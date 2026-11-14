// Vehicle models for the race (a CGTrader low-poly pack, converted by
// assets-src/convert_cars.py: one GLB per vehicle, facing +x, wheels on y = 0,
// one shared scale so trucks stay bigger than cars). Each GLB has two
// materials: `paint` (the body, recoloured per driver) and `base` (everything
// else, coloured from the pack's swatch texture).
//
// The source pack lives in assets-src/ (gitignored): the licence lets us ship
// models inside the game, not hand out the source files, so it must never go
// in static/.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

export function vehicleUrl(v: Vehicle): string {
	return `/models/cars/${v}.glb`;
}

const loader = new GLTFLoader();
const cache = new Map<Vehicle, Promise<THREE.Object3D>>();

/** The vehicle's scene, loaded once per page. Clone it per car (`cloneVehicle`). */
export function loadVehicle(v: Vehicle): Promise<THREE.Object3D> {
	let p = cache.get(v);
	if (!p) {
		p = loader.loadAsync(vehicleUrl(v)).then((gltf) => {
			gltf.scene.traverse((o) => {
				const mesh = o as THREE.Mesh;
				if (!mesh.isMesh) return;
				const m = mesh.material as THREE.MeshStandardMaterial;
				// Matte, like the rest of the sticker world.
				m.roughness = 0.8;
				m.metalness = 0;
			});
			return gltf.scene;
		});
		// A failed load is retried next time rather than cached.
		p.catch(() => cache.delete(v));
		cache.set(v, p);
	}
	return p;
}

/**
 * A copy of the vehicle for one driver: the body in `paint` (flat colour, so
 * it reads clearly from the iso camera), an ink outline, shadows on. The
 * geometry is shared; `materials` are this car's own, to dispose with it.
 */
export function cloneVehicle(
	template: THREE.Object3D,
	paint: THREE.Color,
	outline: THREE.Material
): { body: THREE.Group; materials: THREE.Material[] } {
	const body = new THREE.Group();
	const copy = template.clone(true);
	const painted = new THREE.MeshStandardNodeMaterial({
		color: paint,
		roughness: 0.6,
		flatShading: true
	});
	const meshes: THREE.Mesh[] = [];
	copy.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (!mesh.isMesh) return;
		if ((mesh.material as THREE.Material).name === 'paint') mesh.material = painted;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		meshes.push(mesh);
	});
	body.add(copy);
	// Sticker outline: back faces of a slightly larger copy. Grown from the
	// ground point, so the outline hugs the wheels rather than sinking.
	const edge = copy.clone(true);
	edge.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (mesh.isMesh) {
			mesh.material = outline;
			mesh.castShadow = false;
		}
	});
	edge.scale.multiplyScalar(1.035);
	body.add(edge);
	return { body, materials: [painted] };
}
