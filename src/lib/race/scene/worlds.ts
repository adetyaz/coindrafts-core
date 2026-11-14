// Scenery for each track world (layout.css `.track-*`). Everything is instanced
// so a world costs a handful of draw calls, and seeded by the circuit so a
// track always looks the same. Wind, fireflies and the like are TSL vertex
// offsets: they move on the GPU and cost the CPU nothing.
import * as THREE from 'three/webgpu';
import { cos, instanceIndex, positionLocal, sin, time, uv, vec3 } from 'three/tsl';
import type { TrackPath } from '../trackPath';
import type { TrackTheme } from '../trackTheme';
import { flat, glow, outline, windowsMaterial, type Palette } from './materials';

/**
 * Distance from any ground point to the road's centreline, from a coarse grid
 * built once. Scenery asks it "is this spot clear of the road?".
 */
export function makeClearance(path: TrackPath, reach = 40) {
	const CELL = 2;
	const { minX, maxX, minZ, maxZ } = path.bounds;
	const x0 = minX - reach;
	const z0 = minZ - reach;
	const cols = Math.ceil((maxX - minX + reach * 2) / CELL);
	const rows = Math.ceil((maxZ - minZ + reach * 2) / CELL);
	const grid = new Float32Array(cols * rows).fill(reach);
	const span = Math.ceil(reach / CELL);
	const SAMPLES = Math.max(600, Math.round(path.length / 1.5));
	for (let i = 0; i < SAMPLES; i++) {
		const p = path.at(i / SAMPLES);
		const ci = Math.floor((p.x - x0) / CELL);
		const ri = Math.floor((p.z - z0) / CELL);
		for (let r = Math.max(0, ri - span); r <= Math.min(rows - 1, ri + span); r++) {
			for (let c = Math.max(0, ci - span); c <= Math.min(cols - 1, ci + span); c++) {
				const d = Math.hypot(x0 + (c + 0.5) * CELL - p.x, z0 + (r + 0.5) * CELL - p.z);
				const k = r * cols + c;
				if (d < grid[k]) grid[k] = d;
			}
		}
	}
	return (x: number, z: number) => {
		const c = Math.floor((x - x0) / CELL);
		const r = Math.floor((z - z0) / CELL);
		if (c < 0 || r < 0 || c >= cols || r >= rows) return reach;
		return grid[r * cols + c];
	};
}

export type WorldCtx = {
	scene: THREE.Scene;
	p: Palette;
	path: TrackPath;
	clearance: (x: number, z: number) => number;
	rand: () => number;
	roadHalf: number;
};

type Item = {
	x: number;
	y: number;
	z: number;
	/** Uniform scale, or [x, y, z]. */
	s?: number | [number, number, number];
	ry?: number;
	rz?: number;
	color?: THREE.Color;
};

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const sv = new THREE.Vector3();
const pv = new THREE.Vector3();

/** One instanced mesh for a list of placements; `ink` adds the sticker outline. */
function instanced(
	ctx: WorldCtx,
	geo: THREE.BufferGeometry,
	mat: THREE.Material,
	items: Item[],
	opts: { shadow?: boolean; ink?: boolean } = {}
) {
	if (!items.length) return;
	const mesh = new THREE.InstancedMesh(geo, mat, items.length);
	const edge = opts.ink ? new THREE.InstancedMesh(geo, outline(ctx.p.ink), items.length) : null;
	items.forEach((it, i) => {
		const s = it.s ?? 1;
		const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
		q.setFromEuler(e.set(0, it.ry ?? 0, it.rz ?? 0));
		m4.compose(pv.set(it.x, it.y, it.z), q, sv.set(sx, sy, sz));
		mesh.setMatrixAt(i, m4);
		if (it.color) mesh.setColorAt(i, it.color);
		if (edge) {
			// Grown by a fixed amount, not a fixed ratio, so big and small props get the same line.
			const grow = 0.22;
			m4.compose(pv, q, sv.set(sx + grow, sy + grow, sz + grow));
			edge.setMatrixAt(i, m4);
		}
	});
	mesh.castShadow = !!opts.shadow;
	mesh.receiveShadow = true;
	ctx.scene.add(mesh);
	if (edge) ctx.scene.add(edge);
}

