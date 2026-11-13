import { json } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	lineups,
	lobbies,
	lobbyParticipants,
	tournamentEntries,
	tournaments,
	users
} from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { sweepTournaments } from '$lib/server/tournament-resolution';
import { circuitById } from '$lib/race/circuits';

// GET /api/tournament/[id]: everything the tournament page shows, polled.
// Registration list, the draw (pots and groups), each stage's seats, and the
// final results. Acts on anything due first (see sweepTournaments).
export async function GET({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	await sweepTournaments().catch((e) => console.error('[api/tournament/:id] sweep failed:', e));

	const [t] = await db.select().from(tournaments).where(eq(tournaments.id, params.id));
	if (!t) return json({ error: 'Tournament not found' }, { status: 404 });

	const entrants = await db
		.select({
			userId: tournamentEntries.userId,
			username: users.username,
			xp: users.xpTotal,
			pot: tournamentEntries.pot,
			groupNo: tournamentEntries.groupNo
		})
		.from(tournamentEntries)
		.innerJoin(users, eq(users.id, tournamentEntries.userId))
		.where(eq(tournamentEntries.tournamentId, t.id))
		.orderBy(asc(tournamentEntries.joinedAt));
	// Private tournaments show their page only to entrants and the creator.
	const joined = entrants.some((e) => e.userId === parsed.userId);
	if (t.accessType === 'private' && !joined && t.createdBy !== parsed.userId) {
		return json({ error: 'This tournament is invite-only.' }, { status: 403 });
	}

	const stageRows = await db
		.select()
		.from(lobbies)
		.where(eq(lobbies.tournamentId, t.id))
		.orderBy(asc(lobbies.tournamentStage), asc(lobbies.createdAt));
	const seats = stageRows.length
		? await db
				.select({
					lobbyId: lobbyParticipants.lobbyId,
					userId: lobbyParticipants.userId,
					rank: lobbyParticipants.rank,
					username: users.username,
					wallet: users.walletAddress
				})
				.from(lobbyParticipants)
				.innerJoin(users, eq(users.id, lobbyParticipants.userId))
				.where(
					inArray(
						lobbyParticipants.lobbyId,
						stageRows.map((s) => s.id)
					)
				)
		: [];
	const drafted = stageRows.length
		? await db
				.select({ lobbyId: lineups.lobbyId, userId: lineups.userId })
				.from(lineups)
				.where(
					and(
						inArray(
							lineups.lobbyId,
							stageRows.map((s) => s.id)
						),
						eq(lineups.locked, true)
					)
				)
		: [];

	const potOf = new Map(entrants.map((e) => [e.userId, e.pot]));
	let groupNo = 0;
	const stages = stageRows.map((s) => {
		const isFinal = s.tournamentStage === 1;
		return {
			lobbyId: s.id,
			label: isFinal ? 'Final' : `Group ${String.fromCharCode(65 + groupNo++)}`,
			isFinal,
			status: s.status,
			circuit: s.circuit ? circuitById(s.circuit).name : null,
			draftClosesAt: s.draftClosesAt,
			startAt: s.startAt,
			endAt: s.endAt,
			seats: seats
				.filter((x) => x.lobbyId === s.id)
				.map((x) => ({
					userId: x.userId,
					username: x.username,
					isBot: x.wallet.startsWith('seed:'),
					isMe: x.userId === parsed.userId,
					pot: potOf.get(x.userId!) ?? null,
					rank: x.rank,
					drafted: drafted.some((d) => d.lobbyId === s.id && d.userId === x.userId)
				}))
				.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (a.pot ?? 99) - (b.pot ?? 99))
		};
	});
	// Where I need to be next: the latest stage I have a seat in.
	const mine = [...stages].reverse().find((s) => s.seats.some((x) => x.isMe)) ?? null;

	return json({
		id: t.id,
		name: t.name,
		status: t.status,
		cup: t.cup,
		accessType: t.accessType,
		isCreator: t.createdBy === parsed.userId,
		durationMinutes: t.durationMinutes,
		groupTrack: t.groupTrack ? circuitById(t.groupTrack).name : null,
		finalTrack: t.finalTrack ? circuitById(t.finalTrack).name : null,
		sectorRestriction: t.sectorRestriction,
		prizes: t.prizes ?? [1000, 400, 200],
		entryFee: t.entryFee,
		pot: entrants.length * (t.entryFee ?? 0),
		carPrize: t.carPrize,
		registrationClosesAt: t.registrationClosesAt,
		drawnAt: t.drawnAt,
		joined,
		entrants: entrants.map((e) => ({
			username: e.username,
			xp: e.xp ?? 0,
			pot: e.pot,
			groupNo: e.groupNo,
			isMe: e.userId === parsed.userId
		})),
		stages,
		myStage: mine
			? {
					lobbyId: mine.lobbyId,
					label: mine.label,
					status: mine.status,
					drafted: mine.seats.find((x) => x.isMe)?.drafted ?? false,
					draftClosesAt: mine.draftClosesAt
				}
			: null,
		results: t.results ?? null
	});
}
