<script lang="ts">
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import { ITEMS, type LineupItem } from '$lib/race/items';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import { BADGE_MAP } from '$lib/badges';
	import { lineFor, personalityOf, type HeadToHead, type Mood } from '$lib/bots/personalities';

	// A bot opponent's reaction to the result, in its own voice.
	let botReaction = $state<{ name: string; line: string } | null>(null);
	let item = $state<LineupItem | null>(null);
	// Binary mode (F9): each call, entry → exit, ✓ or ✗.
	let calls = $state<
		{ symbol: string; call: string | null; entry: number; exit: number; right: boolean }[] | null
	>(null);
	let carRace = $state<{ won: boolean; car: { model: string; rarity: string } } | null>(null);

	// Starts empty on purpose. This page previously initialised with a realistic
	// fabricated result ("YOU WON · 1482 / 1215" over five invented picks), which
	// rendered as though real whenever there was no contestId or the fetch failed
	// — including straight from the nav. A result screen must never invent a
	// result; with nothing loaded it now says so.
	let result = $state({
		status: '',
		xp: 0,
		yourScore: 0,
		opponentScore: 0,
		isPaper: false
	});

	let breakdown = $state<
		{
			sector: string;
			pick: string;
			pct: number;
			opponent: string | null;
			opponentPick: string | null;
			opponentPct: number | null;
			points: number;
		}[]
	>([]);
	let opponentName = $state<string | null>(null);
	let record = $state<{ wins: number; losses: number } | null>(null);
	let canRematch = $state(false);
	let stakeInfo = $state<{ amount: number | null; net: number; status: string } | null>(null);
	let rematching = $state(false);
	let hasResult = $state(false);
	let loading = $state(true);
	let resolving = $state(false);
	let error = $state('');
	let aiBreakdown = $state('');
	let aiLoading = $state(false);
	let contestId = $state('');
	let newBadges = $state<{ code: string; emoji: string; name: string }[]>([]);

	// A contest that just ended scores off a live batch price fetch
	// (contest-resolution.ts) — a transient blip there is expected, not a
	// failure, and the server explicitly defers rather than guessing. Landing
	// here straight off the game page (the common case) is exactly when that
	// fetch is most likely to still be in flight. Retrying a few times before
	// giving up turns "Result unavailable" (permanent-looking, wrong) into a
	// few seconds of "Still resolving" (accurate) for what's normally a
	// same-second recovery.
	const MAX_RETRIES = 6;
	const RETRY_DELAY_MS = 4000;

	async function loadResult(attempt = 0) {
		try {
			const res = await fetch(`/api/contest/${contestId}/result`);
			// Still running — send them to watch it rather than showing an error for
			// a contest that simply hasn't finished yet.
			if (res.status === 409) {
				const payload = await res.json().catch(() => ({}));
				if (payload?.stillRunning) {
					window.location.href = payload.gameUrl ?? `/game/${contestId}`;
					return;
				}
			}
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				if (payload?.retryable && attempt < MAX_RETRIES) {
					resolving = true;
					setTimeout(() => loadResult(attempt + 1), RETRY_DELAY_MS);
					return;
				}
				throw new Error(payload?.error ?? 'Failed to load contest result');
			}
			resolving = false;
			const data = await res.json();
			result = {
				status: data.status,
				xp: data.xp,
				yourScore: data.yourScore,
				opponentScore: data.opponentScore,
				isPaper: Boolean(data.isPaper)
			};
			if (Array.isArray(data.breakdown) && data.breakdown.length > 0) {
				breakdown = data.breakdown;
			}
			opponentName = data.opponentName ?? null;
			carRace = data.carRace ?? null;
			item = data.item ?? null;
			calls = data.calls ?? null;
			const rival = data.rival as { username: string; mood: Mood; record: HeadToHead } | null;
			if (rival) {
				const botWon = data.status !== 'YOU WON';
				botReaction = {
					name: rival.username,
					line: lineFor(personalityOf(rival.username), rival.mood, botWon ? 'wins' : 'loses', {
						you: 'you',
						record: rival.record
					})
				};
			}
			record = data.record ?? null;
			canRematch = Boolean(data.canRematch);
			stakeInfo = data.stake ?? null;
			hasResult = true;
			// Fetch AI breakdown after the result is loaded (server reads the picks itself)
			fetchAiBreakdown();

			if (Array.isArray(data.newBadges)) {
				for (const code of data.newBadges) {
					const badge = BADGE_MAP.get(code);
					if (badge) {
						toast(`${badge.emoji} Badge unlocked: ${badge.name}`, 'success');
						newBadges = [...newBadges, { code, emoji: badge.emoji, name: badge.name }];
					}
				}
			}
		} catch (e: any) {
			error = e.message ?? 'Could not load result';
			resolving = false;
			loading = false;
			return;
		}
		if (!resolving) loading = false;
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		contestId = params.get('contestId') ?? '';

		if (!contestId) {
			loading = false;
			return;
		}

		loadResult();
	});

	async function fetchAiBreakdown() {
		aiLoading = true;
		try {
			const res = await fetch('/api/breakdown', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contestId })
			});
			if (res.ok) {
				const data = await res.json();
				aiBreakdown = data.breakdown ?? '';
			} else {
				const err = await res.json().catch(() => ({}));
				console.error('[breakdown] failed:', res.status, err.error, err.detail);
			}
		} catch (e) {
			console.error('[breakdown] fetch threw:', e);
			// Non-fatal — fall back to static text below
		} finally {
			aiLoading = false;
		}
	}

	async function rematch() {
		rematching = true;
		try {
			const res = await fetch(`/api/contest/${contestId}/rematch`, { method: 'POST' });
			const data = await res.json();
			if (!res.ok) {
				// The cap is a deliberate stop, not an error — say so plainly.
				toast(data?.error ?? 'Could not start a rematch', 'error');
				rematching = false;
				return;
			}
			window.location.href = `/draft?contestId=${data.contestId}`;
		} catch {
			toast('Could not start a rematch', 'error');
			rematching = false;
		}
	}

	const won = $derived(result.status === 'YOU WON');
