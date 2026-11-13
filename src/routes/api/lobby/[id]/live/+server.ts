import { json } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cars, lineupPicks, lineups, lobbies, lobbyParticipants, users } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { getAllPrices } from '$lib/server/prices';
import { kickOffIfReady } from '$lib/server/tournament-resolution';
import { resolveLobby } from '$lib/server/lobby-resolution';
import { itemFactors } from '$lib/race/items';

// GET: a multi-car race (tournament group or final) as the race screen needs
// it: every driver's car, item and picks with live moves. Any signed-in player
// can watch. Also nudges the stage along: kick-off when the draft is done,
// resolution when the race is over.
export async function GET({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	let [lobby] = await db.select().from(lobbies).where(eq(lobbies.id, params.id));
	if (!lobby) return json({ error: 'Race not found' }, { status: 404 });
	if (lobby.status === 'drafting' && (await kickOffIfReady(lobby))) {
		[lobby] = await db.select().from(lobbies).where(eq(lobbies.id, params.id));
	}
	if (lobby.status === 'live' && lobby.endAt && new Date(lobby.endAt) <= new Date()) {
		await resolveLobby(lobby.id).catch((e) => console.error('[lobby/live] resolve failed:', e));
		[lobby] = await db.select().from(lobbies).where(eq(lobbies.id, params.id));
	}

	const seats = await db
		.select({
			userId: lobbyParticipants.userId,
			rank: lobbyParticipants.rank,
			username: users.username,
			wallet: users.walletAddress
		})
		.from(lobbyParticipants)
		.innerJoin(users, eq(users.id, lobbyParticipants.userId))
		.where(eq(lobbyParticipants.lobbyId, lobby.id));
	const lineupRows = await db.select().from(lineups).where(eq(lineups.lobbyId, lobby.id));
	const picks = lineupRows.length
		? await db
				.select()
				.from(lineupPicks)
				.where(
					inArray(
						lineupPicks.lineupId,
						lineupRows.map((l) => l.id)
					)
				)
		: [];
	const carIds = lineupRows.map((l) => l.carId).filter((id): id is string => Boolean(id));
	const carRows = carIds.length
		? await db
				.select({ id: cars.id, model: cars.model, rarity: cars.rarity, look: cars.look })
				.from(cars)
				.where(inArray(cars.id, carIds))
		: [];
	const quotes = lobby.status === 'live' ? await getAllPrices().catch(() => null) : null;

	const drivers = seats.map((s) => {
		const lineup = lineupRows.find((l) => l.userId === s.userId);
		const mine = picks
			.filter((p) => p.lineupId === lineup?.id)
			.map((p) => {
				const entry = Number(p.entryPrice ?? 0);
				// Resolved races keep their stored exit; live ones use the latest batch.
				const current =
					lobby.status === 'resolved'
						? Number(p.exitPrice ?? entry)
						: (quotes?.get(p.tokenSymbol.toUpperCase())?.price ?? entry);
				return {
					symbol: p.tokenSymbol,
					sector: p.sector,
					entryPrice: entry,
					currentPrice: current,
					pct: entry > 0 ? ((current - entry) / entry) * 100 : 0
				};
			});
		const factors = itemFactors(mine, lineup?.item);
		return {
			userId: s.userId,
			name: s.username,
			isBot: s.wallet.startsWith('seed:'),
			isMe: s.userId === parsed.userId,
			rank: s.rank,
			drafted: Boolean(lineup?.locked),
			car: carRows.find((c) => c.id === lineup?.carId) ?? null,
			item: lineup?.item ?? null,
			// Lineups stay hidden until the race starts.
			picks: lobby.status === 'drafting' ? [] : mine,
			totalPct: mine.reduce((sum, p, i) => sum + p.pct * factors[i], 0),
			score: lineup ? Number(lineup.finalScore ?? 0) : null
		};
	});

	return json({
		id: lobby.id,
		status: lobby.status,
		tournamentId: lobby.tournamentId,
		isFinal: lobby.tournamentStage === 1,
		durationMinutes: lobby.durationMinutes,
		circuit: lobby.circuit,
		draftClosesAt: lobby.draftClosesAt,
		startAt: lobby.startAt,
		endAt: lobby.endAt,
		drivers
	});
}
