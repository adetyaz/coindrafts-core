import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { TriviaError, answerTrivia, startTrivia, triviaToday } from '$lib/server/trivia';

// GET: today's trivia state. POST { action: 'start' } or { action: 'answer', index, answer }.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	return json(await triviaToday(parsed.userId));
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	try {
		if (body.action === 'start') return json(await startTrivia(parsed.userId));
		if (body.action === 'answer') {
			return json(await answerTrivia(parsed.userId, Number(body.index), String(body.answer ?? '')));
		}
		return json({ error: 'Unknown action' }, { status: 400 });
	} catch (e) {
		if (e instanceof TriviaError) return json({ error: e.message }, { status: 409 });
		console.error('[api/trivia]', e);
		return json({ error: 'Trivia is unavailable right now' }, { status: 500 });
	}
}
