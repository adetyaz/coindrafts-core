import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { submitThrow } from '$lib/server/rps';

export async function POST({ params, request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const result = await submitThrow(params.id, parsed.userId, body?.shape);
	if ('error' in result) return json({ error: result.error }, { status: result.status });
	return json(result.state);
}