/** Random spots off the road: `count` of them between `near` and `far` units from it. */
function scatter(ctx: WorldCtx, count: number, near: number, far: number): [number, number][] {
	const { minX, maxX, minZ, maxZ } = ctx.path.bounds;
	const out: [number, number][] = [];
	for (let tries = 0; tries < count * 12 && out.length < count; tries++) {
		const x = minX - far + ctx.rand() * (maxX - minX + far * 2);
		const z = minZ - far + ctx.rand() * (maxZ - minZ + far * 2);
		const d = ctx.clearance(x, z);
		if (d >= near && d <= far) out.push([x, z]);
	}
	return out;
}

/** Spots along the road edge, `offset` units out, every `every` units. Skips inside corners. */
function alongside(ctx: WorldCtx, offset: number, every: number, keep = () => true) {
	const n = Math.floor(ctx.path.length / every);
	const out: { x: number; z: number; y: number; heading: number; side: number }[] = [];
	for (let i = 0; i < n; i++) {
		const u = i / n;
		// Leave the start/finish straight open (grid, line, arch).
		if (u < 0.02 || u > 0.985) continue;
		for (const side of [-1, 1]) {
			const pt = ctx.path.at(u, side * offset);
			if (pt.y > 0.5) continue; // not on bridges
			if (ctx.clearance(pt.x, pt.z) < offset - 0.6) continue;
			if (!keep()) continue;
			out.push({ x: pt.x, z: pt.z, y: 0, heading: Math.atan2(-pt.dz, pt.dx), side });
		}
	}
	return out;
}

const pick = <T>(ctx: WorldCtx, xs: T[]) => xs[Math.floor(ctx.rand() * xs.length)];
const shade = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

// ── Shared props ─────────────────────────────────────────────────────────

function roundTrees(ctx: WorldCtx, count: number, near = 12, far = 60) {
	const { p } = ctx;
	const spots = scatter(ctx, count, near, far);
	const sizes = spots.map(() => 0.8 + ctx.rand() * 0.6);
	instanced(
		ctx,
		new THREE.CylinderGeometry(0.45, 0.6, 2.6, 6),
		flat(p.trunk),
		spots.map(([x, z], i) => ({ x, y: 1.3 * sizes[i], z, s: sizes[i] })),
		{ shadow: true }
	);
	instanced(
		ctx,
		new THREE.IcosahedronGeometry(2.6, 0),
		flat(new THREE.Color(0xffffff)),
		spots.map(([x, z], i) => ({
			x,
			y: 4.4 * sizes[i],
			z,
			s: sizes[i],
			ry: ctx.rand() * 6,
			color: shade(p.tree, 0.85 + ctx.rand() * 0.35)
		})),
		{ shadow: true, ink: true }
	);
}

function pines(ctx: WorldCtx, count: number, near = 11, far = 60) {
	const { p } = ctx;
	const spots = scatter(ctx, count, near, far);
	const sizes = spots.map(() => 0.8 + ctx.rand() * 0.7);
	const tint = spots.map(() => shade(p.tree, 0.8 + ctx.rand() * 0.4));
	instanced(
		ctx,
		new THREE.CylinderGeometry(0.35, 0.5, 2, 6),
		flat(p.trunk),
		spots.map(([x, z], i) => ({ x, y: sizes[i], z, s: sizes[i] }))
	);
	const cone = new THREE.ConeGeometry(2.4, 4, 7);
	const white = flat(new THREE.Color(0xffffff));
	instanced(
		ctx,
		cone,
		white,
		spots.map(([x, z], i) => ({ x, y: 3.6 * sizes[i], z, s: sizes[i], color: tint[i] })),
		{ shadow: true, ink: true }
	);
	instanced(
		ctx,
		cone,
		white,
		spots.map(([x, z], i) => ({ x, y: 5.8 * sizes[i], z, s: sizes[i] * 0.72, color: tint[i] })),
		{ shadow: true }
	);
}

