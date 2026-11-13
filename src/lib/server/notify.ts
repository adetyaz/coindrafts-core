// Web Push notifications (GAMEPLAY_FLOWS.md, F11). One call — `notify` — that
// every trigger uses. It checks the player's settings (all on/off, each kind,
// quiet hours in their local time), skips bots, sends to every browser they
// enabled, and forgets subscriptions the browser has revoked.
//
// Never throws: a notification is a courtesy, so a push failure must not break
// a race result, a trade or a draw. Needs PUBLIC_VAPID_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT; without them it quietly does nothing.
import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pushSubscriptions, users } from '$lib/server/schema';
import { inQuietHours, type NotifyKind } from '$lib/notifications';

export type Push = { title: string; body: string; url?: string; tag?: string };

let configured: boolean | null = null;
function ready(): boolean {
	if (configured !== null) return configured;
	const pub = publicEnv.PUBLIC_VAPID_KEY;
	const priv = env.VAPID_PRIVATE_KEY;
	if (!pub || !priv) return (configured = false);
	webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:notifications@coindraft.app', pub, priv);
	return (configured = true);
}

export async function notify(userId: string, kind: NotifyKind, push: Push): Promise<void> {
	try {
		if (!ready()) return;
		const [user] = await db
			.select({ wallet: users.walletAddress, settings: users.settings })
			.from(users)
			.where(eq(users.id, userId));
		if (!user || user.wallet.startsWith('seed:')) return;
		const s = user.settings ?? {};
		if (s.notifications === false || s.notify?.[kind] === false) return;
		if (inQuietHours(s)) return;

		const subs = await db
			.select()
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.userId, userId));
		const dead: string[] = [];
		await Promise.all(
			subs.map(async (sub) => {
				try {
					await webpush.sendNotification(
						{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
						JSON.stringify(push),
						{ TTL: 60 * 60 }
					);
				} catch (e) {
					const status = (e as { statusCode?: number }).statusCode;
					// 404/410: the browser revoked it (uninstalled, cleared, denied).
					if (status === 404 || status === 410) dead.push(sub.id);
				}
			})
		);
		if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
	} catch (e) {
		console.error('[notify]', kind, e instanceof Error ? e.message : e);
	}
}

/** The same notification to several players (each still filtered by their own settings). */
export async function notifyAll(userIds: string[], kind: NotifyKind, push: Push) {
	await Promise.all([...new Set(userIds)].map((id) => notify(id, kind, push)));
}

/** Players who have at least one browser subscribed (to keep fan-outs small). */
export async function subscribedUserIds(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ userId: pushSubscriptions.userId })
		.from(pushSubscriptions)
		.catch(() => []);
	return rows.map((r) => r.userId);
}
