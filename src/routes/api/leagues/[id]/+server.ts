import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	leagueNights,
	leagueSeasons,
	leagues,
	leagueMembers,
	lobbies,
	users
} from '$lib/server/schema';
import { leagueNightView, sweepLeagues } from '$lib/server/leagues';
import { circuitById } from '$lib/race/circuits';
import { eq, desc } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';

export async function GET({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const leagueId = params.id;
	if (!leagueId) return json({ error: 'League id required' }, { status: 400 });

	// Seasons, league nights and results that are due happen here (no timers).
	await sweepLeagues().catch((e) => console.error('[api/leagues/:id] sweep failed:', e));

	const league = await db
		.select()
		.from(leagues)
		.where(eq(leagues.id, leagueId))
		.limit(1)
		.then((rows) => rows[0] ?? null);
	if (!league) return json({ error: 'League not found' }, { status: 404 });

	const members = await db
		.select({
			id: leagueMembers.id,
			userId: leagueMembers.userId,
			username: users.username,
			wins: leagueMembers.wins,
			losses: leagueMembers.losses,
			points: leagueMembers.points,
			joinedAt: leagueMembers.joinedAt
		})
		.from(leagueMembers)
		.innerJoin(users, eq(users.id, leagueMembers.userId))
		.where(eq(leagueMembers.leagueId, leagueId))
		.orderBy(desc(leagueMembers.points));

	// Returned the full row to any signed-in user, invite code included, so
	// knowing a league id was enough to join a private league.
	const isMember = members.some((m) => m.userId === parsed.userId);
	if (league.type === 'private' && !isMember) {
		return json({ error: 'League not found' }, { status: 404 });
	}
	return json({
		league: isMember ? league : { ...league, inviteCode: null },
		members,
		viewer: { isMember, isCreator: league.createdBy === parsed.userId },
		homeTrack: league.homeTrack ? circuitById(league.homeTrack).name : null,
		night: await leagueNightView(league, parsed.userId)
	});
}

// DELETE /api/leagues/[id] — creator only; removes the league and all memberships.
export async function DELETE({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const [league] = await db.select().from(leagues).where(eq(leagues.id, params.id)).limit(1);
	if (!league) return json({ error: 'League not found' }, { status: 404 });
	if (league.createdBy !== parsed.userId) {
		return json({ error: 'Only the league creator can delete it' }, { status: 403 });
	}

	// One transaction so a failure can't leave the memberships gone but the
	// league still listed.
	await db.transaction(async (tx) => {
		await tx.delete(leagueMembers).where(eq(leagueMembers.leagueId, league.id));
		// League-night grids stay as race history, detached from the league.
		const nights = await tx
			.select({ id: leagueNights.id })
			.from(leagueNights)
			.where(eq(leagueNights.leagueId, league.id));
		for (const n of nights) {
			await tx.update(lobbies).set({ leagueNightId: null }).where(eq(lobbies.leagueNightId, n.id));
		}
		await tx.delete(leagueNights).where(eq(leagueNights.leagueId, league.id));
		await tx.delete(leagueSeasons).where(eq(leagueSeasons.leagueId, league.id));
		await tx.delete(leagues).where(eq(leagues.id, league.id));
	});
	return json({ ok: true });
}
