import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tournaments, lobbies, lobbyParticipants, users } from '$lib/server/schema';
import { and, eq, sql } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';
import { joinTournament } from '$lib/server/tournament-resolution';
import { CIRCUITS } from '$lib/race/circuits';

const SECTORS = ['l1', 'l2', 'defi', 'meme', 'wildcard'];

// GET /api/tournaments?status=open — browse
export async function GET({ url, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const status = url.searchParams.get('status') ?? 'open';

	const rows = await db
		.select({
			id: tournaments.id,
			name: tournaments.name,
			contestType: tournaments.contestType,
			payoutStructure: tournaments.payoutStructure,
			sectorRestriction: tournaments.sectorRestriction,
			groupSize: tournaments.groupSize,
			status: tournaments.status,
			createdBy: tournaments.createdBy,
			creatorName: users.username,
			createdAt: tournaments.createdAt,
			participantCount: sql<number>`(
				select count(*) from ${lobbyParticipants}
				join ${lobbies} on ${lobbies.id} = ${lobbyParticipants.lobbyId}
				where ${lobbies.tournamentId} = ${tournaments.id}
			)`
		})
		.from(tournaments)
		.leftJoin(users, eq(users.id, tournaments.createdBy))
		// accessType filter is load-bearing, not redundant: two 'private' rows
		// exist from the invite-flow testing pass and were leaking into this
		// public list — this query used to only filter by status.
		.where(and(eq(tournaments.status, status), eq(tournaments.accessType, 'public')));

	return json(rows);
}

// POST /api/tournaments: create (GAMEPLAY_FLOWS.md, F4). Name, public or
// private, race length, group-stage and final tracks, optional sector
// restriction, closing time (= start), optional entry fee in Gears.
// Prizes are the game's standard ones; they pay out with 4+ human entrants.
const DURATIONS = [5, 10, 15, 30, 60, 240, 1440];
const TRACKS = CIRCUITS.map((c) => c.id);

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
	if (!name) return json({ error: 'A tournament name is required' }, { status: 400 });

	const accessType = body.accessType === 'private' ? 'private' : 'public';
	const sectorRestriction = SECTORS.includes(body.sectorRestriction)
		? body.sectorRestriction
		: null;
	const durationMinutes = DURATIONS.includes(Number(body.durationMinutes))
		? Number(body.durationMinutes)
		: 15;
	const groupTrack = TRACKS.includes(body.groupTrack) ? body.groupTrack : TRACKS[0];
	// The final runs somewhere else: a marquee track that isn't the group one.
	const finalTrack =
		TRACKS.includes(body.finalTrack) && body.finalTrack !== groupTrack
			? body.finalTrack
			: (TRACKS.find((t) => t !== groupTrack) ?? groupTrack);
	const closesIn = Math.min(7 * 1440, Math.max(10, Number(body.closesInMinutes) || 60));
	const entryFee = Math.min(5000, Math.max(0, Math.round(Number(body.entryFee) || 0)));

	const [tournament] = await db
		.insert(tournaments)
		.values({
			name,
			createdBy: parsed.userId,
			contestType: 'daily',
			accessType,
			fundingMode: 'free',
			sectorRestriction,
			groupSize: 5,
			minPlayers: 1,
			durationMinutes,
			groupTrack,
			finalTrack,
			entryFee,
			registrationClosesAt: new Date(Date.now() + closesIn * 60_000),
			status: 'open'
		})
		.returning();

	// The creator is in it from the start (and pays the fee like everyone else).
	const joined = await joinTournament(tournament.id, parsed.userId);
	if ('error' in joined && joined.error === 'not_enough_gears') {
		await db
			.update(tournaments)
			.set({ status: 'cancelled' })
			.where(eq(tournaments.id, tournament.id));
		return json(
			{ error: `You need ${entryFee} Gears to enter your own tournament` },
			{ status: 409 }
		);
	}
	return json(tournament);
}
