<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import BotDay from '$lib/components/BotDay.svelte';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import { rarityColor } from '$lib/economy/rarity';

	type Tier = {
		rarity: string;
		price: number;
		reason: string;
		trendPct: number;
		forSale: number;
		soldLast24h: number;
	};
	type Listing = {
		id: string;
		price: number;
		reason: string | null;
		model: string;
		rarity: string;
		races: number;
		wins: number;
		sellerId: string;
		seller: string;
		sellerIsBot: boolean;
	};
	type Sale = {
		id: string;
		price: number;
		reason: string | null;
		buyReason: string | null;
		closedAt: string;
		model: string;
		rarity: string;
		seller: string;
		buyer: string;
	};

	let tiers = $state<Tier[]>([]);
	let listings = $state<Listing[]>([]);
	let sales = $state<Sale[]>([]);
	let meId = $state<string | null>(null);
	let gears = $state<number | null>(null);
	let filter = $state<string>('All');
	let phase = $state<'loading' | 'ready' | 'error'>('loading');
	let buying = $state<string | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;

	async function load() {
		try {
			const res = await fetch('/api/market');
			if (!res.ok) throw new Error();
			const data = await res.json();
			tiers = data.tiers;
			listings = data.listings;
			sales = data.sales;
			phase = 'ready';
		} catch {
			if (phase === 'loading') phase = 'error';
		}
	}

	async function loadMe() {
		const [me, garage] = await Promise.all([fetch('/api/me'), fetch('/api/garage')]);
		if (me.ok) meId = (await me.json()).id ?? null;
		if (garage.ok) gears = (await garage.json()).gears ?? null;
	}

	onMount(() => {
		void load();
		void loadMe();
		// Bots trade after every race, so the board refreshes on its own.
		timer = setInterval(load, 15_000);
	});
	onDestroy(() => timer && clearInterval(timer));

	const shown = $derived(filter === 'All' ? listings : listings.filter((l) => l.rarity === filter));

	async function buy(listing: Listing) {
		buying = listing.id;
		try {
			const res = await fetch('/api/market', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'buy', listingId: listing.id })
			});
			const data = await res.json().catch(() => ({}));
			if (res.status === 401) throw new Error('Sign in to buy cars');
			if (!res.ok) throw new Error(data.error ?? 'Purchase failed');
			toast(`The ${listing.model} is yours`, 'success');
			await Promise.all([load(), loadMe()]);
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Purchase failed', 'error');
		} finally {
			buying = null;
		}
	}

	// ── Simulate a week ──────────────────────────────────────────────────────
	type SimRace = {
		a: string;
		b: string;
		winner: string;
		aMove: number;
		bMove: number;
		carWon?: { model: string; rarity: string };
	};
	type SimDay = {
		date: string;
		races: SimRace[];
		market: string[];
		prices: Record<string, number>;
	};
	type Sim = {
		days: SimDay[];
		bots: { username: string; gears: number; cars: number }[];
		near: { sent: number; pending: number } | null;
	};
	let sim = $state<Sim | null>(null);
	let simulating = $state(false);
	let simDay = $state(0);

	// Plays the week one day per request, so each day appears as it finishes.
	async function simulate() {
		simulating = true;
		sim = { days: [], bots: [], near: null };
		try {
			for (let day = 1; day <= 7; day++) {
				simDay = day;
				const res = await fetch('/api/simulate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ day })
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error ?? 'Simulation failed');
				sim.days = [...sim.days, data.day];
				if (data.done) {
					sim.bots = data.bots ?? [];
					sim.near = data.near ?? null;
				}
				void load();
			}
			await loadMe();
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Simulation failed', 'error');
		} finally {
			simulating = false;
		}
	}

	function fmtMove(n: number) {
		return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
	}

	function ago(iso: string) {
		const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
		if (s < 60) return `${s}s ago`;
		if (s < 3600) return `${Math.round(s / 60)}m ago`;
		return `${Math.round(s / 3600)}h ago`;
	}
</script>

