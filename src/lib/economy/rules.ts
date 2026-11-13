// ─────────────────────────────────────────────────────────────────────────────
// CoinDraft economy rules — every price and every bot market decision lives in
// this one file, and every decision returns its reason in plain words. Those
// reasons are what players see in the Car Market's "why" tooltips.
//
// Nobody sets prices by hand. They move with what happens in the game:
// how many cars of a tier are for sale right now, and how fast they've been
// selling. Bots read the same numbers and act on them, so the market keeps
// moving even when no human is trading.
// ─────────────────────────────────────────────────────────────────────────────

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export const RARITIES: Rarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];

/** What a car of each tier is worth in a calm market, in Gears. */
export const BASE_PRICE: Record<Rarity, number> = {
	Common: 300,
	Rare: 900,
	Epic: 2500,
	Legendary: 7000
};

/** The market for one tier right now. */
export type TierMarket = {
	/** Cars of this tier listed for sale right now. */
	forSale: number;
	/** Cars of this tier sold in the last 24 hours. */
	soldLast24h: number;
};

export type Decision<T> = { value: T; reason: string };

/**
 * How hard a bot haggles, from its personality (src/lib/bots/personalities.ts):
 * `askMarkup` scales what it asks when selling, `payTolerance` what it will pay.
 * 1 and 1 is a calm trader; a big spender pays more, a cautious one less.
 */
export type Temper = { askMarkup: number; payTolerance: number };
const CALM: Temper = { askMarkup: 1, payTolerance: 1 };

// ── Price ────────────────────────────────────────────────────────────────────

/**
 * Fair price for a tier. Supply pushes it down, demand pushes it up:
 * - every car for sale beyond 3 knocks 6% off (down to 60% of base)
 * - every sale in the last day adds 5% (up to 140% of base)
 */
export function fairPrice(rarity: Rarity, market: TierMarket): Decision<number> {
	const supply = clamp(1 - 0.06 * (market.forSale - 3), 0.6, 1.15);
	const demand = clamp(1 + 0.05 * market.soldLast24h, 1, 1.4);
	const price = roundPrice(BASE_PRICE[rarity] * supply * demand);
	const parts: string[] = [];
	if (supply < 1) parts.push(`${market.forSale} ${plural(rarity)} for sale`);
	if (supply > 1) {
		parts.push(
			market.forSale === 0 ? `no ${plural(rarity)} for sale` : `only ${market.forSale} for sale`
		);
	}
	if (market.soldLast24h > 0) parts.push(`${market.soldLast24h} sold today`);
	return {
		value: price,
		reason: parts.length
			? `${parts.join(', ')}`
			: `${plural(rarity)} are trading at their usual price`
	};
}

/** Change against the calm-market price, for the "↓ 18%" trend next to a tier. */
export function trendPct(rarity: Rarity, price: number): number {
	return Math.round(((price - BASE_PRICE[rarity]) / BASE_PRICE[rarity]) * 100);
}

// ── Bots selling ─────────────────────────────────────────────────────────────

export type BotWallet = {
	gears: number;
	/** Cars the bot owns that aren't staked or already listed. */
	cars: { id: string; rarity: Rarity; model: string }[];
};

/** Below this, a bot is broke and sells to get back in the game. */
export const BROKE_BELOW = 150;

/** Below this, a bot with 3+ cars sells a duplicate to save up. */
export const SAVING_BELOW = 1000;

/**
 * Whether a bot lists one of its cars, which one, and at what price.
 * - Broke: fire sale, its cheapest car at 70% of fair price
 * - More than 2 cars of one tier: sells a spare at fair price
 * - Saving up (3+ cars, under SAVING_BELOW Gears): sells a duplicate at 5% over
 *   fair price, holding out for a good offer
 * - Otherwise it keeps its garage
 */
