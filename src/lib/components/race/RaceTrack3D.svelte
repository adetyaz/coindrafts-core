<script lang="ts" module>
	export type RaceCar = {
		id: string;
		name: string;
		/** Any CSS colour, including `var(--token)`. */
		color: string;
		/** The lineup's total % move right now. Decides the order on track. */
		pct: number;
		isMe: boolean;
		/** Showroom model name (e.g. "Falcon"); picks the vehicle. Without one, the built-in pickup. */
		model?: string;
	};
</script>

<script lang="ts">
	// The live race in 3D. WebGPU through three's WebGPURenderer, which drops to
	// WebGL2 by itself on browsers without WebGPU; if neither starts, the race
	// screen gets `onUnsupported` and shows its chart view instead. Materials are
	// TSL ($lib/race/scene/materials), scenery per world ($lib/race/scene/worlds),
	// the pickup in $lib/race/scene/car.
	import { onMount } from 'svelte';
	import * as THREE from 'three/webgpu';
	import { pass } from 'three/tsl';
	import { bloom } from 'three/addons/tsl/display/BloomNode.js';
	import { circuitById, DEFAULT_CIRCUIT } from '$lib/race/circuits';
	import { buildTrackPath } from '$lib/race/trackPath';
	import { AD_SLOTS, type TrackAd } from '$lib/sponsors';
	import type { TrackTheme } from '$lib/race/trackTheme';
	import {
		flat,
		glow,
		groundMaterial,
		roadMaterial,
		type Palette
	} from '$lib/race/scene/materials';
	import { buildCar, carKit } from '$lib/race/scene/car';
	import { cloneVehicle, loadVehicle, vehicleFor } from '$lib/race/scene/models';
	import { buildWorld, makeClearance } from '$lib/race/scene/worlds';

	let {
		cars,
		circuit = DEFAULT_CIRCUIT,
		finished = false,
		holding = false,
		onOvertake,
		onUnsupported,
		checkpoints,
		ads = [],
		theme = 'meadow',
		tall = false
	}: {
		cars: RaceCar[];
		/** Circuit id from $lib/race/circuits (real layouts). Fixed for the life of the component. */
		circuit?: string;
		finished?: boolean;
		/** Cars wait on the grid (the pre-race screen) until this turns false: lights out. */
		holding?: boolean;
		onOvertake?: (passer: RaceCar, passed: RaceCar) => void;
		onUnsupported?: () => void;
		/**
		 * Binary mode (GAMEPLAY_FLOWS.md, F9): one gate per call, spaced around the
		 * lap. true = that call is right now (green), false = wrong (red), null = no
		 * move yet. Read every frame, so gates flip as prices do.
		 */
		checkpoints?: (boolean | null)[];
		/** Sponsors' trackside ads running today on this circuit (GAMEPLAY_FLOWS.md, F12). */
		ads?: TrackAd[];
		/** The world this race runs in (layout.css `.track-*`). Fixed for the life of the component. */
		theme?: TrackTheme;
		/** Fill more of the screen (the live race page). */
		tall?: boolean;
	} = $props();

	// ── Tuning ───────────────────────────────────────────────────────────────
	// The pack laps at a steady visual pace; the market decides the gaps.
	const LAP_SECONDS = 26;
	// 1 percentage point of difference between two lineups = this much of a lap.
	const GAP_PER_PCT = 0.05;
	const MAX_GAP = 0.42;
	// How hard a car is pulled to the gap its lineup has earned (per second).
	const SPRING = 1.4;
	// The accelerator. Every second, each lineup's change in total % move
	// (e.g. -0.02, +0.05, +0.2) speeds its car up or slows it down by that
	// fraction of its speed. Real per-second moves are a few hundredths of a
	// percent — invisible at 1:1 — so they're amplified, then capped so a wild
	// second can't send a car backwards.
	const ACCEL_GAIN = 4;
	const ACCEL_CAP = 0.6;
	const ACCEL_DECAY = 1.6;
	const NITRO_THRESHOLD = 0.15;

	// A real circuit, from measured centerline data (see $lib/race/circuits).
	// Road width is exaggerated well past scale so five cars fit side by side;
	// the cars are big on purpose too. At true scale a car was ~6px on a phone
	// under the whole-circuit camera, which is why the owner saw "no cars".
	const ROAD_WIDTH = 12;
	// How much ground the follow camera shows (scene units, the short side).
	const FOLLOW_VIEW = 62;
	// The circuit is fixed for the life of a race, so it is read once.
	// svelte-ignore state_referenced_locally
	const path = buildTrackPath(circuitById(circuit));

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	type View = 'follow' | 'iso' | 'chase';
	let view = $state<View>('follow');
	const labels: Record<string, HTMLDivElement> = {};

	type CarState = {
		group: THREE.Group;
		flame: THREE.Mesh;
		marker: THREE.Mesh | null;
		/** Smoothed heading (radians); null until the first frame. */
		heading: number | null;
		/** Where the marker bobs: above the roof of whatever vehicle this is. */
		markerY: number;
		wheels: THREE.Mesh[];
		s: number; // track progress in laps (unbounded)
		lane: number;
		accel: number;
		lastPct: number;
	};

	/** Position and heading at track progress `u` (laps), offset sideways by `lane`. */
	function trackAt(u: number, lane = 0): { pos: THREE.Vector3; dir: THREE.Vector3 } {
		const p = path.at(u, lane);
		return { pos: new THREE.Vector3(p.x, p.y, p.z), dir: new THREE.Vector3(p.dx, 0, p.dz) };
	}

	function cssColor(value: string): THREE.Color {
		// Resolve `var(--token)` (and any other CSS colour) through the browser.
		// Appended to the track's own element, so the world class on it applies.
		const probe = document.createElement('span');
		probe.style.color = value;
		(host ?? document.body).appendChild(probe);
		const rgb = getComputedStyle(probe).color;
		probe.remove();
		return new THREE.Color(rgb);
	}

	function token(name: string): THREE.Color {
		return cssColor(`var(--color-${name})`);
	}

	function palette(): Palette {
		return {
			grass: token('race-grass'),
			grassDark: token('race-grass-dark'),
			road: token('race-road'),
			line: token('race-line'),
			kerb: token('race-kerb'),
			tree: token('race-tree'),
			trunk: token('race-trunk'),
			flower: token('race-flower'),
			sun: token('race-sun'),
			wheel: token('race-wheel'),
			flame: token('race-flame'),
			ink: token('ink'),
			sky: token('race-sky'),
			surface: token('surface'),
			positive: token('positive'),
			negative: token('negative'),
			primary: token('primary'),
			tints: ['butter', 'pink', 'lavender', 'sky-tint', 'peach'].map(token)
		};
	}

	/** Builds the scene and starts the loop. Resolves to the cleanup. */
	async function start(): Promise<() => void> {
		const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
		await renderer.init();
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.setClearColor(0x000000, 0);

		const scene = new THREE.Scene();
		const p = palette();
		const textures: THREE.Texture[] = [];

		// ── Light ─────────────────────────────────────────────────────────
		// Each world sets its own light level (`--race-light`): night worlds are
		// dim, lamps and headlights do the rest, and bloom makes them glow.
		const lightLevel = parseFloat(getComputedStyle(host).getPropertyValue('--race-light')) || 1;
		const night = lightLevel < 0.8;
		scene.add(new THREE.HemisphereLight(night ? p.sun : p.surface, p.grassDark, 1.5 * lightLevel));
		const sun = new THREE.DirectionalLight(p.sun, 2.2 * lightLevel);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.bias = -0.0004;
		sun.shadow.normalBias = 0.3;
		scene.add(sun, sun.target);
		const SUN_OFFSET = new THREE.Vector3(50, 110, 35);
		function aimSun(focus: THREE.Vector3, reach: number) {
			sun.position.copy(focus).add(SUN_OFFSET);
			sun.target.position.copy(focus);
			const cam = sun.shadow.camera;
			if (cam.right !== reach) {
				Object.assign(cam, { left: -reach, right: reach, top: reach, bottom: -reach, far: 400 });
				cam.updateProjectionMatrix();
			}
		}
		// Fog only reads in the chase view; the top-down views push it out of range.
		scene.fog = new THREE.Fog(p.sky, 2000, 3000);
		const fog = scene.fog as THREE.Fog;

		// ── Ground ────────────────────────────────────────────────────────
		const { minX, maxX, minZ, maxZ } = path.bounds;
		const centre = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(maxX - minX + 240, maxZ - minZ + 240),
			groundMaterial(p)
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(centre.x, -0.02, centre.z);
		ground.receiveShadow = true;
		scene.add(ground);

		// ── Road: a ribbon along the real centerline ──────────────────────
		// UVs for the TSL road: u runs along the lap (units / 6, so the centre
		// dashes are 3 units long), v across the road.
		const SAMPLES = Math.max(900, Math.round(path.length / 1.2));
		const verts: number[] = [];
		const uvs: number[] = [];
		let run = 0;
		let prev = trackAt(0).pos;
		for (let i = 0; i <= SAMPLES; i++) {
			const u = i / SAMPLES;
			const mid = trackAt(u).pos;
			run += mid.distanceTo(prev);
			prev = mid;
			const inner = trackAt(u, -ROAD_WIDTH / 2).pos;
			const outer = trackAt(u, ROAD_WIDTH / 2).pos;
			verts.push(inner.x, inner.y + 0.01, inner.z, outer.x, outer.y + 0.01, outer.z);
			uvs.push(run / 6, 0, run / 6, 1);
		}
		const index: number[] = [];
		for (let i = 0; i < SAMPLES; i++) {
			const a = i * 2;
			index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
		}
		const roadGeo = new THREE.BufferGeometry();
		roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
		roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
		roadGeo.setIndex(index);
		roadGeo.computeVertexNormals();
		const road = new THREE.Mesh(roadGeo, roadMaterial(p, theme === 'village'));
		road.receiveShadow = true;
		scene.add(road);

		// Bridge pillars wherever the road is raised (Suzuka's crossover).
		const pillarGeo = new THREE.BoxGeometry(1.2, 1, 1.2);
		const pillarMat = flat(p.road);
		for (let i = 0; i < SAMPLES; i += 12) {
			for (const side of [-1, 1]) {
				const pt = trackAt(i / SAMPLES, side * (ROAD_WIDTH / 2 - 0.8)).pos;
				if (pt.y < 0.8) continue;
				const pillar = new THREE.Mesh(pillarGeo, pillarMat);
				pillar.scale.y = pt.y;
				pillar.position.set(pt.x, pt.y / 2, pt.z);
				pillar.castShadow = true;
				scene.add(pillar);
			}
		}

		// Kerbs: two-colour blocks on the outside of every corner.
		const KERB_STEPS = Math.round(path.length / 1.3);
		const kerbSpots: { pos: THREE.Vector3; dir: THREE.Vector3; alt: boolean }[] = [];
		for (let i = 0; i < KERB_STEPS; i++) {
			const u = i / KERB_STEPS;
			const now = trackAt(u).dir;
			const next = trackAt(u + 3 / KERB_STEPS).dir;
			// Signed turn between the two headings: its sign says which way the road bends.
			const turn = now.x * next.z - now.z * next.x;
			if (Math.abs(turn) < 0.04) continue;
			// The outside of the corner is the side the car is pushed towards.
			const side = turn > 0 ? 1 : -1;
			const { pos, dir } = trackAt(u, side * (ROAD_WIDTH / 2 + 0.5));
			kerbSpots.push({ pos, dir, alt: i % 2 === 0 });
		}
		const kerbs = new THREE.InstancedMesh(
			new THREE.BoxGeometry(1.3, 0.18, 1),
			flat(new THREE.Color(0xffffff)),
			Math.max(1, kerbSpots.length)
		);
		const m4 = new THREE.Matrix4();
		const q = new THREE.Quaternion();
		const X = new THREE.Vector3(1, 0, 0);
		kerbSpots.forEach(({ pos, dir, alt }, k) => {
			q.setFromUnitVectors(X, dir.normalize());
			m4.compose(pos.setY(pos.y + 0.09), q, new THREE.Vector3(1, 1, 1));
			kerbs.setMatrixAt(k, m4);
			kerbs.setColorAt(k, alt ? p.kerb : p.line);
		});
		kerbs.count = kerbSpots.length;
		kerbs.receiveShadow = true;
		scene.add(kerbs);

		// Start/finish line: a chequered strip across the road at lap 0.
		const checker = document.createElement('canvas');
		checker.width = 96;
		checker.height = 16;
		const cx = checker.getContext('2d')!;
		for (let i = 0; i < 24; i++) {
			for (let j = 0; j < 4; j++) {
				cx.fillStyle = (i + j) % 2 ? p.wheel.getStyle() : p.line.getStyle();
				cx.fillRect(i * 4, j * 4, 4, 4);
			}
		}
		const lineTex = new THREE.CanvasTexture(checker);
		lineTex.magFilter = THREE.NearestFilter;
		lineTex.colorSpace = THREE.SRGBColorSpace;
		textures.push(lineTex);
		const startLine = new THREE.Mesh(
			new THREE.PlaneGeometry(ROAD_WIDTH, 2),
			new THREE.MeshBasicNodeMaterial({ map: lineTex })
		);
		const start = trackAt(0);
		startLine.rotation.set(-Math.PI / 2, 0, Math.atan2(-start.dir.z, start.dir.x) + Math.PI / 2);
		startLine.position.copy(start.pos).setY(start.pos.y + 0.04);
		scene.add(startLine);

		// Sponsors' ads: a billboard, a banner along the barrier, an arch over the line.
		const loader = new THREE.TextureLoader();
		const postMat = flat(p.ink);
		const box = new THREE.BoxGeometry(1, 1, 1);
		const frameMat = flat(p.surface);
		for (const ad of ads) {
			const spec = AD_SLOTS[ad.slot];
			if (!spec) continue;
			const tex = loader.load(ad.image);
			tex.colorSpace = THREE.SRGBColorSpace;
			textures.push(tex);
			const face = new THREE.MeshBasicNodeMaterial({ map: tex, side: THREE.DoubleSide });
			const { pos, dir } = trackAt(spec.at);
			const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
			const heading = Math.atan2(-dir.z, dir.x);
			const post = (at: THREE.Vector3, h: number) => {
				const m = new THREE.Mesh(box, postMat);
				m.scale.set(0.5, h, 0.5);
				m.position.copy(at).setY(at.y + h / 2);
				m.castShadow = true;
				scene.add(m);
			};
			// The artwork on a cream board, so it sits in the sticker world.
			const board = (w: number, at: THREE.Vector3, ry: number) => {
				const h = w / spec.aspect;
				const back = new THREE.Mesh(box, frameMat);
				back.scale.set(w + 0.8, h + 0.8, 0.3);
				back.position.copy(at);
				back.rotation.y = ry;
				back.castShadow = true;
				const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
				art.position.copy(at);
				art.rotation.y = ry;
				art.translateZ(0.17);
				const artBack = art.clone();
				artBack.position.copy(at);
				artBack.rotation.y = ry + Math.PI;
				artBack.translateZ(0.17);
				scene.add(back, art, artBack);
			};
			if (ad.slot === 'arch') {
				const w = ROAD_WIDTH + 2;
				for (const k of [-1, 1]) post(pos.clone().addScaledVector(side, (k * w) / 2), 7.5);
				board(w, pos.clone().setY(pos.y + 7.5), heading + Math.PI / 2);
			} else if (ad.slot === 'billboard') {
				const w = 14;
				const spot = pos.clone().addScaledVector(side, ROAD_WIDTH / 2 + 7);
				const along = dir.clone().normalize();
				for (const k of [-1, 1]) post(spot.clone().addScaledVector(along, k * (w / 2 - 1)), 4);
				board(
					w,
					spot.setY(pos.y + 4 + w / spec.aspect / 2),
					Math.atan2(-side.z, side.x) + Math.PI / 2
				);
			} else {
				const w = 18;
				board(
					w,
					pos
						.clone()
						.addScaledVector(side, ROAD_WIDTH / 2 + 2)
						.setY(pos.y + w / spec.aspect / 2 + 0.3),
					heading
				);
			}
		}

		// Binary-mode checkpoints: a gate over the road for each call.
		const gates: THREE.MeshStandardNodeMaterial[] = [];
		const gateCount = checkpoints?.length ?? 0;
		for (let i = 0; i < gateCount; i++) {
			const { pos, dir } = trackAt((i + 0.5) / gateCount);
			const material = new THREE.MeshStandardNodeMaterial({
				color: p.line,
				emissiveIntensity: 1.4,
				flatShading: true
			});
			gates.push(material);
			const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
			for (const k of [-1, 1]) {
				const gp = new THREE.Mesh(box, material);
				gp.scale.set(0.6, 6, 0.6);
				gp.position
					.copy(pos)
					.addScaledVector(side, (k * (ROAD_WIDTH + 1)) / 2)
					.setY(pos.y + 3);
				gp.castShadow = true;
				scene.add(gp);
			}
			const bar = new THREE.Mesh(box, material);
			bar.scale.set(ROAD_WIDTH + 1.6, 0.6, 0.6);
			bar.position.copy(pos).setY(pos.y + 6);
			bar.rotation.y = Math.atan2(-dir.z, dir.x) + Math.PI / 2;
			scene.add(bar);
		}
		const black = new THREE.Color(0);
		function paintGates() {
			gates.forEach((m, i) => {
				const v = checkpoints?.[i] ?? null;
				const c = v === true ? p.positive : v === false ? p.negative : p.line;
				m.color.copy(c);
				m.emissive.copy(v === null ? black : c);
			});
		}

		// ── The world: scenery for this theme, seeded by the circuit ──────
		let seed = [...circuit].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
		const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
		buildWorld(theme, {
			scene,
			p,
			path,
			clearance: makeClearance(path),
			rand,
			roadHalf: ROAD_WIDTH / 2
		});

		// ── Cars ──────────────────────────────────────────────────────────
		const kit = carKit(p);
		const carMaterials: THREE.Material[] = [];
		let disposed = false;
		// Frame-loop state, updated 60 times a second. Deliberately not reactive:
		// nothing in the template reads it, and tracking it would re-render per frame.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const state = new Map<string, CarState>();

		function addCar(car: RaceCar, laneIndex: number, laneCount: number): CarState {
			const built = buildCar(kit, cssColor(car.color), {
				headlights: night ? p.sun : null,
				me: car.isMe
			});
			scene.add(built.group);
			const spread = Math.min(2.6, (ROAD_WIDTH - 3) / Math.max(1, laneCount - 1));
			const st: CarState = {
				group: built.group,
				flame: built.flame,
				marker: built.marker,
				markerY: 5,
				heading: null,
				wheels: built.wheels,
				s: 0,
				lane: (laneIndex - (laneCount - 1) / 2) * spread,
				accel: 0,
				lastPct: car.pct
			};
			// The car's real vehicle, once it has loaded. Until then (or if it
			// fails) the built-in pickup races, so a car is never missing.
			const vehicle = vehicleFor(car.model);
			if (vehicle) {
				loadVehicle(vehicle)
					.then((template) => {
						if (disposed || state.get(car.id) !== st) return;
						const { body, materials } = cloneVehicle(template, cssColor(car.color), kit.outline);
						carMaterials.push(...materials);
						st.group.remove(built.body);
						st.group.add(body);
						st.wheels = [];
						// Flame, lights and marker move to this vehicle's ends and roof.
						const box = new THREE.Box3().setFromObject(template);
						st.flame.position.x = box.min.x - 1.1;
						st.markerY = box.max.y + 2.4;
						for (const o of st.group.children) {
							if ((o as THREE.PointLight).isPointLight) o.position.x = box.max.x + 1.2;
						}
					})
					.catch((err) => console.warn(`Vehicle ${vehicle} did not load`, err));
			}
			return st;
		}

		function syncCars() {
			const ids = new Set(cars.map((c) => c.id));
			for (const [id, st] of state) {
				if (!ids.has(id)) {
					scene.remove(st.group);
					state.delete(id);
				}
			}
			cars.forEach((car, i) => {
				if (!state.has(car.id)) state.set(car.id, addCar(car, i, cars.length));
			});
		}

		// ── Cameras ───────────────────────────────────────────────────────
		// Isometric: looking down the (1, 1, 1) diagonal. `iso` frames the whole
		// circuit; `follow` (the default) is the same angle, close on your car.
		const ISO = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(220);
		const iso = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
		iso.position.copy(centre).add(ISO);
		iso.lookAt(centre);
		iso.updateMatrixWorld();
		// Fit the whole circuit: its extent as the iso camera sees it.
		const seen = path.points.map((pt) =>
			new THREE.Vector3(pt.x, pt.y, pt.z).applyMatrix4(iso.matrixWorldInverse)
		);
		const span = {
			w: Math.max(...seen.map((v) => v.x)) - Math.min(...seen.map((v) => v.x)) + 24,
			h: Math.max(...seen.map((v) => v.y)) - Math.min(...seen.map((v) => v.y)) + 24
		};
		const follow = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
		const focus = start.pos.clone();
		const chase = new THREE.PerspectiveCamera(52, 1, 0.5, 900);

		function fitOrtho(cam: THREE.OrthographicCamera, wide: number, high: number, aspect: number) {
			const v = Math.max(high, wide / aspect);
			Object.assign(cam, {
				left: (-v * aspect) / 2,
				right: (v * aspect) / 2,
				top: v / 2,
				bottom: -v / 2
			});
			cam.updateProjectionMatrix();
		}
		function resize() {
			const w = host.clientWidth;
			const h = host.clientHeight;
			if (!w || !h) return;
			renderer.setSize(w, h, false);
			const aspect = w / h;
			fitOrtho(iso, span.w, span.h, aspect);
			// The follow view keeps FOLLOW_VIEW units on its short side.
			if (aspect >= 1) fitOrtho(follow, FOLLOW_VIEW * aspect, FOLLOW_VIEW, aspect);
			else fitOrtho(follow, FOLLOW_VIEW, FOLLOW_VIEW / aspect, aspect);
			chase.aspect = aspect;
			chase.updateProjectionMatrix();
		}
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		// ── Night glow: bloom over the lamps, neon and headlights ─────────
		const glowy = theme === 'night' || theme === 'neon';
		let post: THREE.PostProcessing | null = null;
		let scenePass: ReturnType<typeof pass> | null = null;
		if (glowy) {
			// Post-processing draws onto an opaque target, so the sky becomes the
			// clear colour (these worlds' skies are near-black anyway).
			scene.background = p.sky;
			post = new THREE.PostProcessing(renderer);
			scenePass = pass(scene, follow);
			post.outputNode = scenePass.add(bloom(scenePass, 0.75, 0.35, 0.6));
		}

		// ── Sparks for overtakes ──────────────────────────────────────────
		const sparkGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
		const sparkMat = glow(p.flame, 2);
		const sparks: { mesh: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
		function burst(at: THREE.Vector3) {
			if (reduceMotion) return;
			for (let i = 0; i < 18; i++) {
				const mesh = new THREE.Mesh(sparkGeo, sparkMat);
				mesh.position.copy(at).setY(at.y + 1.5);
				scene.add(mesh);
				sparks.push({
					mesh,
					v: new THREE.Vector3(
						(Math.random() - 0.5) * 12,
						Math.random() * 8 + 3,
						(Math.random() - 0.5) * 12
					),
					life: 0.8
				});
			}
		}

		// ── Loop ──────────────────────────────────────────────────────────
		let order: string[] = [];
		let lastSecond = performance.now();
		let last = performance.now();
		let leaderS = 0;
		let speedScale = 1;
		const projected = new THREE.Vector3();
		const LABEL_Y = 6.8;

		function frame(now: number) {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			syncCars();
			if (gates.length) paintGates();

			// Once a second: each lineup's change in % becomes its accelerator.
			if (now - lastSecond >= 1000) {
				lastSecond = now;
				for (const car of cars) {
					const st = state.get(car.id);
					if (!st) continue;
					const delta = car.pct - st.lastPct;
					st.lastPct = car.pct;
					st.accel = Math.max(-ACCEL_CAP, Math.min(ACCEL_CAP, delta * ACCEL_GAIN));
				}
			}

			// The finish: everyone rolls to a stop.
			speedScale = finished ? Math.max(0, speedScale - dt * 0.6) : holding ? 0 : 1;
			const base = (dt / (reduceMotion ? LAP_SECONDS * 1.6 : LAP_SECONDS)) * speedScale;

			const leaderPct = cars.length ? Math.max(...cars.map((c) => c.pct)) : 0;
			leaderS += base;
			for (const car of cars) {
				const st = state.get(car.id);
				if (!st) continue;
				const gap = Math.min(MAX_GAP, (leaderPct - car.pct) * GAP_PER_PCT);
				const target = leaderS - gap;
				// Speed = steady pace × accelerator, plus a pull towards the place
				// the lineup has earned. The pull is what keeps the order honest.
				const before = st.s;
				st.s += base * (1 + st.accel) + (target - st.s) * Math.min(1, SPRING * dt);
				st.accel *= Math.exp(-ACCEL_DECAY * dt);

				const { pos, dir } = trackAt(st.s, st.lane);
				st.group.position.copy(pos);
				// Ease into the new heading rather than snapping to it, so hairpins
				// read as a turn. The first frame (and a stopped car) sets it outright.
				const want = Math.atan2(-dir.z, dir.x);
				if (st.heading === null) st.heading = want;
				else {
					let turn = want - st.heading;
					turn = Math.atan2(Math.sin(turn), Math.cos(turn));
					st.heading += turn * Math.min(1, dt * 14);
				}
				st.group.rotation.y = st.heading;
				// Wheels turn with the distance covered (radius 0.62).
				const spin = ((st.s - before) * path.length) / 0.62;
				for (const w of st.wheels) w.rotation.y -= spin;
				st.flame.visible = !finished && st.accel > NITRO_THRESHOLD;
				if (st.flame.visible && !reduceMotion) {
					st.flame.scale.setScalar(0.8 + Math.random() * 0.5);
				}
				if (st.marker)
					st.marker.position.y = st.markerY + (reduceMotion ? 0 : Math.sin(now / 250) * 0.3);
			}

			// Overtakes: the order is always the order of total % move.
			const ranked = [...cars].sort((a, b) => b.pct - a.pct).map((c) => c.id);
			if (order.length === ranked.length) {
				ranked.forEach((id, i) => {
					const was = order.indexOf(id);
					if (was > i) {
						const passed = cars.find((c) => c.id === order[i]);
						const passer = cars.find((c) => c.id === id);
						if (passer && passed) {
							burst(state.get(id)!.group.position);
							onOvertake?.(passer, passed);
						}
					}
				});
			}
			order = ranked;

			for (let i = sparks.length - 1; i >= 0; i--) {
				const sp = sparks[i];
				sp.life -= dt;
				sp.v.y -= 22 * dt;
				sp.mesh.position.addScaledVector(sp.v, dt);
				if (sp.life <= 0) {
					scene.remove(sp.mesh);
					sparks.splice(i, 1);
				}
			}

			// The follow and chase views track your car; falls back to the leader.
			const me = cars.find((c) => c.isMe) ?? cars.find((c) => c.id === ranked[0]);
			const target = me ? state.get(me.id) : undefined;
			if (target) focus.lerp(target.group.position, Math.min(1, dt * 4));
			let active: THREE.Camera;
			if (view === 'chase' && target) {
				const { pos, dir } = trackAt(target.s, target.lane);
				const want = pos
					.clone()
					.addScaledVector(dir, -16)
					.setY(pos.y + 8);
				chase.position.lerp(want, Math.min(1, dt * 3));
				chase.lookAt(
					pos
						.clone()
						.addScaledVector(dir, 10)
						.setY(pos.y + 2)
				);
				fog.near = 70;
				fog.far = 320;
				aimSun(pos, 90);
				active = chase;
			} else if (view === 'iso' || !target) {
				fog.near = 2000;
				fog.far = 3000;
				aimSun(centre, Math.max(span.w, span.h) * 0.75);
				active = iso;
			} else {
				follow.position.copy(focus).add(ISO);
				follow.lookAt(focus);
				fog.near = 2000;
				fog.far = 3000;
				aimSun(focus, FOLLOW_VIEW * 1.1);
				active = follow;
			}

			if (post && scenePass) {
				scenePass.camera = active;
				post.render();
			} else {
				renderer.render(scene, active);
			}

			// Name tags follow their cars on screen.
			const w = host.clientWidth;
			const h = host.clientHeight;
			for (const [id, st] of state) {
				const el = labels[id];
				if (!el) continue;
				projected.copy(st.group.position);
				projected.y += LABEL_Y;
				projected.project(active);
				const hidden =
					projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1;
				el.style.opacity = hidden ? '0' : '1';
				el.style.transform = `translate(-50%, -100%) translate(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * h}px)`;
			}
		}
		renderer.setAnimationLoop(frame);

		return () => {
			renderer.setAnimationLoop(null);
			ro.disconnect();
			disposed = true;
			kit.dispose();
			carMaterials.forEach((m) => m.dispose());
			// Teardown only, never rendered: a plain Set is right here.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const seenMats = new Set<THREE.Material>();
			scene.traverse((o) => {
				const mesh = o as THREE.Mesh;
				if (!mesh.isMesh) return;
				mesh.geometry?.dispose();
				const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
				for (const m of mats) seenMats.add(m);
				if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
			});
			seenMats.forEach((m) => m.dispose());
			textures.forEach((t) => t.dispose());
			post?.dispose();
			renderer.dispose();
		};
	}

	onMount(() => {
		let cleanup = () => {};
		let gone = false;
		start()
			.then((stop) => {
				if (gone) stop();
				else cleanup = stop;
			})
			.catch((err) => {
				// No WebGPU and no WebGL2 (or the GPU process died): the race page
				// switches to its chart view.
				console.warn('3D race unavailable', err);
				if (!gone) onUnsupported?.();
			});
		return () => {
			gone = true;
			cleanup();
		};
	});

	const standings = $derived([...cars].sort((a, b) => b.pct - a.pct));
	const VIEWS: [View, string][] = [
		['follow', 'Follow'],
		['iso', 'Track'],
		['chase', 'Chase']
	];
</script>

<div
	bind:this={host}
	class="track-{theme} relative w-full overflow-hidden rounded-[22px] border-2 border-border {tall
		? 'h-[min(62vh,620px)] min-h-[320px]'
		: 'h-[440px] max-sm:h-[320px]'}"
	style="background:var(--race-sky)"