<div class="m-page">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
				Car Market
			</div>
			<h1 class="mt-2 text-[40px] leading-none font-black tracking-[-0.04em] max-sm:text-[30px]">
				Buy and sell cars
			</h1>
			<p class="mt-2 max-w-[60ch] text-sm text-text-muted">
				Nobody sets these prices. They move with how many cars are for sale and how fast they sell.
				Bots trade here too, and every bot move shows its reason.
			</p>
		</div>
		<div class="flex items-center gap-4">
			{#if gears != null}
				<div class="text-right">
					<div class="font-mono text-[28px] leading-none font-bold">⚙️ {gears}</div>
					<div class="mt-1 text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase">
						Your Gears
					</div>
				</div>
			{/if}
			<a
				href={resolve('/garage')}
				class="rounded-full border border-border bg-surface px-4 py-2 text-xs font-extrabold text-text no-underline"
				>My garage</a
			>
		</div>
	</div>

	<BotDay />

	<!-- Simulate a week: the bot economy over 7 real market days, in about a minute -->
	<div class="mb-7 rounded-[20px] border border-border bg-surface-alt p-5">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="max-w-[64ch]">
				<div class="text-sm font-black">Simulate a week</div>
				<p class="mt-1 text-xs text-text-muted">
					Replays the last 7 days of real market moves. Each day the bots race each other (half of
					them car-for-car: winner takes the loser's car), get paid in Gears, then trade here. Every
					change is recorded on NEAR. Your own cars and Gears aren't touched.
				</p>
			</div>
			<button
				onclick={simulate}
				disabled={simulating}
				class="h-11 cursor-pointer rounded-full border-none bg-text px-6 text-sm font-extrabold text-surface disabled:cursor-wait disabled:opacity-60"
			>
				{simulating ? `Day ${simDay} of 7…` : 'Simulate a week'}
			</button>
		</div>

		{#if sim}
			<div class="mt-5 flex flex-col gap-3">
				{#each sim.days as day (day.date)}
					<details
						class="rounded-2xl border border-border bg-surface p-4"
						open={day === sim.days.at(-1)}
					>
						<summary class="cursor-pointer text-xs font-extrabold">
							{day.date} · {day.races.filter((r) => r.carWon).length} cars won ·
							{day.market.filter((m) => m.includes('bought')).length} sold · Common ⚙️ {day.prices
								.Common} · Rare ⚙️ {day.prices.Rare}
						</summary>
						<div class="mt-3 flex flex-col gap-1.5 text-xs">
							{#each day.races as r, i (i)}
								<div>
									<span class="font-bold">{r.winner}</span> beat
									{r.winner === r.a ? r.b : r.a}
									<span class="font-mono text-text-muted"
										>({fmtMove(r.winner === r.a ? r.aMove : r.bMove)} vs {fmtMove(
											r.winner === r.a ? r.bMove : r.aMove
										)})</span
									>
									{#if r.carWon}
										· <span class="font-bold">won their {r.carWon.rarity} {r.carWon.model}</span>
									{/if}
								</div>
							{/each}
							{#each day.market as m, i (i)}
								<div class="text-text-muted">🛒 {m}</div>
							{/each}
						</div>
					</details>
				{/each}

				{#if sim.bots.length > 0}
					<div class="rounded-2xl border border-border bg-surface p-4">
						<div class="mb-2 text-xs font-extrabold">After the week</div>
						<div class="grid grid-cols-4 gap-2 text-xs max-sm:grid-cols-2">
							{#each sim.bots as b (b.username)}
								<div class="rounded-xl bg-surface-alt px-3 py-2">
									<div class="font-bold">{b.username}</div>
									<div class="font-mono text-text-muted">{b.cars} cars · ⚙️ {b.gears}</div>
								</div>
							{/each}
						</div>
						<p class="mt-3 text-[11px] text-text-muted">
							{#if sim.near}
								NEAR: {sim.near.sent} changes recorded so far{sim.near.pending > 0
									? `, ${sim.near.pending} more go through as the market refreshes`
									: ''}.
							{:else}
								Recording the week on NEAR in the background; it goes through as the market
								refreshes.
							{/if}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if phase === 'loading'}
		<div class="h-48 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else if phase === 'error'}
		<div class="rounded-[24px] border border-border bg-surface p-10 text-center">
			<p class="text-lg font-black">Couldn't load the Car Market</p>
			<button
				onclick={load}
				class="mt-4 h-11 cursor-pointer rounded-full border-none bg-primary px-6 text-sm font-extrabold text-text"
				>Try again</button
			>
		</div>
	{:else}
		<!-- Going rate per tier -->
		<div class="grid grid-cols-4 gap-3 max-md:grid-cols-2">
			{#each tiers as t (t.rarity)}
				<button
					type="button"
					onclick={() => (filter = filter === t.rarity ? 'All' : t.rarity)}
					title={t.reason}
					class="cursor-pointer rounded-[18px] border bg-surface p-4 text-left transition {filter ===
					t.rarity
						? 'border-text'
						: 'border-border'}"
				>
					<span
						class="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
						style="background:{rarityColor(t.rarity)}">{t.rarity}</span
					>
					<div class="mt-2 font-mono text-2xl font-bold">⚙️ {t.price}</div>
					<div class="mt-1 text-[11px] font-bold">
						{#if t.trendPct === 0}
							<span class="text-text-muted">— usual price</span>
						{:else}
							<span
								class:text-positive-ink={t.trendPct > 0}
								class:text-negative-ink={t.trendPct < 0}
								>{t.trendPct > 0 ? '↑' : '↓'} {Math.abs(t.trendPct)}%</span
							>
						{/if}
					</div>
					<div class="mt-1 text-[11px] text-text-muted">{t.reason}</div>
				</button>
			{/each}
		</div>

		<div class="mt-7 mb-3 flex items-center justify-between">
			<h2 class="text-lg font-black">
				For sale {filter !== 'All' ? `· ${filter}` : ''}
				<span class="font-mono text-sm text-text-muted">({shown.length})</span>
			</h2>
			{#if filter !== 'All'}
				<button
					onclick={() => (filter = 'All')}
					class="cursor-pointer border-none bg-transparent text-xs font-bold text-text-muted"
					>Show all</button
				>
			{/if}
		</div>

		{#if shown.length === 0}
			<div
				class="rounded-[20px] border border-border bg-surface p-8 text-center text-sm text-text-muted"
			>
				Nothing for sale right now. Bots list spare cars after races, so check back soon.
			</div>
		{:else}
			<div class="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
				{#each shown as l (l.id)}
					<div class="flex flex-col rounded-[20px] border border-border bg-surface p-5">
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="text-lg font-black tracking-[-0.02em]">{l.model}</div>
								<span
									class="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
									style="background:{rarityColor(l.rarity)}">{l.rarity}</span
								>
							</div>
							<div class="font-mono text-xl font-bold">⚙️ {l.price}</div>
						</div>
						<div class="mt-3 text-xs text-text-muted">
							{l.races} races · {l.wins} wins · sold by
							<span class="font-bold text-text">{l.seller}</span>
							{#if l.sellerIsBot}
								<span
									class="ml-1 rounded bg-text px-1.5 py-0.5 text-[9px] font-extrabold text-surface"
									>BOT</span
								>
							{/if}
						</div>
						{#if l.reason}
							<p class="mt-2 rounded-xl bg-surface-alt px-3 py-2 text-[11px]">
								<span class="font-extrabold">Why:</span>
								{l.reason}
							</p>
						{/if}
						<div class="mt-auto pt-4">
							{#if l.sellerId === meId}
								<p class="text-center text-xs font-bold text-text-muted">Your listing</p>
							{:else}
								<button
									disabled={buying !== null || (gears != null && gears < l.price)}
									onclick={() => buy(l)}
									class="h-10 w-full cursor-pointer rounded-full border-none bg-primary text-xs font-extrabold text-text disabled:cursor-not-allowed disabled:opacity-50"
								>
									{buying === l.id
										? 'Buying…'
										: gears != null && gears < l.price
											? `Need ${l.price - gears} more Gears`
											: 'Buy'}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if sales.length > 0}
			<h2 class="mt-9 mb-3 text-lg font-black">Recent sales</h2>
			<div class="flex flex-col gap-2">
				{#each sales as s (s.id)}
					<div
						class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-xs"
					>
						<div>
							<span class="font-extrabold">{s.buyer}</span> bought {s.seller}'s
							<span class="font-bold">{s.rarity} {s.model}</span> for ⚙️ {s.price}
							{#if s.buyReason}<span class="text-text-muted"> · {s.buyReason}</span>{/if}
						</div>
						<span class="font-mono text-text-muted">{ago(s.closedAt)}</span>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<Toast />
