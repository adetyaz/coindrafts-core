import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	cars,
	lobbies,
	lobbyParticipants,
	lineups,
	lineupPicks,
	tournaments
} from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { getSnapshot, extractPrice } from '$lib/server/sosovalue';
import { getAllPrices } from '$lib/server/prices';
import { kickOffIfReady } from '$lib/server/tournament-resolution';
import { classifySector } from '$lib/sectors';

export async function POST({ params, request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const lobbyId = params.id;
	if (!lobbyId) return json({ error: 'Lobby id is required' }, { status: 400 });

	const body = await request.json();
	const picks = Array.isArray(body?.picks) ? body.picks : [];
	if (picks.length !== 5) {
		return json({ error: 'Exactly 5 picks are required' }, { status: 400 });
	}

	const lobby = await db
		.select()
		.from(lobbies)
		.where(eq(lobbies.id, lobbyId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!lobby) return json({ error: 'Lobby not found' }, { status: 404 });
	// Lineups lock while drafting. After the deadline the race has started (or
	// is about to, with an auto-drafted lineup for anyone who missed it).
	if (lobby.status !== 'drafting' && lobby.status !== 'waiting') {
		return json({ error: 'The draft is closed: this race has started.' }, { status: 409 });
	}

	const participants = await db
		.select()
		.from(lobbyParticipants)
		.where(eq(lobbyParticipants.lobbyId, lobbyId));

	if (!participants.some((p) => p.userId === parsed.userId)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const ids = picks.map((p: { currencyId: unknown }) => String(p.currencyId));
	if (new Set(ids).size !== ids.length) {
		return json({ error: 'Each token can only be picked once' }, { status: 400 });
	}

	// The restriction used to be applied only by the draft page's token filter,
	// and each pick's sector was taken from the request body — so any direct
	// POST could ignore it. Classify server-side instead of trusting the client.
	let sectorRestriction: string | null = null;
	if (lobby.tournamentId) {
		const [t] = await db
			.select({ sectorRestriction: tournaments.sectorRestriction })
			.from(tournaments)
			.where(eq(tournaments.id, lobby.tournamentId))
			.limit(1);
		sectorRestriction = t?.sectorRestriction ?? null;
	}
	if (sectorRestriction) {
		const offSector = picks.find(
			(p: { symbol?: unknown }) => classifySector([String(p.symbol ?? '')]) !== sectorRestriction
		);
		if (offSector) {
			return json(
				{
					error: `${String(offSector.symbol ?? '').toUpperCase()} isn't a ${sectorRestriction.toUpperCase()} token — this tournament is ${sectorRestriction.toUpperCase()}-only`
				},
				{ status: 400 }
			);
		}
	}

	const existingLineup = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.lobbyId, lobbyId), eq(lineups.userId, parsed.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	// The car from the race setup step. Cosmetic; a bad value is ignored.
	let carId: string | null = null;
	if (typeof body?.carId === 'string') {
		const [car] = await db
			.select({ id: cars.id, ownerId: cars.ownerId })
			.from(cars)
			.where(eq(cars.id, body.carId));
		if (car?.ownerId === parsed.userId) carId = car.id;
	}

	let lineupId = existingLineup?.id;
	if (!lineupId) {
		const inserted = await db
			.insert(lineups)
			.values({ lobbyId, userId: parsed.userId, locked: true, finalScore: '0', carId })
			.returning({ id: lineups.id });
		lineupId = inserted[0].id;
	} else {
		await db.update(lineups).set({ locked: true, carId }).where(eq(lineups.id, lineupId));
		await db.delete(lineupPicks).where(eq(lineupPicks.lineupId, lineupId));
	}

	// One batch for all five entry prices (same source scoring uses), with a
	// single-token lookup only as a fallback. Five parallel snapshot calls
	// were the burst pattern that rate-limited 1v1 lineups to $0 entries.
	const fresh = await getAllPrices().catch(() => null);
	const snapshots = await Promise.all(
		picks.map(async (p: { currencyId: unknown; symbol?: unknown }) => {
			const live = fresh?.get(String(p.symbol ?? '').toUpperCase())?.price;
			if (live && live > 0) return { price: live };
			return getSnapshot(String(p.currencyId)).catch(() => null);
		})
	);

	for (let i = 0; i < picks.length; i++) {
		const pick = picks[i];
		const snap = snapshots[i] as { price?: number } | null;
		const entryPrice = snap && 'price' in snap && snap.price ? snap.price : extractPrice(snap);
		await db.insert(lineupPicks).values({
			lineupId,
			tokenSymbol: String(pick.symbol ?? '').toUpperCase(),
			tokenName: String(pick.name ?? pick.symbol ?? ''),
			sector: sectorRestriction ?? String(pick.sector ?? 'wildcard'),
			currencyId: String(pick.currencyId),
			entryPrice: String(entryPrice),
			exitPrice: String(entryPrice),
			pctChange: '0',
			score: '0'
		});
	}

	// Once every participant has locked a lineup, the lobby goes live
	// Everyone drafted? The race starts (after the pre-race grid moment).
	await kickOffIfReady(lobby);

	return json({ ok: true, lobbyId, lineupId });
}
