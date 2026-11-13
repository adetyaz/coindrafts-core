// A bot's memory of a player: their head-to-head, read from the contests table
// (every 1v1 already records both players and the winner, so no extra state).
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, users } from '$lib/server/schema';
import { moodFor, personalityOf, type HeadToHead, type Mood } from '$lib/bots/personalities';

export async function headToHead(botId: string, playerId: string): Promise<HeadToHead> {
	const rows = await db
		.select({ winnerId: contests.winnerId })
		.from(contests)
		.where(
			and(
				eq(contests.status, 'resolved'),
				or(
					and(eq(contests.userAId, botId), eq(contests.userBId, playerId)),
					and(eq(contests.userAId, playerId), eq(contests.userBId, botId))
				)
			)
		)
		.orderBy(desc(contests.endAt))
		.limit(50);
	const recent = rows
		.filter((r) => r.winnerId)
		.map((r) => (r.winnerId === botId ? 'bot' : 'player') as 'bot' | 'player');
	return {
		races: recent.length,
		botWins: recent.filter((r) => r === 'bot').length,
		playerWins: recent.filter((r) => r === 'player').length,
		recent: recent.slice(0, 5)
	};
}

export type BotRival = {
	username: string;
	tagline: string;
	draft: string;
	mood: Mood;
	record: HeadToHead;
};

/** Personality + mood for a bot opponent, or null when the user isn't a bot. */
export async function botRival(botUserId: string, playerId: string): Promise<BotRival | null> {
	const [bot] = await db
		.select({ username: users.username, wallet: users.walletAddress })
		.from(users)
		.where(eq(users.id, botUserId));
	if (!bot || !bot.wallet.startsWith('seed:')) return null;
	const record = await headToHead(botUserId, playerId);
	const p = personalityOf(bot.username);
	return {
		username: bot.username,
		tagline: p.tagline,
		draft: p.draft,
		mood: moodFor(record),
		record
	};
}
