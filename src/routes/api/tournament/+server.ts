import { json } from '@sveltejs/kit';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { tournamentEntries, tournaments } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { sweepTournaments } from '$lib/server/tournament-resolution';
import { circuitById } from '$lib/race/circuits';

// GET /api/tournament: public tournaments open for entry, plus any you're in
// that are still running. Private ones are reached by invite, not listed.
// Acts on anything due first, so the list never shows a stale "open".
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	await sweepTournaments().catch((e) => console.error('[api/tournament] sweep failed:', e));

	const mine = await db
		.select({ id: tournamentEntries.tournamentId })
		.from(tournamentEntries)
		.where(eq(tournamentEntries.userId, parsed.userId));
	const mineIds = mine.map((m) => m.id);

	const rows = await db
		.select({
			t: tournaments,
			players: sql<number>`(select count(*)::int from ${tournamentEntries} where ${tournamentEntries.tournamentId} = ${tournaments.id})`
		})
		.from(tournaments)
		.where(
			or(
				and(eq(tournaments.accessType, 'public'), eq(tournaments.status, 'open')),
				mineIds.length
					? and(inArray(tournaments.id, mineIds), inArray(tournaments.status, ['open', 'active']))
					: sql`false`
			)
		)
		.orderBy(asc(tournaments.registrationClosesAt));

	return json(
		rows.map(({ t, players }) => ({
			id: t.id,
			name: t.name,
			status: t.status,
			cup: t.cup,
			players,
			joined: mineIds.includes(t.id),
			durationMinutes: t.durationMinutes,
			groupTrack: t.groupTrack ? circuitById(t.groupTrack).name : null,
			finalTrack: t.finalTrack ? circuitById(t.finalTrack).name : null,
			prizes: t.prizes ?? [1000, 400, 200],
			entryFee: t.entryFee,
			carPrize: t.carPrize,
			sectorRestriction: t.sectorRestriction,
			registrationClosesAt: t.registrationClosesAt
		}))
	);
}
