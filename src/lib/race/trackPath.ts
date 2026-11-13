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

export function buildTrackPath(circuit: Circuit): TrackPath {
	const raw = circuit.points;
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
		const dx = (b.x - a.x) / seg;
		const dz = (b.z - a.z) / seg;
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