</script>

<div class="m-page">
	{#if loading}
		<p class="mb-4 text-sm text-text-muted">Resolving contest and computing scores…</p>
	{:else if error}
		<p class="mb-4 text-sm text-negative-ink">{error}</p>
	{/if}

	{#if !loading && !hasResult}
		<div class="m-card text-center max-sm:p-6">
			<div class="text-[28px] font-black tracking-[-0.03em]">
				{error ? 'Result unavailable' : 'No contest selected'}
			</div>
			<p class="mx-auto mt-3 text-[15px] text-text-muted">
				{error
					? "We couldn't load that contest. It may still be running, or the link may be wrong."
					: 'Open a result from your contest list — results are tied to a specific contest.'}
			</p>
			<div class="mt-7 flex flex-wrap justify-center gap-3">
				<a href="/dashboard" class="m-btn primary lg">Go to dashboard</a>
				<a href="/matchmaking" class="m-btn lg">Find a match</a>
			</div>
		</div>
	{:else if hasResult}
		<!-- A win is loud (green, stamped). A loss is calm: cream, never red-washed. -->
		<div class="halftone m-card !p-[clamp(1.25rem,4vw,2.5rem)] {won ? '!bg-primary' : ''}">
			<div class="flex flex-wrap items-start justify-between gap-6">
				<div>
					<div class="mb-3.5 flex items-center gap-2.5">
						<span class="m-plate"><span>Race · final</span></span>
						{#if result.isPaper}
							<span class="m-tag bg-sky-tint">Scrimmage</span>
						{/if}
					</div>
					<h1
						class="anim-stamp w-fit origin-left font-display text-[clamp(2.75rem,10vw,5rem)] leading-[0.9] font-extrabold tracking-[-0.05em]"
					>
						{won ? 'You won!' : 'You lost.'}
					</h1>
					<p class="mt-2 text-sm font-semibold">
						{won
							? 'First across the line. Your Gears are in the garage.'
							: 'Close the gap next time. You still earned Gears for racing.'}
					</p>
					<div class="mt-3 flex flex-wrap items-center gap-2.5">
						<div class="m-tag bg-surface">
							+{result.xp}
							{result.isPaper ? 'Scrimmage XP (not counted)' : 'XP earned'}
						</div>
						{#if stakeInfo && stakeInfo.status === 'settled'}
							<!-- Stated outright rather than left to be inferred from a balance
						     change — the wager is the reason they're here. -->
							<div class="m-tag m-num {stakeInfo.net >= 0 ? 'bg-brand-tint' : 'bg-pink'}">
								{stakeInfo.net >= 0 ? '+' : ''}{stakeInfo.net} XP wager
							</div>
						{:else if stakeInfo && stakeInfo.status === 'refunded'}
							<div class="m-tag bg-surface">Wager refunded</div>
						{/if}
						{#if record}
							<!-- The record is what makes an opponent a nemesis rather than
						     just the last person you played. -->
							<div class="m-tag m-num bg-lavender">
								{record.wins}–{record.losses} vs {opponentName ?? 'them'}
							</div>
						{/if}
						{#if item}
							<p class="m-tag bg-butter">
								{ITEMS[item.kind].icon}
								{ITEMS[item.kind].label}{item.sector
									? ` on ${item.sector.toUpperCase()}`
									: item.symbol
										? ` on ${item.symbol}`
										: ''}{item.swap ? ` · swapped ${item.swap.from} for ${item.swap.to}` : ''}
							</p>
						{/if}
						{#if carRace}
							<p class="m-tag anim-pop max-w-[44ch] bg-butter !py-2 !text-sm !whitespace-normal">
								{carRace.won
									? `🏁 You won their ${carRace.car.rarity} ${carRace.car.model}. It's in your garage.`
									: `Your ${carRace.car.rarity} ${carRace.car.model} leaves your garage.`}
							</p>
						{/if}
						{#if botReaction}
							<p class="m-tag max-w-[44ch] -rotate-1 bg-surface !py-2 !text-sm !whitespace-normal">
								💬
								{botReaction.name}: “{botReaction.line}”
							</p>
						{/if}
					</div>
				</div>
				<div class="flex items-center gap-6">
					<div>
						<div class="mb-1.5 text-[11px] font-extrabold tracking-[0.1em] uppercase opacity-70">
							You
						</div>
						<div
							class="font-mono text-[44px] leading-none font-bold tracking-[-0.03em] max-sm:text-[32px]"
						>
							{result.yourScore.toLocaleString()}
						</div>
					</div>
					<div class="text-xl font-extrabold opacity-40">/</div>
					<div>
						<div
							class="mb-1.5 truncate text-[11px] font-extrabold tracking-[0.1em] uppercase opacity-70"
						>
							{opponentName ?? 'Opponent'}
						</div>
						<div
							class="font-mono text-[44px] leading-none font-bold tracking-[-0.03em] opacity-65 max-sm:text-[32px]"
						>
							{result.opponentScore.toLocaleString()}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="mt-4.5 flex flex-wrap gap-4.5">
			<div class="min-w-0 flex-[1_1_520px]">
				<!-- After a finished race: offer the home-screen install (F11). -->
				<div class="mb-6"><InstallPrompt /></div>
				{#if calls}
					<div class="mb-3 text-[11px] font-extrabold tracking-[0.12em] text-text-muted uppercase">
						Your calls · {calls.filter((c) => c.right).length} of {calls.length} right
					</div>
					<ul class="mb-6 flex flex-col gap-2">
						{#each calls as c (c.symbol)}
							<li
								class="flat m-card flex flex-wrap items-center justify-between gap-2 !p-4 text-sm"
							>
								<span class="font-black"
									>{c.right ? '✓' : '✗'}
									{c.symbol}
									{c.call === 'up' ? '▲ up' : '▼ down'}</span
								>
								<span class="font-mono text-xs"
									>${c.entry.toPrecision(6)} → ${c.exit.toPrecision(6)}{c.entry === c.exit
										? ' · flat counts as wrong'
										: ''}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
				<div class="mb-3 text-[11px] font-extrabold tracking-[0.12em] text-text-muted uppercase">
					Pick breakdown
				</div>
				<div class="overflow-x-auto rounded-[18px] border border-border">
					<div
						class="grid min-w-[620px] grid-cols-[90px_minmax(100px,1fr)_70px_minmax(100px,1fr)_60px] gap-2.5 bg-surface px-4.5 py-2.5 text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase"
					>
						<div>Sector</div>
						<div>Your pick</div>
						<div class="text-end">Ret</div>
						<div>Opponent</div>
						<div class="text-end">Pts</div>
					</div>
					{#each breakdown as row, i (`${row.sector}-${row.pick}-${i}`)}
						<div
							class="grid min-w-[620px] grid-cols-[90px_minmax(100px,1fr)_70px_minmax(100px,1fr)_60px] items-center gap-2.5 border-t border-border px-4.5 py-3.5"
						>
							<span class="text-[11px] font-extrabold tracking-[0.08em] text-text-muted uppercase"
								>{row.sector}</span
							>
							<span class="text-sm font-bold">{row.pick}</span>
							<span
								class="text-end font-mono text-[13px] font-bold"
								style="color:{row.pct >= 0 ? 'var(--color-positive-ink)' : 'var(--color-red-ink)'}"
								>{row.pct >= 0 ? '+' : ''}{row.pct}%</span
							>
							{#if row.opponentPick}
								<span class="truncate text-sm">
									<span class="font-bold text-text">{row.opponentPick}</span>
									{#if row.opponentPct != null}
										<span
											class="font-mono text-[12px]"
											style="color:{row.opponentPct >= 0
												? 'var(--color-positive-ink)'
												: 'var(--color-red-ink)'}"
											>{row.opponentPct >= 0 ? '+' : ''}{row.opponentPct}%</span
										>
									{/if}
								</span>
							{:else}
								<span class="text-sm text-text-muted">—</span>
							{/if}
							<span class="text-end text-sm font-bold">+{row.points}</span>
						</div>
					{/each}
				</div>

				<div class="m-card mt-4 flex gap-3.5">
					<div class="h-9 w-9 shrink-0 rounded-[9px] bg-surface-alt"></div>
					<div>
						<div
							class="mb-2 text-[11px] font-extrabold tracking-[0.12em] text-text-muted uppercase"
						>
							Mentor take
						</div>
						{#if aiLoading}
							<div class="flex flex-col gap-2">
								<div class="h-3.5 w-3/4 animate-pulse rounded bg-surface-alt"></div>
								<div class="h-3.5 w-full animate-pulse rounded bg-surface-alt"></div>
								<div class="h-3.5 w-2/3 animate-pulse rounded bg-surface-alt"></div>
							</div>
						{:else}
							<p class="text-sm leading-[1.65] text-text-body">
								{aiBreakdown ||
									'Sector momentum and price performance drove your result. Review your picks above to refine your next draft strategy.'}
							</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5">
				{#each newBadges as badge (badge.code)}
					<div class="m-card !bg-brand-tint">
						<div
							class="mb-3.5 text-[11px] font-extrabold tracking-[0.12em] text-primary-ink uppercase"
						>
							Badge unlocked
						</div>
						<div class="flex items-center gap-3">
							<div
								class="grid h-11 w-11 place-items-center rounded-xl border border-primary bg-primary-muted text-xl"
							>
								{badge.emoji}
							</div>
							<div class="text-[15px] font-extrabold">{badge.name}</div>
						</div>
					</div>
				{/each}

				<div class="m-card">
					<div class="mb-3 text-[11px] font-extrabold tracking-[0.12em] text-text-muted uppercase">
						XP gained
					</div>
					<div class="font-mono text-[40px] leading-none font-bold text-primary-ink">
						+{result.xp}
					</div>
				</div>

				{#if !result.isPaper && contestId && page.data.user?.id}
					<a
						href={`/share/${contestId}?u=${page.data.user.id}`}
						target="_blank"
						rel="noopener noreferrer"
						class="m-btn primary lg w-full">Share result</a
					>
				{/if}
				{#if canRematch}
					<!-- The rivalry loop. Same opponent, same terms — one click. -->
					<button
						onclick={rematch}
						disabled={rematching}
						class="m-btn dark lg w-full disabled:opacity-60"
					>
						{rematching ? 'Setting up…' : `Rematch ${opponentName ?? 'them'}`}
					</button>
				{/if}
				<a href="/matchmaking" class="m-btn lg w-full">New opponent</a>
			</div>
		</div>
	{/if}
</div>

<Toast />
