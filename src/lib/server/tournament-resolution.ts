// Tournaments (GAMEPLAY_FLOWS.md, F4).
//
// Register until the closing time → the draw (players ranked by XP into pots,
// one from each pot per group of 5, bots fill empty seats) → each group races
// on the group-stage track → winners (top 2 when there are only 1–2 groups,
// so the final has at least 4 cars) race a final on a marquee track → Gears
// prizes, and the entry-fee pot, go to the best-placed humans. Bots can win;
// prizes skip them.
//
// A stage is a `lobbies` row (tournamentId + tournamentStage). Nothing here
// runs on a timer: `sweepTournaments` acts on whatever is due, and is called
// from the tournament pages, the race page and the daily cron — the same lazy
// pattern contest resolution uses.
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	cars,
	lineupPicks,
	lineups,
	lobbies,
	lobbyParticipants,
	tournamentEntries,
	tournaments,
	users
} from '$lib/server/schema';
import { SCRIMMAGE_BOTS, draftBotLineup } from '$lib/server/botDraft';
import { getAllPrices } from '$lib/server/prices';
import { grantGears, mintCar, spendGears } from '$lib/server/cars';
import { resolveLobby } from '$lib/server/lobby-resolution';
import { personalityOf, type DraftStyle } from '$lib/bots/personalities';
import { SHOWROOM_MODELS, type Rarity } from '$lib/economy/rules';
import { countAdViews } from '$lib/server/sponsors';

export const QUALIFIER_STAGE = 0;
export const FINAL_STAGE = 1;
export const GROUP_SIZE = 5;
/** After the draw (or the final is set), players get this long to draft before auto-draft. */
export const DRAFT_WINDOW_MS = 5 * 60_000;
/** Same pre-race grid moment as 1v1 races. */
const PRE_RACE_MS = 10_000;
export const DEFAULT_PRIZES = [1000, 400, 200];
/** Player-made tournaments pay game prizes only with this many human entrants. */
export const MIN_HUMANS_FOR_PRIZES = 4;
/** How the entry-fee pot splits across the top 3 humans. */
export const POT_SPLIT = [0.5, 0.3, 0.2];
const CUPS_LOCK = 734_400;

type Tournament = typeof tournaments.$inferSelect;
type Lobby = typeof lobbies.$inferSelect;

const isBotWallet = (w: string | null | undefined) => Boolean(w?.startsWith('seed:'));

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// ── Registration ────────────────────────────────────────────────────────────

export async function joinTournament(tournamentId: string, userId: string) {
	const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
	if (!t) return { error: 'not_found' as const };
	if (t.status !== 'open') return { error: 'closed' as const };
	if (t.registrationClosesAt && Date.now() >= new Date(t.registrationClosesAt).getTime()) {
		await evaluateTournament(t);
		return { error: 'closed' as const };
	}
	const [existing] = await db
		.select({ id: tournamentEntries.id })
		.from(tournamentEntries)
		.where(
			and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.userId, userId))
		);
	if (existing) return { joined: true, alreadyJoined: true };

	const fee = t.entryFee ?? 0;
	if (fee > 0) {
		try {
			await spendGears(userId, fee, `entry: ${t.name}`);
		} catch {
			return { error: 'not_enough_gears' as const };
		}
	}
	const inserted = await db
		.insert(tournamentEntries)
		.values({ tournamentId, userId, feePaid: fee })
		.onConflictDoNothing()
		.returning({ id: tournamentEntries.id });
	// Lost a double-click race: the other request already registered (and charged).
	if (!inserted.length && fee > 0) await grantGears(userId, fee, `entry refund: ${t.name}`);
	return { joined: true };
}

export async function entrantCount(tournamentId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(tournamentEntries)
		.where(eq(tournamentEntries.tournamentId, tournamentId));
	return row?.n ?? 0;
}

// ── Close: the draw, or cancel ──────────────────────────────────────────────

/** Acts on a tournament whose closing time has passed: runs the draw, or cancels if nobody came. */
export async function evaluateTournament(t: Tournament) {
	if (t.status !== 'open') return { ok: false as const, outcome: 'not_open' as const };
	if (!t.registrationClosesAt || Date.now() < new Date(t.registrationClosesAt).getTime()) {
		return { ok: false as const, outcome: 'still_open' as const };
	}
	return (await entrantCount(t.id)) > 0 ? runDraw(t.id) : cancelTournament(t.id);
}

