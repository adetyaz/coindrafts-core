import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cars } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { CarRaceError, stakeBlocker, startCarRace } from '$lib/server/carRace';

// GET: your cars, each with why it can't be staked (or null if it can).
// POST { carId, durationMinutes }: stake it against a same-rarity opponent.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const mine = await db
		.select({ id: cars.id, model: cars.model, rarity: cars.rarity, look: cars.look })
		.from(cars)
		.where(eq(cars.ownerId, parsed.userId));
	const withBlockers = await Promise.all(
		mine.map(async (c) => ({ ...c, blocker: await stakeBlocker(parsed.userId, c.id) }))
	);
	return json({ cars: withBlockers });
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	try {
		const { contest, opponent } = await startCarRace(
			parsed.userId,
			String(body.carId),
			Number(body.durationMinutes) || 5
		);
		return json({ ok: true, contestId: contest.id, type: contest.type, opponent });
	} catch (e) {
		if (e instanceof CarRaceError) return json({ error: e.message }, { status: 409 });
		console.error('[api/car-race]', e);
		return json({ error: "Couldn't set up the car race" }, { status: 500 });
	}
}
