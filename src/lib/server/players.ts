// Me, player cards and bot cards (GAMEPLAY_FLOWS.md, F6), and Versus
// challenges sent from a card.
import { and, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	carEvents,
	carListings,
	cars,
	challenges,
	contests,
	lineupPicks,
	lineups,
	lobbies,
	lobbyParticipants,
	userBadges,
	users
} from '$lib/server/schema';
import { headToHead } from '$lib/server/wager';
import { botRival } from '$lib/server/rivalry';
import { SCRIMMAGE_BOTS } from '$lib/server/botDraft';
import { personalityOf } from '$lib/bots/personalities';
import { BADGES } from '$lib/badges';
import { normalizeDuration } from '$lib/constants';
import { notify } from '$lib/server/notify';

const UUID = /^[0-9a-f-]{36}$/i;
const isBotWallet = (w: string | null | undefined) => Boolean(w?.startsWith('seed:'));

export async function findUser(idOrName: string) {
	const [u] = await db
		.select()
		.from(users)
		.where(UUID.test(idOrName) ? eq(users.id, idOrName) : eq(users.username, idOrName));
	return u ?? null;
}

/** Races, wins, podiums and best sector, across Versus races and multi-car grids. Scrimmage excluded. */
export async function playerStats(userId: string) {
	const duels = await db
		.select({ winnerId: contests.winnerId })
		.from(contests)
		.where(
			and(
				eq(contests.status, 'resolved'),
				eq(contests.isPaper, false),
				or(eq(contests.userAId, userId), eq(contests.userBId, userId))
			)
		);
	const grids = await db
		.select({ rank: lobbyParticipants.rank })
		.from(lobbyParticipants)
		.innerJoin(lobbies, eq(lobbies.id, lobbyParticipants.lobbyId))
		.where(and(eq(lobbyParticipants.userId, userId), eq(lobbies.status, 'resolved')));
	const duelWins = duels.filter((d) => d.winnerId === userId).length;
	const gridWins = grids.filter((g) => g.rank === 1).length;
	// A podium is a top-3 finish; in a two-car race only the winner counts.
	const podiums = duelWins + grids.filter((g) => (g.rank ?? 99) <= 3).length;

	const sectors = await db
		.select({
			sector: lineupPicks.sector,
			avg: sql<number>`avg(${lineupPicks.pctChange}::numeric)::float`,
			n: sql<number>`count(*)::int`
		})
		.from(lineupPicks)
		.innerJoin(lineups, eq(lineups.id, lineupPicks.lineupId))
		.leftJoin(contests, eq(contests.id, lineups.contestId))
		.leftJoin(lobbies, eq(lobbies.id, lineups.lobbyId))
		.where(
			and(
				eq(lineups.userId, userId),
				or(eq(contests.status, 'resolved'), eq(lobbies.status, 'resolved'))
			)
		)
		.groupBy(lineupPicks.sector);
	const best = sectors.filter((s) => s.n >= 3).sort((a, b) => b.avg - a.avg)[0];

	return {
		races: duels.length + grids.length,
		wins: duelWins + gridWins,
		podiums,
		bestSector: best ? { sector: best.sector, avgPct: Number(best.avg.toFixed(2)) } : null
	};
}

async function showcase(user: typeof users.$inferSelect) {
	let car = null;
	if (user.showcaseCarId) {
		[car] = await db
			.select({ id: cars.id, model: cars.model, rarity: cars.rarity, look: cars.look })
			.from(cars)
			.where(and(eq(cars.id, user.showcaseCarId), eq(cars.ownerId, user.id)));
	}
	if (!car) {
		// No pick (or it was sold): their rarest car.
		const owned = await db
			.select({ id: cars.id, model: cars.model, rarity: cars.rarity, look: cars.look })
			.from(cars)
			.where(eq(cars.ownerId, user.id));
		const order = ['Legendary', 'Epic', 'Rare', 'Common'];
		car = owned.sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))[0] ?? null;
	}
	const earned = await db
		.select({ code: userBadges.badgeCode })
		.from(userBadges)
		.where(eq(userBadges.userId, user.id))
		.orderBy(desc(userBadges.earnedAt));
	const codes = earned.map((e) => e.code);
	const picked = (user.showcaseBadges ?? []).filter((c) => codes.includes(c)).slice(0, 3);
	const shown = (picked.length ? picked : codes.slice(0, 3))
		.map((c) => BADGES.find((b) => b.code === c))
		.filter(Boolean);
	return { car, badges: shown, earnedCodes: codes };
}

