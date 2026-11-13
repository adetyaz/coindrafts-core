import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { flushOutbox } from '$lib/server/cars';
import { MarketError, buyListing, cancelListing, getMarket, listCar } from '$lib/server/market';

// GET: the Car Market (tier prices with reasons, open listings, recent sales).
// POST { action: 'list' | 'buy' | 'cancel', ... }: trade.
export async function GET() {
	// Market views also nudge the NEAR queue along: capped at 3s, and safe to
	// overlap because the flusher holds a lock (see flushOutbox).
	await Promise.race([flushOutbox(20).catch(() => null), new Promise((r) => setTimeout(r, 3000))]);
	return json(await getMarket());
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	try {
		if (body.action === 'list') {
			const listing = await listCar(parsed.userId, String(body.carId), Number(body.price));
			return json({ ok: true, listing });
		}
		if (body.action === 'buy') {
			const sale = await buyListing(parsed.userId, String(body.listingId));
			return json({ ok: true, sale });
		}
		if (body.action === 'cancel') {
			await cancelListing(parsed.userId, String(body.listingId));
			return json({ ok: true });
		}
		return json({ error: 'Unknown action' }, { status: 400 });
	} catch (e) {
		if (e instanceof MarketError) return json({ error: e.message }, { status: 409 });
		console.error('[api/market]', e);
		return json({ error: 'Market is unavailable right now' }, { status: 500 });
	}
}
