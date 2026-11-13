import { json } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pushSubscriptions, users } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';

// POST { subscription, tzOffset }: this browser agreed to notifications.
// DELETE { endpoint }: turn them off for this browser.
export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => ({}));
	const sub = body?.subscription;
	const endpoint = String(sub?.endpoint ?? '');
	const p256dh = String(sub?.keys?.p256dh ?? '');
	const auth = String(sub?.keys?.auth ?? '');
	if (!/^https:\/\//.test(endpoint) || !p256dh || !auth)
		return json({ error: 'Invalid subscription' }, { status: 400 });

	// The same browser re-subscribing (or moving to another account) keeps one row.
	await db
		.insert(pushSubscriptions)
		.values({ userId: parsed.userId, endpoint, p256dh, auth })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId: parsed.userId, p256dh, auth }
		});

	// Quiet hours are judged in the player's local time.
	const tzOffset = Number(body?.tzOffset);
	const [u] = await db
		.select({ settings: users.settings })
		.from(users)
		.where(eq(users.id, parsed.userId));
	await db
		.update(users)
		.set({
			settings: {
				...(u?.settings ?? {}),
				notifications: true,
				...(Number.isFinite(tzOffset) && Math.abs(tzOffset) <= 14 * 60 ? { tzOffset } : {})
			}
		})
		.where(eq(users.id, parsed.userId));
	return json({ ok: true });
}

export async function DELETE({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => ({}));
	await db
		.delete(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.endpoint, String(body?.endpoint ?? '')),
				eq(pushSubscriptions.userId, parsed.userId)
			)
		);
	return json({ ok: true });
}
