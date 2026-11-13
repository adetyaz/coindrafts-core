import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { and, eq, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lobbies } from '$lib/server/schema';
import { resolveContest } from '$lib/server/contest-resolution';
import { resolveLobby } from '$lib/server/lobby-resolution';
import { flushOutbox } from '$lib/server/cars';
import { cancelAbandonedCarRaces } from '$lib/server/carRace';
import { sweepTournaments } from '$lib/server/tournament-resolution';

// Merges the contest and lobby resolution sweeps into a single cron job.
// Vercel's Hobby plan caps cron jobs at once/day and limits how many a
// project can have — this keeps us to one daily job instead of two hourly
// ones. The lazy-resolve-on-view path (hitting a result page) still
// resolves instantly regardless of this cron's cadence; this is just the
// catch-all for anyone who never loads their result page.
async function sweep(authHeader: string | null) {
	if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const now = new Date();

	const dueContests = await db
		.select({ id: contests.id })
		.from(contests)
		.where(and(eq(contests.status, 'live'), lte(contests.endAt, now)));

	const dueLobbies = await db
		.select({ id: lobbies.id })
		.from(lobbies)
		.where(and(eq(lobbies.status, 'live'), lte(lobbies.endAt, now)));

	const contestResults = await Promise.all(
		dueContests.map(async (c) => ({ contestId: c.id, ...(await resolveContest(c.id)) }))
	);
	const lobbyResults = await Promise.all(
		dueLobbies.map(async (l) => ({ lobbyId: l.id, ...(await resolveLobby(l.id)) }))
	);

	// Tournaments: closes, kick-offs, results and tomorrow's cups.
	const tournamentSweep = await sweepTournaments().catch((e) => ({ error: String(e) }));

	// Car races nobody started within the hour: cars go back to their garages.
	const carRacesCancelled = await cancelAbandonedCarRaces().catch((e) => {
		console.error('[cron/resolve-all] car race cleanup failed:', e);
		return 0;
	});

	// Catch-all for on-chain car/Gears writes that a sign-in or garage view
	// didn't get to (see near_outbox in schema.ts).
	const near = await flushOutbox(100).catch((e) => ({ error: String(e) }));

	return json({
		near,
		carRacesCancelled,
		tournaments: tournamentSweep,
		contests: {
			checked: dueContests.length,
			resolved: contestResults.filter((r) => r.resolved).length,
			results: contestResults
		},
		lobbies: {
			checked: dueLobbies.length,
			resolved: lobbyResults.filter((r) => r.resolved).length,
			results: lobbyResults
		}
	});
}

// Vercel Cron Jobs send GET requests
export async function GET({ request }) {
	return sweep(request.headers.get('authorization'));
}

// Kept for manual/local triggering
export async function POST({ request }) {
	return sweep(request.headers.get('authorization'));
}
