import { json } from '@sveltejs/kit';
import { parseSessionToken } from '$lib/server/auth';
import { getCarHistory } from '$lib/server/cars';

// GET ?carId=: every owner a car has had and how it moved (Garage → car
// history). Names and prices only, which the Car Market shows publicly anyway.
export async function GET({ url, cookies }) {
	const token = cookies.get('session');
	if (!token || !parseSessionToken(token)) return json({ error: 'Unauthorized' }, { status: 401 });
	const carId = url.searchParams.get('carId');
	if (!carId || !/^[0-9a-f-]{36}$/i.test(carId))
		return json({ error: 'carId required' }, { status: 400 });
	return json({ events: await getCarHistory(carId) });
}
