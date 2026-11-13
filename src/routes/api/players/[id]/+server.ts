import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { playerCard } from '$lib/server/players';

// GET /api/players/[id or username]: a player's or bot's card (GAMEPLAY_FLOWS.md, F6).
export async function GET({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	const card = await playerCard(params.id, parsed.userId);
	if (!card) return json({ error: 'Player not found' }, { status: 404 });
	return json(card);
}
