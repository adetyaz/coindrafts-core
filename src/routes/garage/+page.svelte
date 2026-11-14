<script lang="ts">
	// Garage (GAMEPLAY_FLOWS.md, F3): your cars with your last-used one marked,
	// customise (paint, decal, plate), car history, sell (list or Sell now to a
	// bot), the Showroom, and your NEAR account.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import CarPreview from '$lib/components/garage/CarPreview.svelte';
	import ItemShop from '$lib/components/garage/ItemShop.svelte';
	import { rarityColor } from '$lib/economy/rarity';
	import {
		CUSTOMISE_PRICE,
		DECALS,
		PAINTS,
		PLATE,
		customiseCost,
		type CarLook
	} from '$lib/economy/rules';

	type Car = {
		id: string;
		tokenId: string;
		model: string;
		rarity: string;
		races: number;
		wins: number;
		stakedInRace: string | null;
		look: CarLook;
		listing: { id: string; price: number } | null;
		sellNow: { value: number; reason: string } | null;
	};
	type ShowroomTier = { rarity: string; price: number; models: string[]; left: number | null };
	type Garage = {
		gears: number;
		lastCarId: string | null;
		cars: Car[];
		showroom: ShowroomTier[];
		near: {
			network: string;
			contractId: string;
			accountId: string | null;
			accountUrl: string | null;
			contractUrl: string;
		} | null;
	};
	type Tier = { rarity: string; price: number; reason: string };
	type HistoryEvent = {
		kind: string;
		price: number | null;
		at: string;
		from: string | null;
		to: string;
	};

	let garage = $state<Garage | null>(null);
	let tiers = $state<Tier[]>([]);
	let phase = $state<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
	let busy = $state(false);

	// One open panel at a time, under the car it belongs to.
	let open = $state<{ carId: string; panel: 'sell' | 'sellNow' | 'customise' | 'history' } | null>(
		null
	);
	let price = $state(0);
	let draft = $state<Required<CarLook>>({ paint: 'coral', decal: 'none', plate: '' });
	let history = $state<HistoryEvent[] | null>(null);
	let showroomModel = $state<Record<string, string>>({});

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
			for (const t of garage!.showroom) showroomModel[t.rarity] ??= t.models[0];
			phase = 'ready';
		} catch {
			phase = 'error';
		}
	}

	onMount(load);

	const fairFor = (rarity: string) => tiers.find((t) => t.rarity === rarity);

	// Last-used car first: it's the one the race flow pre-selects.
	const sortedCars = $derived(
		garage
			? [...garage.cars].sort(
					(a, b) => Number(b.id === garage!.lastCarId) - Number(a.id === garage!.lastCarId)
				)
			: []
	);

	async function openPanel(car: Car, panel: NonNullable<typeof open>['panel']) {
		if (open?.carId === car.id && open.panel === panel) {
			open = null;
			return;
		}
		open = { carId: car.id, panel };
		if (panel === 'sell') price = fairFor(car.rarity)?.price ?? 300;
		if (panel === 'customise') {
			draft = {
				paint: car.look.paint ?? 'coral',
				decal: car.look.decal ?? 'none',
				plate: car.look.plate ?? ''
			};
		}
		if (panel === 'history') {
			history = null;
			const res = await fetch(`/api/garage/history?carId=${car.id}`);
			history = res.ok ? (await res.json()).events : [];
		}
	}

	async function post(url: string, body: Record<string, unknown>) {
		busy = true;
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
			return data;
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
			return null;
		} finally {
			busy = false;
		}
	}

	async function act(url: string, body: Record<string, unknown>, success: (d: never) => string) {
		const data = await post(url, body);
		if (!data) return;
		toast(success(data as never), 'success');
		open = null;
		await load();
	}

	// What the customise draft changes, compared with the car as it is now.
	function changes(car: Car): CarLook {
		const out: CarLook = {};
		if (draft.paint !== (car.look.paint ?? 'coral')) out.paint = draft.paint;
		if (draft.decal !== (car.look.decal ?? 'none')) out.decal = draft.decal;
		const plate = draft.plate.toUpperCase().trim();
		if (plate && plate !== car.look.plate) out.plate = plate;
		return out;
	}

	function historyLine(e: HistoryEvent): string {
		if (e.kind === 'starter') return `Given to ${e.to} as a starter car`;
		if (e.kind === 'showroom') return `Bought new from the Showroom by ${e.to}`;
		if (e.kind === 'market') return `${e.to} bought it from ${e.from ?? '?'} for ⚙️ ${e.price}`;
		if (e.kind === 'sell_now') return `${e.from ?? '?'} sold it to ${e.to} for ⚙️ ${e.price}`;
		if (e.kind === 'prize') return `Won by ${e.to} as a tournament prize`;
		if (e.kind === 'staked') return `${e.to} staked it in a car race`;
		if (e.kind === 'race_won') return `${e.to} won it from ${e.from ?? '?'} in a car race`;
		return e.kind;
	}

	function shortAccount(id: string) {
		return id.length > 24 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
	}