function bushes(ctx: WorldCtx, count: number) {
	const { p } = ctx;
	instanced(
		ctx,
		new THREE.IcosahedronGeometry(1.4, 0),
		flat(new THREE.Color(0xffffff)),
		scatter(ctx, count, 9, 45).map(([x, z]) => ({
			x,
			y: 0.7,
			z,
			s: [1 + ctx.rand() * 0.6, 0.75, 1 + ctx.rand() * 0.6],
			ry: ctx.rand() * 6,
			color: shade(p.tree, 1 + ctx.rand() * 0.3)
		})),
		{ shadow: true, ink: true }
	);
}

function flowers(ctx: WorldCtx, count: number) {
	const { p } = ctx;
	const colours = [p.flower, p.flower, ...p.tints];
	instanced(
		ctx,
		new THREE.OctahedronGeometry(0.38, 0),
		flat(new THREE.Color(0xffffff), { roughness: 0.6 }),
		scatter(ctx, count, 8.5, 50).map(([x, z]) => ({
			x,
			y: 0.35,
			z,
			ry: ctx.rand() * 6,
			color: pick(ctx, colours)
		}))
	);
}

/** Hedges lining stretches of road, the way the reference tracks are framed. */
function hedges(ctx: WorldCtx) {
	const { p } = ctx;
	// Runs of hedge with gaps: a stretch is on or off for a while.
	let on = true;
	let left = 0;
	const keep = () => {
		if (left-- <= 0) {
			on = !on;
			left = 6 + Math.floor(ctx.rand() * 14);
		}
		return on;
	};
	instanced(
		ctx,
		new THREE.BoxGeometry(1, 1, 1),
		flat(new THREE.Color(0xffffff)),
		alongside(ctx, ctx.roadHalf + 2.8, 3.1, keep).map((h) => ({
			x: h.x,
			y: 0.8,
			z: h.z,
			s: [3.3, 1.6, 1.4],
			ry: h.heading,
			color: shade(p.tree, 1.05 + ctx.rand() * 0.15)
		})),
		{ shadow: true, ink: true }
	);
}

// ── Worlds ───────────────────────────────────────────────────────────────

function meadow(ctx: WorldCtx) {
	roundTrees(ctx, 120);
	bushes(ctx, 110);
	flowers(ctx, 650);
	hedges(ctx);
	// Sheep: a woolly body and a dark head.
	const { p } = ctx;
	const flock = scatter(ctx, 16, 14, 45);
	const facing = flock.map(() => ctx.rand() * Math.PI * 2);
	instanced(
		ctx,
		new THREE.IcosahedronGeometry(1, 0),
		flat(p.surface),
		flock.map(([x, z], i) => ({ x, y: 1.1, z, s: [1.4, 1, 1.05], ry: facing[i] })),
		{ shadow: true, ink: true }
	);
	instanced(
		ctx,
		new THREE.BoxGeometry(0.6, 0.65, 0.6),
		flat(p.ink),
		flock.map(([x, z], i) => ({
			x: x + Math.cos(facing[i]) * 1.45,
			y: 1.45,
			z: z - Math.sin(facing[i]) * 1.45,
			ry: facing[i]
		}))
	);
}

