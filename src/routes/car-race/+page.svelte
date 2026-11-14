<script lang="ts">
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';
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
	<a href={resolve('/play')} class="text-sm font-bold text-text no-underline">← All races</a>
	<div
		class="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-center gap-6"
	>
		<header class="flex flex-col gap-3">
			<span class="m-plate w-fit !bg-pink"><span>Car race · Night forest</span></span>
			<h1 class="m-title">Race for pink slips.</h1>
			<p class="m-lead">
				Put a car on the line against a driver with one of the same rarity. The winner drives home
				in both.
			</p>
		</header>
		<WorldThumb theme="night" paint="var(--color-red)" />
	</div>

	{#if phase === 'loading'}
		<div class="mt-8 h-48 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else if phase === 'signed-out'}
		<p class="mt-8 text-sm text-text-muted">Sign in to race for cars.</p>
	{:else if phase === 'error'}
		<p class="mt-8 text-sm text-negative-ink">Couldn't load your cars. Refresh to try again.</p>
	{:else}
		<h2 class="m-eyebrow mt-8 mb-3">1 · Car to stake</h2>
		{#if cars.every((c) => c.blocker)}
			<div class="m-card mt-3 text-sm">
				<p class="font-bold">You don't have a car you can stake yet.</p>
				<p class="mt-1 text-text-muted">
					Your starter car can't be staked. Buy one in the
					<a href={resolve('/garage')} class="font-bold text-text">Showroom</a> or the
					<a href={resolve('/car-market')} class="font-bold text-text">Car Market</a>.
				</p>
			</div>
		{/if}
		<div
			class="mt-3 grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4"
		>
			{#each cars as car (car.id)}
				<button
					type="button"
					disabled={Boolean(car.blocker)}
					aria-pressed={carId === car.id}
					onclick={() => (carId = car.id)}
					class="m-card flex cursor-pointer flex-col gap-2 text-start transition-transform disabled:cursor-not-allowed disabled:opacity-50 {carId ===
					car.id
						? '-translate-y-1 !bg-butter'
						: ''}"
				>
					<div class="[&>svg]:h-auto [&>svg]:w-full"><CarPreview look={car.look ?? {}} /></div>
					<div class="font-display text-xl font-extrabold">{car.model}</div>
					<span
						class="w-fit rounded-lg border-2 border-border px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
						style="background:{rarityColor(car.rarity)}">{car.rarity}</span
					>
					{#if car.blocker}<p class="mt-2 text-xs text-text-muted">{car.blocker}</p>{/if}
				</button>
			{/each}
		</div>

		<h2 class="m-eyebrow mt-8">2 · Race length</h2>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each LENGTHS as d (d.minutes)}
				<button
					type="button"
					aria-pressed={minutes === d.minutes}
					onclick={() => (minutes = d.minutes)}
					class="m-chip !min-h-11 !px-5 !text-sm">{d.label}</button
				>
			{/each}
		</div>

		{#if error}<p class="m-tag mt-6 w-fit bg-pink !whitespace-normal" role="alert">{error}</p>{/if}

		{#if chosen}
			{#if !confirming}
				<button type="button" onclick={() => (confirming = true)} class="m-btn primary lg mt-8"
					>Stake my {chosen.model} →</button
				>
			{:else}
				<!-- The warning: unmissable, but not alarming. -->
				<div class="halftone anim-pop m-card mt-8 !bg-pink" role="alert">
					<span class="m-plate"><span>Read this first</span></span>
					<p class="mt-3 font-display text-2xl font-extrabold">Winner takes both cars.</p>
					<p class="mt-1 text-sm">
						If you lose, your {chosen.rarity}
						{chosen.model} leaves your garage for good. You'll race a driver with a {chosen.rarity}
						car, and both cars are held by the garage contract on NEAR until the race ends.
					</p>
					<div class="mt-4 flex flex-wrap gap-2">
						<button type="button" disabled={starting} onclick={start} class="m-btn dark"
							>{starting ? 'Finding an opponent…' : 'I understand, race for it'}</button
						>
						<button
							type="button"
							disabled={starting}
							onclick={() => (confirming = false)}
							class="m-btn">Back</button
						>
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>
