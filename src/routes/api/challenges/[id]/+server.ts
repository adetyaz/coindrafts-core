import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { ChallengeError, respondChallenge } from '$lib/server/players';

// POST { action: 'accept' | 'decline' }. Accepting creates the Versus race.
export async function POST({ params, request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => ({}));
	try {
		return json(await respondChallenge(params.id, parsed.userId, body.action === 'accept'));
	} catch (e) {
		if (e instanceof ChallengeError) return json({ error: e.message }, { status: 409 });
		throw e;
	}
}
