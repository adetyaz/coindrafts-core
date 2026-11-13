// "Simulate a week": a week of the bot economy in about a minute, so anyone
// (judges included) can watch it move without waiting seven days.
//
// It replays the last 7 days of real daily price moves from Binance. Each day
// the bots pair off and race: each drafts one coin per sector in its own style
// (reading the previous day's moves, like a player would), and the lineup with
// the bigger total move that day wins. Half the races are car-for-car — the
// winner takes the loser's car through the garage contract's race escrow.
// Winners and losers are paid Gears like a real race, then the bots trade in
// the Car Market. Everything happens to the real bot economy (players' cars and
// Gears are never touched) and replays on NEAR through the outbox.
import { and, eq, inArray, isNull, like } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { carListings, cars, users } from '$lib/server/schema';
import { classifySector } from '$lib/sectors';
import { getTokensWithPrices } from '$lib/server/sosovalue';
import { grantGears, openCarRace, settleCarRace } from '$lib/server/cars';
import { runBotMarket, tierMarkets } from '$lib/server/market';
import { personalityOf, type DraftStyle } from '$lib/bots/personalities';
import { RARITIES, fairPrice, type Rarity } from '$lib/economy/rules';

const KLINES = 'https://data-api.binance.vision/api/v3/klines';
const SECTORS = ['l1', 'l2', 'defi', 'meme', 'wildcard'] as const;
const DAYS = 7;
const CAR_RACE_CHANCE = 0.5;
const PAYOUT = { win: 150, lose: 40 };

type Token = { symbol: string; sector: string; moves: number[] };

export type SimRace = {
	a: string;
	b: string;
	winner: string;
	aMove: number;
	bMove: number;
	picks: { [bot: string]: string[] };
	carWon?: { model: string; rarity: string };
};

export type SimDay = {
	date: string;
	races: SimRace[];
	market: string[];
	prices: { [rarity: string]: number };
};

/** % move per day for each symbol, oldest first: DAYS + 1 days (one to draft from). */
async function dailyMoves(
	symbols: string[]
): Promise<{ dates: string[]; moves: Map<string, number[]> }> {
	const moves = new Map<string, number[]>();
	let dates: string[] = [];
	await Promise.all(
		symbols.map(async (symbol) => {
			try {
				const res = await fetch(`${KLINES}?symbol=${symbol}USDT&interval=1d&limit=${DAYS + 1}`);
				if (!res.ok) return;
				const candles = (await res.json()) as [number, string, string, string, string][];
				if (candles.length < DAYS + 1) return;
				moves.set(
					symbol,
					candles.map((c) => ((Number(c[4]) - Number(c[1])) / Number(c[1])) * 100)
				);
				if (dates.length === 0)
					dates = candles.map((c) => new Date(c[0]).toISOString().slice(0, 10));
			} catch {
				// A symbol Binance doesn't list just sits the week out.
			}
		})
	);
	return { dates, moves };
}

function draft(tokens: Token[], style: DraftStyle, day: number): Token[] {
	const used = new Set<string>();
	const lineup: Token[] = [];
	for (const sector of SECTORS) {
		const pool = tokens.filter((t) => t.sector === sector && !used.has(t.symbol));
		const options = pool.length > 0 ? pool : tokens.filter((t) => !used.has(t.symbol));
		if (options.length === 0) continue;
		// Drafted on what the bot could see: the day before.
		const prior = (t: Token) => t.moves[day - 1];
		// One of the top two by the bot's style, so two bots with the same style
		// don't draft identical lineups and tie every race.
		const by = (score: (t: Token) => number) => {
			const ranked = [...options].sort((x, y) => score(y) - score(x));
			return ranked[Math.random() < 0.5 || ranked.length < 2 ? 0 : 1];
		};
		const pick =
			style === 'momentum'
				? by(prior)
				: style === 'contrarian'
					? by((t) => -prior(t))
					: style === 'steady'
						? by((t) => -Math.abs(prior(t)))
						: style === 'volatile'
							? by((t) => Math.abs(prior(t)))
							: options[Math.floor(Math.random() * options.length)];
		used.add(pick.symbol);
		lineup.push(pick);
	}
	return lineup;
}

function shuffle<T>(list: T[]): T[] {
	return [...list].sort(() => Math.random() - 0.5);
}

async function stakeableCars(botIds: string[]) {
	return db
		.select({ id: cars.id, ownerId: cars.ownerId, rarity: cars.rarity, model: cars.model })
		.from(cars)
		.leftJoin(carListings, and(eq(carListings.carId, cars.id), eq(carListings.status, 'open')))
		.where(and(inArray(cars.ownerId, botIds), isNull(cars.stakedInRace), isNull(carListings.id)));
}

// The week's price history, fetched once and reused for each day's request
// (the week is played one day per request; see /api/simulate).
let week: { at: number; dates: string[]; tokens: Token[] } | null = null;
const WEEK_CACHE_MS = 10 * 60 * 1000;

