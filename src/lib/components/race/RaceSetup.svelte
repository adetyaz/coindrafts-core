<script lang="ts">
	// Race flow steps 2 and 3 (GAMEPLAY_FLOWS.md, F2): choose your car, then the
	// circuit. Both are cosmetic. The draft comes after.
	import { onMount } from 'svelte';
	import { CIRCUITS, type Circuit } from '$lib/race/circuits';
	import { rarityColor } from '$lib/economy/rarity';
	import CarPreview from '$lib/components/garage/CarPreview.svelte';
	import type { CarLook } from '$lib/economy/rules';

	type Car = {
		id: string;
		model: string;
		rarity: string;
		races: number;
		wins: number;
		stakedInRace: string | null;
		look?: CarLook | null;
		listing: { id: string; price: number } | null;
	};

	let {
		chooseTrack = true,
		chooseCar = true,
		onDone
	}: {
		/** Off when the track is set elsewhere (a tournament's group-stage track). */
		chooseTrack?: boolean;
		/** Off for a car race: the staked car is the car you race. */
		chooseCar?: boolean;
		onDone: (choice: { carId: string | null; circuit: string | null }) => void;
	} = $props();

	let step = $state<'car' | 'track'>('car');
	// The page may only learn it's a car race after this mounts (URL read in onMount).
	$effect(() => {
		if (!chooseCar && step === 'car') step = 'track';
	});
	let cars = $state<Car[]>([]);
	let carId = $state<string | null>(null);
	let circuit = $state<string>(CIRCUITS[0].id);
	let loading = $state(true);

	onMount(async () => {
		try {
			const res = await fetch('/api/garage');
			if (res.ok) {
				const g = await res.json();
				cars = g.cars ?? [];
				const usable = cars.filter((c) => !c.stakedInRace && !c.listing);
				// Your last-used car is pre-selected, so this step is one tap.
				carId = usable.find((c) => c.id === g.lastCarId)?.id ?? usable[0]?.id ?? null;
			}
		} finally {
			loading = false;
		}
	});

	function blocked(car: Car): string | null {
		if (car.stakedInRace) return 'Staked in a car race';
		if (car.listing) return `For sale at ⚙️ ${car.listing.price}`;
		return null;
	}

	function next() {
		if (chooseTrack) step = 'track';
		else onDone({ carId, circuit: null });
	}

	/** The circuit's real outline as an SVG path, fitted to a 100×100 box. */
	function outline(c: Circuit): string {
		const xs = c.points.map((p) => p[0]);
		const zs = c.points.map((p) => p[1]);
		const minX = Math.min(...xs);
		const minZ = Math.min(...zs);
		const size = Math.max(Math.max(...xs) - minX, Math.max(...zs) - minZ);
		const pts = c.points.filter((_, i) => i % 2 === 0);
		return (
			pts
				.map((p, i) => {
					const x = 8 + ((p[0] - minX) / size) * 84;
					const y = 8 + ((p[1] - minZ) / size) * 84;
					return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
				})
				.join(' ') + ' Z'
		);
	}
</script>

<div>
	<!-- Steps: where you are on the way to the grid. -->
	<ol class="flex flex-wrap items-center gap-2 text-xs font-bold" aria-label="Race setup steps">
		{#each [...(chooseCar ? ['Car'] : []), ...(chooseTrack ? ['Track'] : []), 'Draft'] as label, i (label)}
			{@const current =
				(step === 'car' && label === 'Car') || (step === 'track' && label === 'Track')}
			<li
				class="m-tag !shadow-none {current ? 'bg-butter' : 'bg-surface'}"
				aria-current={current ? 'step' : undefined}
			>
				<span class="m-num">{i + 1}</span>
				{label}
			</li>
		{/each}
	</ol>

	{#if step === 'car'}
		<h1 class="m-title mt-4">Choose your car.</h1>
		<p class="m-lead mt-1">Cars are for show: your coins set the pace, never the car.</p>

		{#if loading}
			<div class="mt-6 h-40 animate-pulse rounded-[22px] bg-surface-alt"></div>
		{:else if cars.length === 0}
			<p class="dashed m-card mt-6 text-sm font-semibold">
				No car in your garage yet, so you'll race a standard car this time.
			</p>
		{:else}
			<div
				class="mt-6 grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-4"
			>
				{#each cars as car (car.id)}
					{@const why = blocked(car)}
					{@const chosen = carId === car.id}
					<button
						type="button"
						disabled={why !== null}
						onclick={() => (carId = car.id)}
						aria-pressed={chosen}
						class="m-card flex cursor-pointer flex-col gap-2 text-start transition-transform disabled:cursor-not-allowed disabled:opacity-50 {chosen
							? '-translate-y-1 bg-butter'
							: ''}"
					>
						<div class="w-full [&>svg]:h-auto [&>svg]:w-full">
							<CarPreview look={car.look ?? {}} />
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class="font-display text-xl font-extrabold">{car.model}</span>
							<span
								class="rounded-lg border-2 border-border px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
								style="background:{rarityColor(car.rarity)}">{car.rarity}</span
							>
						</div>
						<div class="m-num text-xs text-text-muted">{car.races} races · {car.wins} wins</div>
						{#if why}<div class="text-xs font-bold">{why}</div>{/if}
						{#if chosen}<span class="m-tag anim-pop absolute -end-2 -top-3 rotate-3 bg-primary"
								>Racing this</span
							>{/if}
					</button>
				{/each}
			</div>
		{/if}

		<button type="button" onclick={next} disabled={loading} class="m-btn primary lg mt-6">
			{chooseTrack ? 'Next: the track →' : 'Next: draft your coins →'}
		</button>
	{:else}
		<h1 class="m-title mt-4">Choose the track.</h1>
		<p class="m-lead mt-1">
			Real circuits, traced from track data. For show: it never changes the result.
		</p>

		<div
			class="mt-6 grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-4"
		>
			{#each CIRCUITS as c (c.id)}
				{@const chosen = circuit === c.id}
				<button
					type="button"
					onclick={() => (circuit = c.id)}
					aria-pressed={chosen}
					class="m-card flex cursor-pointer flex-col text-start transition-transform {chosen
						? '-translate-y-1 bg-butter'
						: ''}"
				>
					<svg
						viewBox="0 0 100 100"
						class="aspect-[4/3] w-full rounded-[14px] border-2 border-border bg-grass"
						role="img"
						aria-label="{c.name} layout"
					>
						<path
							d={outline(c)}
							fill="none"
							stroke="var(--color-ink)"
							stroke-width="6.5"
							stroke-linejoin="round"
						/>
						<path
							d={outline(c)}
							fill="none"
							stroke="var(--color-race-road)"
							stroke-width="4"
							stroke-linejoin="round"
						/>
					</svg>
					<span class="mt-3 font-display text-xl font-extrabold">{c.name}</span>
					<span class="m-num text-xs text-text-muted">{c.place} · {c.lengthKm} km</span>
					<span class="mt-1 text-sm">{c.character}</span>
				</button>
			{/each}
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			{#if chooseCar}
				<button type="button" onclick={() => (step = 'car')} class="m-btn lg">← Car</button>
			{/if}
			<button type="button" onclick={() => onDone({ carId, circuit })} class="m-btn primary lg">
				Next: draft your coins →
			</button>
		</div>
	{/if}
</div>
