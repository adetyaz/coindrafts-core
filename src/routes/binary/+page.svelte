<script lang="ts">
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';
	import { resolve } from '$app/paths';
	// Binary race mode (GAMEPLAY_FLOWS.md, F9): mode and length → car → track →
	// pick any 5 coins and call each up or down, against today's price → lock.
	// Then the same race screen, with a checkpoint per call.
	import { onMount } from 'svelte';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import RaceSetup from '$lib/components/race/RaceSetup.svelte';
	import { BINARY_LENGTHS, BINARY_PICKS, SOLO_TO_WIN, type Call } from '$lib/race/binary';
	import { classifySector } from '$lib/sectors';

	type Token = {
		currency_id: string;
		symbol?: string;
		name?: string;
		price: number | null;
		change24h: number | null;
	};
	type Pick = { currencyId: string; symbol: string; name: string; sector: string; call: Call };

	let step = $state<'mode' | 'setup' | 'calls'>('mode');
	let opponent = $state<'market' | 'bot'>('market');
	let minutes = $state(5);
	let contest = $state<{ id: string; type: string } | null>(null);
	let setup = $state<{ carId: string | null; circuit: string | null } | null>(null);
	let tokens = $state<Token[]>([]);
	let picks = $state<Pick[]>([]);
	let query = $state('');
	let busy = $state(false);

	onMount(async () => {
		const res = await fetch('/api/tokens').catch(() => null);
		if (res?.ok) tokens = (await res.json()).filter((t: Token) => t.symbol && t.price);
	});

	async function createRace() {
		busy = true;
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'binary', opponent, durationMinutes: minutes })
			});
			const data = await res.json().catch(() => ({}));
			if (res.status === 401) {
				window.location.href = '/?auth=required';
				return;
			}
			if (!res.ok) throw new Error(data.error ?? "Couldn't set up the race");
			contest = { id: data.id, type: data.type };
			step = 'setup';
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			busy = false;
		}
	}

	function toggle(t: Token, call: Call) {
		const i = picks.findIndex((p) => p.currencyId === t.currency_id);
		if (i >= 0 && picks[i].call === call) {
			picks = picks.filter((_p, k) => k !== i);
			return;
		}
		if (i >= 0) {
			picks[i].call = call;
			return;
		}
		if (picks.length >= BINARY_PICKS) {
			toast(`${BINARY_PICKS} coins max. Remove one first.`, 'info');
			return;
		}
		picks = [
			...picks,
			{
				currencyId: t.currency_id,
				symbol: t.symbol!.toUpperCase(),
				name: t.name ?? t.symbol!,
				sector: classifySector([t.symbol!]),
				call
			}
		];
	}

	async function lock() {
		if (!contest || picks.length !== BINARY_PICKS) return;
		busy = true;
		try {
			const res = await fetch(`/api/contest/${contest.id}/lineup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					picks,
					carId: setup?.carId ?? null,
					circuit: setup?.circuit ?? null
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? "Couldn't lock your calls");
			window.location.href = `/game/${contest.id}`;
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
			busy = false;
		}
	}

	const callOf = (t: Token) => picks.find((p) => p.currencyId === t.currency_id)?.call ?? null;
	const shown = $derived(
		tokens.filter((t) => !query || t.symbol!.toLowerCase().includes(query.toLowerCase()))
	);
	const priceFmt = (p: number | null) =>
		p == null
			? '—'
			: p >= 1000
				? `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
				: p >= 1
					? `$${p.toFixed(2)}`
					: `$${p.toPrecision(3)}`;
</script>

<div class="m-page">
	{#if step === 'mode'}
		<a href={resolve('/play')} class="text-sm font-bold text-text no-underline">← All races</a>
		<div
			class="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-center gap-6"
		>
			<header class="flex flex-col gap-3">
				<span class="m-plate w-fit"><span>Binary · Neon town</span></span>
				<h1 class="m-title">Call it up or down.</h1>
				<p class="m-lead">
					Pick any five coins and call each one. Every right call lights a gate on the lap and
					speeds you up. A coin that doesn't move counts as wrong.
				</p>
			</header>
			<WorldThumb theme="neon" paint="var(--color-amber)" />
		</div>

		<h2 class="m-eyebrow mt-8">Against</h2>
		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			{#each [{ id: 'market', title: 'The market', blurb: `Get ${SOLO_TO_WIN} of 5 right and you win. Practice rewards.` }, { id: 'bot', title: 'A bot', blurb: 'Most correct calls wins. Ties go to whoever was right by more.' }] as o (o.id)}
				<button
					type="button"
					aria-pressed={opponent === o.id}
					onclick={() => (opponent = o.id as 'market' | 'bot')}
					class="m-card cursor-pointer text-start transition-transform {opponent === o.id
						? '-translate-y-1 !bg-butter'
						: ''}"
				>
					<div class="font-display text-xl font-extrabold">{o.title}</div>
					<p class="mt-1 text-sm text-text-muted">{o.blurb}</p>
				</button>
			{/each}
		</div>

		<h2 class="m-eyebrow mt-8">Length</h2>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each BINARY_LENGTHS as l (l.minutes)}
				<button
					type="button"
					aria-pressed={minutes === l.minutes}
					onclick={() => (minutes = l.minutes)}
					class="m-chip !min-h-11 !px-5 !text-sm">{l.label}</button
				>
			{/each}
		</div>
		<button
			type="button"
			disabled={busy}
			onclick={createRace}
			class="m-btn primary lg mt-8 disabled:opacity-50">Next &rarr;</button
		>
	{:else if step === 'setup'}
		<RaceSetup
			onDone={(choice) => {
				setup = choice;
				step = 'calls';
			}}
		/>
	{:else}
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="m-title">Make your calls</h1>
				<p class="mt-2 text-sm text-text-muted">
					The price shown is the line to beat. Entry prices are taken when the race starts.
				</p>
			</div>
			<button
				type="button"
				disabled={busy || picks.length !== BINARY_PICKS}
				onclick={lock}
				class="m-btn primary lg disabled:opacity-50"
				>{picks.length === BINARY_PICKS
					? 'Lock calls →'
					: `${picks.length}/${BINARY_PICKS} called`}</button
			>
		</div>

		{#if picks.length}
			<div class="mt-4 flex flex-wrap gap-2">
				{#each picks as p (p.currencyId)}
					<span class="rounded-full bg-text px-3 py-1 text-sm font-bold text-surface"
						>{p.symbol} {p.call === 'up' ? '▲' : '▼'}</span
					>
				{/each}
			</div>
		{/if}

		<input
			bind:value={query}
			placeholder="Search coins"
			class="mt-5 h-11 w-full max-w-sm rounded-xl border border-border bg-surface px-3 text-sm"
		/>
		<div class="mt-3 grid grid-cols-3 gap-2 max-md:grid-cols-2 max-sm:grid-cols-1">
			{#each shown as t (t.currency_id)}
				{@const c = callOf(t)}
				<div
					class="flex items-center justify-between gap-2 rounded-2xl border bg-surface p-3 {c
						? 'border-text'
						: 'border-border'}"
				>
					<div class="min-w-0">
						<div class="font-black">{t.symbol!.toUpperCase()}</div>
						<div class="font-mono text-xs text-text-muted">
							{priceFmt(t.price)}
							{#if t.change24h != null}
								<span class={t.change24h >= 0 ? 'text-positive-ink' : 'text-negative-ink'}
									>{t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(1)}%</span
								>{/if}
						</div>
					</div>
					<div class="flex gap-1">
						<button
							type="button"
							aria-label="Call {t.symbol} up"
							aria-pressed={c === 'up'}
							onclick={() => toggle(t, 'up')}
							class="h-9 w-11 cursor-pointer rounded-xl border text-sm font-black {c === 'up'
								? 'border-positive bg-positive text-text'
								: 'border-border bg-bg'}">▲</button
						>
						<button
							type="button"
							aria-label="Call {t.symbol} down"
							aria-pressed={c === 'down'}
							onclick={() => toggle(t, 'down')}
							class="h-9 w-11 cursor-pointer rounded-xl border text-sm font-black {c === 'down'
								? 'border-negative bg-negative text-text'
								: 'border-border bg-bg'}">▼</button
						>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Toast />
