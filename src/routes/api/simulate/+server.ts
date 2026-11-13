import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { flushOutbox } from '$lib/server/cars';
import { SIM_DAYS, botSummary, simulateDay } from '$lib/server/simulate';

// One simulated day per request (POST { day: 1..7 }); the Car Market page
// plays the week by calling this seven times in a row. A whole week in one
// request ran 90–190s against a remote database — past serverless limits —
// and showed nothing until the end.
export const config = { maxDuration: 60 };

// A new week can start once every few minutes, across everyone: each run moves
// the real bot economy and queues on-chain writes, so it shouldn't be spammed.
const COOLDOWN_MS = 3 * 60 * 1000;
let lastStart = 0;

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	if (!token || !parseSessionToken(token)) {
		return json({ error: 'Sign in to run the simulation' }, { status: 401 });
	}
	const { day } = await request.json().catch(() => ({ day: 1 }));
	const n = Number(day);

	if (n === 1) {
		const wait = lastStart + COOLDOWN_MS - Date.now();
		if (wait > 0) {
			return json(
				{ error: `A week was just simulated. Try again in ${Math.ceil(wait / 60000)} min.` },
				{ status: 429 }
			);
		}
		lastStart = Date.now();
	}

	try {
		const result = await simulateDay(n);
		if (n < SIM_DAYS) return json({ day: result, done: false });

		// Last day: start replaying the week on NEAR. Whatever doesn't fit here is
		// picked up by the next flush (Car Market views, sign-ins, the daily job).
		const near = await Promise.race([
			flushOutbox(50),
			new Promise<null>((r) => setTimeout(() => r(null), 8_000))
		]).catch(() => null);
		return json({ day: result, done: true, bots: await botSummary(), near });
	} catch (e) {
		if (n === 1) lastStart = 0;
		console.error('[api/simulate]', e);
		return json({ error: e instanceof Error ? e.message : 'Simulation failed' }, { status: 500 });
	}
}
