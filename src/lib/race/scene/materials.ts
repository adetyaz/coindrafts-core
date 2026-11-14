// TSL materials for the race scene (WebGPU, with the WebGL2 fallback that
// WebGPURenderer picks by itself). Painterly rather than realistic: the look is
// Meadow's sticker world (ink outlines, flat colour, a little texture).
import * as THREE from 'three/webgpu';
import {
	abs,
	color,
	float,
	fract,
	max,
	mix,
	mx_noise_float,
	mx_worley_noise_float,
	positionWorld,
	smoothstep,
	step,
	uv
} from 'three/tsl';

/** Every colour the scene uses, resolved from the world's CSS tokens. */
export type Palette = {
	grass: THREE.Color;
	grassDark: THREE.Color;
	road: THREE.Color;
	line: THREE.Color;
	kerb: THREE.Color;
	tree: THREE.Color;
	trunk: THREE.Color;
	flower: THREE.Color;
	sun: THREE.Color;
	wheel: THREE.Color;
	flame: THREE.Color;
	ink: THREE.Color;
	sky: THREE.Color;
	surface: THREE.Color;
	positive: THREE.Color;
	negative: THREE.Color;
	primary: THREE.Color;
	/** Pastel tints (walls, flags, sheep): butter, pink, lavender, sky, peach. */
	tints: THREE.Color[];
};

/** Plain flat-shaded colour. Cheap; used for most props. */
export function flat(
	c: THREE.Color,
	extra: Partial<THREE.MeshStandardNodeMaterialParameters> = {}
) {
	return new THREE.MeshStandardNodeMaterial({
		color: c,
		flatShading: true,
		roughness: 0.85,
		...extra
	});
}

/** Self-lit colour: lamps, neon, headlights. Picked up by the bloom pass in night worlds. */
export function glow(c: THREE.Color, strength = 1.6) {
	const m = new THREE.MeshStandardNodeMaterial({ color: c, roughness: 0.6 });
	m.emissiveNode = color(c).mul(strength);
	return m;
}

/** The sticker outline: the back faces of a slightly larger copy, in ink. */
export function outline(ink: THREE.Color) {
	return new THREE.MeshBasicNodeMaterial({ color: ink, side: THREE.BackSide });
}

/** Grass: two greens in big soft patches, plus fine speckle, so it reads as a field. */
export function groundMaterial(p: Palette) {
	const m = new THREE.MeshStandardNodeMaterial({ roughness: 1 });
	const patches = mx_noise_float(positionWorld.xz.mul(0.035));
	const speckle = mx_noise_float(positionWorld.xz.mul(0.7));
	const base = mix(color(p.grassDark), color(p.grass), smoothstep(-0.35, 0.45, patches));
	m.colorNode = base.mul(speckle.mul(0.09).add(0.96));
	return m;
}

/**
 * The road. UV: u runs along the lap (in units / 6), v across (0 → 1).
 * Asphalt grain, painted edge lines and a dashed centre line; the village gets
 * cobblestones (Worley cells with dark grout).
 */
export function roadMaterial(p: Palette, cobbles: boolean) {
	const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, side: THREE.DoubleSide });
	const u = uv().x;
	const v = uv().y;
	const grain = mx_noise_float(positionWorld.xz.mul(1.8)).mul(0.08).add(0.96);
	let surface = color(p.road).mul(grain);
	if (cobbles) {
		const cells = mx_worley_noise_float(positionWorld.xz.mul(0.9));
		surface = surface.mul(smoothstep(0.02, 0.32, cells).mul(0.32).add(0.72));
	}
	const edges = max(step(v, float(0.035)), step(float(0.965), v));
	const dash = step(fract(u), float(0.5)).mul(step(abs(v.sub(0.5)), float(0.012)));
	m.colorNode = mix(surface, color(p.line), max(edges, dash));
	return m;
}

/**
 * Building walls with lit windows (neon town, the village at night): a grid of
 * windows in world space, some lit, some dark, so blocks don't look stamped.
 */
export function windowsMaterial(wall: THREE.Color, light: THREE.Color, lit = 0.55) {
	const m = new THREE.MeshStandardNodeMaterial({ color: wall, flatShading: true, roughness: 0.9 });
	const across = fract(positionWorld.x.add(positionWorld.z).mul(0.45));
	const up = fract(positionWorld.y.mul(0.5));
	const window = step(0.3, across).mul(step(across, 0.75)).mul(step(0.35, up)).mul(step(up, 0.8));
	// Which windows are on: noise per window cell, cut at `lit`.
	const cell = mx_noise_float(
		positionWorld.xz.mul(0.45).floor().add(positionWorld.y.mul(0.5).floor().mul(7.13))
	);
	// cell + 1 runs 0 → 2; a window is on when it clears 2 − 2·lit (about `lit` of them).
	const on = step(float(2 - lit * 2), cell.add(1));
	m.emissiveNode = color(light).mul(window).mul(on).mul(1.8);
	return m;
}
