// Nitro and pit-stop items (GAMEPLAY_FLOWS.md, F8). Client-safe: the server
// scores with these multipliers and the race screen moves the cars with the
// same ones, so what you see on track is what gets scored.
//
// Every item works through the same lever scoring already has: a multiplier
// on a pick's % move (see calcPickScore's `boost`).

export type ItemKind = 'nitro' | 'turbo' | 'spare' | 'shield';

/** What a lineup locked in: the item, plus the sector or coin it targets. */
export type LineupItem = {
	kind: ItemKind;
	sector?: string;
	symbol?: string;
	/** Spare Tyre only: set once the swap has been made. */
	used?: boolean;
	/** Spare Tyre only: what was swapped out and in. */
	swap?: { from: string; to: string };
};

export type Inventory = Partial<Record<ItemKind, number>>;

export const ITEMS: Record<
	ItemKind,
	{
		label: string;
		icon: string;
		/** What it does, in one line, for the tray. */
		does: string;
		target: 'sector' | 'coin' | null;
		/** Showroom price in Gears. Burned, like every Showroom spend. */
		price: number;
	}
> = {
	nitro: {
		label: 'Nitro',
		icon: '🔥',
		does: "Choose a sector: its coin's move counts ×1.25",
		target: 'sector',
		price: 150
	},
	turbo: {
		label: 'Turbo',
		icon: '⚡',
		does: 'Choose a coin: its move counts double, up or down',
		target: 'coin',
		price: 220
	},
	spare: {
		label: 'Spare Tyre',
		icon: '🛞',
		does: 'Swap one coin during the first 10% of the race',
		target: null,
		price: 180
	},
	shield: {
		label: 'Shield',
		icon: '🛡️',
		does: "Your worst coin's loss is halved",
		target: null,
		price: 160
	}
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];

/** One item per race, and at most this many races with an item each week. */
export const WEEKLY_ITEM_CAP = 3;

export const NITRO_FACTOR = 1.25;
export const TURBO_FACTOR = 2;
export const SHIELD_FACTOR = 0.5;

/** The Spare Tyre swap window: this share of the race, from the start. */
export const SPARE_WINDOW = 0.1;

export function isItemKind(v: unknown): v is ItemKind {
	return typeof v === 'string' && v in ITEMS;
}

/**
 * Per-pick multipliers for one lineup, in pick order. `pct` is each pick's
 * current % move; it only matters for the Shield, which picks the worst coin
 * at the moment of scoring (and only softens a loss).
 */
export function itemFactors(
	picks: { symbol: string; sector: string; pct: number }[],
	item: LineupItem | null | undefined
): number[] {
	const out = picks.map(() => 1);
	if (!item) return out;
	if (item.kind === 'nitro' && item.sector) {
		picks.forEach((p, i) => {
			if (p.sector === item.sector) out[i] = NITRO_FACTOR;
		});
	} else if (item.kind === 'turbo' && item.symbol) {
		const i = picks.findIndex((p) => p.symbol.toUpperCase() === item.symbol!.toUpperCase());
		if (i >= 0) out[i] = TURBO_FACTOR;
	} else if (item.kind === 'shield' && picks.length) {
		let worst = 0;
		picks.forEach((p, i) => {
			if (p.pct < picks[worst].pct) worst = i;
		});
		if (picks[worst].pct < 0) out[worst] = SHIELD_FACTOR;
	}
	return out;
}

/** Start of the item week: Monday 00:00 UTC (same week as Showroom stock). */
export function itemWeekStart(now = new Date()): Date {
	const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	return d;
}
