<script lang="ts">
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';
	import { resolve } from '$app/paths';

	import { DURATION_OPTIONS, DEFAULT_DURATION_MINUTES, durationLabel } from '$lib/constants';
	import { STAKE_TIERS } from '$lib/stakes';

	const NO_OPPONENT_SUGGEST_MS = 20_000;

	// Terms are chosen before matching, and players are matched on them — so the
	// page opens on a picker rather than searching immediately.
	let status = $state<'idle' | 'searching' | 'matched' | 'error'>('idle');
	let durationMinutes = $state(DEFAULT_DURATION_MINUTES);
	// Stake tier. Matching on it IS the agreement to that stake, so there's
	// nothing to negotiate later. 0 = play for nothing.
	let stakeTier = $state(0);
	let xpBalance = $state<number | null>(null);
	let errorMessage = $state('');
	let contestId = $state('');
	let _opponentId = $state('');
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let searchStartTime = $state(0);
	let elapsed = $state(0);
	let noOpponentYet = $state(false);
	let startingScrimmage = $state(false);

	const elapsedStr = $derived.by(() => {
		const s = Math.floor(elapsed / 1000);
		const m = Math.floor(s / 60);
		return `${m}:${(s % 60).toString().padStart(2, '0')}`;
	});

	// No auto-search: the player picks terms first. Previously this page joined
	// the queue the moment it loaded, which is incompatible with choosing a
	// duration to be matched on.

	onMount(async () => {
		// Needed to grey out tiers the player can't cover — offering a stake they
		// can't fund would fail only after they'd committed to it.
		try {
			const res = await fetch('/api/me');
			if (res.ok) xpBalance = (await res.json())?.xpTotal ?? 0;
		} catch {
			/* balance is a nicety; the server enforces affordability anyway */
		}
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	async function startSearch() {
		status = 'searching';
		searchStartTime = Date.now();
		elapsed = 0;
		noOpponentYet = false;

		// Poll elapsed time
		const elapsedTimer = setInterval(() => {
			elapsed = Date.now() - searchStartTime;
			if (elapsed > NO_OPPONENT_SUGGEST_MS) noOpponentYet = true;
		}, 1000);

		// Join queue
		const res = await fetch('/api/matchmaking/join', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'daily', durationMinutes, stakeTier })
		});

		if (res.status === 401) {
			window.location.href = '/?auth=required';
			return;
		}
		if (!res.ok) {
			clearInterval(elapsedTimer);
			status = 'error';
			errorMessage = 'Could not join matchmaking. Please try again.';
			return;
		}

		const data = await res.json();
		if (data.status === 'matched') {
			clearInterval(elapsedTimer);
			contestId = data.contestId;
			_opponentId = data.opponentId;
			status = 'matched';
			toast('Opponent found!', 'success');
			setTimeout(() => goto(resolve(`/draft?contestId=${contestId}`)), 1500);
			return;
		}

		// Poll for a real opponent every 3s — no bot fallback, ever (Versus is real-opponents-only)
		pollTimer = setInterval(async () => {
			const pollRes = await fetch('/api/matchmaking/status');
			if (pollRes.status === 401) {
				clearInterval(elapsedTimer);
				if (pollTimer) clearInterval(pollTimer);
				pollTimer = null;
				window.location.href = '/?auth=required';
				return;
			}
			if (!pollRes.ok) return; // transient — let the next 3s tick retry
			const pollData = await pollRes.json();
			if (pollData.status === 'matched') {
				clearInterval(elapsedTimer);
				if (pollTimer) clearInterval(pollTimer);
				pollTimer = null;
				contestId = pollData.contestId;
				_opponentId = pollData.opponentId;
				status = 'matched';
				toast('Opponent found!', 'success');
				setTimeout(() => goto(resolve(`/draft?contestId=${contestId}`)), 1500);
			}
		}, 3000);
	}

	async function cancelSearch() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		await fetch('/api/matchmaking/leave', { method: 'POST' });
		goto(resolve('/dashboard'));
	}

	async function startScrimmage() {
		startingScrimmage = true;
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		await fetch('/api/matchmaking/leave', { method: 'POST' });
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'daily', mode: 'paper', durationMinutes })
			});
			if (res.status === 401) {
				window.location.href = '/?auth=required';
				return;
			}
			if (!res.ok) throw new Error('Could not start Scrimmage. Please try again.');
			const contest = await res.json();
			window.location.href = `/draft?contestId=${contest.id}&type=${contest.type}&mode=paper`;
		} catch (error) {
			startingScrimmage = false;
			status = 'error';
			errorMessage = (error as Error)?.message ?? 'Could not start Scrimmage. Please try again.';
		}
	}
</script>

