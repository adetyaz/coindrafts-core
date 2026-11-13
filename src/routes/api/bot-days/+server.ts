import { json } from '@sveltejs/kit';
import { recentBotDays } from '$lib/server/botDay';

// GET: the bots' latest days (races, cars won, trades, Showroom buys), for the
// Car Market. Bot activity only; nothing about any player.
export async function GET() {
	try {
		return json(await recentBotDays(3));
	} catch {
		// Before the bot_days table exists, or if the database is unreachable.
		return json([]);
	}
}