>
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>

	{#each cars as car (car.id)}
		<div
			bind:this={labels[car.id]}
			class="pointer-events-none absolute top-0 left-0 rounded-full border-2 border-border px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap transition-opacity"
			style="background:{car.isMe
				? 'var(--color-primary)'
				: 'var(--color-surface)'};color:var(--color-text)"
		>
			{car.isMe ? 'You' : car.name}
			<span class="font-mono font-bold opacity-70"
				>{car.pct >= 0 ? '+' : ''}{car.pct.toFixed(2)}%</span
			>
		</div>
	{/each}

	<!-- Standings strip -->
	<ol
		class="absolute top-3 left-3 flex flex-col gap-1 rounded-[14px] border-2 border-border bg-surface p-2 pe-3 text-[11px] font-bold shadow-[3px_3px_0_var(--color-ink)]"
		aria-label="Race order"
	>
		{#each standings as car, i (car.id)}
			<li class="flex items-center gap-2">
				<span class="w-4 text-right font-mono text-text-muted">{i + 1}</span>
				<span class="inline-block h-2.5 w-2.5 rounded-full" style="background:{car.color}"></span>
				<span class:text-primary-ink={car.isMe}>{car.isMe ? 'You' : car.name}</span>
			</li>
		{/each}
	</ol>

	<div
		class="absolute top-3 right-3 flex gap-1 rounded-[14px] border-2 border-border bg-surface p-1 shadow-[3px_3px_0_var(--color-ink)]"
		role="group"
		aria-label="Camera"
	>
		{#each VIEWS as [mode, label] (mode)}
			<button
				type="button"
				onclick={() => (view = mode)}
				aria-pressed={view === mode}
				class="min-h-8 cursor-pointer rounded-[9px] border-none px-3 text-[11px] font-extrabold transition {view ===
				mode
					? 'bg-butter text-text'
					: 'bg-transparent text-text-muted'}"
			>
				{label}
			</button>
		{/each}
	</div>

	{#if finished}
		<div class="absolute inset-x-0 bottom-4 flex justify-center">
			<div class="rounded-full bg-text px-5 py-2 text-sm font-black text-surface shadow">
				🏁 Chequered flag — final prices coming in
			</div>
		</div>
	{/if}
</div>
