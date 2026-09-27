import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { getRpsState } from '$lib/server/rps';

// Polled by the client during a match; also settles a round whose deadline has
// passed, since nothing else runs on a timer.
export async function GET({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const state = await getRpsState(params.id, parsed.userId);
	if (!state) return json({ error: 'Match not found' }, { status: 404 });
	return json(state);
}