export function botListing(
	bot: BotWallet,
	markets: Record<Rarity, TierMarket>,
	temper: Temper = CALM
): Decision<{ carId: string; price: number } | null> {
	if (bot.cars.length === 0) return { value: null, reason: 'No cars to sell' };

	if (bot.gears < BROKE_BELOW && bot.cars.length > 1) {
		const car = [...bot.cars].sort((a, b) => BASE_PRICE[a.rarity] - BASE_PRICE[b.rarity])[0];
		const fair = fairPrice(car.rarity, markets[car.rarity]);
		const price = roundPrice(fair.value * 0.7 * temper.askMarkup);
		return {
			value: { carId: car.id, price },
			reason: `Fire sale: down to ${bot.gears} Gears and needs to race again`
		};
	}

	for (const rarity of RARITIES) {
		const ofTier = bot.cars.filter((c) => c.rarity === rarity);
		if (ofTier.length > 2) {
			const fair = fairPrice(rarity, markets[rarity]);
			return {
				value: { carId: ofTier[0].id, price: roundPrice(fair.value * temper.askMarkup) },
				reason: `Owns ${ofTier.length} ${plural(rarity)} and only needs 2 (${fair.reason})`
			};
		}
	}
	if (bot.cars.length >= 3 && bot.gears < SAVING_BELOW) {
		for (const rarity of RARITIES) {
			const ofTier = bot.cars.filter((c) => c.rarity === rarity);
			if (ofTier.length >= 2) {
				const fair = fairPrice(rarity, markets[rarity]);
				return {
					value: { carId: ofTier[0].id, price: roundPrice(fair.value * 1.05 * temper.askMarkup) },
					reason: `Has ${ofTier.length} ${plural(rarity)} and is saving up for something better`
				};
			}
		}
	}
	return { value: null, reason: 'Happy with its garage' };
}

// ── Bots buying ──────────────────────────────────────────────────────────────

/**
 * Whether a bot buys a listing.
 * - Never spends more than two thirds of its Gears on one car
 * - Never owns more than 6 cars
 * - Buys anything at least 10% under fair price (a bargain)
 * - Buys a tier it doesn't own yet at up to fair price (filling its garage)
 * - With Gears to spare (3× the price) and under 4 cars, buys a fairly priced
 *   car (up to 15% over the going rate): this is the steady demand that keeps
 *   cars changing hands when there are no bargains
 */
export function botWouldBuy(
	bot: BotWallet,
	listing: { price: number; rarity: Rarity },
	market: TierMarket,
	temper: Temper = CALM
): Decision<boolean> {
	// A bot that pays over the odds sees the going rate as higher than it is.
	const fair = fairPrice(listing.rarity, market).value * temper.payTolerance;
	if (bot.cars.length >= 6) return { value: false, reason: 'Garage is full' };
	if (listing.price > (bot.gears * 2) / 3) return { value: false, reason: 'Too expensive for it' };
	if (listing.price <= fair * 0.9) {
		const off = Math.round((1 - listing.price / fair) * 100);
		return {
			value: true,
			reason: `A bargain: ${off}% under the going rate for a ${listing.rarity}`
		};
	}
	if (!bot.cars.some((c) => c.rarity === listing.rarity) && listing.price <= fair) {
		return { value: true, reason: `Wanted its first ${listing.rarity}` };
	}
	if (bot.cars.length < 4 && bot.gears >= listing.price * 3 && listing.price <= fair * 1.15) {
		return {
			value: true,
			reason: `Had Gears to spare and liked the price for a ${listing.rarity}`
		};
	}
	return { value: false, reason: 'Not a good enough deal' };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) {
	return Math.max(lo, Math.min(hi, n));
}

export function plural(rarity: Rarity): string {
	return rarity === 'Legendary' ? 'Legendaries' : `${rarity}s`;
}

/**
 * A bot's listing has gone stale when the market has moved well below it:
 * nobody will pay 25% over the going rate, so the bot takes it down and
 * re-lists at today's price next round.
 */
export function isStale(price: number, fair: number): boolean {
	return price > fair * 1.25;
}

