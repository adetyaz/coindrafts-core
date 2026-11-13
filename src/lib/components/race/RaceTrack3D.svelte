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

	let {
		cars,
		finished = false,
		onOvertake,
		onUnsupported
	}: {
		cars: RaceCar[];
		finished?: boolean;
		onOvertake?: (passer: RaceCar, passed: RaceCar) => void;
		onUnsupported?: () => void;
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

	// Stadium-shaped track in the XZ plane.
	const STRAIGHT = 44;
	const RADIUS = 15;
	const ROAD_WIDTH = 8;
	const PERIMETER = 2 * STRAIGHT + 2 * Math.PI * RADIUS;

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
		let d = (((u % 1) + 1) % 1) * PERIMETER;
		const half = STRAIGHT / 2;
		const arc = Math.PI * RADIUS;
		let x: number, z: number, dx: number, dz: number;
		if (d < STRAIGHT) {
			// bottom straight, heading +x
			x = -half + d;
			z = RADIUS;
			dx = 1;
			dz = 0;
		} else if ((d -= STRAIGHT) < arc) {
			// right bend
			const a = d / RADIUS;
			x = half + Math.sin(a) * RADIUS;
			z = Math.cos(a) * RADIUS;
			dx = Math.cos(a);
			dz = -Math.sin(a);
		} else if ((d -= arc) < STRAIGHT) {
			// top straight, heading -x
			x = half - d;
			z = -RADIUS;
			dx = -1;
			dz = 0;
		} else {
			// left bend
			d -= STRAIGHT;
			const a = d / RADIUS;
			x = -half - Math.sin(a) * RADIUS;
			z = -Math.cos(a) * RADIUS;
			dx = -Math.cos(a);
			dz = Math.sin(a);
		}
		// Left-hand normal of the heading; lanes spread across the road.
		const pos = new THREE.Vector3(x - dz * lane, 0, z + dx * lane);
		return { pos, dir: new THREE.Vector3(dx, 0, dz) };
	}

	function cssColor(value: string): THREE.Color {
		// Resolve `var(--token)` (and any other CSS colour) through the browser.
		const probe = document.createElement('span');
		probe.style.color = value;
		document.body.appendChild(probe);
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
		const white = token('surface');
		scene.add(new THREE.HemisphereLight(white, token('race-grass-dark'), 1.4));
		const sun = new THREE.DirectionalLight(white, 1.6);
		sun.position.set(30, 60, 20);
		sun.castShadow = true;
		sun.shadow.mapSize.set(1024, 1024);
		Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 40, bottom: -40 });
		sun.shadow.camera.updateProjectionMatrix();
		scene.add(sun);

		// ── Ground ────────────────────────────────────────────────────────
		const ground = new THREE.Mesh(
			keep(new THREE.PlaneGeometry(220, 160)),
			mat(token('race-grass'))
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -0.02;
		ground.receiveShadow = true;
		scene.add(ground);

		// ── Road: a ribbon sampled along the stadium path ──────────────────
		const SAMPLES = 240;
		const verts: number[] = [];
		for (let i = 0; i <= SAMPLES; i++) {
			const inner = trackAt(i / SAMPLES, -ROAD_WIDTH / 2).pos;
			const outer = trackAt(i / SAMPLES, ROAD_WIDTH / 2).pos;
			verts.push(inner.x, 0, inner.z, outer.x, 0, outer.z);
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

		// Kerbs: alternating blocks along both edges.
		const kerbGeo = keep(new THREE.BoxGeometry(1.6, 0.12, 0.5));
		const kerbs = new THREE.InstancedMesh(kerbGeo, mat(white), 2 * 120);
		const kerbA = token('race-kerb');
		const kerbB = token('race-line');
		const m4 = new THREE.Matrix4();
		const q = new THREE.Quaternion();
		let k = 0;
		for (let i = 0; i < 120; i++) {
			for (const side of [-1, 1]) {
				const { pos, dir } = trackAt(i / 120, side * (ROAD_WIDTH / 2 + 0.25));
				q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
				m4.compose(pos.setY(0.05), q, new THREE.Vector3(1, 1, 1));
				kerbs.setMatrixAt(k, m4);
				kerbs.setColorAt(k, i % 2 ? kerbA : kerbB);
				k++;
			}
		}
		scene.add(kerbs);

		// Start/finish line: a checkered strip across the bottom straight.
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
		startLine.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
		startLine.position.copy(trackAt(0).pos).setY(0.03);
		scene.add(startLine);

		// A few low-poly trees in the infield and around the outside.
		const trunkGeo = keep(new THREE.CylinderGeometry(0.3, 0.4, 1.6, 6));
		const crownGeo = keep(new THREE.ConeGeometry(1.8, 4, 7));
		const trunkMat = mat(token('race-trunk'));
		const crownMat = mat(token('race-tree'));
		const treeSpots = [
			[-12, 0],
			[0, -4],
			[12, 2],
			[-4, 5],
			[6, -6],
			[-40, -26],
			[-20, 28],
			[24, 29],
			[44, -24],
			[52, 8],
			[-55, 6],
			[2, -30]
		];
		for (const [x, z] of treeSpots) {
			const trunk = new THREE.Mesh(trunkGeo, trunkMat);
			trunk.position.set(x, 0.8, z);
			const crown = new THREE.Mesh(crownGeo, crownMat);
			crown.position.set(x, 3.4, z);
			crown.castShadow = trunk.castShadow = true;
			scene.add(trunk, crown);
		}

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
		const iso = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
		// True isometric: looking down the (1, 1, 1) diagonal.
		iso.position.set(80, 80, 80);
		iso.lookAt(0, 0, 0);
		const chase = new THREE.PerspectiveCamera(55, 1, 0.1, 500);

		function resize() {
			const w = host.clientWidth;
			const h = host.clientHeight;
			renderer.setSize(w, h, false);
			const aspect = w / h;
			const view = 46;
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
			speedScale = finished ? Math.max(0, speedScale - dt * 0.6) : 1;
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
				const want = pos.clone().addScaledVector(dir, -9).setY(4.5);
				chase.position.lerp(want, Math.min(1, dt * 3));
				chase.lookAt(pos.clone().addScaledVector(dir, 6).setY(1));
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
	class="relative h-[440px] w-full overflow-hidden rounded-[24px] border border-border bg-surface-alt max-sm:h-[340px]"
>
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>

	{#each cars as car (car.id)}
		<div
			bind:this={labels[car.id]}
			class="pointer-events-none absolute top-0 left-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap shadow-sm transition-opacity"
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
		class="absolute top-3 left-3 flex flex-col gap-1 rounded-2xl bg-surface/90 p-2 text-[11px] font-bold shadow-sm backdrop-blur"
	>
		{#each standings as car, i (car.id)}
			<li class="flex items-center gap-2">
				<span class="w-4 text-right font-mono text-text-muted">{i + 1}</span>
				<span class="inline-block h-2.5 w-2.5 rounded-full" style="background:{car.color}"></span>
				<span class:text-primary-ink={car.isMe}>{car.isMe ? 'You' : car.name}</span>
			</li>
		{/each}
	</ol>

	<div class="absolute top-3 right-3 flex gap-1 rounded-full bg-surface/90 p-1 shadow-sm">
		{#each [['iso', 'Overview'], ['chase', 'Chase']] as [mode, label] (mode)}
			<button
				type="button"
				onclick={() => (camera = mode as 'iso' | 'chase')}
				class="cursor-pointer rounded-full border-none px-3 py-1 text-[11px] font-extrabold transition {camera ===
				mode
					? 'bg-text text-surface'
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
