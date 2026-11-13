import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { SponsorError, adminBookings, decideBooking, isAdmin } from '$lib/server/sponsors';

// Operator only (ADMIN_USER_IDS). GET: every booking. POST { id, action: 'paid' | 'approve' | 'reject', note? }.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed || !isAdmin(parsed.userId)) return json({ error: 'Not found' }, { status: 404 });
	return json(await adminBookings());
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed || !isAdmin(parsed.userId)) return json({ error: 'Not found' }, { status: 404 });
	const body = await request.json().catch(() => ({}));
	try {
		await decideBooking(String(body.id ?? ''), String(body.action ?? ''), body.note);
		return json({ ok: true });
	} catch (e) {
		if (e instanceof SponsorError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
}