/** Creator-only "everyone's here, start now". */
export async function closeRegistration(tournamentId: string, userId: string) {
	const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
	if (!t) return { error: 'not_found' as const };
	if (t.createdBy !== userId) return { error: 'forbidden' as const };
	if (t.status !== 'open') return { error: 'already_closed' as const };
	if ((await entrantCount(tournamentId)) === 0)
		return { error: 'not_enough_players' as const, joined: 0, minimum: 1 };
	return runDraw(tournamentId);
}

async function cancelTournament(tournamentId: string) {
	const [claimed] = await db
		.update(tournaments)
		.set({ status: 'cancelled' })
		.where(and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'open')))
		.returning();
	if (!claimed) return { ok: false as const, outcome: 'not_open' as const };
	const paid = await db
		.select()
		.from(tournamentEntries)
		.where(eq(tournamentEntries.tournamentId, tournamentId));
	for (const e of paid) {
		if (e.feePaid > 0) await grantGears(e.userId, e.feePaid, `entry refund: ${claimed.name}`);
	}
	return { ok: true as const, outcome: 'cancelled' as const };
}

/**
 * The draw. Players ranked by XP are cut into pots (Pot 1 = strongest), each
 * the size of the number of groups; every group gets one player from each pot.
 * Empty seats go to bots. Claims open → active first, so it runs once.
 */
export async function runDraw(tournamentId: string) {
	const now = new Date();
	const [t] = await db
		.update(tournaments)
		.set({ status: 'active', drawnAt: now, groupSize: GROUP_SIZE })
		.where(and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'open')))
		.returning();
	if (!t) return { ok: false as const, outcome: 'not_open' as const };

	const entrants = await db
		.select({ id: tournamentEntries.id, userId: tournamentEntries.userId, xp: users.xpTotal })
		.from(tournamentEntries)
		.innerJoin(users, eq(users.id, tournamentEntries.userId))
		.where(eq(tournamentEntries.tournamentId, tournamentId))
		.orderBy(desc(users.xpTotal), asc(tournamentEntries.joinedAt));

	const groupCount = Math.max(1, Math.ceil(entrants.length / GROUP_SIZE));
	const groups: string[][] = Array.from({ length: groupCount }, () => []);
	for (let pot = 0; pot * groupCount < entrants.length; pot++) {
		const members = shuffle(entrants.slice(pot * groupCount, (pot + 1) * groupCount));
		// Spread a short last pot over random groups, not always the first ones.
		const slots = shuffle(groups.map((_g, i) => i)).slice(0, members.length);
		for (let k = 0; k < members.length; k++) {
			groups[slots[k]].push(members[k].userId);
			await db
				.update(tournamentEntries)
				.set({ pot: pot + 1, groupNo: slots[k] + 1 })
				.where(eq(tournamentEntries.id, members[k].id));
		}
	}

	// Bots fill each group to 5, spread so the same bot isn't in every group
	// while there are enough to go round.
	let bots = shuffle([...SCRIMMAGE_BOTS]);
	for (const humans of groups) {
		const seats = humans.map((userId) => ({ userId, bot: null as string | null }));
		while (seats.length < GROUP_SIZE) {
			if (!bots.length) bots = shuffle([...SCRIMMAGE_BOTS]);
			const bot = bots.shift()!;
			if (seats.some((s) => s.userId === bot.id)) continue;
			seats.push({ userId: bot.id, bot: bot.username });
		}
		await createStage(t, QUALIFIER_STAGE, seats);
	}
	return { ok: true as const, outcome: 'started' as const, groups: groupCount };
}