/** Prices land on round tens so they read like prices, not computations. */
function roundPrice(n: number) {
	return Math.max(10, Math.round(n / 10) * 10);
}

// ── Showroom ─────────────────────────────────────────────────────────────────
// Brand-new cars from the game itself, at base price. The Gears are destroyed
// (burned on chain): the simulation had bots sitting on 3,000–6,000 Gears with
// nothing to spend them on, which stalls the Car Market.

export const SHOWROOM_MODELS: Record<Rarity, string[]> = {
	Common: ['Viper', 'Comet', 'Bolt', 'Drift', 'Nova', 'Rally'],
	Rare: ['Falcon', 'Raptor', 'Mirage', 'Cobra'],
	Epic: ['Phantom', 'Tempest', 'Vortex'],
	Legendary: ['Apex', 'Eclipse']
};

/**
 * New cars per tier per week (Monday 00:00 UTC). Null is unlimited. Scarce
 * enough that Rare and up keep their Car Market value; Commons never run out
 * so a new player always has something to buy.
 */
export const WEEKLY_STOCK: Record<Rarity, number | null> = {
	Common: null,
	Rare: 6,
	Epic: 3,
	Legendary: 1
};

/** Start of the current stock week: Monday 00:00 UTC. */
export function stockWeekStart(now = new Date()): Date {
	const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	return d;
}

// ── Sell now ─────────────────────────────────────────────────────────────────

/** An instant sale to a bot pays this share of the going rate. */
export const SELL_NOW_SHARE = 0.8;

export function sellNowPrice(rarity: Rarity, market: TierMarket): Decision<number> {
	const fair = fairPrice(rarity, market);
	return {
		value: roundPrice(fair.value * SELL_NOW_SHARE),
		reason: `${Math.round(SELL_NOW_SHARE * 100)}% of the going rate (${fair.value}), paid right away`
	};
}

// ── Customising ──────────────────────────────────────────────────────────────
// Cosmetic only. Gears spent here are destroyed, like the Showroom.

export type CarLook = { paint?: string; decal?: string; plate?: string };

/** Paints are design tokens so the new design system can restyle them in one place. */
export const PAINTS = [
	{ id: 'coral', label: 'Coral', color: 'var(--color-coral)' },
	{ id: 'mint', label: 'Mint', color: 'var(--color-mint)' },
	{ id: 'blue', label: 'Blue', color: 'var(--color-blue)' },
	{ id: 'amber', label: 'Amber', color: 'var(--color-amber)' },
	{ id: 'sky', label: 'Sky', color: 'var(--color-sky)' },
	{ id: 'red', label: 'Red', color: 'var(--color-red)' },
	{ id: 'ink', label: 'Ink', color: 'var(--color-ink)' }
] as const;

export const DECALS = [
	{ id: 'none', label: 'None' },
	{ id: 'stripe', label: 'Racing stripe' },
	{ id: 'twin', label: 'Twin stripes' },
	{ id: 'checker', label: 'Checker' },
	{ id: 'bolt', label: 'Lightning' }
] as const;

export const CUSTOMISE_PRICE = { paint: 120, decal: 180, plate: 250 } as const;

/** Number plates: 2–7 letters or digits, shown on the car and the grid. */
export const PLATE = /^[A-Z0-9]{2,7}$/;

export function paintColor(look: CarLook | null | undefined): string | null {
	return PAINTS.find((p) => p.id === look?.paint)?.color ?? null;
}

/** What a set of changes costs: only the parts that actually change are charged. */
export function customiseCost(from: CarLook, to: CarLook): number {
	let cost = 0;
	if (to.paint !== undefined && to.paint !== from.paint) cost += CUSTOMISE_PRICE.paint;
	if (to.decal !== undefined && to.decal !== (from.decal ?? 'none')) cost += CUSTOMISE_PRICE.decal;
	if (to.plate !== undefined && to.plate !== from.plate) cost += CUSTOMISE_PRICE.plate;
	return cost;
}
