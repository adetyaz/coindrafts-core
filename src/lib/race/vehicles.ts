// Which vehicle each Showroom model is. No three.js here, so any page can
// import it (the garage pictures); the 3D loader is $lib/race/scene/models.
import { SHOWROOM_MODELS } from '$lib/economy/rules';

/** Vehicle files in static/models/cars. */
export const VEHICLES = [
	'car-a01-2', // SUV
	'car-a01-3', // SUV, silver
	'car-a02-2', // pickup
	'car-a02-3', // pickup
	'car-a03', // pickup with a trailer
	'tractor-a01', // big-wheel tractor
	'tractor-a02', // tractor with a plough
	'tractor-a03', // tractor with a trailer
	'truck-a01', // box truck
	'truck-a02', // box truck
	'truck-a03', // flatbed
	'truck-a04' // flatbed with cargo
] as const;
export type Vehicle = (typeof VEHICLES)[number];

/**
 * Showroom model name → vehicle. Rarer tiers get bigger machines: Commons are
 * SUVs and pickups, Rares tow or plough, Epics and Legendaries are trucks.
 * Every name in SHOWROOM_MODELS must be here (checked below).
 */
export const MODEL_VEHICLE: Record<string, Vehicle> = {
	// Common
	Viper: 'car-a01-2',
	Comet: 'car-a01-3',
	Bolt: 'car-a02-2',
	Drift: 'car-a02-3',
	Nova: 'car-a01-2',
	Rally: 'car-a02-2',
	// Rare
	Falcon: 'car-a03',
	Raptor: 'tractor-a02',
	Mirage: 'tractor-a03',
	Cobra: 'car-a02-3',
	// Epic
	Phantom: 'truck-a03',
	Tempest: 'truck-a02',
	Vortex: 'truck-a04',
	// Legendary
	Apex: 'truck-a01',
	Eclipse: 'tractor-a01'
};

if (import.meta.env?.DEV) {
	const missing = Object.values(SHOWROOM_MODELS)
		.flat()
		.filter((m) => !MODEL_VEHICLE[m]);
	if (missing.length) console.warn('Showroom models with no vehicle:', missing);
}

export function vehicleFor(model: string | null | undefined): Vehicle | null {
	if (!model) return null;
	if ((VEHICLES as readonly string[]).includes(model)) return model as Vehicle;
	return MODEL_VEHICLE[model] ?? null;
}

/** Pictures for flat screens (garage, Showroom, cards): the vehicle, and where its paint goes. */
export function vehicleSprite(v: Vehicle): { picture: string; paint: string } {
	return {
		picture: `/models/cars/sprites/${v}.webp`,
		paint: `/models/cars/sprites/${v}-paint.webp`
	};
}