/** A group or final: the lobby, its seats, and the bots' lineups (drafted on the spot). */
async function createStage(
	t: Tournament,
	stage: number,
	seats: { userId: string; bot: string | null }[]
) {
	const [lobby] = await db
		.insert(lobbies)
		.values({
			createdBy: t.createdBy,
			contestType: t.contestType,
			format: 'fixed',
			size: seats.length,
			status: 'drafting',
			tournamentId: t.id,
			tournamentStage: stage,
			durationMinutes: t.durationMinutes ?? 15,
			circuit: stage === FINAL_STAGE ? t.finalTrack : t.groupTrack,
			draftClosesAt: new Date(Date.now() + DRAFT_WINDOW_MS)
		})
		.returning();
	await db
		.insert(lobbyParticipants)
		.values(seats.map((s) => ({ lobbyId: lobby.id, userId: s.userId })));
	for (const s of seats) {
		if (s.bot) await autoDraft(lobby.id, s.userId, personalityOf(s.bot).draft);
	}
	return lobby;
}

/**
 * Drafts and locks a lineup for a bot, or for a player who didn't draft in
 * time (F4: "races with an auto-drafted lineup"). Priced from the same batch
 * the human lineups use.
 */
export async function autoDraft(lobbyId: string, userId: string, style: DraftStyle) {
	const picks = await draftBotLineup(style);
	if (picks.length !== 5) throw new Error('Auto-draft returned an incomplete lineup');
	const fresh = await getAllPrices().catch(() => null);
	const [car] = await db
		.select({ id: cars.id })
		.from(cars)
		.where(and(eq(cars.ownerId, userId), sql`${cars.stakedInRace} is null`))
		.orderBy(sql`random()`)
		.limit(1);
	const [lineup] = await db
		.insert(lineups)
		.values({ lobbyId, userId, locked: true, finalScore: '0', carId: car?.id ?? null })
		.returning({ id: lineups.id });
	await db.insert(lineupPicks).values(
		picks.map((p) => {
			const entry = fresh?.get(p.symbol.toUpperCase())?.price ?? p.price ?? 0;
			return {
				lineupId: lineup.id,
				tokenSymbol: p.symbol.toUpperCase(),
				tokenName: p.name,
				sector: p.sector,
				currencyId: p.currencyId,
				entryPrice: String(entry),
				exitPrice: String(entry),
				pctChange: '0',
				score: '0'
			};
		})
	);
}

/**
 * Starts a stage's race once everyone has a lineup, or once the draft deadline
 * passes (auto-drafting whoever hasn't). Safe to call any time.
 */
export async function kickOffIfReady(lobby: Lobby) {
	if (lobby.status !== 'drafting') return false;
	const seats = await db
		.select({ userId: lobbyParticipants.userId })
		.from(lobbyParticipants)
		.where(eq(lobbyParticipants.lobbyId, lobby.id));
	const drafted = new Set(
		(
			await db
				.select({ userId: lineups.userId })
				.from(lineups)
				.where(and(eq(lineups.lobbyId, lobby.id), eq(lineups.locked, true)))
		).map((l) => l.userId)
	);
	const missing = seats.map((s) => s.userId!).filter((id) => !drafted.has(id));
	const deadlinePassed = lobby.draftClosesAt
		? Date.now() >= new Date(lobby.draftClosesAt).getTime()
		: false;
	if (missing.length && !deadlinePassed) return false;
	for (const userId of missing) await autoDraft(lobby.id, userId, 'steady');

	const startAt = new Date(Date.now() + PRE_RACE_MS);
	const endAt = new Date(startAt.getTime() + (lobby.durationMinutes ?? 15) * 60_000);
	const [started] = await db
		.update(lobbies)
		.set({ status: 'live', startAt, endAt })
		.where(and(eq(lobbies.id, lobby.id), eq(lobbies.status, 'drafting')))
		.returning({ id: lobbies.id });
	// Every driver on the grid sees the circuit's trackside ads.
	if (started) await countAdViews(lobby.circuit, seats.length);
	return Boolean(started);
}

// ── Advancing and the final ─────────────────────────────────────────────────