function golden(ctx: WorldCtx) {
	const { p } = ctx;
	// Wheat fields: clumps of stalks that sway (TSL: the tip moves, the root stays).
	const stalks: Item[] = [];
	for (const [cx, cz] of scatter(ctx, 22, 16, 50)) {
		for (let k = 0; k < 70; k++) {
			const a = ctx.rand() * Math.PI * 2;
			const r = Math.sqrt(ctx.rand()) * 9;
			const x = cx + Math.cos(a) * r;
			const z = cz + Math.sin(a) * r;
			if (ctx.clearance(x, z) < 9) continue;
			const h = 0.8 + ctx.rand() * 0.5;
			stalks.push({
				x,
				y: 0.9 * h,
				z,
				s: [1, h, 1],
				color: pick(ctx, [p.grass, p.grassDark, shade(p.sun, 0.95)])
			});
		}
	}
	const wheat = flat(new THREE.Color(0xffffff));
	const sway = sin(time.mul(1.6).add(instanceIndex.toFloat().mul(0.37)))
		.mul(uv().y)
		.mul(0.35);
	wheat.positionNode = positionLocal.add(vec3(sway, 0, sway.mul(0.5)));
	instanced(ctx, new THREE.ConeGeometry(0.28, 1.8, 4), wheat, stalks);

	instanced(
		ctx,
		new THREE.CylinderGeometry(1.1, 1.1, 1.7, 10),
		flat(shade(p.grassDark, 1.05)),
		scatter(ctx, 26, 10, 40).map(([x, z]) => ({
			x,
			y: 1.1,
			z,
			rz: Math.PI / 2,
			ry: ctx.rand() * 6
		})),
		{ shadow: true, ink: true }
	);
	// Poplars: tall thin trees.
	const spots = scatter(ctx, 60, 12, 55);
	instanced(
		ctx,
		new THREE.CylinderGeometry(0.3, 0.4, 2, 5),
		flat(p.trunk),
		spots.map(([x, z]) => ({ x, y: 1, z }))
	);
	instanced(
		ctx,
		new THREE.ConeGeometry(1.2, 7.5, 6),
		flat(new THREE.Color(0xffffff)),
		spots.map(([x, z]) => ({ x, y: 5.4, z, color: shade(p.tree, 0.85 + ctx.rand() * 0.3) })),
		{ shadow: true, ink: true }
	);
	roundTrees(ctx, 30, 18, 60);
}

function night(ctx: WorldCtx, lights: THREE.PointLight[]) {
	const { p } = ctx;
	pines(ctx, 150);
	bushes(ctx, 50);
	// Lamp posts down the side of the road; a few carry real light.
	const posts = alongside(ctx, ctx.roadHalf + 1.8, ctx.path.length / 30).filter(
		(_, i) => i % 2 === 0
	);
	instanced(
		ctx,
		new THREE.CylinderGeometry(0.16, 0.22, 5.2, 6),
		flat(p.ink),
		posts.map((l) => ({ x: l.x, y: 2.6, z: l.z }))
	);
	instanced(
		ctx,
		new THREE.IcosahedronGeometry(0.5, 1),
		glow(p.sun, 3),
		posts.map((l) => ({ x: l.x, y: 5.3, z: l.z }))
	);
	const lit = Math.min(6, posts.length);
	for (let i = 0; i < lit; i++) {
		const l = posts[Math.floor((i * posts.length) / lit)];
		const lamp = new THREE.PointLight(p.sun, 90, 28, 1.4);
		lamp.position.set(l.x, 4.8, l.z);
		ctx.scene.add(lamp);
		lights.push(lamp);
	}
	// Fireflies: they bob and drift on the GPU.
	const flies = glow(p.tints[0] ?? p.sun, 4);
	const t = time.add(instanceIndex.toFloat().mul(1.7));
	flies.positionNode = positionLocal.add(
		vec3(sin(t.mul(0.7)).mul(1.4), sin(t.mul(1.9)).mul(0.6), cos(t.mul(0.5)).mul(1.4))
	);
	instanced(
		ctx,
		new THREE.OctahedronGeometry(0.18, 0),
		flies,
		scatter(ctx, 240, 7, 45).map(([x, z]) => ({ x, y: 1.2 + ctx.rand() * 2.5, z }))
	);
}

