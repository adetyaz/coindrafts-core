// The daily notifications the cron sends (GAMEPLAY_FLOWS.md, F11): today's
// trivia for players keeping a streak, and a bot with a grudge asking for a
// rematch. Only players who turned notifications on are considered, so this
// stays small however many accounts exist.
import { inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { notify, subscribedUserIds } from '$lib/server/notify';
import { botRival } from '$lib/server/rivalry';
import { SCRIMMAGE_BOTS } from '$lib/server/botDraft';

const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export async function dailyNudges() {
	const ids = await subscribedUserIds();
	if (!ids.length) return { trivia: 0, grudges: 0 };
	const people = await db
		.select({ id: users.id, streak: users.triviaStreak, lastPass: users.triviaLastPass })
		.from(users)
		.where(inArray(users.id, ids));

	let trivia = 0;
	let grudges = 0;
	for (const p of people) {
		// Streak alive (passed yesterday): today's set keeps it going.
		if (p.streak > 0 && p.lastPass === yesterday()) {
			await notify(p.id, 'trivia', {
				title: "Today's trivia is live",
				body: `8 questions, about a minute. Keep your ${p.streak}-day streak.`,
				url: '/dashboard',
				tag: 'trivia'
			});
			trivia++;
		}
		// One bot with a grudge, at most one nudge a day.
		for (const bot of SCRIMMAGE_BOTS) {
			const rival = await botRival(bot.id, p.id).catch(() => null);
			if (rival?.mood !== 'grudge') continue;
			await notify(p.id, 'challenge', {
				title: `${rival.username} has a grudge`,
				body: "It hasn't forgotten last time. Rematch?",
				url: `/players/${bot.id}`,
				tag: 'grudge'
			});
			grudges++;
			break;
		}
	}
	return { trivia, grudges };
}
