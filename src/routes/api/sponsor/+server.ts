import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import {
	SponsorError,
	bookAd,
	bookTournament,
	isAdmin,
	sponsorDashboard
} from '$lib/server/sponsors';

// GET: the sponsor dashboard (bookings, views, invoices). POST { kind: 'ad' | 'tournament', ... }.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	return json({ ...(await sponsorDashboard(parsed.userId)), isAdmin: isAdmin(parsed.userId) });
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => ({}));
	try {
		const booking =
			body.kind === 'tournament'
				? await bookTournament(parsed.userId, body)
				: await bookAd(parsed.userId, body);
		return json({ ok: true, ...booking });
	} catch (e) {
		if (e instanceof SponsorError) return json({ error: e.message }, { status: 400 });
		console.error('[api/sponsor]', e);
		return json({ error: "Couldn't save the booking" }, { status: 500 });
	}
}
