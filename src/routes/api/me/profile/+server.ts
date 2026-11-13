import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cars, users } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { myChallenges, playerCard, rivals } from '$lib/server/players';
import { explorerUrl } from '$lib/server/cars';

// GET: everything the Me page shows (GAMEPLAY_FLOWS.md, F6): your card, rivals,
// challenges, the cars you can showcase, badges you can show, and settings.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const [card, rivalry, challengeList, [user], myCars] = await Promise.all([
		playerCard(parsed.userId, parsed.userId),
		rivals(parsed.userId),
		myChallenges(parsed.userId),
		db
			.select({
				nearAccountId: users.nearAccountId,
				email: users.email,
				showcaseCarId: users.showcaseCarId,
				showcaseBadges: users.showcaseBadges,
				settings: users.settings
			})
			.from(users)
			.where(eq(users.id, parsed.userId)),
		db
			.select({ id: cars.id, model: cars.model, rarity: cars.rarity })
			.from(cars)
			.where(eq(cars.ownerId, parsed.userId))
	]);
	if (!card) return json({ error: 'User not found' }, { status: 404 });
	return json({
		card,
		rivals: rivalry,
		challenges: challengeList,
		cars: myCars,
		showcaseCarId: user?.showcaseCarId ?? null,
		showcaseBadges: user?.showcaseBadges ?? [],
		settings: {
			botChat: 'on',
			notifications: true,
			reducedMotion: false,
			...(user?.settings ?? {})
		},
		nearAccountId: user?.nearAccountId ?? null,
		email: user?.email ?? null,
		nearAccountUrl: user?.nearAccountId ? explorerUrl(user.nearAccountId) : null
	});
}
