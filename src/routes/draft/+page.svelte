<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SECTORS } from '$lib/constants';
	import { sectorTheme } from '$lib/sectorTheme';
	import { classifySector } from '$lib/sectors';
	import Toast from '$lib/components/Toast.svelte';
	import DraftAgent from '$lib/components/DraftAgent.svelte';
	import TokenIcon from '$lib/components/TokenIcon.svelte';
	import TokenHover from '$lib/components/TokenHover.svelte';
	import { toast } from '$lib/toast';
	import RaceSetup from '$lib/components/race/RaceSetup.svelte';
	import ItemTray from '$lib/components/race/ItemTray.svelte';
	import type { LineupItem } from '$lib/race/items';

	type Token = {
		currency_id: string;
		symbol?: string;
		name?: string;
		price: number | null;
		change24h: number | null;
		volume24h: number | null;
		rank: number | null;
	};

	type SectorInfo = { id: string; name: string; change: number | null };

	type Pick = {
		slot: string;
		currencyId: string;
		symbol: string;
		name: string;
		sector: string;
	};

	type Slot = { id: string; sector: string; name: string };

	// ── State ──────────────────────────────────────────────────────────
	let contestId = $state('');
	// Race flow: car and track come before the draft (GAMEPLAY_FLOWS.md, F2).
	let setup = $state<{ carId: string | null; circuit: string | null } | null>(null);
	// Car race: the staked car is fixed, so the setup skips straight to the track.
	let isCarRace = $state(false);
	let lobbyId = $state('');

	// Token hover overlay (G-07). Anchored to the hovered card's rect so the
	// overlay can place itself beside it and flip near the viewport edge.
	let hoverToken = $state<{ currencyId: string; symbol: string } | null>(null);
	let hoverRect = $state<DOMRect | null>(null);
	// Now that the overlay is clickable (Stats/News tabs), leaving the card
	// can't close it immediately — the mouse has to cross the gap to the
	// overlay itself first. Close is delayed and cancellable so hovering
	// either the card OR the overlay keeps it open; it only actually closes
	// once the pointer has left both.
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	function openHover(e: MouseEvent, currencyId: string, symbol: string) {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
		hoverRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		hoverToken = { currencyId, symbol };
	}
	function scheduleCloseHover() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = setTimeout(() => {
			hoverToken = null;
			hoverRect = null;
			closeTimer = null;
		}, 150);
	}
	function cancelCloseHover() {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
	}
	function closeHover() {
		cancelCloseHover();
		hoverToken = null;
		hoverRect = null;
	}

	// The anchor rect is captured once, so any scroll invalidates it. Dismissing
	// is better than letting the overlay drift away from its card.
	$effect(() => {
		if (!hoverToken) return;
		window.addEventListener('scroll', closeHover, { passive: true, once: true });
		return () => window.removeEventListener('scroll', closeHover);
	});
	let tokens = $state<Token[]>([]);
	let sectorChanges = $state<Map<string, number | null>>(new Map());
	let lineup = $state<Pick[]>([]);
	// The nitro or pit-stop item for this race, locked in with the lineup.
	let item = $state<LineupItem | null>(null);
	// A changed lineup can leave the item aimed at a coin that's gone: clear it.
	$effect(() => {
		void lineup.map((p) => p.symbol).join();
		item = null;
	});
	let loading = $state(true);
	let loadError = $state('');
	let submitting = $state(false);
	let activeSlot = $state<string>(SECTORS[0].id);
	let search = $state('');
	let timeLeft = $state(45 * 60);
	let timer: ReturnType<typeof setInterval> | null = null;
	let activeBoosts = $state<Map<string, boolean>>(new Map());
	let highlightId = $state('');
	let contestType = $state<'daily' | 'weekly'>('daily');
	let isPaper = $state(false);
	let sectorRestriction = $state<string | null>(null);

	// ── Lifecycle ──────────────────────────────────────────────────────
	onMount(() => {
		const p = new URLSearchParams(window.location.search);
		contestId = p.get('contestId') ?? '';
		lobbyId = p.get('lobbyId') ?? '';
		highlightId = p.get('highlight') ?? '';
		contestType = p.get('type') === 'weekly' ? 'weekly' : 'daily';
		isPaper = p.get('mode') === 'paper';
		isCarRace = p.get('carRace') === '1';
		loadData();
		timer = setInterval(() => {
			timeLeft = Math.max(0, timeLeft - 1);
		}, 1000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	async function loadData() {
		loading = true;
		loadError = '';
		try {
			if (lobbyId) {
				const lRes = await fetch(`/api/lobby/${lobbyId}`);
				if (lRes.ok) {
					const lobbyInfo = await lRes.json();
					sectorRestriction = lobbyInfo.sectorRestriction ?? null;
					if (sectorRestriction) activeSlot = `${sectorRestriction}-1`;
				}
			}

			const tokensUrl = sectorRestriction
				? `/api/tokens?sector=${sectorRestriction}`
				: '/api/tokens';
			const [tRes, sRes, meRes] = await Promise.all([
				fetch(tokensUrl),
				fetch('/api/sectors'),
				fetch('/api/me')
			]);
			if (!tRes.ok) throw new Error('Failed to load tokens');
			tokens = await tRes.json();
			if (highlightId) {
				const match = tokens.find((t) => t.currency_id === highlightId);
				if (match?.symbol) {
					search = match.symbol;
					// The pool is now sector-filtered by the active slot — without this,
					// a highlighted token outside the default L1 tab would search for
					// nothing found.
					if (!sectorRestriction) activeSlot = tokenSector(match);
					queueMicrotask(() =>
						document
							.getElementById('token-pool')
							?.scrollIntoView({ behavior: 'smooth', block: 'start' })
					);
				}
			}
			if (sRes.ok) {
				const secs: SectorInfo[] = await sRes.json();
				sectorChanges = new Map(secs.map((s) => [s.id, s.change]));
			}
			if (meRes.ok) {
				const me = await meRes.json();
				const boosts: Array<{ sector: string; expiresAt: string }> = me.activeBoosts || [];
				const now = new Date().toISOString();
				const validBoosts = boosts.filter((b) => b.expiresAt > now);
				activeBoosts = new Map(validBoosts.map((b) => [b.sector, true]));
			}
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	// ── Derived ────────────────────────────────────────────────────────
	const tokenMap = $derived(new Map(tokens.map((t) => [t.currency_id, t])));

	function tokenSector(t: { symbol?: string }): string {
		return classifySector([t.symbol ?? '']);
	}

	// A sector-restricted tournament can't use one-slot-per-sector — only that
	// sector's tokens are in the pool, so the other four slots could never be
	// filled. It gets five open slots from the restricted pool instead.
	const slots = $derived.by<Slot[]>(() => {
		const r = sectorRestriction;
		if (!r) return SECTORS.map((s) => ({ id: s.id, sector: s.id, name: s.name }));
		const label = SECTORS.find((s) => s.id === r)?.name ?? r.toUpperCase();
		return [1, 2, 3, 4, 5].map((n) => ({ id: `${r}-${n}`, sector: r, name: `${label} #${n}` }));
	});
	const activeSlotInfo = $derived(slots.find((s) => s.id === activeSlot) ?? slots[0]);
	const activeSector = $derived(activeSlotInfo.sector);
	const activeSlotLabel = $derived(
		sectorRestriction ? activeSlotInfo.name : sectorTheme(activeSector).label
	);

	// Only Wildcard accepts any chain — every other slot only shows/accepts
	// tokens actually classified into that sector. A restricted pool is already
	// filtered server-side.
	const filteredTokens = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const inSector =
			sectorRestriction || activeSector === 'wildcard'
				? tokens
				: tokens.filter((t) => tokenSector(t) === activeSector);
		if (!q) return inSector.slice(0, 50);
		return inSector
			.filter((t) => t.symbol?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q))
			.slice(0, 50);
	});

	const slotsFilledCount = $derived(lineup.length);

	const timerStr = $derived.by(() => {
		const m = Math.floor(timeLeft / 60)
			.toString()
			.padStart(2, '0');
		const s = (timeLeft % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	});

	// Real, derived from the actual lineup + live 24h changes + active boosts —
	// not a fabricated number. Matches the scoring formula on the Guide page:
	// score = Σ(move% × boost) × 100.
	const projectedScore = $derived(
		Math.round(
			lineup.reduce((sum, p) => {
				const t = tokenMap.get(p.currencyId);
				const chg = t?.change24h ?? 0;
				const boosted = activeBoosts.get(p.sector) ? chg * 1.25 : chg;
				return sum + boosted;
			}, 0) * 100
		)
	);

	// ── Helpers ────────────────────────────────────────────────────────
	function pickForSlot(id: string): Pick | undefined {
		return lineup.find((p) => p.slot === id);
	}

	function isInLineup(currencyId: string): boolean {
		return lineup.some((p) => p.currencyId === currencyId);
	}

	function selectSlot(id: string) {
		activeSlot = id;
		document.getElementById('token-pool')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function addToken(token: Token) {
		const sym = (token.symbol ?? token.currency_id).toUpperCase();
		if (isInLineup(token.currency_id)) {
			toast(`${sym} is already in your lineup`, 'error');
			return;
		}
		// Belt-and-suspenders: filteredTokens already excludes mismatches, but
		// this guards any other path that could call addToken directly.
		const required = sectorRestriction ?? (activeSector === 'wildcard' ? null : activeSector);
		if (required && tokenSector(token) !== required) {
			toast(`${sym} doesn't belong in the ${activeSlotInfo.name} slot`, 'error');
			return;
		}
		lineup = [
			...lineup.filter((p) => p.slot !== activeSlot),
			{
				slot: activeSlot,
				currencyId: token.currency_id,
				symbol: token.symbol ?? token.currency_id,
				name: token.name ?? '',
				sector: activeSector
			}
		];
		toast(`${sym} added to ${activeSlotInfo.name} slot`, 'success');
		const next = slots.find((s) => !lineup.some((p) => p.slot === s.id));
		if (next) activeSlot = next.id;
	}

	function removePick(slotId: string) {
		lineup = lineup.filter((p) => p.slot !== slotId);
		activeSlot = slotId;
	}

	const emptySectors = $derived(
		slots.filter((s) => !lineup.some((p) => p.slot === s.id)).map((s) => s.sector)
	);

	// Applies AI Draft Agent picks the same way a manual click would — normal
	// draft flow (addToken/removePick above) is completely unchanged, this is
	// purely additive. The agent fills by sector, so it's only offered in the
	// normal one-slot-per-sector draft, where slot id == sector id.
	function applyAgentPicks(
		picks: { sector: string; symbol: string; name: string; currencyId: string }[]
	) {
		for (const p of picks) {
			lineup = [...lineup.filter((x) => x.slot !== p.sector), { ...p, slot: p.sector }];
		}
	}

	function fmtChg(v: number | null): string {
		if (v == null) return '—';
		return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
	}

	function fmtPrice(v: number | null): string {
		if (v == null) return '';
		if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
		if (v >= 1) return '$' + v.toFixed(2);
		return '$' + v.toPrecision(4);
	}

	// ── Submit ─────────────────────────────────────────────────────────
	async function submitLineup() {
		if (lineup.length !== 5) {
			toast(
				sectorRestriction ? 'Fill all 5 slots first' : 'Select all 5 slots first — one per sector',
				'error'
			);
			return;
		}
		submitting = true;
		try {
			if (lobbyId) {
				const r2 = await fetch(`/api/lobby/${lobbyId}/lineup`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						picks: lineup,
						carId: setup?.carId ?? null,
						circuit: setup?.circuit ?? null
					})
				});
				if (!r2.ok) {
					const errData = await r2.json().catch(() => ({}));
					throw new Error((errData as { error?: string }).error ?? 'Failed to submit lineup');
				}
				window.location.href = `/race/${lobbyId}`;
				return;
			}

			if (!contestId) {
				const r = await fetch('/api/contests', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'daily' })
				});
				if (!r.ok) throw new Error('Failed to create contest');
				contestId = (await r.json()).id;
			}

			const r2 = await fetch(`/api/contest/${contestId}/lineup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					picks: lineup,
					carId: setup?.carId ?? null,
					circuit: setup?.circuit ?? null,
					item
				})
			});
			if (!r2.ok) {
				const errData = await r2.json().catch(() => ({}));
				throw new Error((errData as { error?: string }).error ?? 'Failed to submit lineup');
			}
			// Goes to the game, not the result. Landing on the result page straight
			// from a lock is what used to settle contests seconds after they began.
			window.location.href = `/game/${contestId}`;
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Submit failed', 'error');
		} finally {
			submitting = false;
		}
	}

	const TILTS = ['-1.6deg', '1.2deg', '-0.8deg', '1.6deg', '-1.2deg'];
</script>

<div class="m-page">
	{#if !setup}
		<!-- Lobby drafts take the tournament's track; head-to-head races choose one. -->
		<RaceSetup
			chooseTrack={!lobbyId}
			chooseCar={!isCarRace}
			onDone={(choice) => (setup = choice)}
		/>
	{:else}
		<!-- ── Where you are: car ✓ track ✓ → draft → lock ─────────────── -->
		<header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<span class="m-plate"
						><span
							>{lobbyId
								? 'Tournament race'
								: isCarRace
									? 'Car race'
									: isPaper
										? 'Scrimmage'
										: contestType === 'weekly'
											? 'Weekly Versus · 2× XP'
											: 'Versus'}</span
						></span
					>
					<span class="text-xs font-bold text-text-muted">Step 3 of 3 · Draft</span>
				</div>
				<h1 class="m-title mt-2">Build your engine.</h1>
				<p class="m-lead mt-1">
					{sectorRestriction
						? `Five ${sectorRestriction.toUpperCase()} coins. When they go up, you speed up.`
						: 'One coin for each sector. When they go up, your car speeds up.'}
				</p>
			</div>
			<div class="m-tag !min-h-10 bg-butter !px-4" role="timer" aria-label="Time left to lock">
				<span class="anim-blink h-2 w-2 rounded-full border border-border bg-negative"></span>
				<span class="m-num text-sm">{timerStr}</span> to lock
			</div>
		</header>

		{#if loading}
			<div class="mt-6 h-72 animate-pulse rounded-[22px] bg-surface-alt"></div>
		{:else if loadError}
			<div class="m-card mt-6 flex flex-wrap items-center justify-between gap-3 bg-pink">
				<span class="text-sm font-bold">{loadError}</span>
				<button type="button" onclick={loadData} class="m-btn sm">Try again</button>
			</div>
		{:else}
			<!-- ── The five slots ──────────────────────────────────────────── -->
			<section class="mt-6" aria-label="Your lineup">
				<div class="m-rail !gap-3">
					{#each slots as slot, i (slot.id)}
						{@const pick = pickForSlot(slot.id)}
						{@const theme = sectorTheme(slot.sector)}
						{@const t = pick ? tokenMap.get(pick.currencyId) : null}
						{@const isActive = activeSlot === slot.id}
						{@const sectorChg = sectorChanges.get(slot.sector) ?? null}
						<div
							class="relative flex min-w-[8.5rem] flex-1 flex-col items-center gap-2 rounded-[20px] border-2 p-3 text-center transition-transform {pick
								? 'border-border shadow-[4px_4px_0_var(--color-ink)]'
								: 'border-dashed border-border'} {isActive ? '-translate-y-1.5' : ''}"
							style="background:{pick || isActive ? theme.color : 'transparent'};rotate:{isActive
								? '0deg'
								: TILTS[i % TILTS.length]}"
						>
							<button
								type="button"
								onclick={() => selectSlot(slot.id)}
								aria-pressed={isActive}
								aria-label="{slot.name} slot{pick ? `: ${pick.symbol.toUpperCase()}` : ', empty'}"
								class="flex w-full cursor-pointer flex-col items-center gap-2 border-none bg-transparent p-0 text-text"
							>
								<span class="m-eyebrow">{sectorRestriction ? slot.name : theme.label}</span>
								{#if pick}
									<span
										class="anim-pop grid h-14 w-14 place-items-center rounded-full border-2 border-border bg-surface-alt"
									>
										<TokenIcon symbol={pick.symbol} size={40} />
									</span>
									<span class="font-display text-lg leading-none font-extrabold"
										>{pick.symbol.toUpperCase()}</span
									>
									<span class="m-chg {(t?.change24h ?? 0) >= 0 ? 'up' : 'down'}"
										>{fmtChg(t?.change24h ?? null)}</span
									>
								{:else}
									<span
										class="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border bg-surface-alt text-2xl {isActive
											? 'anim-blink'
											: ''}">+</span
									>
									<span class="text-sm font-bold">{isActive ? 'Picking…' : 'Empty'}</span>
									<span class="m-num text-[11px] text-text-muted"
										>{sectorChg == null ? 'sector —' : `sector ${fmtChg(sectorChg)}`}</span
									>
								{/if}
							</button>
							{#if activeBoosts.get(slot.sector)}
								<span
									class="m-tag absolute -end-2 -top-3 !min-h-6 rotate-3 bg-butter !px-2 !text-[10px]"
									>×1.25</span
								>
							{/if}
							{#if pick}
								<button
									type="button"
									onclick={() => removePick(slot.id)}
									aria-label="Remove {pick.symbol.toUpperCase()}"
									class="absolute -start-2 -top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 border-border bg-surface-alt text-xs font-bold"
									>✕</button
								>
							{/if}
						</div>
					{/each}
				</div>
			</section>

			<div
				class="mt-4 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-6 nav:[grid-template-columns:minmax(0,1fr)_21rem]"
			>
				<!-- ── The pool for the slot you're filling ───────────────────── -->
				<section id="token-pool" class="m-card scroll-mt-24" aria-labelledby="pool-title">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 id="pool-title" class="font-display text-xl font-extrabold">
								Pick your {activeSlotLabel} coin
							</h2>
							<p class="text-xs text-text-muted">
								{activeSector === 'wildcard' && !sectorRestriction
									? 'Wildcard takes any coin.'
									: 'Sorted by size. Tap a coin to drop it in.'}
							</p>
						</div>
						<input
							type="search"
							bind:value={search}
							placeholder="Search coins"
							aria-label="Search coins"
							class="h-11 w-full max-w-[14rem] rounded-[14px] border-2 border-border bg-surface-alt px-3 text-sm"
						/>
					</div>

					{#if filteredTokens.length === 0}
						<p class="dashed m-card mt-4 text-sm font-semibold">
							No coins match. Try another search, or another slot.
						</p>
					{:else}
						<ul
							class="mt-4 grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-2"
						>
							{#each filteredTokens as token (token.currency_id)}
								{@const inLineup = isInLineup(token.currency_id)}
								{@const isHighlighted = token.currency_id === highlightId}
								<li>
									<button
										type="button"
										onclick={() => addToken(token)}
										onmouseenter={(e) => openHover(e, token.currency_id, token.symbol ?? '')}
										onmouseleave={scheduleCloseHover}
										disabled={inLineup}
										class="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-2 border-border p-2.5 text-start text-text transition-transform enabled:hover:-translate-x-0.5 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[3px_3px_0_var(--color-ink)] disabled:cursor-default {inLineup
											? 'bg-brand-tint'
											: isHighlighted
												? 'bg-butter'
												: 'bg-surface-alt'}"
									>
										<TokenIcon symbol={token.symbol} size={36} />
										<span class="min-w-0 flex-1">
											<span class="block truncate text-sm font-extrabold"
												>{(token.symbol ?? '').toUpperCase()}</span
											>
											<span class="block truncate text-xs text-text-muted"
												>{token.name ?? ''} · {fmtPrice(token.price) || '—'}</span
											>
										</span>
										{#if inLineup}
											<span class="m-chg up">In ✓</span>
										{:else if token.change24h != null}
											<span class="m-chg {token.change24h >= 0 ? 'up' : 'down'}"
												>{fmtChg(token.change24h)}</span
											>
										{:else}
											<span class="m-chg" title="Price unavailable">—</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<!-- ── Your lineup, an item, and the lock ─────────────────────── -->
				<aside class="flex flex-col gap-4 nav:sticky nav:top-24">
					<section class="m-card" aria-labelledby="summary">
						<h2 id="summary" class="font-display text-lg font-extrabold">Your engine</h2>
						<div class="mt-3 flex gap-1" aria-hidden="true">
							{#each slots as slot (slot.id)}
								<span
									class="h-3.5 flex-1 rounded-full border-2 border-border"
									style="background:{pickForSlot(slot.id)
										? sectorTheme(slot.sector).color
										: 'transparent'}"
								></span>
							{/each}
						</div>
						<p class="mt-2 text-sm font-bold">{slotsFilledCount} of 5 coins picked</p>
						<div
							class="mt-3 flex items-baseline justify-between gap-2 border-t-2 border-border-soft pt-3"
						>
							<span class="text-xs text-text-muted">If today repeats itself</span>
							<span
								class="m-num text-lg font-bold {projectedScore >= 0
									? 'text-positive-ink'
									: 'text-negative-ink'}">{projectedScore >= 0 ? '+' : ''}{projectedScore}</span
							>
						</div>
					</section>

					{#if !lobbyId && lineup.length === 5}
						<ItemTray picks={lineup} bind:value={item} />
					{/if}

					<!-- Desktop lock. Phones get the bar below, always in reach. -->
					<div class="max-nav:hidden">
						<button
							type="button"
							onclick={submitLineup}
							disabled={submitting || slotsFilledCount < 5}
							class="m-btn primary lg block"
						>
							{submitting
								? 'Locking…'
								: slotsFilledCount < 5
									? `Pick ${5 - slotsFilledCount} more`
									: 'Lock in and race →'}
						</button>
						<p class="mt-2 text-center text-xs text-text-muted">
							Locked means locked: no swaps once the lights go out.
						</p>
					</div>
				</aside>
			</div>

			<!-- Phone lock bar: stable chrome above the tab bar, so the primary action
			     is never scrolled away. -->
			<div
				class="fixed inset-x-0 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] z-40 px-3 nav:hidden"
			>
				<div
					class="mx-auto flex max-w-md items-center gap-3 rounded-[18px] border-2 border-border bg-surface p-2 ps-4 shadow-[0_4px_0_var(--color-ink)]"
				>
					<span class="m-num text-sm font-bold">{slotsFilledCount}/5</span>
					<button
						type="button"
						onclick={submitLineup}
						disabled={submitting || slotsFilledCount < 5}
						class="m-btn primary flex-1"
					>
						{submitting
							? 'Locking…'
							: slotsFilledCount < 5
								? `Pick ${5 - slotsFilledCount} more`
								: 'Lock in and race →'}
					</button>
				</div>
			</div>
			<!-- Room for the lock bar so the last coins aren't hidden behind it. -->
			<div class="h-20 nav:hidden"></div>
		{/if}
	{/if}
</div>

{#if hoverToken}
	<TokenHover
		currencyId={hoverToken.currencyId}
		symbol={hoverToken.symbol}
		anchor={hoverRect}
		onenter={cancelCloseHover}
		onleave={scheduleCloseHover}
	/>
{/if}

<Toast />
{#if !sectorRestriction}
	<DraftAgent {emptySectors} {isPaper} onPicks={applyAgentPicks} />
{/if}