/** Bots' moods towards you and your record with each; humans you race most. */
export async function rivals(userId: string) {
	const bots = (
		await Promise.all(
			SCRIMMAGE_BOTS.map(async (b) => {
				const r = await botRival(b.id, userId).catch(() => null);
				return r ? { ...r, id: b.id } : null;
			})
		)
	)
		.filter((r): r is NonNullable<typeof r> => Boolean(r))
		.sort((a, b) => b.record.races - a.record.races);

	const pairs = await db
		.select({ a: contests.userAId, b: contests.userBId })
		.from(contests)
		.where(
			and(
				eq(contests.status, 'resolved'),
				eq(contests.isPaper, false),
				or(eq(contests.userAId, userId), eq(contests.userBId, userId))
			)
		);
	const counts = new Map<string, number>();
	for (const p of pairs) {
		const other = p.a === userId ? p.b : p.a;
		if (other) counts.set(other, (counts.get(other) ?? 0) + 1);
	}
	const botIds = new Set<string>(SCRIMMAGE_BOTS.map((b) => b.id));
	const top = [...counts.entries()]
		.filter(([id]) => !botIds.has(id))
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);
	const names = top.length
		? await db
				.select({ id: users.id, username: users.username, wallet: users.walletAddress })
				.from(users)
				.where(
					inArray(
						users.id,
						top.map(([id]) => id)
					)
				)
		: [];
	const humans = await Promise.all(
		top
			.map(([id, races]) => ({ id, races, user: names.find((n) => n.id === id) }))
			.filter((h) => h.user && !isBotWallet(h.user.wallet))
			.map(async (h) => ({
				id: h.id,
				username: h.user!.username,
				races: h.races,
				record: await headToHead(userId, h.id)
			}))
	);
	return { bots, humans };
}

/** Anyone's card, as seen by `viewerId`. Bots add personality, garage and market moves. */
export async function playerCard(targetIdOrName: string, viewerId: string) {
	const user = await findUser(targetIdOrName);
	if (!user) return null;
	const isBot = isBotWallet(user.walletAddress);
	const [stats, show] = await Promise.all([playerStats(user.id), showcase(user)]);
	const card = {
		id: user.id,
		username: user.username,
		isBot,
		isMe: user.id === viewerId,
		xp: user.xpTotal ?? 0,
		stats,
		car: show.car,
		badges: show.badges,
		headToHead: user.id === viewerId ? null : await headToHead(viewerId, user.id),
		bot: null as null | {
			tagline: string;
			draft: string;
			trade: { askMarkup: number; payTolerance: number };
			mood: string | null;
			gears: number;
			garage: { model: string; rarity: string }[];
			moves: {
				kind: string;
				price: number;
				reason: string | null;
				at: Date | null;
				model: string;
			}[];
		}
	};
	if (!isBot) return card;

	const p = personalityOf(user.username);
	const rival = await botRival(user.id, viewerId).catch(() => null);
	const garage = await db
		.select({ model: cars.model, rarity: cars.rarity })
		.from(cars)
		.where(eq(cars.ownerId, user.id));
	const listed = await db
		.select({
			price: carListings.price,
			reason: carListings.reason,
			status: carListings.status,
			at: carListings.createdAt,
			model: cars.model
		})
		.from(carListings)
		.innerJoin(cars, eq(cars.id, carListings.carId))
		.where(eq(carListings.sellerId, user.id))
		.orderBy(desc(carListings.createdAt))
		.limit(6);
	const bought = await db
		.select({
			price: carListings.price,
			reason: carListings.buyReason,
			at: carListings.closedAt,
			model: cars.model
		})
		.from(carListings)
		.innerJoin(cars, eq(cars.id, carListings.carId))
		.where(and(eq(carListings.buyerId, user.id), eq(carListings.status, 'sold')))
		.orderBy(desc(carListings.closedAt))
		.limit(6);
	const instant = await db
		.select({ price: carEvents.price, at: carEvents.at, model: cars.model })
		.from(carEvents)
		.innerJoin(cars, eq(cars.id, carEvents.carId))
		.where(and(eq(carEvents.kind, 'sell_now'), eq(carEvents.toUserId, user.id)))
		.orderBy(desc(carEvents.at))
		.limit(4);
	const moves = [
		...listed.map((l) => ({
			kind: l.status === 'sold' ? 'sold' : l.status === 'open' ? 'listed' : 'took down',
			price: l.price,
			reason: l.reason,
			at: l.at,
			model: l.model
		})),
		...bought.map((b) => ({
			kind: 'bought',
			price: b.price,
			reason: b.reason,
			at: b.at,
			model: b.model
		})),
		...instant.map((i) => ({
			kind: 'bought (Sell now)',
			price: i.price ?? 0,
			reason: 'Took an instant sale at 80% of the going rate',
			at: i.at,
			model: i.model
		}))
	]
		.sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
		.slice(0, 8);

	card.bot = {
		tagline: p.tagline,
		draft: p.draft,
		trade: p.trade,
		mood: rival?.mood ?? null,
		gears: user.gears,
		garage,
		moves
	};
	return card;
}

