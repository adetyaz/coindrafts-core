// Turns a real circuit's centerline (./circuits.ts) into something a car can
// drive along: position and heading at any fraction of a lap, offset into a
// lane, plus where the corners are (for kerbs) and how high the road is.
//
// Height exists for one reason: Suzuka is a figure of eight, so its centerline
// crosses itself. Flat, the two roads would overlap; instead the later pass
// rises over a bridge, like the real one.
import type { Circuit } from './circuits';

export type TrackPoint = { x: number; y: number; z: number; dx: number; dz: number };

export type TrackPath = {
	/** Lap length in scene units. */
	length: number;
	/** Point on the track at lap fraction `u` (any number; wraps), `lane` units to the left. */
	at(u: number, lane?: number): TrackPoint;
	/** Per centerline point: true where the track turns sharply (kerbs go there). */
	corner: boolean[];
	points: { x: number; z: number; y: number }[];
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

const BRIDGE_HEIGHT = 3.2;
/** How many points either side of a crossing ramp up to the bridge. */
const RAMP = 18;
const CORNER_ANGLE = 0.06; // radians of heading change per point

function segmentsCross(
	a: [number, number],
	b: [number, number],
	c: [number, number],
	d: [number, number]
): boolean {
	const side = (p: [number, number], q: [number, number], r: [number, number]) =>
		Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
	return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/**
 * Measured centerlines are slightly noisy, point to point. Driven raw, the
 * heading flips at every point and the outer lanes jump sideways at each kink
 * (cars visibly twitched through corners), so the loop is smoothed first: a
 * small Gaussian over neighbouring points. It rounds off noise, not corners.
 */
const SMOOTH_RADIUS = 5;
const SMOOTH_SIGMA = 2.2;
function smoothLoop(pts: [number, number][]): [number, number][] {
	const n = pts.length;
	const w: number[] = [];
	for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k++) {
		w.push(Math.exp(-(k * k) / (2 * SMOOTH_SIGMA * SMOOTH_SIGMA)));
	}
	const total = w.reduce((a, b) => a + b, 0);
	return pts.map((_, i) => {
		let x = 0;
		let z = 0;
		for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k++) {
			const p = pts[(i + k + n) % n];
			const wk = w[k + SMOOTH_RADIUS] / total;
			x += p[0] * wk;
			z += p[1] * wk;
		}
		return [x, z];
	});
}

export function buildTrackPath(circuit: Circuit): TrackPath {
	const raw = smoothLoop(circuit.points);
	const n = raw.length;

	// ── Bridges where the lap crosses itself ─────────────────────────────────
	// A real crossing is two centerline segments that intersect. (Nearness
	// isn't enough: Interlagos runs two sections side by side without crossing.)
	const lift = new Array<number>(n).fill(0);
	for (let i = 0; i < n; i++) {
		for (let j = i + 2; j < n; j++) {
			if (i === 0 && j === n - 1) continue; // they share the start point
			if (segmentsCross(raw[i], raw[(i + 1) % n], raw[j], raw[(j + 1) % n])) lift[j] = 1; // the later pass goes over
		}
	}
	const y = new Array<number>(n).fill(0);
	for (let i = 0; i < n; i++) {
		if (!lift[i]) continue;
		for (let k = -RAMP; k <= RAMP; k++) {
			const idx = (i + k + n) % n;
			const h = BRIDGE_HEIGHT * (0.5 + 0.5 * Math.cos((Math.PI * k) / RAMP));
			y[idx] = Math.max(y[idx], h);
		}
	}

	const points = raw.map(([x, z], i) => ({ x, z, y: y[i] }));

	// ── Arc length ───────────────────────────────────────────────────────────
	const cumulative = new Array<number>(n + 1).fill(0);
	for (let i = 0; i < n; i++) {
		const a = points[i];
		const b = points[(i + 1) % n];
		cumulative[i + 1] = cumulative[i] + Math.hypot(b.x - a.x, b.z - a.z);
	}
	const length = cumulative[n];

	// Direction at each point: across its two neighbours. `at` blends between
	// these, so the heading (and the lane offset) turns smoothly through a corner.
	const tangent = points.map((_, i) => {
		const p = points[(i - 1 + n) % n];
		const q = points[(i + 1) % n];
		const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
		return { x: (q.x - p.x) / len, z: (q.z - p.z) / len };
	});

	// ── Corners ──────────────────────────────────────────────────────────────
	const heading = points.map((p, i) => {
		const q = points[(i + 1) % n];
		return Math.atan2(q.z - p.z, q.x - p.x);
	});
	const corner = heading.map((h, i) => {
		let turn = Math.abs(heading[(i + 1) % n] - h);
		if (turn > Math.PI) turn = 2 * Math.PI - turn;
		return turn > CORNER_ANGLE;
	});

	function at(u: number, lane = 0): TrackPoint {
		const d = (((u % 1) + 1) % 1) * length;
		// Binary search the segment containing distance d.
		let lo = 0;
		let hi = n;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (cumulative[mid] <= d) lo = mid;
			else hi = mid;
		}
		const a = points[lo];
		const b = points[(lo + 1) % n];
		const seg = cumulative[lo + 1] - cumulative[lo] || 1;
		const t = (d - cumulative[lo]) / seg;
		const ta = tangent[lo];
		const tb = tangent[(lo + 1) % n];
		let dx = ta.x + (tb.x - ta.x) * t;
		let dz = ta.z + (tb.z - ta.z) * t;
		const dl = Math.hypot(dx, dz) || 1;
		dx /= dl;
		dz /= dl;
		// Left-hand normal of the heading; lanes spread across the road.
		return {
			x: a.x + (b.x - a.x) * t - dz * lane,
			y: a.y + (b.y - a.y) * t,
			z: a.z + (b.z - a.z) * t + dx * lane,
			dx,
			dz
		};
	}

	const xs = points.map((p) => p.x);
	const zs = points.map((p) => p.z);
	return {
		length,
		at,
		corner,
		points,
		bounds: {
			minX: Math.min(...xs),
			maxX: Math.max(...xs),
			minZ: Math.min(...zs),
			maxZ: Math.max(...zs)
		}
	};
}
