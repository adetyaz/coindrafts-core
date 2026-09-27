import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { leagues, leagueMembers } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';

// POST /api/leagues/[id]/leave — a member removes themselves. The creator
// deletes the league instead, so a league is never left without an owner.
export async function POST({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const [league] = await db.select().from(leagues).where(eq(leagues.id, params.id)).limit(1);
	if (!league) return json({ error: 'League not found' }, { status: 404 });
	if (league.createdBy === parsed.userId) {
		return json({ error: 'You created this league — delete it instead' }, { status: 409 });
	}

	const removed = await db
		.delete(leagueMembers)
		.where(and(eq(leagueMembers.leagueId, league.id), eq(leagueMembers.userId, parsed.userId)))
		.returning({ id: leagueMembers.id });
	if (removed.length === 0) return json({ error: 'You are not in this league' }, { status: 404 });

	return json({ ok: true });
}
