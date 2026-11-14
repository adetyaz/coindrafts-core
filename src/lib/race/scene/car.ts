// The race car: a chunky low-poly pickup (the Truckful reference), built from
// boxes and cylinders so it needs no model file. Paint comes from the driver's
// car; ink outlines give it the Meadow sticker look. Local axes: +x forward,
// +y up, the car sits on y = 0. About 6 units long.
import * as THREE from 'three/webgpu';
import { flat, glow, outline, type Palette } from './materials';

export type CarParts = {
	group: THREE.Group;
	flame: THREE.Mesh;
	marker: THREE.Mesh | null;
	wheels: THREE.Mesh[];
};

type Shared = {
	box: THREE.BoxGeometry;
	wheel: THREE.CylinderGeometry;
	hub: THREE.CylinderGeometry;
	flame: THREE.ConeGeometry;
	marker: THREE.ConeGeometry;
	outline: THREE.MeshBasicNodeMaterial;
	glass: THREE.MeshStandardNodeMaterial;
	tyre: THREE.MeshStandardNodeMaterial;
	chrome: THREE.MeshStandardNodeMaterial;
	lamp: THREE.MeshStandardNodeMaterial;
	tail: THREE.MeshStandardNodeMaterial;
	crate: THREE.MeshStandardNodeMaterial;
	flameMat: THREE.MeshBasicNodeMaterial;
	markerMat: THREE.MeshStandardNodeMaterial;
};

/** Geometry and materials every car shares (made once per race). */
export function carKit(p: Palette): Shared & { dispose(): void } {
	const kit: Shared = {
		box: new THREE.BoxGeometry(1, 1, 1),
		wheel: new THREE.CylinderGeometry(0.62, 0.62, 0.55, 14),
		hub: new THREE.CylinderGeometry(0.28, 0.28, 0.6, 8),
		flame: new THREE.ConeGeometry(0.5, 2.2, 8),
		marker: new THREE.ConeGeometry(0.7, 1.3, 4),
		outline: outline(p.ink),
		glass: flat(p.tints[3] ?? p.surface, { roughness: 0.25, metalness: 0.1 }),
		tyre: flat(p.wheel),
		chrome: flat(new THREE.Color(0xbfc4c0), { roughness: 0.35, metalness: 0.4 }),
		lamp: glow(p.tints[0] ?? p.sun, 2.2),
		tail: glow(p.negative, 1.4),
		crate: flat(p.tints[0] ?? p.sun),
		flameMat: new THREE.MeshBasicNodeMaterial({ color: p.flame, transparent: true, opacity: 0.9 }),
		markerMat: glow(p.primary, 0.8)
	};
	return {
		...kit,
		dispose() {
			for (const v of Object.values(kit)) (v as { dispose?: () => void }).dispose?.();
		}
	};
}

/**
 * One car. `paint` is the body colour; `headlights` adds a real light (night
 * worlds); `me` adds the bobbing marker above your car.
 */
export function buildCar(
	kit: Shared,
	paint: THREE.Color,
	opts: { headlights: THREE.Color | null; me: boolean }
): CarParts & { materials: THREE.Material[] } {
	const group = new THREE.Group();
	const body = flat(paint, { roughness: 0.55 });
	const trim = flat(paint.clone().multiplyScalar(0.72), { roughness: 0.6 });

	// A box part, with an ink outline when `ink` (the silhouette pieces).
	const part = (
		mat: THREE.Material,
		size: [number, number, number],
		at: [number, number, number],
		ink = false
	) => {
		const mesh = new THREE.Mesh(kit.box, mat);
		mesh.scale.set(...size);
		mesh.position.set(...at);
		mesh.castShadow = true;
		group.add(mesh);
		if (ink) {
			const edge = new THREE.Mesh(kit.box, kit.outline);
			edge.scale.set(size[0] + 0.16, size[1] + 0.16, size[2] + 0.16);
			edge.position.set(...at);
			group.add(edge);
		}
		return mesh;
	};

	// Body: low chassis, hood, cab with a roof, the bed with its rails.
	part(body, [6.0, 0.95, 2.5], [0, 1.05, 0], true);
	part(body, [1.9, 0.35, 2.35], [2.0, 1.68, 0], true);
	part(body, [1.9, 1.35, 2.35], [0.05, 2.2, 0], true);
	part(trim, [2.0, 0.18, 2.45], [0.05, 2.95, 0]);
	part(kit.glass, [0.12, 0.85, 2.05], [1.05, 2.3, 0]);
	part(kit.glass, [1.45, 0.7, 2.42], [0.05, 2.35, 0]);
	part(trim, [2.6, 0.55, 0.16], [-1.65, 1.8, 1.17], true);
	part(trim, [2.6, 0.55, 0.16], [-1.65, 1.8, -1.17], true);
	part(trim, [0.16, 0.55, 2.5], [-2.95, 1.8, 0], true);
	// Something in the bed, like the reference trucks.
	part(kit.crate, [0.95, 0.75, 0.95], [-1.55, 1.9, 0.35], true);

	// Fenders over the wheels, bumpers, lamps.
	for (const x of [1.95, -1.95]) part(trim, [1.55, 0.32, 2.75], [x, 1.42, 0]);
	part(kit.chrome, [0.3, 0.38, 2.7], [3.08, 0.78, 0]);
	part(kit.chrome, [0.3, 0.38, 2.7], [-3.08, 0.78, 0]);
	for (const z of [0.82, -0.82]) {
		part(kit.lamp, [0.14, 0.32, 0.5], [3.02, 1.28, z]);
		part(kit.tail, [0.14, 0.3, 0.4], [-3.02, 1.28, z]);
	}

	const wheels: THREE.Mesh[] = [];
	for (const [x, z] of [
		[1.95, 1.22],
		[1.95, -1.22],
		[-1.95, 1.22],
		[-1.95, -1.22]
	]) {
		const wheel = new THREE.Mesh(kit.wheel, kit.tyre);
		wheel.rotation.x = Math.PI / 2;
		wheel.position.set(x, 0.62, z);
		wheel.castShadow = true;
		const hub = new THREE.Mesh(kit.hub, kit.chrome);
		wheel.add(hub);
		group.add(wheel);
		wheels.push(wheel);
	}

	if (opts.headlights) {
		const beam = new THREE.PointLight(opts.headlights, 60, 22, 1.4);
		beam.position.set(4.2, 1.6, 0);
		group.add(beam);
	}

	const flame = new THREE.Mesh(kit.flame, kit.flameMat);
	flame.rotation.z = Math.PI / 2;
	flame.position.set(-4.2, 1.0, 0);
	flame.visible = false;
	group.add(flame);

	let marker: THREE.Mesh | null = null;
	if (opts.me) {
		marker = new THREE.Mesh(kit.marker, kit.markerMat);
		marker.rotation.x = Math.PI;
		marker.position.y = 5;
		group.add(marker);
	}

	return { group, flame, marker, wheels, materials: [body, trim] };
}
