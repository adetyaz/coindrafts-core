import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { cars, userBadges, users } from '$lib/server/schema';
import { and, eq, ne, sql } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';
import { NOTIFY_KIND_IDS } from '$lib/notifications';

export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, parsed.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!user) return json({ error: 'User not found' }, { status: 404 });

	return json({
		id: user.id,
		username: user.username,
		walletAddress: user.walletAddress,
		xpTotal: user.xpTotal,
		paperXpTotal: user.paperXpTotal,
		gears: user.gears,
		streak: user.streak,
		researchStreak: user.researchStreak,
		freeHitsAvailable: user.freeHitsAvailable,
		matchmakingStatus: user.matchmakingStatus,
		activeBoosts: user.activeBoosts || [],
		settings: user.settings ?? {},
		email: user.email ?? null
	});
}

// PATCH: any of { username, email, showcaseCarId, showcaseBadges, settings }.
// Username: bots and opponents say it out loud, so it has to read like a name.
const NAME = /^[A-Za-z0-9_]{3,20}$/;
const BOT_CHAT = ['on', 'quiet', 'off'];

export async function PATCH({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const set: Partial<typeof users.$inferInsert> = {};

	if (body.username !== undefined) {
		const username = String(body.username ?? '').trim();
		if (!NAME.test(username)) {
			return json(
				{ error: 'Use 3–20 letters, numbers or underscores (no spaces).' },
				{ status: 400 }
			);
		}
		// Case-insensitive, so "Tayo" and "tayo" can't both exist.
		const [taken] = await db
			.select({ id: users.id })
			.from(users)
			.where(and(sql`lower(${users.username}) = lower(${username})`, ne(users.id, parsed.userId)))
			.limit(1);
		if (taken) return json({ error: 'That name is taken — try another.' }, { status: 409 });
		set.username = username;
	}

	if (body.email !== undefined) {
		const email = String(body.email ?? '')
			.trim()
			.toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
			return json({ error: 'That email address does not look right' }, { status: 400 });
		}
		set.email = email;
	}

	if (body.showcaseCarId !== undefined) {
		if (body.showcaseCarId === null) set.showcaseCarId = null;
		else {
			const [car] = await db
				.select({ id: cars.id })
				.from(cars)
				.where(and(eq(cars.id, String(body.showcaseCarId)), eq(cars.ownerId, parsed.userId)));
			if (!car) return json({ error: "That isn't your car" }, { status: 400 });
			set.showcaseCarId = car.id;
		}
	}

	if (body.showcaseBadges !== undefined) {
		const wanted = Array.isArray(body.showcaseBadges) ? body.showcaseBadges.map(String) : [];
		const earned = new Set(
			(
				await db
					.select({ code: userBadges.badgeCode })
					.from(userBadges)
					.where(eq(userBadges.userId, parsed.userId))
			).map((b) => b.code)
		);
		set.showcaseBadges = wanted.filter((c: string) => earned.has(c)).slice(0, 3);
	}

	if (body.settings && typeof body.settings === 'object') {
		const [cur] = await db
			.select({ settings: users.settings })
			.from(users)
			.where(eq(users.id, parsed.userId));
		const next = { ...(cur?.settings ?? {}) };
		if (BOT_CHAT.includes(body.settings.botChat)) next.botChat = body.settings.botChat;
		if (typeof body.settings.notifications === 'boolean')
			next.notifications = body.settings.notifications;
		if (typeof body.settings.reducedMotion === 'boolean')
			next.reducedMotion = body.settings.reducedMotion;
		// Notifications: one toggle per kind, quiet hours (local hours 0–23).
		if (body.settings.notify && typeof body.settings.notify === 'object') {
			const notify = { ...(next.notify ?? {}) };
			for (const k of NOTIFY_KIND_IDS) {
				if (typeof body.settings.notify[k] === 'boolean') notify[k] = body.settings.notify[k];
			}
			next.notify = notify;
		}
		for (const key of ['quietStart', 'quietEnd'] as const) {
			const h = body.settings[key];
			if (Number.isInteger(h) && h >= 0 && h <= 23) next[key] = h;
		}
		set.settings = next;
	}

	if (!Object.keys(set).length) return json({ error: 'Nothing to change' }, { status: 400 });
	await db.update(users).set(set).where(eq(users.id, parsed.userId));
	return json({ ok: true, ...set });
}
