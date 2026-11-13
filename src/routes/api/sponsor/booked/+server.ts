import { json } from '@sveltejs/kit';
import { bookedRanges } from '$lib/server/sponsors';
import { AD_SLOT_IDS, type AdSlot } from '$lib/sponsors';

// GET ?circuit=&slot=: date ranges already taken, so the picker can grey them out.
export async function GET({ url }) {
	const circuit = url.searchParams.get('circuit') ?? '';
	const slot = url.searchParams.get('slot') as AdSlot;
	if (!AD_SLOT_IDS.includes(slot)) return json([]);
	return json(await bookedRanges(circuit, slot).catch(() => []));
}
