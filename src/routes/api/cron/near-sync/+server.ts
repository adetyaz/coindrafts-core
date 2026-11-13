import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SCRIMMAGE_BOTS } from '$lib/server/botDraft';
import { flushOutbox, grantStarterKit, nearConfig } from '$lib/server/cars';

// Gives every seeded bot its named NEAR account and starter garage (once),
// then replays queued on-chain writes. Safe to run any number of times.
async function sync(authHeader: string | null) {
	if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const bots: { username: string; granted?: boolean; error?: string }[] = [];
	for (const bot of SCRIMMAGE_BOTS) {
		try {
			bots.push({ username: bot.username, granted: await grantStarterKit(bot.id) });
		} catch (e) {
			bots.push({ username: bot.username, error: e instanceof Error ? e.message : String(e) });
		}
	}

	const outbox = await flushOutbox(100);
	return json({ ledger: nearConfig() ? 'near' : 'db', bots, outbox });
}

export async function GET({ request }) {
	return sync(request.headers.get('authorization'));
}

export async function POST({ request }) {
	return sync(request.headers.get('authorization'));
}
