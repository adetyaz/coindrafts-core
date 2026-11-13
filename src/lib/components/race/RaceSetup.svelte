<script lang="ts">
	// Race flow steps 2 and 3 (GAMEPLAY_FLOWS.md, F2): choose your car, then the
	// circuit. Both are cosmetic. The draft comes after.
	import { onMount } from 'svelte';
	import { CIRCUITS, type Circuit } from '$lib/race/circuits';
	import { rarityColor } from '$lib/economy/rarity';

	type Car = {
		id: string;
		model: string;
		rarity: string;
		races: number;
		wins: number;
		stakedInRace: string | null;
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

<div class="mx-auto max-w-[1100px]">
	<div class="mb-1 font-mono text-[11px] font-bold tracking-[0.14em] text-text-muted uppercase">
		Step {step === 'car' ? 1 : 2} of {chooseTrack ? 3 : 2}
	</div>

	{#if step === 'car'}
		<h1 class="text-[36px] leading-none font-black tracking-[-0.04em]">Choose your car</h1>
		<p class="mt-2 text-sm text-text-muted">
			Cars are cosmetic: your coins decide the pace, never the car.
		</p>

		{#if loading}
			<div class="mt-6 h-40 animate-pulse rounded-[20px] bg-surface-alt"></div>
		{:else if cars.length === 0}
			<p class="mt-6 text-sm text-text-muted">
				No car in your garage yet, so you'll race a standard car this time.
			</p>
		{:else}
			<div class="mt-6 grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
				{#each cars as car (car.id)}
					{@const why = blocked(car)}
					<button
						type="button"
						disabled={why !== null}
						onclick={() => (carId = car.id)}
						aria-pressed={carId === car.id}
						class="cursor-pointer rounded-[20px] border-2 bg-surface p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 {carId ===
						car.id
							? 'border-text'
							: 'border-border'}"
					>
						<div class="text-lg font-black">{car.model}</div>
						<span
							class="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
							style="background:{rarityColor(car.rarity)}">{car.rarity}</span
						>
						<div class="mt-2 font-mono text-xs text-text-muted">
							{car.races} races · {car.wins} wins
						</div>
						{#if why}<div class="mt-1 text-xs font-bold">{why}</div>{/if}
					</button>
				{/each}
			</div>
		{/if}

		<button
			type="button"
			onclick={next}
			disabled={loading}
			class="mt-6 h-12 cursor-pointer rounded-full border-none bg-text px-8 text-sm font-extrabold text-surface disabled:opacity-50"
		>
			{chooseTrack ? 'Next: choose the track →' : 'Next: draft your coins →'}
		</button>
	{:else}
		<h1 class="text-[36px] leading-none font-black tracking-[-0.04em]">Choose the track</h1>
		<p class="mt-2 text-sm text-text-muted">
			Real circuit layouts. Cosmetic only: the track never changes the result.
		</p>

		<div class="mt-6 grid grid-cols-4 gap-3 max-md:grid-cols-2">
			{#each CIRCUITS as c (c.id)}
				<button
					type="button"
					onclick={() => (circuit = c.id)}
					aria-pressed={circuit === c.id}
					class="cursor-pointer rounded-[20px] border-2 bg-surface p-4 text-left transition {circuit ===
					c.id
						? 'border-text'
						: 'border-border'}"
				>
					<svg
						viewBox="0 0 100 100"
						class="aspect-square w-full"
						role="img"
						aria-label="{c.name} layout"
					>
						<path
							d={outline(c)}
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							stroke-linejoin="round"
						/>
					</svg>
					<div class="mt-2 text-lg font-black">{c.name}</div>
					<div class="text-xs text-text-muted">{c.place} · {c.lengthKm} km</div>
					<div class="mt-1 text-xs">{c.character}</div>
				</button>
			{/each}
		</div>

		<div class="mt-6 flex gap-3">
			<button
				type="button"
				onclick={() => (step = 'car')}
				class="h-12 cursor-pointer rounded-full border border-border bg-transparent px-6 text-sm font-bold text-text-muted"
				>← Car</button
			>
			<button
				type="button"
				onclick={() => onDone({ carId, circuit })}
				class="h-12 cursor-pointer rounded-full border-none bg-text px-8 text-sm font-extrabold text-surface"
			>
				Next: draft your coins →
			</button>
		</div>
	{/if}
</div>
