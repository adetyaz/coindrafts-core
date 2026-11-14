<script lang="ts">
	// Car race (GAMEPLAY_FLOWS.md, F3): choose a car to stake, a race length, a
	// clear warning, then the normal race flow from the Track step.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import CarPreview from '$lib/components/garage/CarPreview.svelte';
	import { rarityColor } from '$lib/economy/rarity';
	import { DURATION_OPTIONS } from '$lib/constants';
	import type { CarLook } from '$lib/economy/rules';

	type Car = {
		id: string;
		model: string;
		rarity: string;
		look: CarLook | null;
		blocker: string | null;
	};

	// Car races are short: the stake is a whole car, so it's settled in one sitting.
	const LENGTHS = DURATION_OPTIONS.filter((d) => d.minutes >= 5 && d.minutes <= 60);

	let cars = $state<Car[]>([]);
	let phase = $state<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
	let carId = $state<string | null>(null);
	let minutes = $state(LENGTHS[0]?.minutes ?? 5);
	let confirming = $state(false);
	let starting = $state(false);
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/car-race');
			if (res.status === 401) {
				phase = 'signed-out';
				return;
			}
			if (!res.ok) throw new Error();
			cars = (await res.json()).cars;
			carId = cars.find((c) => !c.blocker)?.id ?? null;
			phase = 'ready';
		} catch {
			phase = 'error';
		}
	});

	const chosen = $derived(cars.find((c) => c.id === carId) ?? null);

	async function start() {
		starting = true;
		error = '';
		try {
			const res = await fetch('/api/car-race', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ carId, durationMinutes: minutes })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? "Couldn't set up the car race");
			window.location.href = `/draft?contestId=${data.contestId}&type=${data.type}&carRace=1`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
			starting = false;
			confirming = false;
		}
	}
</script>

<div class="m-page mid">
	<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
		Car race
	</div>
	<h1 class="mt-2 text-[40px] leading-none font-black tracking-[-0.04em] max-sm:text-[30px]">
		Race for pink slips
	</h1>
	<p class="mt-3 max-w-[56ch] text-sm text-text-muted">
		Stake a car against a driver with a car of the same rarity. The winner drives home in both.
	</p>

	{#if phase === 'loading'}
		<div class="mt-8 h-48 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else if phase === 'signed-out'}
		<p class="mt-8 text-sm text-text-muted">Sign in to race for cars.</p>
	{:else if phase === 'error'}
		<p class="mt-8 text-sm text-negative-ink">Couldn't load your cars. Refresh to try again.</p>
	{:else}
		<h2 class="mt-8 text-sm font-black tracking-[0.06em] uppercase">1 · Car to stake</h2>
		{#if cars.every((c) => c.blocker)}
			<div class="mt-3 rounded-[20px] border border-border bg-surface p-6 text-sm">
				<p class="font-bold">You don't have a car you can stake yet.</p>
				<p class="mt-1 text-text-muted">
					Your starter car can't be staked. Buy one in the
					<a href={resolve('/garage')} class="font-bold text-text">Showroom</a> or the
					<a href={resolve('/car-market')} class="font-bold text-text">Car Market</a>.
				</p>
			</div>
		{/if}
		<div class="mt-3 grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
			{#each cars as car (car.id)}
				<button
					type="button"
					disabled={Boolean(car.blocker)}
					aria-pressed={carId === car.id}
					onclick={() => (carId = car.id)}
					class="cursor-pointer rounded-[20px] border-2 bg-surface p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 {carId ===
					car.id
						? 'border-text'
						: 'border-border'}"
				>
					<CarPreview look={car.look ?? {}} size={160} />
					<div class="mt-2 font-black">{car.model}</div>
					<span
						class="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
						style="background:{rarityColor(car.rarity)}">{car.rarity}</span
					>
					{#if car.blocker}<p class="mt-2 text-xs text-text-muted">{car.blocker}</p>{/if}
				</button>
			{/each}
		</div>

		<h2 class="mt-8 text-sm font-black tracking-[0.06em] uppercase">2 · Race length</h2>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each LENGTHS as d (d.minutes)}
				<button
					type="button"
					aria-pressed={minutes === d.minutes}
					onclick={() => (minutes = d.minutes)}
					class="h-10 cursor-pointer rounded-full border px-4 text-sm font-bold {minutes ===
					d.minutes
						? 'border-text bg-text text-surface'
						: 'border-border bg-surface'}">{d.label}</button
				>
			{/each}
		</div>

		{#if error}<p class="mt-6 text-sm font-bold text-negative-ink">{error}</p>{/if}

		{#if chosen}
			{#if !confirming}
				<button
					type="button"
					onclick={() => (confirming = true)}
					class="mt-8 h-12 cursor-pointer rounded-full border-none bg-primary px-7 text-sm font-extrabold text-text"
					>Stake my {chosen.model} &rarr;</button
				>
			{:else}
				<div class="mt-8 rounded-[20px] border-2 border-negative bg-surface p-5" role="alert">
					<p class="text-lg font-black">Winner takes both cars.</p>
					<p class="mt-1 text-sm">
						If you lose, your {chosen.rarity}
						{chosen.model} leaves your garage for good. You'll race a driver with a {chosen.rarity}
						car, and both cars are held by the garage contract on NEAR until the race ends.
					</p>
					<div class="mt-4 flex flex-wrap gap-2">
						<button
							type="button"
							disabled={starting}
							onclick={start}
							class="h-11 cursor-pointer rounded-full border-none bg-text px-6 text-sm font-extrabold text-surface disabled:opacity-50"
							>{starting ? 'Finding an opponent…' : 'I understand, race for it'}</button
						>
						<button
							type="button"
							disabled={starting}
							onclick={() => (confirming = false)}
							class="h-11 cursor-pointer rounded-full border border-border bg-transparent px-5 text-sm font-bold"
							>Back</button
						>
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>
