import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { contests, lineups } from '$lib/server/schema';
import { and, eq, or } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';
import { DEFAULT_DURATION_MINUTES, normalizeDuration } from '$lib/constants';
import { BINARY_LENGTHS, BINARY_SOLO, BINARY_VERSUS } from '$lib/race/binary';

export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) {
		return json([]);
	}

	const userContests = await db
		.select()
		.from(contests)
		.where(or(eq(contests.userAId, parsed.userId), eq(contests.userBId, parsed.userId)));

	// So the dashboard can tell "already locked, waiting/racing" apart from
	// "haven't drafted yet" — without it, every non-resolved contest looked
	// the same and linked back to /draft even once a lineup was locked.
	const myLockedLineups = await db
		.select({ contestId: lineups.contestId })
		.from(lineups)
		.where(and(eq(lineups.userId, parsed.userId), eq(lineups.locked, true)));
	const lockedContestIds = new Set(myLockedLineups.map((l) => l.contestId));

	return json(userContests.map((c) => ({ ...c, myLineupLocked: lockedContestIds.has(c.id) })));
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const type = body.type === 'weekly' ? 'weekly' : 'daily';
	// Binary mode (F9): solo against the market, or Versus a bot. Solo plays like
	// a Scrimmage (practice XP, Scrimmage Gears), so it can't be farmed.
	const binary = body.mode === 'binary';
	const mode = binary ? (body.opponent === 'bot' ? BINARY_VERSUS : BINARY_SOLO) : null;
	const isPaper = body.mode === 'paper' || mode === BINARY_SOLO;
	let durationMinutes = normalizeDuration(body.durationMinutes ?? DEFAULT_DURATION_MINUTES);
	if (binary && !BINARY_LENGTHS.some((l) => l.minutes === durationMinutes)) durationMinutes = 5;

	// Reuse any open or live contest the user already has of the same
	// type/mode/duration. Duration is part of the identity here: a 20-minute game
	// and a 24-hour game are different games, so reusing one for the other would
	// silently hand back a contest with the wrong clock.
	const existing = await db
		.select()
		.from(contests)
		.where(or(eq(contests.userAId, parsed.userId), eq(contests.userBId, parsed.userId)))
		.then(
			(rows) =>
				rows.find(
					(c) =>
						(c.status === 'open' || c.status === 'live') &&
						c.type === type &&
						Boolean(c.isPaper) === isPaper &&
						(c.mode ?? null) === mode &&
						(c.durationMinutes ?? DEFAULT_DURATION_MINUTES) === durationMinutes
				) ?? null
		);

	if (existing) {
		return json(existing);
	}

	// No active contest of this type/mode — create one. Paper contests are always bot-only.
	const [newContest] = await db
		.insert(contests)
		.values({
			userAId: parsed.userId,
			userBId: null,
			type,
			isPaper,
			durationMinutes,
			mode,
			status: 'open'
		})
		.returning();

	return json(newContest);
}