function neon(ctx: WorldCtx) {
	const { p } = ctx;
	// City blocks with lit windows, in two neon colours.
	const blocks = scatter(ctx, 80, 20, 70);
	const wall = shade(p.grassDark, 0.55);
	const box = new THREE.BoxGeometry(1, 1, 1);
	const towers = blocks.map(([x, z]) => {
		const h = 8 + ctx.rand() * 30;
		const w = 7 + ctx.rand() * 9;
		const d = 7 + ctx.rand() * 9;
		return { x, y: h / 2, z, s: [w, h, d] as [number, number, number] };
	});
	instanced(
		ctx,
		box,
		windowsMaterial(wall, p.flower, 0.5),
		towers.filter((_, i) => i % 2 === 0),
		{
			shadow: true,
			ink: true
		}
	);
	instanced(
		ctx,
		box,
		windowsMaterial(wall, p.kerb, 0.45),
		towers.filter((_, i) => i % 2 === 1),
		{
			shadow: true,
			ink: true
		}
	);
	// Neon posts lining the road, alternating colours.
	const posts = alongside(ctx, ctx.roadHalf + 1.6, ctx.path.length / 60);
	const pole = new THREE.BoxGeometry(0.45, 4, 0.45);
	instanced(
		ctx,
		pole,
		glow(p.line, 2.6),
		posts.filter((_, i) => i % 2 === 0).map((l) => ({ x: l.x, y: 2, z: l.z }))
	);
	instanced(
		ctx,
		pole,
		glow(p.kerb, 2.6),
		posts.filter((_, i) => i % 2 === 1).map((l) => ({ x: l.x, y: 2, z: l.z }))
	);
	pines(ctx, 40, 10, 20);
}

function village(ctx: WorldCtx) {
	const { p } = ctx;
	// Cottages: pastel walls, a four-sided roof.
	const lots = scatter(ctx, 50, 13, 36);
	const houses = lots.map(([x, z]) => ({
		x,
		z,
		w: 6 + ctx.rand() * 3,
		h: 4 + ctx.rand() * 2,
		d: 5 + ctx.rand() * 3,
		ry: Math.floor(ctx.rand() * 4) * (Math.PI / 2) + (ctx.rand() - 0.5) * 0.3
	}));
	instanced(
		ctx,
		new THREE.BoxGeometry(1, 1, 1),
		flat(new THREE.Color(0xffffff)),
		houses.map((h) => ({
			x: h.x,
			y: h.h / 2,
			z: h.z,
			s: [h.w, h.h, h.d],
			ry: h.ry,
			color: pick(ctx, [p.surface, ...p.tints])
		})),
		{ shadow: true, ink: true }
	);
	instanced(
		ctx,
		new THREE.ConeGeometry(Math.SQRT1_2, 1, 4),
		flat(new THREE.Color(0xffffff)),
		houses.map((h) => ({
			x: h.x,
			y: h.h + 1.5,
			z: h.z,
			s: [h.w * 1.1, 3, h.d * 1.1],
			ry: h.ry + Math.PI / 4,
			color: pick(ctx, [p.kerb, p.negative, shade(p.trunk, 1.2)])
		})),
		{ shadow: true, ink: true }
	);
	roundTrees(ctx, 70, 12, 60);
	hedges(ctx);
	flowers(ctx, 300);
	// Bunting flags on poles by the road.
	const poles = alongside(ctx, ctx.roadHalf + 2, ctx.path.length / 24).filter(
		(_, i) => i % 3 === 0
	);
	instanced(
		ctx,
		new THREE.CylinderGeometry(0.12, 0.12, 6, 5),
		flat(p.surface),
		poles.map((l) => ({ x: l.x, y: 3, z: l.z }))
	);
	instanced(
		ctx,
		new THREE.BoxGeometry(1.8, 1.1, 0.08),
		flat(new THREE.Color(0xffffff)),
		poles.map((l) => ({
			x: l.x + Math.cos(l.heading) * 0.9,
			y: 5.3,
			z: l.z - Math.sin(l.heading) * 0.9,
			ry: l.heading,
			color: pick(ctx, [p.kerb, p.flower, ...p.tints])
		})),
		{ ink: true }
	);
}

/** Dresses the scene for `theme`. Returns the extra lights it added (night lamps). */
export function buildWorld(theme: TrackTheme, ctx: WorldCtx): { lights: THREE.PointLight[] } {
	const lights: THREE.PointLight[] = [];
	if (theme === 'golden') golden(ctx);
	else if (theme === 'night') night(ctx, lights);
	else if (theme === 'neon') neon(ctx);
	else if (theme === 'village') village(ctx);
	else meadow(ctx);
	return { lights };
}