<div class="m-page mid">
	{#if status === 'idle'}
		<a href={resolve('/play')} class="text-sm font-bold text-text no-underline">← All races</a>
		<div
			class="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-center gap-6"
		>
			<header class="flex flex-col gap-3">
				<span class="m-plate w-fit"><span>Versus · Golden hour</span></span>
				<h1 class="m-title">One rival. Five coins each.</h1>
				<p class="m-lead">
					We match you with a real driver who picked the same race length, so both engines run on
					the same market window.
				</p>
			</header>
			<WorldThumb theme="golden" paint="var(--color-blue)" />
		</div>

		<section class="m-card mt-6" aria-labelledby="vs-length">
			<h2 id="vs-length" class="font-display text-xl font-extrabold">How long should it run?</h2>
			<p class="text-sm text-text-muted">
				Shorter races fill more slowly: fewer people wait on them.
			</p>
			<div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Race length">
				{#each DURATION_OPTIONS as opt (opt.minutes)}
					<button
						type="button"
						onclick={() => (durationMinutes = opt.minutes)}
						aria-pressed={durationMinutes === opt.minutes}
						class="m-chip !min-h-11 !px-5 !text-sm">{opt.label}</button
					>
				{/each}
			</div>

			<h2 class="mt-6 font-display text-xl font-extrabold">
				Play for XP? <span class="text-sm font-semibold text-text-muted">(optional)</span>
			</h2>
			<div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Stake">
				{#each STAKE_TIERS as tier (tier)}
					{@const tooRich = tier > 0 && xpBalance != null && xpBalance < tier}
					<button
						type="button"
						disabled={tooRich}
						onclick={() => (stakeTier = tier)}
						aria-pressed={stakeTier === tier}
						title={tooRich ? `You have ${xpBalance} XP` : undefined}
						class="m-chip !min-h-11 !px-5 !text-sm disabled:cursor-not-allowed disabled:opacity-40"
						>{tier === 0 ? 'No stake' : `${tier} XP`}</button
					>
				{/each}
			</div>
			{#if stakeTier > 0}
				<p class="mt-3 text-sm text-text-body">
					You'll meet someone who chose the same stake. It always settles at the
					<strong>lower</strong> of your two numbers, so you're never pushed above yours.
				</p>
			{/if}
			{#if xpBalance != null}
				<p class="m-num mt-2 text-xs text-text-muted">Balance: {xpBalance} XP</p>
			{/if}

			<button onclick={startSearch} class="m-btn primary lg mt-6 block">
				Find a rival · {durationLabel(durationMinutes)}{stakeTier > 0 ? ` · ${stakeTier} XP` : ''} →
			</button>
			<div class="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
				<span class="text-text-muted">Rather not wait?</span>
				<button onclick={startScrimmage} disabled={startingScrimmage} class="m-btn sm">
					{startingScrimmage ? 'Starting…' : 'Practice against a bot'}
				</button>
			</div>
		</section>
	{:else if status === 'searching'}
		<section class="halftone relative m-card overflow-hidden !bg-butter" aria-live="polite">
			<div
				class="pointer-events-none absolute -end-16 top-10 grid h-72 w-72 place-items-center max-sm:-end-28"
				aria-hidden="true"
			>
				{#each [0, 0.85, 1.7] as d (d)}
					<div
						class="anim-pulse absolute h-48 w-48 rounded-full border-2 border-border"
						style="animation-delay:{d}s"
					></div>
				{/each}
				<div class="h-16 w-16 rounded-full border-2 border-border bg-primary"></div>
			</div>
			<span class="m-tag relative bg-surface"
				><span class="anim-blink h-2 w-2 rounded-full border border-border bg-primary"
				></span>Searching</span
			>
			<h1 class="m-title relative mt-6 max-w-[14ch]">Finding your rival…</h1>
			<p class="relative mt-3 max-w-[40ch] text-sm font-semibold">
				Looking for a real driver who's online now. If no one turns up, you can practice against a
				bot while we keep looking.
			</p>
			<div class="relative mt-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					<div class="m-num text-4xl font-bold" role="timer">{elapsedStr}</div>
					<div class="m-eyebrow mt-1">waiting</div>
				</div>
				<button onclick={cancelSearch} class="m-btn">Cancel search</button>
			</div>
		</section>
		{#if noOpponentYet}
			<div class="m-card mt-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<div class="font-bold">No one's online right now</div>
					<p class="text-sm text-text-muted">We'll keep searching in the background.</p>
				</div>
				<button onclick={startScrimmage} disabled={startingScrimmage} class="m-btn primary">
					{startingScrimmage ? 'Starting…' : 'Practice while you wait'}
				</button>
			</div>
		{/if}
	{:else if status === 'matched'}
		<section class="m-card !bg-primary text-center" aria-live="polite">
			<span class="m-tag anim-stamp bg-surface">Matched</span>
			<h1 class="m-title mt-5">Rival found!</h1>
			<p class="mt-2 font-semibold">Taking you to the draft…</p>
		</section>
	{:else if status === 'error'}
		<section class="m-card text-center">
			<h1 class="font-display text-2xl font-extrabold">Something went wrong</h1>
			<p class="mt-2 text-sm text-text-body">{errorMessage}</p>
			<button onclick={startSearch} class="m-btn primary mt-5">Try again</button>
		</section>
	{/if}
</div>

<Toast />