/** Called by resolveLobby() right after it resolves a tournament stage. */
export async function onLobbyResolved(lobby: {
	id: string;
	tournamentId: string | null;
	tournamentStage: number | null;
}) {
	if (!lobby.tournamentId) return;
	const [t] = await db.select().from(tournaments).where(eq(tournaments.id, lobby.tournamentId));
	if (!t || t.status !== 'active') return;

	if (lobby.tournamentStage === FINAL_STAGE) {
		await finishTournament(t, lobby.id);
		return;
	}

	const groups = await db
		.select()
		.from(lobbies)
		.where(and(eq(lobbies.tournamentId, t.id), eq(lobbies.tournamentStage, QUALIFIER_STAGE)));
	if (groups.some((g) => g.status !== 'resolved')) return; // the final waits for the last group

	// The final is created once: whichever group finishes last gets here, and a
	// second arrival finds it already there.
	const [existingFinal] = await db
		.select({ id: lobbies.id })
		.from(lobbies)
		.where(and(eq(lobbies.tournamentId, t.id), eq(lobbies.tournamentStage, FINAL_STAGE)));
	if (existingFinal) return;

	// Group winners advance; with only 1–2 groups, enough per group for a final of at least 4.
	const perGroup = groups.length >= 3 ? 1 : Math.ceil(4 / groups.length);
	const advancers: { userId: string; bot: string | null }[] = [];
	for (const g of groups) {
		const ranked = await db
			.select({
				userId: lobbyParticipants.userId,
				username: users.username,
				wallet: users.walletAddress
			})
			.from(lobbyParticipants)
			.innerJoin(users, eq(users.id, lobbyParticipants.userId))
			.where(eq(lobbyParticipants.lobbyId, g.id))
			.orderBy(asc(lobbyParticipants.rank));
		let taken = 0;
		for (const r of ranked) {
			if (taken >= perGroup) break;
			// The same bot can win two groups; it only gets one seat in the final.
			if (advancers.some((a) => a.userId === r.userId)) continue;
			advancers.push({ userId: r.userId!, bot: isBotWallet(r.wallet) ? r.username : null });
			taken++;
		}
	}
	if (advancers.length < 2) {
		await finishTournament(t, null);
		return;
	}
	await createStage(t, FINAL_STAGE, advancers);
}

/**
 * Prizes go to the best-placed humans: finalists in finishing order first,
 * then everyone else by their group placing. 1st–3rd get the game's Gears
 * prizes plus their share of the entry pot; the winner also gets the car prize.
 */
async function finishTournament(t: Tournament, finalLobbyId: string | null) {
	const [claimed] = await db
		.update(tournaments)
		.set({ status: 'resolved' })
		.where(and(eq(tournaments.id, t.id), eq(tournaments.status, 'active')))
		.returning();
	if (!claimed) return;

	const stages = await db
		.select({
			stage: lobbies.tournamentStage,
			userId: lobbyParticipants.userId,
			rank: lobbyParticipants.rank,
			username: users.username,
			wallet: users.walletAddress
		})
		.from(lobbyParticipants)
		.innerJoin(lobbies, eq(lobbies.id, lobbyParticipants.lobbyId))
		.innerJoin(users, eq(users.id, lobbyParticipants.userId))
		.where(eq(lobbies.tournamentId, t.id));

	const humans = stages.filter((s) => !isBotWallet(s.wallet));
	const finalists = humans
		.filter((s) => finalLobbyId && s.stage === FINAL_STAGE)
		.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
	const rest = humans
		.filter((s) => s.stage === QUALIFIER_STAGE && !finalists.some((f) => f.userId === s.userId))
		.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
	const order = [...finalists, ...rest];

	const entries = await db
		.select({ fee: tournamentEntries.feePaid })
		.from(tournamentEntries)
		.where(eq(tournamentEntries.tournamentId, t.id));
	const pot = entries.reduce((sum, e) => sum + e.fee, 0);
	// Game prizes on a player-made tournament need a real field: otherwise one
	// player could create tournaments alone, let bots fill the seats, and farm
	// Gears. The scheduled cups always pay; the entry pot always pays.
	const humanCount = new Set(humans.map((h) => h.userId)).size;
	const prizes =
		t.cup || humanCount >= MIN_HUMANS_FOR_PRIZES
			? ((t.prizes as number[] | null) ?? DEFAULT_PRIZES)
			: [0, 0, 0];

	const results: NonNullable<Tournament['results']> = [];
	for (let i = 0; i < order.length; i++) {
		const p = order[i];
		const gears = i < 3 ? (prizes[i] ?? 0) + Math.floor(pot * (POT_SPLIT[i] ?? 0)) : 0;
		let car: string | undefined;
		if (gears > 0) await grantGears(p.userId!, gears, `${t.name}: place ${i + 1}`);
		if (i === 0 && t.carPrize && t.carPrize in SHOWROOM_MODELS) {
			const rarity = t.carPrize as Rarity;
			const models = SHOWROOM_MODELS[rarity];
			const model = models[Math.floor(Math.random() * models.length)];
			await mintCar(p.userId!, model, rarity, 'prize');
			car = `${rarity} ${model}`;
		}
		results.push({ userId: p.userId!, username: p.username, place: i + 1, gears, car });
	}
	await db.update(tournaments).set({ results }).where(eq(tournaments.id, t.id));
}

