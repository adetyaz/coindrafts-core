import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { and, eq, ne, sql } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';

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
		streak: user.streak,
		researchStreak: user.researchStreak,
		freeHitsAvailable: user.freeHitsAvailable,
		matchmakingStatus: user.matchmakingStatus,
		activeBoosts: user.activeBoosts || []
	});
}

// PATCH { username }: set your racing name (first sign-in, or Me → Profile).
// Bots and opponents say it out loud, so it has to read like a name.
const NAME = /^[A-Za-z0-9_]{3,20}$/;

export async function PATCH({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const username = String(body?.username ?? '').trim();
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

	await db.update(users).set({ username }).where(eq(users.id, parsed.userId));
	return json({ ok: true, username });
}
