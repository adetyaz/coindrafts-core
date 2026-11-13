import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import {
	GarageError,
	buyShowroomCar,
	customiseCar,
	getGarage,
	grantStarterKit,
	showroomStock
} from '$lib/server/cars';
import { MarketError, sellNow, tierMarkets } from '$lib/server/market';
import {
	BASE_PRICE,
	DECALS,
	PAINTS,
	PLATE,
	RARITIES,
	SHOWROOM_MODELS,
	sellNowPrice,
	type CarLook,
	type Rarity
} from '$lib/economy/rules';

// GET: the signed-in player's cars (with a Sell now quote each), Gears, NEAR
// account, and this week's Showroom. Also hands out the starter kit to
// accounts that signed up before cars existed.
// POST { action: 'showroom' | 'customise' | 'sellNow', ... }.
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

	const [markets, stock] = await Promise.all([
		tierMarkets().catch(() => null),
		showroomStock().catch(() => null)
	]);
	return json({
		...garage,
		cars: garage.cars.map((c) => ({
			...c,
			sellNow: markets ? sellNowPrice(c.rarity as Rarity, markets[c.rarity as Rarity]) : null
		})),
		showroom: RARITIES.map((r) => ({
			rarity: r,
			price: BASE_PRICE[r],
			models: SHOWROOM_MODELS[r],
			left: stock ? stock[r] : null
		}))
	});
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	try {
		if (body.action === 'showroom') {
			const rarity = String(body.rarity) as Rarity;
			if (!RARITIES.includes(rarity)) return json({ error: 'Unknown tier' }, { status: 400 });
			const car = await buyShowroomCar(
				parsed.userId,
				rarity,
				String(body.model),
				BASE_PRICE[rarity]
			);
			return json({ ok: true, car: { id: car.id, model: car.model, rarity: car.rarity } });
		}
		if (body.action === 'customise') {
			const look: CarLook = {};
			if (body.paint !== undefined) {
				if (!PAINTS.some((p) => p.id === body.paint))
					return json({ error: 'Unknown paint' }, { status: 400 });
				look.paint = body.paint;
			}
			if (body.decal !== undefined) {
				if (!DECALS.some((d) => d.id === body.decal))
					return json({ error: 'Unknown decal' }, { status: 400 });
				look.decal = body.decal;
			}
			if (body.plate !== undefined) {
				const plate = String(body.plate).toUpperCase().trim();
				if (!PLATE.test(plate))
					return json({ error: 'Plates are 2–7 letters or numbers.' }, { status: 400 });
				look.plate = plate;
			}
			const result = await customiseCar(parsed.userId, String(body.carId), look);
			return json({ ok: true, ...result });
		}
		if (body.action === 'sellNow') {
			const sale = await sellNow(parsed.userId, String(body.carId));
			return json({ ok: true, ...sale });
		}
		return json({ error: 'Unknown action' }, { status: 400 });
	} catch (e) {
		if (e instanceof GarageError || e instanceof MarketError)
			return json({ error: e.message }, { status: 409 });
		console.error('[api/garage]', e);
		return json({ error: 'The garage is unavailable right now' }, { status: 500 });
	}
}