// ── Scheduled cups ──────────────────────────────────────────────────────────

/** Next occurrence (UTC) of `hour`:00 on one of `days` (0 = Sunday), strictly in the future. */
function nextAt(hour: number, days: number[]): Date {
	const d = new Date();
	d.setUTCMinutes(0, 0, 0);
	d.setUTCHours(hour);
	while (d.getTime() <= Date.now() || !days.includes(d.getUTCDay())) {
		d.setUTCDate(d.getUTCDate() + 1);
	}
	return d;
}

export const CUPS = [
	{
		cup: 'daily-monza',
		name: 'Daily Monza Cup',
		closes: () => nextAt(18, [0, 1, 2, 3, 4, 5, 6]),
		durationMinutes: 15,
		groupTrack: 'monza',
		finalTrack: 'suzuka',
		prizes: [500, 250, 100],
		carPrize: null
	},
	{
		cup: 'weekend-spa',
		name: 'Weekend Spa Classic',
		closes: () => nextAt(17, [6]),
		durationMinutes: 60,
		groupTrack: 'interlagos',
		finalTrack: 'spa',
		prizes: [1500, 600, 300],
		carPrize: 'Rare'
	}
] as const;

/** Keeps one open entry of each scheduled cup, so there's always something to join. */
export async function ensureCups() {
	await db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(${CUPS_LOCK})`);
		const open = await tx
			.select({ cup: tournaments.cup })
			.from(tournaments)
			.where(
				and(
					eq(tournaments.status, 'open'),
					inArray(
						tournaments.cup,
						CUPS.map((c) => c.cup)
					)
				)
			);
		for (const c of CUPS) {
			if (open.some((o) => o.cup === c.cup)) continue;
			await tx.insert(tournaments).values({
				name: c.name,
				cup: c.cup,
				accessType: 'public',
				fundingMode: 'free',
				groupSize: GROUP_SIZE,
				minPlayers: 1,
				isAutoCreated: true,
				durationMinutes: c.durationMinutes,
				groupTrack: c.groupTrack,
				finalTrack: c.finalTrack,
				prizes: [...c.prizes],
				carPrize: c.carPrize,
				registrationClosesAt: c.closes(),
				status: 'open'
			});
		}
	});
}

// ── The sweep ───────────────────────────────────────────────────────────────

/** Does whatever is due: cups, closes, kick-offs and resolutions. Idempotent. */
export async function sweepTournaments() {
	const now = new Date();
	await ensureCups().catch((e) => console.error('[tournaments] cups failed:', e));

	const closing = await db
		.select()
		.from(tournaments)
		.where(and(eq(tournaments.status, 'open'), lte(tournaments.registrationClosesAt, now)));
	for (const t of closing) {
		await evaluateTournament(t).catch((e) => console.error('[tournaments] close failed:', e));
	}

	const stages = await db
		.select()
		.from(lobbies)
		.where(
			and(sql`${lobbies.tournamentId} is not null`, inArray(lobbies.status, ['drafting', 'live']))
		);
	for (const l of stages) {
		try {
			if (l.status === 'drafting') await kickOffIfReady(l);
			else if (l.endAt && new Date(l.endAt) <= now) await resolveLobby(l.id);
		} catch (e) {
			console.error(`[tournaments] stage ${l.id} failed:`, e);
		}
	}
	return { closed: closing.length, stages: stages.length };
}
