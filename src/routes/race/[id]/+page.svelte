<script lang="ts">
	// A multi-car race: a tournament group or final (GAMEPLAY_FLOWS.md, F4).
	// Draft wait → pre-race grid → the race on the stage's circuit → standings.
	// Same 3D track and item maths as 1v1 races.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import RaceTrack3D, { type RaceCar } from '$lib/components/race/RaceTrack3D.svelte';
	import { streamPrices } from '$lib/race/priceStream';
	import { circuitById, DEFAULT_CIRCUIT } from '$lib/race/circuits';
	import { ITEMS, itemFactors, type LineupItem } from '$lib/race/items';
	import { paintColor } from '$lib/economy/rules';
	import { rarityColor } from '$lib/economy/rarity';

	type Pick = {
		symbol: string;
		sector: string;
		entryPrice: number;
		currentPrice: number;
		pct: number;
	};
	type Driver = {
		userId: string;
		name: string;
		isBot: boolean;
		isMe: boolean;
		rank: number | null;
		drafted: boolean;
		car: { model: string; rarity: string; look: { paint?: string } | null } | null;
		item: LineupItem | null;
		picks: Pick[];
		totalPct: number;
		score: number | null;
	};
	type Race = {
		id: string;
		status: 'drafting' | 'live' | 'resolved' | string;
		tournamentId: string | null;
		leagueId: string | null;
		isFinal: boolean;
		durationMinutes: number | null;
		circuit: string | null;
		draftClosesAt: string | null;
		startAt: string | null;
		endAt: string | null;
		drivers: Driver[];
	};

	const raceId = page.params.id ?? '';
	const PALETTE = [
		'var(--color-coral)',
		'var(--color-blue)',
		'var(--color-mint)',
		'var(--color-amber)',
		'var(--color-sky)',
		'var(--color-red)',
		'var(--color-ink)'
	];

	let race = $state<Race | null>(null);
	let error = $state('');
	let now = $state(Date.now());
	let livePrices = $state<Record<string, number>>({});
	let live3d = $state(true);
	let skipped = $state(false);

	async function poll() {
		try {
			const res = await fetch(`/api/lobby/${raceId}/live`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Race unavailable');
			race = data;
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Race unavailable';
		}
	}

	onMount(() => {
		poll();
		const p = setInterval(poll, 4000);
		const c = setInterval(() => (now = Date.now()), 250);
		return () => {
			clearInterval(p);
			clearInterval(c);
		};
	});

	const circuit = $derived(circuitById(race?.circuit ?? DEFAULT_CIRCUIT));
	const startMs = $derived(race?.startAt ? new Date(race.startAt).getTime() : 0);
	const endMs = $derived(race?.endAt ? new Date(race.endAt).getTime() : 0);
	const holding = $derived(race?.status === 'live' && now < startMs);
	const lightsOn = $derived(
		startMs - now > 3000 ? 0 : Math.min(3, 3 - Math.floor((startMs - now) / 1000))
	);

	const symbols = $derived(
		[...new Set((race?.drivers ?? []).flatMap((d) => d.picks.map((p) => p.symbol.toUpperCase())))]
			.sort()
			.join(',')
	);
	$effect(() => {
		if (race?.status !== 'live' || !symbols) return;
		return streamPrices(symbols.split(','), (symbol, price) => {
			livePrices[symbol] = price;
		});
	});

	function total(d: Driver): number {
		if (race?.status !== 'live') return d.totalPct;
		const moves = d.picks.map((p) => {
			const cur = livePrices[p.symbol.toUpperCase()] ?? p.currentPrice;
			return { ...p, pct: p.entryPrice > 0 ? ((cur - p.entryPrice) / p.entryPrice) * 100 : 0 };
		});
		const f = itemFactors(moves, d.item);
		return moves.reduce((s, m, i) => s + m.pct * f[i], 0);
	}

	const cars = $derived<RaceCar[]>(
		(race?.drivers ?? []).map((d, i) => ({
			id: d.userId,
			name: d.isMe ? 'You' : d.name,
			color: paintColor(d.car?.look) ?? PALETTE[i % PALETTE.length],
			pct: total(d),
			isMe: d.isMe
		}))
	);
	const standings = $derived(
		race?.status === 'resolved'
			? [...(race?.drivers ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
			: [...(race?.drivers ?? [])].sort((a, b) => total(b) - total(a))
	);
	const me = $derived(race?.drivers.find((d) => d.isMe) ?? null);

	function clock(ms: number) {
		const s = Math.max(0, Math.ceil(ms / 1000));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		return h ? `${h}h ${m}m` : `${m}:${String(sec).padStart(2, '0')}`;
	}
	const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
</script>

<div class="mx-auto max-w-[1100px] px-7 pt-7 pb-18 max-sm:px-4">
	{#if !race}
		{#if error}
			<p class="text-sm text-negative-ink">{error}</p>
		{:else}
			<div class="h-64 animate-pulse rounded-[24px] bg-surface-alt"></div>
		{/if}
	{:else}
		<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
			<div>
				<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
					{race.leagueId ? 'League night' : race.isFinal ? 'Final' : 'Group race'} · {circuit.name}
				</div>
				<h1 class="mt-1 text-[32px] leading-none font-black tracking-[-0.04em]">
					{race.status === 'drafting'
						? 'On the way to the grid'
						: race.status === 'resolved'
							? 'Chequered flag'
							: holding
								? 'On the grid'
								: 'Racing'}
				</h1>
			</div>
			<div class="text-right font-mono text-sm">
				{#if race.status === 'drafting' && race.draftClosesAt}
					Auto-draft in {clock(new Date(race.draftClosesAt).getTime() - now)}
				{:else if race.status === 'live' && !holding}
					{clock(endMs - now)} left
				{/if}
			</div>
		</div>

		{#if race.status === 'drafting'}
			<div class="rounded-[24px] border border-border bg-surface p-6">
				<p class="font-bold">
					{race.drivers.filter((d) => d.drafted).length} of {race.drivers.length} drivers have locked
					a lineup.
				</p>
				<p class="mt-1 text-sm text-text-muted">
					The race starts when everyone has drafted. Anyone who hasn't by the deadline races an
					auto-drafted lineup.
				</p>
				{#if me && !me.drafted}
					<!-- resolve() can't carry a query string; the path itself is resolved. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={`${resolve('/draft')}?lobbyId=${race.id}`}
						class="mt-4 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-extrabold text-text no-underline"
						>Draft your lineup &rarr;</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
				<ul class="mt-5 grid gap-2 sm:grid-cols-2">
					{#each race.drivers as d (d.userId)}
						<li class="flex items-center justify-between rounded-2xl bg-bg px-4 py-2.5 text-sm">
							<span class="font-bold"
								>{d.isMe ? 'You' : d.name}
								{#if d.isBot}<span
										class="ml-1 rounded bg-text px-1.5 py-0.5 text-[9px] font-extrabold text-surface"
										>BOT</span
									>{/if}</span
							>
							<span class="text-xs {d.drafted ? 'text-positive-ink' : 'text-text-muted'}"
								>{d.drafted ? 'Locked in' : 'Drafting…'}</span
							>
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<div class="relative">
				{#if live3d}
					{#key circuit.id}
						<RaceTrack3D
							circuit={circuit.id}
							{cars}
							{holding}
							finished={race.status === 'resolved' || (endMs > 0 && now >= endMs)}
							onUnsupported={() => (live3d = false)}
						/>
					{/key}
				{/if}
				{#if holding && !skipped}
					<div
						class="absolute inset-0 flex flex-col justify-between rounded-[24px] bg-black/55 p-5 text-white"
					>
						<div class="flex items-start justify-between">
							<div>
								<div class="font-mono text-[11px] font-bold tracking-[0.14em] uppercase opacity-80">
									On the grid
								</div>
								<div class="text-2xl font-black">{circuit.name}</div>
							</div>
							<button
								type="button"
								onclick={() => (skipped = true)}
								class="cursor-pointer rounded-full border border-white/40 bg-transparent px-3 py-1 text-xs font-bold text-white"
								>Skip</button
							>
						</div>
						<div class="grid gap-2 sm:grid-cols-2">
							{#each race.drivers as d (d.userId)}
								<div class="rounded-xl bg-black/50 px-3 py-2 text-xs">
									<span class="font-black">{d.isMe ? 'You' : d.name}</span>
									{#if d.isBot}<span class="ml-1 opacity-70">BOT</span>{/if}
									{#if d.car}<span class="ml-1 opacity-80">· {d.car.model}</span>{/if}
									{#if d.item}<span class="ml-1">{ITEMS[d.item.kind].icon}</span>{/if}
								</div>
							{/each}
						</div>
						<div class="flex justify-center gap-3" aria-label="Start lights">
							{#each [0, 1, 2] as i (i)}
								<span
									class="h-6 w-6 rounded-full border-2 border-white/60 {lightsOn > i
										? 'bg-red-500'
										: 'bg-transparent'}"
								></span>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<ol class="mt-5 flex flex-col gap-2">
				{#each standings as d, i (d.userId)}
					<li
						class="flex flex-wrap items-center gap-3 rounded-2xl border bg-surface px-4 py-3 text-sm {d.isMe
							? 'border-text'
							: 'border-border'}"
					>
						<span class="w-6 font-mono font-bold"
							>{race.status === 'resolved' ? d.rank : i + 1}</span
						>
						<span class="flex-1 font-black"
							>{d.isMe ? 'You' : d.name}
							{#if d.isBot}<span
									class="ml-1 rounded bg-text px-1.5 py-0.5 text-[9px] font-extrabold text-surface"
									>BOT</span
								>{/if}
							{#if d.car}<span
									class="ml-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase"
									style="background:{rarityColor(d.car.rarity)}">{d.car.model}</span
								>{/if}
							{#if d.item}<span class="ml-1" title={ITEMS[d.item.kind].label}
									>{ITEMS[d.item.kind].icon}</span
								>{/if}
						</span>
						<span class="font-mono text-xs text-text-muted"
							>{d.picks.map((p) => p.symbol.toUpperCase()).join(' · ')}</span
						>
						<span
							class="w-20 text-right font-mono font-bold {total(d) >= 0
								? 'text-positive-ink'
								: 'text-negative-ink'}">{pct(total(d))}</span
						>
					</li>
				{/each}
			</ol>
		{/if}

		{#if race.leagueId}
			<a
				href={resolve('/leagues/[id]', { id: race.leagueId })}
				class="mt-6 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-bold text-text no-underline"
				>&larr; League</a
			>
		{/if}
		{#if race.tournamentId}
			<a
				href={resolve('/tournament/[id]', { id: race.tournamentId })}
				class="mt-6 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-bold text-text no-underline"
				>&larr; Tournament</a
			>
		{/if}
	{/if}
</div>
