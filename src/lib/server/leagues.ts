// Leagues (GAMEPLAY_FLOWS.md, F5).
//
// League night, weekly: every member races on the league's home track, in
// grids of up to 5. The grids open an hour before lights out so members can
// draft ahead; anyone who hasn't drafted by lights out races an auto-drafted
// lineup. Fewer than 2 members → that week is skipped, with a note.
//
// Standings come from league nights plus any Versus race between two members
// (contest-resolution.ts). In a league-night grid you beat everyone you
// finish ahead of: each one is a win (3 points), each one ahead of you a loss.
//
// Monthly seasons: when the month turns, the leader gets the trophy badge and
// the Gears prize, the season is recorded, and the standings reset.
//
// Like tournaments, nothing runs on a timer: `sweepLeagues` does whatever is
// due and is called from the league pages, the race page and the daily cron.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	leagueMembers,
	lineups,
	leagueNights,
	leagueSeasons,
	leagues,
	lobbies,
	lobbyParticipants,
	users
} from '$lib/server/schema';
import { kickOffIfReady } from '$lib/server/tournament-resolution';
import { resolveLobby } from '$lib/server/lobby-resolution';
import { grantGears } from '$lib/server/cars';
import { awardLeagueChampionBadge } from '$lib/server/badges';
import { notifyAll } from '$lib/server/notify';

export const GRID_SIZE = 5;
/** Grids open this long before lights out, for drafting ahead. */
export const OPENS_BEFORE_MS = 60 * 60_000;
/** A season prize needs a real league, or one player alone could farm it. */
export const MIN_MEMBERS_FOR_PRIZE = 3;

type League = typeof leagues.$inferSelect;

export function monthKey(d = new Date()): string {
	return d.toISOString().slice(0, 7);
}

/** This week's lights-out (UTC) for a league: its night day and hour, Monday-start week. */
export function nightOfWeek(
	league: Pick<League, 'nightDay' | 'nightHour'>,
	now = new Date()
): Date {
	const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
	const at = new Date(monday);
	at.setUTCDate(monday.getUTCDate() + ((league.nightDay + 6) % 7));
	at.setUTCHours(league.nightHour, 0, 0, 0);
	return at;
}