async function loadWeek() {
	if (week && Date.now() - week.at < WEEK_CACHE_MS) return week;
	const pool = await getTokensWithPrices();
	const symbols = [...new Set(pool.map((t) => (t.symbol ?? '').toUpperCase()).filter(Boolean))];
	const { dates, moves } = await dailyMoves(symbols);
	const tokens: Token[] = symbols
		.filter((s) => moves.has(s))
		.map((s) => ({ symbol: s, sector: classifySector([s]), moves: moves.get(s)! }));
	if (tokens.length < 5) throw new Error('Not enough price history to simulate');
	week = { at: Date.now(), dates, tokens };
	return week;
}

async function allBots() {
	const bots = await db
		.select({ id: users.id, username: users.username })
		.from(users)
		.where(like(users.walletAddress, 'seed:%'));
	if (bots.length < 2) throw new Error('Need at least 2 bots');
	return bots;
}

/**
 * Plays one day of the week (1–7): the bots race in pairs, half of them
 * car-for-car, get paid, then trade. One day per request keeps each request
 * short (well inside serverless time limits) and lets the page fill in day by
 * day while you watch.
 */
export async function simulateDay(day: number): Promise<SimDay> {
	if (!Number.isInteger(day) || day < 1 || day > DAYS) throw new Error(`Day must be 1–${DAYS}`);
	const { dates, tokens } = await loadWeek();
	const bots = await allBots();

	const races: SimRace[] = [];
	const order = shuffle(bots);
	const available = await stakeableCars(bots.map((b) => b.id));

	// The day's races run side by side: each pair has its own bots and cars,
	// so nothing they touch overlaps. (Run one after another, a week took
	// over three minutes.)
	const pairs: [number, (typeof bots)[number], (typeof bots)[number]][] = [];
	for (let i = 0; i + 1 < order.length; i += 2) pairs.push([i, order[i], order[i + 1]]);
	await Promise.all(
		pairs.map(async ([i, a, b]) => {
			const lineupA = draft(tokens, personalityOf(a.username).draft, day);
			const lineupB = draft(tokens, personalityOf(b.username).draft, day);
			const moveA = lineupA.reduce((s, t) => s + t.moves[day], 0);
			const moveB = lineupB.reduce((s, t) => s + t.moves[day], 0);
			const aWins = moveA === moveB ? Math.random() < 0.5 : moveA > moveB;
			const [winner, loser] = aWins ? [a, b] : [b, a];

			const race: SimRace = {
				a: a.username,
				b: b.username,
				winner: winner.username,
				aMove: Number(moveA.toFixed(2)),
				bMove: Number(moveB.toFixed(2)),
				picks: {
					[a.username]: lineupA.map((t) => t.symbol),
					[b.username]: lineupB.map((t) => t.symbol)
				}
			};

			// Car-for-car: both stake a car of the same rarity, the winner takes both.
			if (Math.random() < CAR_RACE_CHANCE) {
				for (const rarity of RARITIES) {
					const carA = available.find((c) => c.ownerId === a.id && c.rarity === rarity);
					const carB = available.find((c) => c.ownerId === b.id && c.rarity === rarity);
					if (!carA || !carB) continue;
					const raceId = `sim-${dates[day]}-${i}-${crypto.randomUUID().slice(0, 8)}`;
					try {
						await openCarRace(raceId, [
							{ userId: a.id, carId: carA.id },
							{ userId: b.id, carId: carB.id }
						]);
						await settleCarRace(raceId, winner.id);
						const lost = loser.id === a.id ? carA : carB;
						race.carWon = { model: lost.model, rarity: lost.rarity };
						for (const c of [carA, carB]) available.splice(available.indexOf(c), 1);
					} catch (e) {
						console.error('[simulate] car race failed:', e);
					}
					break;
				}
			}

			await Promise.all([
				grantGears(winner.id, PAYOUT.win, `sim win ${dates[day]}`),
				grantGears(loser.id, PAYOUT.lose, `sim race ${dates[day]}`)
			]);
			races.push(race);
		})
	);

	const market = await runBotMarket();
	const markets = await tierMarkets();
	return {
		date: dates[day] ?? `Day ${day}`,
		races,
		market,
		prices: Object.fromEntries(RARITIES.map((r) => [r, fairPrice(r, markets[r as Rarity]).value]))
	};
}

/** Each bot's garage size and Gears, most cars first. */
export async function botSummary(): Promise<{ username: string; gears: number; cars: number }[]> {
	const bots = await db
		.select({ id: users.id, username: users.username, gears: users.gears })
		.from(users)
		.where(like(users.walletAddress, 'seed:%'));
	const owned = await db
		.select({ ownerId: cars.ownerId })
		.from(cars)
		.where(
			inArray(
				cars.ownerId,
				bots.map((b) => b.id)
			)
		);
	return bots
		.map((b) => ({
			username: b.username,
			gears: b.gears,
			cars: owned.filter((o) => o.ownerId === b.id).length
		}))
		.sort((x, y) => y.cars - x.cars || y.gears - x.gears);
}

export const SIM_DAYS = DAYS;