// ── Challenges ──────────────────────────────────────────────────────────────

export class ChallengeError extends Error {}
const CHALLENGE_TTL_MS = 24 * 3600_000;
const MAX_PENDING_TO_ONE = 2;

export async function sendChallenge(
	fromUserId: string,
	toUserId: string,
	durationMinutes: number,
	message?: string
) {
	if (fromUserId === toUserId) throw new ChallengeError("You can't challenge yourself");
	const target = await findUser(toUserId);
	if (!target) throw new ChallengeError('Player not found');
	if (isBotWallet(target.walletAddress))
		throw new ChallengeError('Bots race you any time: start a Versus race instead');
	const pending = await db
		.select({ id: challenges.id })
		.from(challenges)
		.where(
			and(
				eq(challenges.fromUserId, fromUserId),
				eq(challenges.toUserId, target.id),
				eq(challenges.status, 'pending'),
				gte(challenges.createdAt, new Date(Date.now() - CHALLENGE_TTL_MS))
			)
		);
	if (pending.length >= MAX_PENDING_TO_ONE)
		throw new ChallengeError('You already have challenges waiting with this player');
	const [c] = await db
		.insert(challenges)
		.values({
			fromUserId,
			toUserId: target.id,
			durationMinutes: normalizeDuration(durationMinutes),
			message: message?.slice(0, 140) || null
		})
		.returning();
	const [from] = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, fromUserId));
	await notify(target.id, 'challenge', {
		title: `${from?.username ?? 'Someone'} challenged you`,
		body: message?.slice(0, 140) || 'A Versus race, on their terms. You have 24 hours.',
		url: '/profile',
		tag: `challenge-${c.id}`
	});
	return c;
}

/** Accepting creates the Versus race; both players then draft as usual. */
export async function respondChallenge(id: string, userId: string, accept: boolean) {
	const [c] = await db.select().from(challenges).where(eq(challenges.id, id));
	if (!c || c.toUserId !== userId) throw new ChallengeError('Challenge not found');
	if (c.status !== 'pending') throw new ChallengeError('That challenge has already been answered');
	if (Date.now() - new Date(c.createdAt).getTime() > CHALLENGE_TTL_MS) {
		await db.update(challenges).set({ status: 'expired' }).where(eq(challenges.id, id));
		throw new ChallengeError('That challenge has expired');
	}
	if (!accept) {
		await db
			.update(challenges)
			.set({ status: 'declined', respondedAt: new Date() })
			.where(and(eq(challenges.id, id), eq(challenges.status, 'pending')));
		return { declined: true };
	}
	// Claim first, so a double tap can't create two races.
	const [claimed] = await db
		.update(challenges)
		.set({ status: 'accepted', respondedAt: new Date() })
		.where(and(eq(challenges.id, id), eq(challenges.status, 'pending')))
		.returning();
	if (!claimed) throw new ChallengeError('That challenge has already been answered');
	const [contest] = await db
		.insert(contests)
		.values({
			userAId: c.fromUserId,
			userBId: c.toUserId,
			type: 'daily',
			isPaper: false,
			durationMinutes: c.durationMinutes,
			status: 'open'
		})
		.returning();
	await db.update(challenges).set({ contestId: contest.id }).where(eq(challenges.id, id));
	return { contestId: contest.id, type: contest.type };
}

/** Challenges to and from me in the last day, with names. */
export async function myChallenges(userId: string) {
	const rows = await db
		.select()
		.from(challenges)
		.where(
			and(
				or(eq(challenges.toUserId, userId), eq(challenges.fromUserId, userId)),
				gte(challenges.createdAt, new Date(Date.now() - CHALLENGE_TTL_MS))
			)
		)
		.orderBy(desc(challenges.createdAt))
		.limit(20);
	const ids = [...new Set(rows.flatMap((r) => [r.fromUserId, r.toUserId]))];
	const names = ids.length
		? await db
				.select({ id: users.id, username: users.username })
				.from(users)
				.where(inArray(users.id, ids))
		: [];
	const name = (id: string) => names.find((n) => n.id === id)?.username ?? 'Player';
	return rows.map((r) => ({
		id: r.id,
		incoming: r.toUserId === userId,
		other: r.toUserId === userId ? name(r.fromUserId) : name(r.toUserId),
		otherId: r.toUserId === userId ? r.fromUserId : r.toUserId,
		durationMinutes: r.durationMinutes,
		message: r.message,
		status: r.status,
		contestId: r.contestId
	}));
}
