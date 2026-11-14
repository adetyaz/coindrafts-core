<script lang="ts" module>
	export type RaceCar = {
		id: string;
		name: string;
		/** Any CSS colour, including `var(--token)`. */
		color: string;
		/** The lineup's total % move right now. Decides the order on track. */
		pct: number;
		isMe: boolean;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { circuitById, DEFAULT_CIRCUIT } from '$lib/race/circuits';
	import { buildTrackPath } from '$lib/race/trackPath';
	import { AD_SLOTS, type TrackAd } from '$lib/sponsors';
	import type { TrackTheme } from '$lib/race/trackTheme';

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
	// Road width is exaggerated well past scale so five cars fit side by side.
	const ROAD_WIDTH = 7;
	// The circuit is fixed for the life of a race, so it is read once.
	// svelte-ignore state_referenced_locally
	const path = buildTrackPath(circuitById(circuit));

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let camera = $state<'iso' | 'chase'>('iso');
	const labels: Record<string, HTMLDivElement> = {};

	type CarState = {
		group: THREE.Group;
		flame: THREE.Mesh;
		marker: THREE.Mesh | null;
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

	onMount(() => {
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		} catch {
			onUnsupported?.();
			return;
		}
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		const scene = new THREE.Scene();
		const disposables: { dispose: () => void }[] = [];
		const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
		const mat = (color: THREE.Color, extra: THREE.MeshStandardMaterialParameters = {}) =>
			keep(new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra }));

		// ── Light ─────────────────────────────────────────────────────────
		// Each world sets its own light level (`--race-light`): night worlds are
		// dim, and the cars carry headlights instead.
		const lightLevel = parseFloat(getComputedStyle(host).getPropertyValue('--race-light')) || 1;
		const night = lightLevel < 0.8;
		const white = token('surface');
		const sunColour = token('race-sun');
		scene.add(
			new THREE.HemisphereLight(
				night ? sunColour : white,
				token('race-grass-dark'),
				1.4 * lightLevel
			)
		);
		const sun = new THREE.DirectionalLight(sunColour, 1.6 * lightLevel);
		sun.position.set(60, 120, 40);
		sun.castShadow = true;
		sun.shadow.mapSize.set(1024, 1024);
		Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, far: 400 });
		sun.shadow.camera.updateProjectionMatrix();
		scene.add(sun);

		// ── Ground ────────────────────────────────────────────────────────
		const { minX, maxX, minZ, maxZ } = path.bounds;
		const centre = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
		const ground = new THREE.Mesh(
			keep(new THREE.PlaneGeometry(maxX - minX + 80, maxZ - minZ + 80)),
			mat(token('race-grass'))
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(centre.x, -0.02, centre.z);
		ground.receiveShadow = true;
		scene.add(ground);

		// ── Road: a ribbon along the real centerline ──────────────────────
		const SAMPLES = 900;
		const verts: number[] = [];
		for (let i = 0; i <= SAMPLES; i++) {
			const inner = trackAt(i / SAMPLES, -ROAD_WIDTH / 2).pos;
			const outer = trackAt(i / SAMPLES, ROAD_WIDTH / 2).pos;
			verts.push(inner.x, inner.y + 0.01, inner.z, outer.x, outer.y + 0.01, outer.z);
		}
		const index: number[] = [];
		for (let i = 0; i < SAMPLES; i++) {
			const a = i * 2;
			index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
		}
		const roadGeo = keep(new THREE.BufferGeometry());
		roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
		roadGeo.setIndex(index);
		roadGeo.computeVertexNormals();
		const road = new THREE.Mesh(roadGeo, mat(token('race-road'), { side: THREE.DoubleSide }));
		road.receiveShadow = true;
		scene.add(road);

		// Bridge pillars wherever the road is raised (Suzuka's crossover).
		const pillarGeo = keep(new THREE.BoxGeometry(0.8, 1, 0.8));
		const pillarMat = mat(token('race-road'));
		for (let i = 0; i < SAMPLES; i += 12) {
			for (const side of [-1, 1]) {
				const p = trackAt(i / SAMPLES, side * (ROAD_WIDTH / 2 - 0.6)).pos;
				if (p.y < 0.8) continue;
				const pillar = new THREE.Mesh(pillarGeo, pillarMat);
				pillar.scale.y = p.y;
				pillar.position.set(p.x, p.y / 2, p.z);
				pillar.castShadow = true;
				scene.add(pillar);
			}
		}

		// Kerbs: red-and-white blocks on the outside of every corner.
		const KERB_STEPS = 600;
		const kerbSpots: { pos: THREE.Vector3; dir: THREE.Vector3; alt: boolean }[] = [];
		for (let i = 0; i < KERB_STEPS; i++) {
			const u = i / KERB_STEPS;
			const now = trackAt(u).dir;
			const next = trackAt(u + 2 / KERB_STEPS).dir;
			// Signed turn between the two headings: its sign says which way the road bends.
			const turn = now.x * next.z - now.z * next.x;
			if (Math.abs(turn) < 0.04) continue;
			// The outside of the corner is the side the car is pushed towards.
			const side = turn > 0 ? 1 : -1;
			const { pos, dir } = trackAt(u, side * (ROAD_WIDTH / 2 + 0.3));
			kerbSpots.push({ pos, dir, alt: i % 2 === 0 });
		}
		const kerbGeo = keep(new THREE.BoxGeometry(0.9, 0.12, 0.6));
		const kerbs = new THREE.InstancedMesh(kerbGeo, mat(white), Math.max(1, kerbSpots.length));
		const kerbA = token('race-kerb');
		const kerbB = token('race-line');
		const m4 = new THREE.Matrix4();
		const q = new THREE.Quaternion();
		kerbSpots.forEach(({ pos, dir, alt }, k) => {
			q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
			m4.compose(pos.setY(pos.y + 0.06), q, new THREE.Vector3(1, 1, 1));
			kerbs.setMatrixAt(k, m4);
			kerbs.setColorAt(k, alt ? kerbA : kerbB);
		});
		kerbs.count = kerbSpots.length;
		scene.add(kerbs);

		// Start/finish line: a chequered strip across the road at lap 0.
		const checker = document.createElement('canvas');
		checker.width = 64;
		checker.height = 16;
		const cx = checker.getContext('2d')!;
		const dark = token('race-wheel').getStyle();
		const light = token('race-line').getStyle();
		for (let i = 0; i < 16; i++) {
			for (let j = 0; j < 4; j++) {
				cx.fillStyle = (i + j) % 2 ? dark : light;
				cx.fillRect(i * 4, j * 4, 4, 4);
			}
		}
		const lineTex = keep(new THREE.CanvasTexture(checker));
		lineTex.magFilter = THREE.NearestFilter;
		const startLine = new THREE.Mesh(
			keep(new THREE.PlaneGeometry(ROAD_WIDTH, 1.4)),
			keep(new THREE.MeshBasicMaterial({ map: lineTex }))
		);
		const start = trackAt(0);
		startLine.rotation.set(-Math.PI / 2, 0, Math.atan2(-start.dir.z, start.dir.x) + Math.PI / 2);
		startLine.position.copy(start.pos).setY(start.pos.y + 0.04);
		scene.add(startLine);

		// Sponsors' ads: a billboard, a banner along the barrier, an arch over the line.
		const loader = new THREE.TextureLoader();
		const postMat = mat(token('race-wheel'));
		for (const ad of ads) {
			const spec = AD_SLOTS[ad.slot];
			if (!spec) continue;
			const tex = keep(loader.load(ad.image));
			tex.colorSpace = THREE.SRGBColorSpace;
			const face = keep(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
			const { pos, dir } = trackAt(spec.at);
			const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
			const heading = Math.atan2(-dir.z, dir.x);
			if (ad.slot === 'arch') {
				const w = ROAD_WIDTH + 1.2;
				const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, w / spec.aspect)), face);
				sign.position.copy(pos).setY(pos.y + 4.2);
				sign.rotation.y = heading + Math.PI / 2;
				scene.add(sign);
				for (const k of [-1, 1]) {
					const post = new THREE.Mesh(keep(new THREE.BoxGeometry(0.4, 4.6, 0.4)), postMat);
					post.position
						.copy(pos)
						.addScaledVector(side, (k * w) / 2)
						.setY(pos.y + 2.3);
					scene.add(post);
				}
			} else if (ad.slot === 'billboard') {
				const w = 9;
				const board = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, w / spec.aspect)), face);
				const spot = pos.clone().addScaledVector(side, ROAD_WIDTH / 2 + 5);
				board.position.copy(spot).setY(pos.y + 3.6);
				// Faces the road.
				board.rotation.y = Math.atan2(-side.z, side.x) - Math.PI / 2 + Math.PI;
				scene.add(board);
				for (const k of [-1, 1]) {
					const post = new THREE.Mesh(keep(new THREE.BoxGeometry(0.3, 3.6, 0.3)), postMat);
					post.position
						.copy(spot)
						.addScaledVector(dir.clone().normalize(), k * (w / 2 - 0.6))
						.setY(pos.y + 1.4);
					scene.add(post);
				}
			} else {
				const w = 14;
				const banner = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, w / spec.aspect)), face);
				banner.position
					.copy(pos)
					.addScaledVector(side, ROAD_WIDTH / 2 + 1.4)
					.setY(pos.y + 0.9);
				banner.rotation.y = heading;
				scene.add(banner);
			}
		}

		// Binary-mode checkpoints: a gate over the road for each call.
		const gates: THREE.MeshStandardMaterial[] = [];
		const gateCount = checkpoints?.length ?? 0;
		for (let i = 0; i < gateCount; i++) {
			const { pos, dir } = trackAt((i + 0.5) / gateCount);
			const material = new THREE.MeshStandardMaterial({
				color: token('race-line'),
				emissiveIntensity: 0.9,
				flatShading: true
			});
			keep(material);
			gates.push(material);
			const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
			const postGeo = keep(new THREE.BoxGeometry(0.35, 3.2, 0.35));
			for (const k of [-1, 1]) {
				const post = new THREE.Mesh(postGeo, material);
				post.position
					.copy(pos)
					.addScaledVector(side, (k * ROAD_WIDTH) / 2)
					.setY(pos.y + 1.6);
				scene.add(post);
			}
			const bar = new THREE.Mesh(
				keep(new THREE.BoxGeometry(ROAD_WIDTH + 0.4, 0.35, 0.35)),
				material
			);
			bar.position.copy(pos).setY(pos.y + 3.2);
			bar.rotation.y = Math.atan2(-dir.z, dir.x) + Math.PI / 2;
			scene.add(bar);
		}
		const gateOn = token('positive');
		const gateOff = token('negative');
		const gateIdle = token('race-line');
		function paintGates() {
			gates.forEach((m, i) => {
				const v = checkpoints?.[i] ?? null;
				const c = v === true ? gateOn : v === false ? gateOff : gateIdle;
				m.color.copy(c);
				m.emissive.copy(v === null ? new THREE.Color(0) : c);
			});
		}

		// Low-poly trees scattered off the circuit. Seeded by the circuit, so a
		// track always looks the same.
		const trunkGeo = keep(new THREE.CylinderGeometry(0.3, 0.4, 1.6, 6));
		const crownGeo = keep(new THREE.ConeGeometry(1.8, 4, 7));
		const trunkMat = mat(token('race-trunk'));
		const crownMat = mat(token('race-tree'));
		let seed = [...circuit].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
		const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
		let planted = 0;
		for (let tries = 0; tries < 400 && planted < 45; tries++) {
			const x = minX - 25 + rand() * (maxX - minX + 50);
			const z = minZ - 25 + rand() * (maxZ - minZ + 50);
			const clear = path.points.every((p) => Math.hypot(p.x - x, p.z - z) > ROAD_WIDTH + 4);
			if (!clear) continue;
			const trunk = new THREE.Mesh(trunkGeo, trunkMat);
			trunk.position.set(x, 0.8, z);
			const crown = new THREE.Mesh(crownGeo, crownMat);
			crown.position.set(x, 3.4, z);
			crown.castShadow = trunk.castShadow = true;
			scene.add(trunk, crown);
			planted++;
		}

		// Flowers in the grass (lamps, at night): small dots of the world's accent colour.
		const flowerGeo = keep(new THREE.SphereGeometry(night ? 0.42 : 0.3, 6, 5));
		const flowerColour = token('race-flower');
		const flowerMat = keep(
			new THREE.MeshStandardMaterial({
				color: flowerColour,
				emissive: flowerColour,
				emissiveIntensity: night ? 1.4 : 0.15,
				flatShading: true
			})
		);
		const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 160);
		const fm = new THREE.Matrix4();
		let grown = 0;
		for (let tries = 0; tries < 900 && grown < 160; tries++) {
			const x = minX - 20 + rand() * (maxX - minX + 40);
			const z = minZ - 20 + rand() * (maxZ - minZ + 40);
			const off = path.points.every((p) => Math.hypot(p.x - x, p.z - z) > ROAD_WIDTH / 2 + 1.5);
			if (!off) continue;
			fm.setPosition(x, night ? 1.1 : 0.25, z);
			flowers.setMatrixAt(grown++, fm);
		}
		flowers.count = grown;
		scene.add(flowers);

		// ── Cars ──────────────────────────────────────────────────────────
		const bodyGeo = keep(new THREE.BoxGeometry(2.4, 0.6, 1.2));
		const cabinGeo = keep(new THREE.BoxGeometry(1.2, 0.5, 1.0));
		const wheelGeo = keep(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 10));
		const spoilerGeo = keep(new THREE.BoxGeometry(0.2, 0.08, 1.2));
		const flameGeo = keep(new THREE.ConeGeometry(0.35, 1.6, 8));
		const markerGeo = keep(new THREE.ConeGeometry(0.5, 1, 4));
		const wheelMat = mat(token('race-wheel'));
		const glassMat = mat(token('race-line'), { metalness: 0.2, roughness: 0.3 });
		const flameMat = keep(
			new THREE.MeshBasicMaterial({ color: token('race-flame'), transparent: true, opacity: 0.85 })
		);

		// Frame-loop state, updated 60 times a second. Deliberately not reactive:
		// nothing in the template reads it, and tracking it would re-render per frame.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const state = new Map<string, CarState>();

		function buildCar(car: RaceCar, laneIndex: number, laneCount: number): CarState {
			const group = new THREE.Group();
			const paint = mat(cssColor(car.color));
			const body = new THREE.Mesh(bodyGeo, paint);
			body.position.y = 0.55;
			const cabin = new THREE.Mesh(cabinGeo, glassMat);
			cabin.position.set(-0.2, 1.05, 0);
			const spoiler = new THREE.Mesh(spoilerGeo, paint);
			spoiler.position.set(-1.15, 1.0, 0);
			group.add(body, cabin, spoiler);
			for (const [x, z] of [
				[0.75, 0.62],
				[0.75, -0.62],
				[-0.75, 0.62],
				[-0.75, -0.62]
			]) {
				const wheel = new THREE.Mesh(wheelGeo, wheelMat);
				wheel.rotation.x = Math.PI / 2;
				wheel.position.set(x, 0.34, z);
				group.add(wheel);
			}
			group.traverse((o) => (o.castShadow = true));
			// Night worlds: headlights that light the road ahead.
			if (night) {
				const lamp = new THREE.PointLight(sunColour, 28, 16, 1.6);
				lamp.position.set(2.6, 1.2, 0);
				group.add(lamp);
			}

			const flame = new THREE.Mesh(flameGeo, flameMat);
			flame.rotation.z = Math.PI / 2;
			flame.position.set(-2.0, 0.55, 0);
			flame.visible = false;
			group.add(flame);

			let marker: THREE.Mesh | null = null;
			if (car.isMe) {
				marker = new THREE.Mesh(markerGeo, mat(token('primary')));
				marker.rotation.x = Math.PI;
				marker.position.y = 2.6;
				group.add(marker);
			}
			scene.add(group);

			const spread = Math.min(1.5, (ROAD_WIDTH - 2) / Math.max(1, laneCount - 1));
			return {
				group,
				flame,
				marker,
				s: 0,
				lane: (laneIndex - (laneCount - 1) / 2) * spread,
				accel: 0,
				lastPct: car.pct
			};
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
				if (!state.has(car.id)) state.set(car.id, buildCar(car, i, cars.length));
			});
		}

		// ── Cameras ───────────────────────────────────────────────────────
		const iso = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
		// True isometric: looking down the (1, 1, 1) diagonal.
		iso.position.set(centre.x + 150, 150, centre.z + 150);
		iso.lookAt(centre);
		iso.updateMatrixWorld();
		// Fit the whole circuit: its extent as the iso camera sees it.
		const seen = path.points.map((p) =>
			new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(iso.matrixWorldInverse)
		);
		const span = {
			w: Math.max(...seen.map((v) => v.x)) - Math.min(...seen.map((v) => v.x)) + 16,
			h: Math.max(...seen.map((v) => v.y)) - Math.min(...seen.map((v) => v.y)) + 16
		};
		const chase = new THREE.PerspectiveCamera(55, 1, 0.1, 500);

		function resize() {
			const w = host.clientWidth;
			const h = host.clientHeight;
			renderer.setSize(w, h, false);
			const aspect = w / h;
			const view = Math.max(span.h, span.w / aspect);
			iso.left = (-view * aspect) / 2;
			iso.right = (view * aspect) / 2;
			iso.top = view / 2;
			iso.bottom = -view / 2;
			iso.updateProjectionMatrix();
			chase.aspect = aspect;
			chase.updateProjectionMatrix();
		}
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		// ── Sparks for overtakes ──────────────────────────────────────────
		const sparkGeo = keep(new THREE.BoxGeometry(0.18, 0.18, 0.18));
		const sparkMat = keep(new THREE.MeshBasicMaterial({ color: token('race-flame') }));
		const sparks: { mesh: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
		function burst(at: THREE.Vector3) {
			if (reduceMotion) return;
			for (let i = 0; i < 14; i++) {
				const mesh = new THREE.Mesh(sparkGeo, sparkMat);
				mesh.position.copy(at).setY(0.8);
				scene.add(mesh);
				sparks.push({
					mesh,
					v: new THREE.Vector3(
						(Math.random() - 0.5) * 8,
						Math.random() * 6 + 2,
						(Math.random() - 0.5) * 8
					),
					life: 0.7
				});
			}
		}

		// ── Loop ──────────────────────────────────────────────────────────
		let order: string[] = [];
		let lastSecond = performance.now();
		let last = performance.now();
		let raf = 0;
		let leaderS = 0;
		let speedScale = 1;
		const projected = new THREE.Vector3();

		function frame(now: number) {
			raf = requestAnimationFrame(frame);
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			syncCars();
			if (gates.length) paintGates();
			if (state.size === 0) {
				renderer.render(scene, iso);
				return;
			}

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

			const leaderPct = Math.max(...cars.map((c) => c.pct));
			leaderS += base;
			for (const car of cars) {
				const st = state.get(car.id);
				if (!st) continue;
				const gap = Math.min(MAX_GAP, (leaderPct - car.pct) * GAP_PER_PCT);
				const target = leaderS - gap;
				// Speed = steady pace × accelerator, plus a pull towards the place
				// the lineup has earned. The pull is what keeps the order honest.
				st.s += base * (1 + st.accel) + (target - st.s) * Math.min(1, SPRING * dt);
				st.accel *= Math.exp(-ACCEL_DECAY * dt);

				const { pos, dir } = trackAt(st.s, st.lane);
				st.group.position.copy(pos);
				st.group.rotation.y = Math.atan2(-dir.z, dir.x);
				st.flame.visible = !finished && st.accel > NITRO_THRESHOLD;
				if (st.flame.visible && !reduceMotion) {
					st.flame.scale.setScalar(0.8 + Math.random() * 0.5);
				}
				if (st.marker) st.marker.position.y = 2.6 + (reduceMotion ? 0 : Math.sin(now / 250) * 0.15);
			}

			// Overtakes: the order is always the order of total % move.
			const ranked = [...cars].sort((a, b) => b.pct - a.pct).map((c) => c.id);
			if (order.length === ranked.length) {
				ranked.forEach((id, i) => {
					const before = order.indexOf(id);
					if (before > i) {
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
				const p = sparks[i];
				p.life -= dt;
				p.v.y -= 18 * dt;
				p.mesh.position.addScaledVector(p.v, dt);
				if (p.life <= 0) {
					scene.remove(p.mesh);
					sparks.splice(i, 1);
				}
			}

			// Chase camera follows your car; falls back to the leader.
			const me = cars.find((c) => c.isMe) ?? cars.find((c) => c.id === ranked[0]);
			const target = me ? state.get(me.id) : undefined;
			if (camera === 'chase' && target) {
				const { pos, dir } = trackAt(target.s, target.lane);
				const want = pos
					.clone()
					.addScaledVector(dir, -9)
					.setY(pos.y + 4.5);
				chase.position.lerp(want, Math.min(1, dt * 3));
				chase.lookAt(
					pos
						.clone()
						.addScaledVector(dir, 6)
						.setY(pos.y + 1)
				);
			}
			const active = camera === 'chase' ? chase : iso;
			renderer.render(scene, active);

			// Name tags follow their cars on screen.
			const w = host.clientWidth;
			const h = host.clientHeight;
			for (const [id, st] of state) {
				const el = labels[id];
				if (!el) continue;
				projected.copy(st.group.position).setY(3.4).project(active);
				const hidden = projected.z > 1;
				el.style.opacity = hidden ? '0' : '1';
				el.style.transform = `translate(-50%, -100%) translate(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * h}px)`;
			}
		}
		raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			disposables.forEach((d) => d.dispose());
			renderer.dispose();
		};
	});

	const standings = $derived([...cars].sort((a, b) => b.pct - a.pct));
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
	>
		{#each [['iso', 'Overview'], ['chase', 'Chase']] as [mode, label] (mode)}
			<button
				type="button"
				onclick={() => (camera = mode as 'iso' | 'chase')}
				aria-pressed={camera === mode}
				class="min-h-8 cursor-pointer rounded-[9px] border-none px-3 text-[11px] font-extrabold transition {camera ===
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
