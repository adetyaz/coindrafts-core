import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { ItemError, buyItem, getInventory } from '$lib/server/items';
import { isItemKind } from '$lib/race/items';

// GET: items you own and this week's use. POST { action: 'buy', kind }: Showroom.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	return json(await getInventory(parsed.userId));
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	if (body.action !== 'buy' || !isItemKind(body.kind))
		return json({ error: 'Unknown item' }, { status: 400 });
	try {
		await buyItem(parsed.userId, body.kind);
		return json({ ok: true, ...(await getInventory(parsed.userId)) });
	} catch (e) {
		if (e instanceof ItemError) return json({ error: e.message }, { status: 409 });
		console.error('[api/items]', e);
		return json({ error: 'Items are unavailable right now' }, { status: 500 });
	}
}
