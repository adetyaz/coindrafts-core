// Drafts a real, sector-correct lineup for a seeded bot account. Used by
// Scrimmage contests, which are created directly (never via
// `matchmaking_queue`) and so never reach bots-service's own queue-join
// logic — its drafting shape is reused here, but triggered inline instead.
//
// Also fixes a real bug found in bots-service's own script: it assigns its
// 5 random picks to sector slots positionally (`sectors[i]`), with no check
// the token is actually that sector. This uses the same classifier
// ($lib/sectors.ts) the rest of the app already relies on for sector-correct
// assignment instead.
import { classifySector } from '$lib/sectors';
import { getTokensWithPrices, type TokenWithPrice } from '$lib/server/sosovalue';
import type { DraftStyle } from '$lib/bots/personalities';

// Mirrors bots-service/keep-bots-online.cjs's roster exactly — same 8 seeded
// accounts, already present in the database (wallet_address = 'seed:<username>').
export const SCRIMMAGE_BOTS = [
	{ id: 'f684269c-7d3d-40b0-a21b-98bb766d64ff', username: 'CryptoWhale_99' },
	{ id: 'c84f9dd6-2e38-4765-974b-f38d1830d01b', username: 'AlphaLegend' },
	{ id: 'e747d3d3-736d-4f23-9ace-c20fcb6c1f93', username: 'SatoshiKnight' },
	{ id: 'b68c834e-3293-4412-ae54-efb19133d1cc', username: 'BullZone_OG' },
	{ id: '8b53257d-9c96-4a43-84c0-3a4a06f7e4b3', username: 'DegenScout' },
	{ id: '403c6e78-7c55-43f2-ba68-6380565332f3', username: 'ChartWizard' },
	{ id: '2c00b2ed-41a1-40a5-8458-4f932e112963', username: 'MoonRunner' },
	{ id: 'fb185647-3d16-41d3-96c5-2ff0001dd0e6', username: 'RektProof' }
] as const;

export function pickScrimmageBot(): (typeof SCRIMMAGE_BOTS)[number] {
	return SCRIMMAGE_BOTS[Math.floor(Math.random() * SCRIMMAGE_BOTS.length)];
}

export type BotPick = {
	sector: string;
	symbol: string;
	name: string;
	currencyId: string;
	price: number | null;
};

const SECTORS = ['l1', 'l2', 'defi', 'meme', 'wildcard'] as const;

/**
 * Each bot drafts in its own style (src/lib/bots/personalities.ts), reading
 * the same 24h moves players see on the draft board.
 */
function pickByStyle(pool: TokenWithPrice[], style: DraftStyle): TokenWithPrice {
	const move = (t: TokenWithPrice) => t.change24h ?? 0;
	const by = (score: (t: TokenWithPrice) => number) =>
		pool.reduce((best, t) => (score(t) > score(best) ? t : best));
	switch (style) {
		case 'momentum':
			return by(move);
		case 'contrarian':
			return by((t) => -move(t));
		case 'steady':
			return by((t) => -Math.abs(move(t)));
		case 'volatile':
			return by((t) => Math.abs(move(t)));
		default:
			return pool[Math.floor(Math.random() * pool.length)];
	}
}

/** Drafts 5 sector-correct picks from the live token pool for a bot opponent. */
export async function draftBotLineup(style: DraftStyle = 'chaos'): Promise<BotPick[]> {
	const tokens = await getTokensWithPrices();

	const bySector = new Map<string, TokenWithPrice[]>(SECTORS.map((s) => [s, []]));
	for (const t of tokens) {
		if (!t.symbol) continue;
		bySector.get(classifySector([t.symbol]))?.push(t);
	}

	const used = new Set<string>();
	const picks: BotPick[] = [];
	for (const sector of SECTORS) {
		const inSector = (bySector.get(sector) ?? []).filter((t) => t.symbol && !used.has(t.symbol));
		const pool =
			inSector.length > 0 ? inSector : tokens.filter((t) => t.symbol && !used.has(t.symbol));
		if (pool.length === 0) continue;

		const chosen = pickByStyle(pool, style);
		used.add(chosen.symbol as string);
		// When the live pool has no token for this slot's sector, the fallback
		// above pulls from the whole pool — label with the token's own real
		// sector, not the empty slot's name, or the stored label lies (this was
		// the exact bug this function was written to fix, just reappearing in
		// the fallback path).
		picks.push({
			sector: inSector.length > 0 ? sector : classifySector([chosen.symbol as string]),
			symbol: chosen.symbol as string,
			name: chosen.name ?? (chosen.symbol as string),
			currencyId: chosen.currency_id,
			// Carried straight from the same batch call used to pick this token —
			// no second price fetch needed, and nothing here can rate-limit.
			price: chosen.price
		});
	}
	return picks;
}

/**
 * Binary mode (GAMEPLAY_FLOWS.md, F9): a bot picks 5 coins and calls them in
 * its own style. Momentum rides the biggest movers; contrarian bets they turn;
 * steady calls the calm ones to keep going; volatile and chaos pick wild coins
 * and call them on a hunch.
 */
export async function binaryBotCalls(style: DraftStyle = 'chaos') {
	const tokens = (await getTokensWithPrices()).filter(
		(t) => t.symbol && t.price != null && t.price > 0 && t.change24h != null
	);
	const by = (f: (t: TokenWithPrice) => number) => [...tokens].sort((a, b) => f(b) - f(a));
	const pool =
		style === 'steady'
			? by((t) => -Math.abs(t.change24h!))
			: style === 'chaos'
				? [...tokens].sort(() => Math.random() - 0.5)
				: by((t) => Math.abs(t.change24h!));
	return pool.slice(0, 5).map((t) => {
		const trend = t.change24h! >= 0 ? 'up' : 'down';
		const flip = trend === 'up' ? 'down' : 'up';
		const call =
			style === 'contrarian'
				? flip
				: style === 'momentum' || style === 'steady'
					? trend
					: Math.random() < 0.5
						? 'up'
						: 'down';
		return {
			symbol: t.symbol!,
			name: t.name ?? t.symbol!,
			currencyId: t.currency_id,
			sector: classifySector([t.symbol!]),
			price: t.price,
			call: call as 'up' | 'down'
		};
	});
}
