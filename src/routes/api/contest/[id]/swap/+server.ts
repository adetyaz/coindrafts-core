import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineupPicks, lineups } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { getAllPrices } from '$lib/server/prices';
import { SPARE_WINDOW, type LineupItem } from '$lib/race/items';
import { DEFAULT_DURATION_MINUTES } from '$lib/constants';

// POST { from, to: { symbol, name, currencyId } }: the Spare Tyre
// (GAMEPLAY_FLOWS.md, F8). Swap one coin for another in the same sector during
// the first 10% of the race. The new coin enters at today's price, so the swap
// can't reach back and claim moves that already happened.
export async function POST({ params, request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const from = String(body?.from ?? '').toUpperCase();
	const to = body?.to ?? {};
	const toSymbol = String(to.symbol ?? '').toUpperCase();
	if (!from || !toSymbol || !to.currencyId)
		return json({ error: 'Choose a coin to swap out and one to swap in' }, { status: 400 });

	const [contest] = await db.select().from(contests).where(eq(contests.id, params.id));
	if (!contest || contest.status !== 'live' || !contest.startAt)
		return json({ error: 'This race is not running' }, { status: 409 });
	const start = new Date(contest.startAt).getTime();
	const windowMs = (contest.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000 * SPARE_WINDOW;
	const now = Date.now();
	if (now < start || now > start + windowMs)
		return json(
			{ error: 'The pit lane is closed: swaps only in the first 10% of the race' },
			{ status: 409 }
		);

	const [lineup] = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, params.id), eq(lineups.userId, parsed.userId)));
	const item = lineup?.item as LineupItem | null | undefined;
	if (!lineup || item?.kind !== 'spare')
		return json({ error: 'No Spare Tyre on this car' }, { status: 409 });
	if (item.used) return json({ error: 'Your Spare Tyre is already used' }, { status: 409 });

	const picks = await db.select().from(lineupPicks).where(eq(lineupPicks.lineupId, lineup.id));
	const out = picks.find((p) => p.tokenSymbol.toUpperCase() === from);
	if (!out) return json({ error: `${from} isn't in your lineup` }, { status: 400 });
	if (picks.some((p) => p.tokenSymbol.toUpperCase() === toSymbol))
		return json({ error: `${toSymbol} is already in your lineup` }, { status: 400 });

	const price = (await getAllPrices().catch(() => null))?.get(toSymbol)?.price;
	if (!price || price <= 0)
		return json({ error: `No live price for ${toSymbol} right now` }, { status: 503 });

	// Claim the tyre first, so two taps can't swap twice.
	const used: LineupItem = { ...item, used: true, swap: { from, to: toSymbol } };
	const [claimed] = await db
		.update(lineups)
		.set({ item: used })
		.where(and(eq(lineups.id, lineup.id), eq(lineups.item, item)))
		.returning({ id: lineups.id });
	if (!claimed) return json({ error: 'Your Spare Tyre is already used' }, { status: 409 });

	await db
		.update(lineupPicks)
		.set({
			tokenSymbol: toSymbol,
			tokenName: String(to.name ?? toSymbol),
			currencyId: String(to.currencyId),
			entryPrice: String(price),
			exitPrice: String(price),
			pctChange: '0'
		})
		.where(eq(lineupPicks.id, out.id));
	return json({ ok: true, from, to: toSymbol, entryPrice: price });
}
