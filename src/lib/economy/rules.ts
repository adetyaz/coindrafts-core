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
	markets: Record<Rarity, TierMarket>
): Decision<{ carId: string; price: number } | null> {
	if (bot.cars.length === 0) return { value: null, reason: 'No cars to sell' };

	if (bot.gears < BROKE_BELOW && bot.cars.length > 1) {
		const car = [...bot.cars].sort((a, b) => BASE_PRICE[a.rarity] - BASE_PRICE[b.rarity])[0];
		const fair = fairPrice(car.rarity, markets[car.rarity]);
		const price = roundPrice(fair.value * 0.7);
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
				value: { carId: ofTier[0].id, price: fair.value },
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
					value: { carId: ofTier[0].id, price: roundPrice(fair.value * 1.05) },
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
	market: TierMarket
): Decision<boolean> {
	const fair = fairPrice(listing.rarity, market).value;
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
