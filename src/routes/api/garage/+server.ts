import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { getGarage, grantStarterKit } from '$lib/server/cars';

// The signed-in player's cars, Gears and NEAR account (with explorer links).
// Also hands out the starter kit to accounts that signed up before cars existed.
export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		await grantStarterKit(parsed.userId);
	} catch (e) {
		console.error('[api/garage] starter kit failed:', e instanceof Error ? e.message : e);
	}

	const garage = await getGarage(parsed.userId);
	if (!garage) return json({ error: 'User not found' }, { status: 404 });
	return json(garage);
}
