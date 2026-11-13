<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import { rarityColor } from '$lib/economy/rarity';

	type Car = {
		id: string;
		tokenId: string;
		model: string;
		rarity: string;
		races: number;
		wins: number;
		stakedInRace: string | null;
		listing: { id: string; price: number } | null;
	};
	type Garage = {
		gears: number;
		cars: Car[];
		near: {
			network: string;
			contractId: string;
			accountId: string | null;
			accountUrl: string | null;
			contractUrl: string;
		} | null;
	};
	type Tier = { rarity: string; price: number; reason: string };

	let garage = $state<Garage | null>(null);
	let tiers = $state<Tier[]>([]);
	let phase = $state<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
	let selling = $state<string | null>(null);
	let price = $state(0);
	let busy = $state(false);

	async function load() {
		try {
			const [g, m] = await Promise.all([fetch('/api/garage'), fetch('/api/market')]);
			if (g.status === 401) {
				phase = 'signed-out';
				return;
			}
			if (!g.ok) throw new Error();
			garage = await g.json();
			if (m.ok) tiers = (await m.json()).tiers;
			phase = 'ready';
		} catch {
			phase = 'error';
		}
	}

	onMount(load);

	function fairFor(rarity: string) {
		return tiers.find((t) => t.rarity === rarity);
	}

	function startSelling(car: Car) {
		selling = car.id;
		price = fairFor(car.rarity)?.price ?? 300;
	}

	async function trade(body: Record<string, unknown>, success: string) {
		busy = true;
		try {
			const res = await fetch('/api/market', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
			toast(success, 'success');
			selling = null;
			await load();
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			busy = false;
		}
	}

	function shortAccount(id: string) {
		return id.length > 24 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
	}
</script>

<div class="mx-auto max-w-[1100px] px-7 pt-7 pb-18 max-sm:px-4">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
				Garage
			</div>
			<h1 class="mt-2 text-[40px] leading-none font-black tracking-[-0.04em] max-sm:text-[30px]">
				Your cars
			</h1>
		</div>
		{#if garage}
			<div class="text-right">
				<div class="font-mono text-[34px] leading-none font-bold">⚙️ {garage.gears}</div>
				<div class="mt-1.5 text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase">
					Gears
				</div>
			</div>
		{/if}
	</div>

	{#if phase === 'loading'}
		<div class="h-48 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else if phase === 'signed-out'}
		<div class="rounded-[24px] border border-border bg-surface p-10 text-center">
			<p class="text-lg font-black">Sign in to see your garage</p>
			<p class="mt-2 text-sm text-text-muted">
				Every new player gets a free car and 500 Gears on their first sign-in.
			</p>
		</div>
	{:else if phase === 'error' || !garage}
		<div class="rounded-[24px] border border-border bg-surface p-10 text-center">
			<p class="text-lg font-black">Couldn't load your garage</p>
			<button
				onclick={load}
				class="mt-4 h-11 cursor-pointer rounded-full border-none bg-primary px-6 text-sm font-extrabold text-text"
				>Try again</button
			>
		</div>
	{:else}
		{#if garage.cars.length === 0}
			<div class="rounded-[24px] border border-border bg-surface p-10 text-center">
				<p class="text-lg font-black">Your garage is empty</p>
				<p class="mt-2 text-sm text-text-muted">
					Race to earn Gears, then pick up a car in the Car Market.
				</p>
				<a
					href={resolve('/car-market')}
					class="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-extrabold text-text no-underline"
					>Open the Car Market</a
				>
			</div>
		{:else}
			<div class="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
				{#each garage.cars as car (car.id)}
					{@const fair = fairFor(car.rarity)}
					<div class="rounded-[20px] border border-border bg-surface p-5">
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="text-xl font-black tracking-[-0.02em]">{car.model}</div>
								<span
									class="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
									style="background:{rarityColor(car.rarity)}">{car.rarity}</span
								>
							</div>
							<div class="text-right font-mono text-xs text-text-muted">
								<div>{car.races} races</div>
								<div>{car.wins} wins</div>
							</div>
						</div>

						<div class="mt-4">
							{#if car.stakedInRace}
								<p class="text-xs font-bold text-warning-ink">Staked in a race</p>
							{:else if car.listing}
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs font-bold">For sale · ⚙️ {car.listing.price}</span>
									<button
										disabled={busy}
										onclick={() =>
											trade({ action: 'cancel', listingId: car.listing!.id }, 'Listing removed')}
										class="cursor-pointer rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-50"
										>Take it off sale</button
									>
								</div>
							{:else if selling === car.id}
								<label class="block text-[11px] font-bold text-text-muted" for="price-{car.id}">
									Price in Gears
									{#if fair}<span class="font-normal"> · going rate {fair.price}</span>{/if}
								</label>
								<div class="mt-1.5 flex gap-2">
									<input
										id="price-{car.id}"
										type="number"
										min="10"
										step="10"
										bind:value={price}
										class="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-alt px-3 font-mono text-sm"
									/>
									<button
										disabled={busy || price < 10}
										onclick={() =>
											trade({ action: 'list', carId: car.id, price }, `Listed for ${price} Gears`)}
										class="h-10 cursor-pointer rounded-full border-none bg-primary px-4 text-xs font-extrabold text-text disabled:opacity-50"
										>List</button
									>
									<button
										onclick={() => (selling = null)}
										class="h-10 cursor-pointer rounded-full border border-border bg-transparent px-3 text-xs font-bold text-text-muted"
										>Cancel</button
									>
								</div>
							{:else}
								<button
									onclick={() => startSelling(car)}
									class="h-10 w-full cursor-pointer rounded-full border border-border bg-transparent text-xs font-extrabold text-text transition hover:border-primary"
									>Sell in the Car Market</button
								>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if garage.near}
			<div
				class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border bg-surface-alt p-5 text-xs"
			>
				<div>
					<div class="font-extrabold">Your cars and Gears are recorded on NEAR</div>
					<div class="mt-1 text-text-muted">
						{#if garage.near.accountId}
							Account
							<!-- External NEAR explorer link: resolve() is for app routes only -->
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={garage.near.accountUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="font-mono font-bold text-text">{shortAccount(garage.near.accountId)}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							on {garage.near.network}. You never need to sign or pay gas; the game does it.
						{:else}
							Your NEAR account is being set up.
						{/if}
					</div>
				</div>
				<!-- External NEAR explorer link: resolve() is for app routes only -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={garage.near.contractUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-full border border-border bg-surface px-3.5 py-1.5 font-bold text-text no-underline"
					>View the garage contract ↗</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{/if}
	{/if}
</div>

<Toast />
