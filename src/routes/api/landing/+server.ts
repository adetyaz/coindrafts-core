import { json } from '@sveltejs/kit';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { contests, lineupPicks, lineups, users } from '$lib/server/schema';
import { getTokensWithPrices } from '$lib/server/sosovalue';
import { circuitById, circuitForRace } from '$lib/race/circuits';

// Public, for the landing page's "Run your game" section (GAMEPLAY_FLOWS.md,
// F1): races happening right now, and the coins drafted most in the last day.
// Only what a race card shows — driver names, length, time left, circuit — and
// pick counts per coin; never anyone's lineup.
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
	try {
		const now = new Date();
		const a = alias(users, 'driver_a');
		const b = alias(users, 'driver_b');
		const live = await db
			.select({
				id: contests.id,
				endAt: contests.endAt,
				durationMinutes: contests.durationMinutes,
				circuit: contests.circuit,
				isPaper: contests.isPaper,
				driverA: a.username,
				driverB: b.username,
				botB: b.walletAddress
			})
			.from(contests)
			.innerJoin(a, eq(a.id, contests.userAId))
			.leftJoin(b, eq(b.id, contests.userBId))
			.where(and(eq(contests.status, 'live'), gt(contests.endAt, now)))
			.orderBy(contests.endAt)
			.limit(12);

		const picked = await db
			.select({
				symbol: lineupPicks.tokenSymbol,
				sector: lineupPicks.sector,
				drafts: sql<number>`count(*)::int`
			})
			.from(lineupPicks)
			.innerJoin(lineups, eq(lineups.id, lineupPicks.lineupId))
			.innerJoin(contests, eq(contests.id, lineups.contestId))
			.where(gt(contests.startAt, new Date(now.getTime() - DAY_MS)))
			.groupBy(lineupPicks.tokenSymbol, lineupPicks.sector)
			.orderBy(desc(sql`count(*)`))
			.limit(24);

		const moves = new Map(
			(await getTokensWithPrices().catch(() => [])).map((t) => [
				(t.symbol ?? '').toUpperCase(),
				{ price: t.price, change24h: t.change24h }
			])
		);

		return json({
			updatedAt: now.toISOString(),
			liveRaces: live.map((r) => {
				const circuit = r.circuit ? circuitById(r.circuit) : circuitForRace(r.id);
				return {
					id: r.id,
					drivers: [r.driverA, r.driverB].filter(Boolean),
					vsBot: Boolean(r.botB?.startsWith('seed:')),
					scrimmage: Boolean(r.isPaper),
					durationMinutes: r.durationMinutes,
					msLeft: r.endAt ? Math.max(0, new Date(r.endAt).getTime() - now.getTime()) : null,
					circuit: { id: circuit.id, name: circuit.name }
				};
			}),
			hotCoins: picked.map((p) => ({
				symbol: p.symbol.toUpperCase(),
				sector: p.sector.toLowerCase(),
				drafts: p.drafts,
				price: moves.get(p.symbol.toUpperCase())?.price ?? null,
				change24h: moves.get(p.symbol.toUpperCase())?.change24h ?? null
			}))
		});
	} catch (error) {
		console.error('[api/landing]', error);
		return json({ error: 'unavailable' }, { status: 503 });
	}
}