</script>

<div class="m-page">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<span class="m-eyebrow">Garage</span>
			<h1 class="m-title mt-1">Your cars.</h1>
		</div>
		{#if garage}
			<div class="flat m-card bg-butter !px-4 !py-2 text-end">
				<div class="m-num text-2xl leading-none font-bold">⚙️ {garage.gears.toLocaleString()}</div>
				<div class="m-eyebrow mt-1">Gears to spend</div>
			</div>
		{/if}
	</header>

	<!-- Jump bar: the page is long, so its sections are one tap away. -->
	{#if phase === 'ready'}
		<nav class="m-rail sticky top-[4.75rem] z-30 mt-4 !pb-2" aria-label="Garage sections">
			{#each [['#my-cars', '🚗 My cars'], ['#showroom', '🆕 Showroom'], ['#items', '🔥 Items'], ['#on-near', '⛓ On NEAR']] as [href, label] (href)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- in-page anchor -->
				<a {href} class="m-chip no-underline">{label}</a>
			{/each}
		</nav>
	{/if}
	<div id="my-cars" class="scroll-mt-36 pt-4"></div>

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
		{#if sortedCars.length === 0}
			<div class="rounded-[24px] border border-border bg-surface p-10 text-center">
				<p class="text-lg font-black">Your garage is empty</p>
				<p class="mt-2 text-sm text-text-muted">
					Race to earn Gears, then buy a car below or in the Car Market.
				</p>
			</div>
		{:else}
			<div class="grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-5">
				{#each sortedCars as car (car.id)}
					{@const fair = fairFor(car.rarity)}
					{@const isOpen = open?.carId === car.id}
					<div
						class="rounded-[20px] border bg-surface p-5 {isOpen
							? 'border-text'
							: 'border-border'} {isOpen ? 'col-span-full' : ''}"
					>
						<div class="flex flex-wrap items-start gap-4">
							<CarPreview look={isOpen && open?.panel === 'customise' ? draft : car.look} />
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-2">
									<div>
										<div class="text-xl font-black tracking-[-0.02em]">{car.model}</div>
										<div class="mt-1.5 flex flex-wrap gap-1.5">
											<span
												class="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
												style="background:{rarityColor(car.rarity)}">{car.rarity}</span
											>
											{#if car.id === garage.lastCarId}
												<span
													class="rounded-full bg-text px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] text-surface uppercase"
													>Last used</span
												>
											{/if}
										</div>
									</div>
									<div class="text-right font-mono text-xs text-text-muted">
										<div>{car.races} races</div>
										<div>{car.wins} wins</div>
									</div>
								</div>
								<div class="mt-3 text-xs">
									{#if car.stakedInRace}
										<span class="font-bold text-warning-ink">Staked in a race</span>
									{:else if car.listing}
										<span class="font-bold">For sale · ⚙️ {car.listing.price}</span>
									{:else}
										<span class="text-text-muted">Available</span>
									{/if}
								</div>
							</div>
						</div>

						<div class="mt-4 flex flex-wrap gap-1.5">
							<button
								onclick={() => openPanel(car, 'customise')}
								class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-3 text-xs font-bold"
								>Customise</button
							>
							<button
								onclick={() => openPanel(car, 'history')}
								class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-3 text-xs font-bold"
								>History</button
							>
							{#if !car.stakedInRace}
								{#if car.listing}
									<button
										disabled={busy}
										onclick={() =>
											act(
												'/api/market',
												{ action: 'cancel', listingId: car.listing!.id },
												() => 'Listing removed'
											)}
										class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-3 text-xs font-bold text-text-muted disabled:opacity-50"
										>Take off sale</button
									>
								{:else}
									<button
										onclick={() => openPanel(car, 'sell')}
										class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-3 text-xs font-bold"
										>Sell</button
									>
								{/if}
								{#if car.sellNow}
									<button
										onclick={() => openPanel(car, 'sellNow')}
										class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-3 text-xs font-bold"
										>Sell now · ⚙️ {car.sellNow.value}</button
									>
								{/if}
							{/if}
						</div>

						{#if isOpen && open?.panel === 'sell'}
							<div class="mt-4 border-t border-border pt-4">
								<label class="block text-[11px] font-bold text-text-muted" for="price-{car.id}">
									Your price in Gears
									{#if fair}<span class="font-normal"> · going rate {fair.price}</span>{/if}
								</label>
								<div class="mt-1.5 flex max-w-md gap-2">
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
											act(
												'/api/market',
												{ action: 'list', carId: car.id, price },
												() => `Listed for ${price} Gears`
											)}
										class="h-10 cursor-pointer rounded-full border-none bg-primary px-4 text-xs font-extrabold text-text disabled:opacity-50"
										>List in the Car Market</button
									>
								</div>
							</div>
						{:else if isOpen && open?.panel === 'sellNow' && car.sellNow}
							<div class="mt-4 border-t border-border pt-4 text-sm">
								<p class="font-bold">
									Sell your {car.model} to a bot right now for ⚙️ {car.sellNow.value}?
								</p>
								<p class="mt-1 text-xs text-text-muted">
									{car.sellNow.reason}. Listing it yourself usually gets more, but you wait for a
									buyer.
									{#if car.listing}Your current listing will be taken down.{/if}
								</p>
								<button
									disabled={busy}
									onclick={() =>
										act(
											'/api/garage',
											{ action: 'sellNow', carId: car.id },
											(d: { buyer: string; price: number }) =>
												`${d.buyer} bought your ${car.model} for ${d.price} Gears`
										)}
									class="mt-3 h-10 cursor-pointer rounded-full border-none bg-primary px-5 text-xs font-extrabold text-text disabled:opacity-50"
									>Sell for ⚙️ {car.sellNow.value}</button
								>
							</div>
						{:else if isOpen && open?.panel === 'customise'}
							{@const delta = changes(car)}
							{@const cost = customiseCost(car.look, delta)}
							{@const plateOk = !delta.plate || PLATE.test(delta.plate)}
							<div class="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-3">
								<fieldset>
									<legend class="text-xs font-black">Paint · ⚙️ {CUSTOMISE_PRICE.paint}</legend>
									<div class="mt-2 flex flex-wrap gap-2">
										{#each PAINTS as p (p.id)}
											<button
												type="button"
												aria-label={p.label}
												aria-pressed={draft.paint === p.id}
												onclick={() => (draft.paint = p.id)}
												class="h-8 w-8 cursor-pointer rounded-full border-2 {draft.paint === p.id
													? 'border-text'
													: 'border-border'}"
												style="background:{p.color}"
											></button>
										{/each}
									</div>
								</fieldset>
								<fieldset>
									<legend class="text-xs font-black">Decal · ⚙️ {CUSTOMISE_PRICE.decal}</legend>
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#each DECALS as d (d.id)}
											<button
												type="button"
												aria-pressed={draft.decal === d.id}
												onclick={() => (draft.decal = d.id)}
												class="h-8 cursor-pointer rounded-full border px-3 text-xs font-bold {draft.decal ===
												d.id
													? 'border-text bg-text text-surface'
													: 'border-border bg-transparent'}">{d.label}</button
											>
										{/each}
									</div>
								</fieldset>
								<div>
									<label for="plate-{car.id}" class="text-xs font-black"
										>Number plate · ⚙️ {CUSTOMISE_PRICE.plate}</label
									>
									<input
										id="plate-{car.id}"
										bind:value={draft.plate}
										maxlength="7"
										placeholder="e.g. NITRO1"
										class="mt-2 h-9 w-full rounded-xl border border-border bg-surface-alt px-3 font-mono text-sm uppercase"
									/>
									{#if !plateOk}
										<p class="mt-1 text-xs text-negative-ink">2–7 letters or numbers.</p>
									{/if}
								</div>
								<div class="flex flex-wrap items-center gap-3 md:col-span-3">
									<button
										disabled={busy || cost === 0 || !plateOk || cost > garage.gears}
										onclick={() =>
											act(
												'/api/garage',
												{ action: 'customise', carId: car.id, ...delta },
												() => `Done. ${cost} Gears spent.`
											)}
										class="h-10 cursor-pointer rounded-full border-none bg-primary px-5 text-xs font-extrabold text-text disabled:opacity-50"
										>{cost ? `Apply for ⚙️ ${cost}` : 'Pick a change'}</button
									>
									<span class="text-xs text-text-muted">
										{cost > garage.gears
											? 'Not enough Gears.'
											: 'Cosmetic only. Gears spent here are gone for good.'}
									</span>
								</div>
							</div>
						{:else if isOpen && open?.panel === 'history'}
							<div class="mt-4 border-t border-border pt-4">
								{#if history == null}
									<div class="h-16 animate-pulse rounded-xl bg-surface-alt"></div>
								{:else if history.length === 0}
									<p class="text-sm text-text-muted">
										This car was built before history was recorded.
									</p>
								{:else}
									<ol class="flex flex-col gap-2">
										{#each history as e, i (i)}
											<li class="flex flex-wrap justify-between gap-2 text-sm">
												<span>{historyLine(e)}</span>
												<span class="font-mono text-xs text-text-muted"
													>{new Date(e.at).toLocaleDateString()}</span
												>
											</li>
										{/each}
									</ol>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Showroom -->
		<section id="showroom" class="mt-12 scroll-mt-36">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 class="text-2xl font-black tracking-[-0.03em]">Showroom</h2>
					<p class="mt-1 text-sm text-text-muted">
						Brand-new cars from the game. Rare and up are limited each week. Or find a deal in the
						<a href={resolve('/car-market')} class="font-bold text-text">Car Market</a>.
					</p>
				</div>
			</div>
			<div class="mt-4 grid grid-cols-4 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
				{#each garage.showroom as tier (tier.rarity)}
					{@const soldOut = tier.left === 0}
					<div class="flex flex-col rounded-[20px] border border-border bg-surface p-4">
						<span
							class="self-start rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
							style="background:{rarityColor(tier.rarity)}">{tier.rarity}</span
						>
						<div class="mt-3 font-mono text-2xl font-bold">⚙️ {tier.price.toLocaleString()}</div>
						<div class="mt-1 text-xs text-text-muted">
							{tier.left == null ? 'Always in stock' : `${tier.left} left this week`}
						</div>
						<label class="mt-3 text-[11px] font-bold text-text-muted" for="model-{tier.rarity}"
							>Model</label
						>
						<select
							id="model-{tier.rarity}"
							bind:value={showroomModel[tier.rarity]}
							class="mt-1 h-9 rounded-xl border border-border bg-surface-alt px-2 text-sm"
						>
							{#each tier.models as m (m)}<option value={m}>{m}</option>{/each}
						</select>
						<button
							disabled={busy || soldOut || garage.gears < tier.price}
							onclick={() =>
								act(
									'/api/garage',
									{ action: 'showroom', rarity: tier.rarity, model: showroomModel[tier.rarity] },
									() => `Your new ${showroomModel[tier.rarity]} is in the garage`
								)}
							class="mt-3 h-10 cursor-pointer rounded-full border-none bg-primary text-xs font-extrabold text-text disabled:opacity-50"
						>
							{soldOut ? 'Sold out' : garage.gears < tier.price ? 'Not enough Gears' : 'Buy new'}
						</button>
					</div>
				{/each}
			</div>
		</section>

		<div id="items" class="scroll-mt-36"><ItemShop gears={garage.gears} onBought={load} /></div>

		{#if garage.near}
			<div
				id="on-near"
				class="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border bg-surface-alt p-5 text-xs"
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
