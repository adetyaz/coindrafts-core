import { json } from '@sveltejs/kit';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cars, contests, lineups, lineupPicks, users } from '$lib/server/schema';
import { CIRCUITS } from '$lib/race/circuits';
import { parseSessionToken } from '$lib/server/auth';
import { getSnapshot, extractPrice, getTokensWithPrices } from '$lib/server/sosovalue';
import { getAllPrices } from '$lib/server/prices';
import { pickScrimmageBot, draftBotLineup } from '$lib/server/botDraft';
import { personalityOf } from '$lib/bots/personalities';
import { DEFAULT_DURATION_MINUTES } from '$lib/constants';
import { stakedCars } from '$lib/server/carRace';
import { binaryBotCalls } from '$lib/server/botDraft';
import { BINARY_SOLO, BINARY_VERSUS, isBinaryMode, isCall } from '$lib/race/binary';
import { ItemError, getInventory, lockItem } from '$lib/server/items';
import { ITEMS, isItemKind, type LineupItem } from '$lib/race/items';

// The race starts this long after both lineups lock, so the pre-race screen
// (cars on the grid, driver cards, start lights) has its own time instead of
// eating into the race.
const PRE_RACE_MS = 10_000;

export async function POST({ params, request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const contestId = params.id;
	if (!contestId) return json({ error: 'Contest id is required' }, { status: 400 });

	const body = await request.json();
	const picks = Array.isArray(body?.picks) ? body.picks : [];
	if (picks.length !== 5) {
		return json({ error: 'Exactly 5 picks are required' }, { status: 400 });
	}

	// Car and circuit from the race setup steps. Both are cosmetic, so a bad
	// value is ignored rather than failing the lock.
	const circuitId: string | null = CIRCUITS.some((c) => c.id === body?.circuit)
		? body.circuit
		: null;
	let carId: string | null = null;
	if (typeof body?.carId === 'string') {
		const [car] = await db
			.select({ id: cars.id, ownerId: cars.ownerId, stakedInRace: cars.stakedInRace })
			.from(cars)
			.where(eq(cars.id, body.carId));
		if (
			car &&
			car.ownerId === parsed.userId &&
			(!car.stakedInRace || car.stakedInRace === contestId)
		)
			carId = car.id;
	}
	// Car race: you race the car you staked, whatever the car step said.
	const staked = await stakedCars(contestId);
	const myStake = staked.find((c) => c.ownerId === parsed.userId);
	if (myStake) carId = myStake.id;

	// Nitro or pit-stop item (GAMEPLAY_FLOWS.md, F8): one per race, aimed at a
	// sector or coin in this lineup. Checked before anything is written, so a
	// bad item never leaves a half-locked lineup.
	let item: LineupItem | null = null;
	const rawKind: unknown = body?.item?.kind;
	if (isItemKind(rawKind)) {
		const kind = rawKind;
		const target = ITEMS[kind].target;
		item = { kind };
		if (target === 'sector') {
			const sector = String(body.item.sector ?? '');
			if (!picks.some((p: { sector?: string }) => p.sector === sector))
				return json({ error: 'Pick a sector from your lineup for the Nitro' }, { status: 400 });
			item.sector = sector;
		}
		if (target === 'coin') {
			const symbol = String(body.item.symbol ?? '').toUpperCase();
			if (!picks.some((p: { symbol?: string }) => String(p.symbol).toUpperCase() === symbol))
				return json({ error: 'Pick a coin from your lineup for the Turbo' }, { status: 400 });
			item.symbol = symbol;
		}
		const inv = await getInventory(parsed.userId);
		if (!inv.owned[kind])
			return json({ error: `You don't have a ${ITEMS[kind].label}` }, { status: 409 });
		if (inv.usedThisWeek >= inv.weeklyCap)
			return json({ error: `You've used ${inv.weeklyCap} items this week.` }, { status: 409 });
	}

	const existingContest = await db
		.select()
		.from(contests)
		.where(eq(contests.id, contestId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!existingContest) return json({ error: 'Contest not found' }, { status: 404 });
	if (existingContest.userAId !== parsed.userId && existingContest.userBId !== parsed.userId) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	// Once the contest is live, a "re-lock" isn't a re-lock — it's a redraft
	// mid-race, silently overwriting the entry prices scoring already keyed
	// off. Re-locking while still 'open' (contest not started yet, or waiting
	// on the opponent) is fine — nothing has been scored against it yet.
	if (existingContest.status === 'live') {
		return json(
			{ error: 'This contest is already live — your lineup is locked in.' },
			{ status: 409 }
		);
	}

	// Binary mode (F9): any 5 different coins, each called up or down. No items.
	const binary = isBinaryMode(existingContest.mode);
	if (binary) {
		const ids = picks.map((p: { currencyId?: unknown }) => String(p.currencyId));
		if (new Set(ids).size !== ids.length)
			return json({ error: 'Pick 5 different coins' }, { status: 400 });
		if (!picks.every((p: { call?: unknown }) => isCall(p.call)))
			return json({ error: 'Call every coin up or down' }, { status: 400 });
		item = null;
	}

	const existingLineup = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, parsed.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	// ── Price FIRST, write second ────────────────────────────────────────────
	// Order matters, and getting it wrong corrupted real games. This used to
	// mark the lineup `locked` and DELETE its picks up front, then fetch prices,
	// then write the picks back. Any failure in the fetch left a lineup flagged
	// locked and holding nothing — permanently, since a re-lock is refused once
	// the contest goes live. That is exactly how contest 352fc4db ended up with
	// a player who had zero picks, scored 0, and lost a match they never played;
	// the trigger was getTokensWithPrices() throwing on production for weeks
	// (Binance geo-blocks the API from US regions, see src/lib/server/prices.ts).
	//
	// Nothing below touches the database until every pick has a price in hand.
	//
	// Priced from the same batch pool the draft screen itself is built from —
	// one cached call, not five parallel single-token requests. That per-token
	// burst (here and in the bot path below) was the actual cause of entry
	// prices silently landing on $0 under any rate-limit blip: extractPrice()
	// treats a failed fetch as "$0", not "unknown", and a $0 entry gets
	// filtered out of the race chart client-side, making it read as blank.
	//
	// Entry is locked from the same 10s batch that prices the exit at
	// resolution (contest-resolution.ts). The token pool above it is cached for
	// 60s, which is fine for a 24h race but in a 1-minute sprint would measure
	// partly the minute *before* the race. The pool is the fallback.
	const fresh = await getAllPrices().catch(() => null);
	const priceByCurrency = new Map(
		(await getTokensWithPrices()).map((t) => [t.currency_id, t.price])
	);
	async function priceFor(currencyId: string, symbol: string): Promise<number> {
		const live = fresh?.get(symbol.toUpperCase())?.price;
		if (live != null && live > 0) return live;
		const cached = priceByCurrency.get(currencyId);
		if (cached != null && cached > 0) return cached;
		// Rare fallback — a token that's dropped out of the pool since the user
		// drafted it. Single-token lookup is fine as a one-off, just not as a burst.
		try {
			return extractPrice(await getSnapshot(currencyId));
		} catch {
			return 0;
		}
	}

	const pickRows: {
		tokenSymbol: string;
		tokenName: string;
		sector: string;
		currencyId: string;
		entryPrice: string;
		exitPrice: string;
		pctChange: string;
		score: string;
		call: string | null;
	}[] = [];
	for (const pick of picks) {
		const entryPrice = await priceFor(String(pick.currencyId), String(pick.symbol ?? ''));
		pickRows.push({
			tokenSymbol: String(pick.symbol ?? '').toUpperCase(),
			tokenName: String(pick.name ?? pick.symbol ?? ''),
			sector: String(pick.sector ?? 'wildcard'),
			currencyId: String(pick.currencyId),
			entryPrice: String(entryPrice),
			exitPrice: String(entryPrice),
			pctChange: '0',
			score: '0',
			call: binary ? String(pick.call) : null
		});
	}

	// ── Then write it all, atomically ────────────────────────────────────────
	// Wrapped in a transaction so the lock, the clearing of any previous picks
	// and the new picks land together or not at all. Without it, a failure
	// between the delete and the inserts leaves the same empty-locked-lineup
	// state the reordering above is meant to prevent.
	let lineupId: string;
	await db.transaction(async (tx) => {
		if (!existingLineup?.id) {
			const inserted = await tx
				.insert(lineups)
				.values({ contestId, userId: parsed.userId, locked: true, finalScore: '0', carId })
				.returning({ id: lineups.id });
			lineupId = inserted[0].id;
		} else {
			lineupId = existingLineup.id;
			await tx.update(lineups).set({ locked: true, carId }).where(eq(lineups.id, lineupId));
			await tx.delete(lineupPicks).where(eq(lineupPicks.lineupId, lineupId));
		}
		await tx.insert(lineupPicks).values(pickRows.map((r) => ({ ...r, lineupId })));
		// The car you race is the one pre-selected next time.
		if (carId) await tx.update(users).set({ lastCarId: carId }).where(eq(users.id, parsed.userId));
		// First to choose sets the circuit. (Versus: the rock-paper-scissors
		// tiebreak decides when two choices differ — GAMEPLAY_FLOWS.md, F2.)
		if (circuitId) {
			await tx
				.update(contests)
				.set({ circuit: circuitId })
				.where(and(eq(contests.id, contestId), isNull(contests.circuit)));
		}
	});
	lineupId = lineupId!;

	try {
		await lockItem(parsed.userId, contestId, lineupId, item);
	} catch (e) {
		// The lineup itself is saved; only the item didn't go on.
		if (e instanceof ItemError) return json({ error: e.message, lineupId }, { status: 409 });
		throw e;
	}

	// Scrimmage contests are created directly (never via matchmaking_queue), so
	// bots-service never sees them. Assign a real bot opponent right here, the
	// moment the human submits — same instant the human's entry prices are
	// captured, so both sides reflect the same market moment.
	//
	// This used to swallow a failure here and mark the contest live anyway, on
	// the assumption that resolution had a fallback for a missing bot lineup.
	// It doesn't — a missing userBId makes resolution skip scoring entirely and
	// record the human as the loser of a game that never had an opponent. So
	// this now retries once, and refuses to start the game at all rather than
	// start it broken. Priced from `botPicks[i].price`, carried straight from
	// draftBotLineup's own batch fetch — no separate per-token price burst here.
	// Car races against a bot work the same way, except the bot was chosen
	// (and its car staked) when the race was set up.
	const carRaceBot =
		staked.length > 0 && existingContest.userBId && existingContest.userBId !== parsed.userId
			? await db
					.select({ id: users.id, username: users.username, wallet: users.walletAddress })
					.from(users)
					.where(eq(users.id, existingContest.userBId))
					.then((r) => (r[0]?.wallet.startsWith('seed:') ? r[0] : null))
			: null;
	const botHasLineup = carRaceBot
		? await db
				.select({ id: lineups.id })
				.from(lineups)
				.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, carRaceBot.id)))
				.then((r) => r.length > 0)
		: true;
	// Solo binary races the market, not a bot. Binary Versus gets a bot that
	// makes its own calls.
	const needsBot =
		existingContest.mode === BINARY_SOLO
			? false
			: (existingContest.isPaper && !existingContest.userBId) ||
				(existingContest.mode === BINARY_VERSUS && !existingContest.userBId) ||
				!botHasLineup;
	if (needsBot) {
		let botReady = false;
		for (let attempt = 0; attempt < 2 && !botReady; attempt++) {
			try {
				const bot = carRaceBot ?? pickScrimmageBot();
				const style = personalityOf(bot.username).draft;
				const botPicks:
					| Awaited<ReturnType<typeof binaryBotCalls>>
					| Awaited<ReturnType<typeof draftBotLineup>> = binary
					? await binaryBotCalls(style)
					: await draftBotLineup(style);
				if (botPicks.length !== 5) throw new Error('Bot draft returned an incomplete lineup');

				const [botLineup] = await db
					.insert(lineups)
					.values({
						contestId,
						userId: bot.id,
						locked: true,
						finalScore: '0',
						// The bot races its staked car, or one of its own cars.
						carId:
							staked.find((c) => c.ownerId === bot.id)?.id ??
							(await db
								.select({ id: cars.id })
								.from(cars)
								.where(and(eq(cars.ownerId, bot.id), isNull(cars.stakedInRace)))
								.orderBy(sql`random()`)
								.limit(1)
								.then((r) => r[0]?.id ?? null))
					})
					.returning({ id: lineups.id });

				for (const p of botPicks) {
					// Same fresh batch as the player's entry, so both sides start from
					// prices taken at the same moment.
					const entryPrice = fresh?.get(p.symbol.toUpperCase())?.price ?? p.price ?? 0;
					await db.insert(lineupPicks).values({
						lineupId: botLineup.id,
						tokenSymbol: p.symbol.toUpperCase(),
						tokenName: p.name,
						sector: p.sector,
						currencyId: p.currencyId,
						entryPrice: String(entryPrice),
						exitPrice: String(entryPrice),
						pctChange: '0',
						score: '0',
						call: 'call' in p ? String(p.call) : null
					});
				}

				await db.update(contests).set({ userBId: bot.id }).where(eq(contests.id, contestId));
				botReady = true;
			} catch (e) {
				console.error(`[contest/lineup] Scrimmage bot draft failed (attempt ${attempt + 1}/2):`, e);
			}
		}

		if (!botReady) {
			// The human's own lineup is already saved (locked:true, above) —
			// retrying this same request will find it and just re-lock picks,
			// so nothing is lost by bailing out here.
			return json(
				{
					error: "Couldn't set up your opponent — please try locking your lineup again."
				},
				{ status: 503 }
			);
		}
	}

	// Start the clock only once BOTH sides have actually locked a lineup — never
	// on the first submission alone. It used to go live the instant userA (the
	// creator) submitted, so userB's entire draft time was silently eaten by a
	// timer they didn't know was already running, and a slow userB's game could
	// resolve before they'd ever picked. Refetch first: the scrimmage block
	// above may have just set userBId on this same request.
	const contestNow = await db
		.select()
		.from(contests)
		.where(eq(contests.id, contestId))
		.limit(1)
		.then((rows) => rows[0]!);

	if (contestNow.status !== 'live') {
		const otherUserId =
			contestNow.userAId === parsed.userId ? contestNow.userBId : contestNow.userAId;
		// Requires actual PICKS, not merely a lineup row. Checking only for the
		// row let a half-written lineup count as "ready", so the contest would go
		// live with one player holding nothing — they'd score 0 and lose a match
		// they never played. The transaction above should prevent that state
		// arising at all now; this is the second line of defence, and it also
		// covers rows already corrupted before the fix.
		const otherLineupReady = otherUserId
			? await db
					.select({ id: lineupPicks.id })
					.from(lineupPicks)
					.innerJoin(lineups, eq(lineups.id, lineupPicks.lineupId))
					.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, otherUserId)))
					.limit(1)
					.then((rows) => rows.length > 0)
			: false;

		// Solo binary: there's no one else to wait for.
		if (otherLineupReady || (contestNow.mode === BINARY_SOLO && !contestNow.userBId)) {
			const durationMinutes = contestNow.durationMinutes ?? DEFAULT_DURATION_MINUTES;
			const startAt = new Date(Date.now() + PRE_RACE_MS);
			const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
			await db
				.update(contests)
				.set({ status: 'live', startAt, endAt })
				.where(eq(contests.id, contestId));
		}
	}

	return json({ ok: true, contestId, lineupId });
}