/** The next lights-out from now (this week's if it hasn't happened, else next week's). */
export function nextNight(league: Pick<League, 'nightDay' | 'nightHour'>, now = new Date()): Date {
	const thisWeek = nightOfWeek(league, now);
	if (thisWeek.getTime() > now.getTime()) return thisWeek;
	return new Date(thisWeek.getTime() + 7 * 86_400_000);
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/**
 * Opens this week's league night once we're within an hour of lights out:
 * grids of up to 5 (split evenly), draft deadline = lights out. Once per week
 * per league (the unique night row is the claim).
 */
async function openNight(league: League, now = new Date()) {
	const lightsOut = nightOfWeek(league, now);
	if (now.getTime() < lightsOut.getTime() - OPENS_BEFORE_MS) return;
	// A night only opens in its own window; a league created after it waits for next week.
	if (now.getTime() > lightsOut.getTime() + 6 * 3600_000) return;

	const members = await db
		.select({ userId: leagueMembers.userId })
		.from(leagueMembers)
		.where(eq(leagueMembers.leagueId, league.id));
	const skipped = members.length < 2;
	const [night] = await db
		.insert(leagueNights)
		.values({
			leagueId: league.id,
			night: dayOf(lightsOut),
			status: skipped ? 'skipped' : 'racing',
			note: skipped ? 'Skipped: league night needs at least 2 members.' : null
		})
		.onConflictDoNothing()
		.returning();
	if (!night || skipped) return;

	const ids = shuffle(members.map((m) => m.userId!));
	const gridCount = Math.ceil(ids.length / GRID_SIZE);
	for (let g = 0; g < gridCount; g++) {
		// Even split: 7 members race 4 + 3, not 5 + 2.
		const seats = ids.filter((_id, i) => i % gridCount === g);
		const [lobby] = await db
			.insert(lobbies)
			.values({
				createdBy: league.createdBy,
				contestType: 'daily',
				format: 'fixed',
				size: seats.length,
				status: 'drafting',
				durationMinutes: league.nightMinutes,
				circuit: league.homeTrack,
				draftClosesAt: lightsOut,
				leagueNightId: night.id
			})
			.returning();
		await db
			.insert(lobbyParticipants)
			.values(seats.map((userId) => ({ lobbyId: lobby.id, userId })));
	}
	await notifyAll(ids, 'league', {
		title: `${league.name}: league night is open`,
		body: 'Draft before lights out, or race an auto-drafted lineup.',
		url: `/leagues/${league.id}`,
		tag: `league-${night.id}`
	});
}

/**
 * Points from one finished grid: each member beats everyone they finished
 * ahead of. Called once, from resolveLobby, right after the grid resolves.
 */
export async function onLeagueGridResolved(lobby: { id: string; leagueNightId: string | null }) {
	if (!lobby.leagueNightId) return;
	const [night] = await db
		.select()
		.from(leagueNights)
		.where(eq(leagueNights.id, lobby.leagueNightId));
	if (!night) return;
	const ranked = await db
		.select({ userId: lobbyParticipants.userId, rank: lobbyParticipants.rank })
		.from(lobbyParticipants)
		.where(eq(lobbyParticipants.lobbyId, lobby.id))
		.orderBy(asc(lobbyParticipants.rank));
	const n = ranked.length;
	for (const r of ranked) {
		const ahead = (r.rank ?? n) - 1;
		const beaten = n - 1 - ahead;
		await db
			.update(leagueMembers)
			.set({
				wins: sql`coalesce(${leagueMembers.wins}, 0) + ${beaten}`,
				losses: sql`coalesce(${leagueMembers.losses}, 0) + ${ahead}`,
				points: sql`coalesce(${leagueMembers.points}, 0) + ${beaten * 3}`
			})
			.where(and(eq(leagueMembers.leagueId, night.leagueId), eq(leagueMembers.userId, r.userId!)));
	}
	// The night is done when every grid is.
	const open = await db
		.select({ id: lobbies.id })
		.from(lobbies)
		.where(and(eq(lobbies.leagueNightId, night.id), sql`${lobbies.status} <> 'resolved'`));
	if (!open.length) {
		await db.update(leagueNights).set({ status: 'done' }).where(eq(leagueNights.id, night.id));
	}
}

/**
 * Versus between two members of the same league counts in that league's
 * table (and only then). Called from contest resolution.
 */
export async function recordVersus(winnerId: string, loserId: string) {
	const shared = await db
		.select({ leagueId: leagueMembers.leagueId })
		.from(leagueMembers)
		.where(eq(leagueMembers.userId, winnerId))
		.then(async (mine) => {
			const ids = mine.map((m) => m.leagueId!).filter(Boolean);
			if (!ids.length) return [];
			return db
				.select({ leagueId: leagueMembers.leagueId })
				.from(leagueMembers)
				.where(and(eq(leagueMembers.userId, loserId), inArray(leagueMembers.leagueId, ids)));
		});
	for (const { leagueId } of shared) {
		await db
			.update(leagueMembers)
			.set({
				wins: sql`coalesce(${leagueMembers.wins}, 0) + 1`,
				points: sql`coalesce(${leagueMembers.points}, 0) + 3`
			})
			.where(and(eq(leagueMembers.leagueId, leagueId!), eq(leagueMembers.userId, winnerId)));
		await db
			.update(leagueMembers)
			.set({ losses: sql`coalesce(${leagueMembers.losses}, 0) + 1` })
			.where(and(eq(leagueMembers.leagueId, leagueId!), eq(leagueMembers.userId, loserId)));
	}
}

/**
 * Month turned: the leader takes the season (trophy badge + Gears), it's
 * recorded, the table resets. The season row is the claim, so it pays once.
 */
async function rollSeason(league: League, now = new Date()) {
	const current = monthKey(now);
	if (!league.seasonMonth) {
		await db.update(leagues).set({ seasonMonth: current }).where(eq(leagues.id, league.id));
		return;
	}
	if (league.seasonMonth === current) return;

	const table = await db
		.select({
			userId: leagueMembers.userId,
			points: leagueMembers.points,
			wins: leagueMembers.wins
		})
		.from(leagueMembers)
		.where(eq(leagueMembers.leagueId, league.id));
	const leader = [...table].sort(
		(a, b) => (b.points ?? 0) - (a.points ?? 0) || (b.wins ?? 0) - (a.wins ?? 0)
	)[0];
	const winner = leader && (leader.points ?? 0) > 0 ? leader : null;
	const prize = winner && table.length >= MIN_MEMBERS_FOR_PRIZE ? league.seasonPrize : 0;

	const [season] = await db
		.insert(leagueSeasons)
		.values({
			leagueId: league.id,
			month: league.seasonMonth,
			winnerId: winner?.userId ?? null,
			points: winner?.points ?? 0,
			prize
		})
		.onConflictDoNothing()
		.returning();
	if (season && winner?.userId) {
		await awardLeagueChampionBadge(winner.userId);
		if (prize > 0)
			await grantGears(winner.userId, prize, `season ${league.seasonMonth}: ${league.name}`);
	}
	await db
		.update(leagueMembers)
		.set({ wins: 0, losses: 0, points: 0 })
		.where(eq(leagueMembers.leagueId, league.id));
	await db.update(leagues).set({ seasonMonth: current }).where(eq(leagues.id, league.id));
}

/** Seasons, league nights, grid kick-offs and results: whatever is due. Idempotent. */
export async function sweepLeagues() {
	const now = new Date();
	const all = await db.select().from(leagues);
	for (const l of all) {
		try {
			await rollSeason(l, now);
			await openNight(l, now);
		} catch (e) {
			console.error(`[leagues] ${l.id} failed:`, e);
		}
	}
	const grids = await db
		.select()
		.from(lobbies)
		.where(
			and(sql`${lobbies.leagueNightId} is not null`, inArray(lobbies.status, ['drafting', 'live']))
		);
	for (const g of grids) {
		try {
			if (g.status === 'drafting') await kickOffIfReady(g);
			else if (g.endAt && new Date(g.endAt) <= now) await resolveLobby(g.id);
		} catch (e) {
			console.error(`[leagues] grid ${g.id} failed:`, e);
		}
	}
}

/** For the league page: this week's night, my grid in it, recent nights, past seasons. */
export async function leagueNightView(league: League, userId: string) {
	const nights = await db
		.select()
		.from(leagueNights)
		.where(eq(leagueNights.leagueId, league.id))
		.orderBy(sql`${leagueNights.night} desc`)
		.limit(6);
	const latest = nights[0] ?? null;
	let myGrid: { lobbyId: string; status: string; drafted: boolean } | null = null;
	let grids: { lobbyId: string; status: string; drivers: string[] }[] = [];
	if (latest && latest.status !== 'skipped') {
		const rows = await db
			.select({
				lobbyId: lobbies.id,
				status: lobbies.status,
				userId: lobbyParticipants.userId,
				username: users.username
			})
			.from(lobbies)
			.innerJoin(lobbyParticipants, eq(lobbyParticipants.lobbyId, lobbies.id))
			.innerJoin(users, eq(users.id, lobbyParticipants.userId))
			.where(eq(lobbies.leagueNightId, latest.id));
		const ids = [...new Set(rows.map((r) => r.lobbyId))];
		grids = ids.map((id) => ({
			lobbyId: id,
			status: rows.find((r) => r.lobbyId === id)!.status ?? 'drafting',
			drivers: rows.filter((r) => r.lobbyId === id).map((r) => r.username)
		}));
		const mine = rows.find((r) => r.userId === userId);
		if (mine) {
			const [lineup] = await db
				.select({ id: lineups.id })
				.from(lineups)
				.where(
					and(
						eq(lineups.lobbyId, mine.lobbyId),
						eq(lineups.userId, userId),
						eq(lineups.locked, true)
					)
				);
			myGrid = {
				lobbyId: mine.lobbyId,
				status: mine.status ?? 'drafting',
				drafted: Boolean(lineup)
			};
		}
	}
	const seasons = await db
		.select({
			month: leagueSeasons.month,
			points: leagueSeasons.points,
			prize: leagueSeasons.prize,
			winner: users.username
		})
		.from(leagueSeasons)
		.leftJoin(users, eq(users.id, leagueSeasons.winnerId))
		.where(eq(leagueSeasons.leagueId, league.id))
		.orderBy(sql`${leagueSeasons.month} desc`)
		.limit(12);
	return {
		nextNight: nextNight(league),
		latest: latest ? { night: latest.night, status: latest.status, note: latest.note } : null,
		grids,
		myGrid,
		seasons
	};
}
