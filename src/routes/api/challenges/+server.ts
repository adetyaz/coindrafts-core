import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { ChallengeError, myChallenges, sendChallenge } from '$lib/server/players';

// GET: challenges to and from you (last 24h). POST { toUserId, durationMinutes, message? }.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	return json(await myChallenges(parsed.userId));
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => ({}));
	try {
		const c = await sendChallenge(
			parsed.userId,
			String(body.toUserId ?? ''),
			Number(body.durationMinutes) || 15,
			typeof body.message === 'string' ? body.message : undefined
		);
		return json({ ok: true, id: c.id });
	} catch (e) {
		if (e instanceof ChallengeError) return json({ error: e.message }, { status: 409 });
		throw e;
	}
}
