// The bots' daily life (GAMEPLAY_FLOWS.md, F10). The daily job plays one bot
// day on its own, so the economy moves even when no players are around:
// yesterday's real market decides the bots' races (some for cars), they get
// paid, trade in the Car Market, and the ones with Gears to spare buy new cars
// in the Showroom. Players' cars and Gears are never touched.
//
// Same engine as Simulate a week (simulate.ts). The day it plays is the last
// complete one: the cron runs just after midnight UTC, when today's candle has
// barely started.
import { desc, eq, inArray, like } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { botDays, cars, users } from '$lib/server/schema';
import { simulateDay, SIM_DAYS, type SimDay } from '$lib/server/simulate';
import { buyShowroomCar, flushOutbox, showroomStock } from '$lib/server/cars';
import { personalityOf } from '$lib/bots/personalities';
import { SHOWROOM_MODELS, BASE_PRICE, botShowroomPick, type Rarity } from '$lib/economy/rules';

export type BotDaySummary = SimDay & { showroom: string[] };

/** Bots with Gears to spare buy a new car, best tier they don't own yet. */
async function botShowroomRound(): Promise<string[]> {
	const bots = await db
		.select({ id: users.id, username: users.username, gears: users.gears })
		.from(users)
		.where(like(users.walletAddress, 'seed:%'));
	if (!bots.length) return [];
	const owned = await db
		.select({ ownerId: cars.ownerId, rarity: cars.rarity })
		.from(cars)
		.where(
			inArray(
				cars.ownerId,
				bots.map((b) => b.id)
			)
		);
	const stock = await showroomStock();
	const lines: string[] = [];
	for (const bot of bots) {
		const p = personalityOf(bot.username);
		const pick = botShowroomPick(
			{
				gears: bot.gears,
				rarities: owned.filter((o) => o.ownerId === bot.id).map((o) => o.rarity as Rarity)
			},
			stock,
			p.trade
		);
		if (!pick.value) continue;
		const models = SHOWROOM_MODELS[pick.value];
		const model = models[Math.floor(Math.random() * models.length)];
		try {
			await buyShowroomCar(bot.id, pick.value, model, BASE_PRICE[pick.value]);
			const left = stock[pick.value];
			if (left != null) stock[pick.value] = left - 1;
			lines.push(`${bot.username} bought a new ${pick.value} ${model}. ${pick.reason}.`);
		} catch {
			// Sold out or short of Gears since we looked: skip this bot today.
		}
	}
	return lines;
}

/**
 * Plays one bot day, once per UTC date (the bot_days row is claimed first).
 * Returns null when today's day has already been played.
 */
export async function playBotDay(now = new Date()): Promise<BotDaySummary | null> {
	const today = now.toISOString().slice(0, 10);
	const [claimed] = await db
		.insert(botDays)
		.values({ day: today })
		.onConflictDoNothing()
		.returning({ day: botDays.day });
	if (!claimed) return null;

	try {
		// Day SIM_DAYS - 1 of the replay window is yesterday: the last full day.
		const day = await simulateDay(SIM_DAYS - 1);
		const showroom = await botShowroomRound();
		const summary: BotDaySummary = { ...day, showroom };
		await db.update(botDays).set({ summary }).where(eq(botDays.day, today));
		await Promise.race([flushOutbox(50), new Promise((r) => setTimeout(r, 8000))]).catch(
			() => null
		);
		return summary;
	} catch (e) {
		// Release the claim so the next run can try again.
		await db.delete(botDays).where(eq(botDays.day, today));
		throw e;
	}
}

/** The latest bot days, newest first, for the Car Market's "yesterday in the bot world". */
export async function recentBotDays(limit = 3) {
	return db
		.select({ day: botDays.day, summary: botDays.summary })
		.from(botDays)
		.orderBy(desc(botDays.day))
		.limit(limit);
}
