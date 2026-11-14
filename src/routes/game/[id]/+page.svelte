<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { sectorTheme } from '$lib/sectorTheme';
	import TokenIcon from '$lib/components/TokenIcon.svelte';
	import RaceChart from '$lib/components/RaceChart.svelte';
	import StakeCommit from '$lib/components/StakeCommit.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import RaceTrack3D, { type RaceCar } from '$lib/components/race/RaceTrack3D.svelte';
	import { streamPrices } from '$lib/race/priceStream';
	import { paintColor } from '$lib/economy/rules';
	import { ITEMS, SPARE_WINDOW, itemFactors, type LineupItem } from '$lib/race/items';
	import { binaryPace, callRight, isBinaryMode } from '$lib/race/binary';
	import type { TrackAd } from '$lib/sponsors';
	import { TRACK_THEMES, trackThemeFor } from '$lib/race/trackTheme';
	import { circuitById, circuitForRace } from '$lib/race/circuits';
	import { rarityColor } from '$lib/economy/rarity';
	import {
		MOOD_LABEL,
		lineFor,
		personalityOf,
		type HeadToHead,
		type Mood
	} from '$lib/bots/personalities';

	type Pick = {
		sector: string;
		symbol: string;
		name: string;
		currencyId: string;
		entryPrice: number;
		currentPrice: number;
		pct: number;
		call?: 'up' | 'down' | null;
	};
	type Side = {
		userId: string;
		name: string | null;
		car: { model: string; rarity: string; look?: { paint?: string } | null } | null;
		item?: LineupItem | null;
		picks: Pick[];
		totalPct: number;
	} | null;
	type Live = {
		status: string;
		isPaper: boolean;
		durationMinutes: number | null;
		startAt: string | null;
		endAt: string | null;
		msRemaining: number | null;
		finished: boolean;
		me: Side;
		opponent: Side;
		stakeId?: string | null;
		circuit?: string | null;
		mode?: string | null;
		carRace?: boolean;
		ads?: TrackAd[];
		rival?: {
			username: string;
			tagline: string;
			mood: Mood;
			record: HeadToHead;
		} | null;
		history: { at: string; prices: Record<string, number> }[];
	};

	const POLL_MS = 4000;
	const SAMPLE_SECONDS = 4;

	const contestId = page.params.id;
	let live = $state<Live | null>(null);
	// The circuit chosen in the race setup; older races fall back to one picked
	// from the race id.
	const circuit = $derived(
		live?.circuit ? circuitById(live.circuit) : circuitForRace(contestId ?? '')
	);
	let phase = $state<'loading' | 'waiting' | 'racing' | 'error'>('loading');
	let errorMessage = $state('');
	let msRemaining = $state(0);
	let leaving = false;

	// Rebuilt from server-stored samples on every poll, so the line survives a
	// refresh and both players see the same race. Each entry is one sampled
	// tick: a timestamp plus each pick's % move from its locked entry price.
	let series = $state<{ at: number; vals: Record<string, number> }[]>([]);

	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let tickTimer: ReturnType<typeof setInterval> | null = null;

	const clock = $derived.by(() => {
		const s = Math.max(0, Math.floor(msRemaining / 1000));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		return h > 0
			? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
			: `${m}:${String(sec).padStart(2, '0')}`;
	});

	function keyFor(side: 'me' | 'opp', symbol: string) {
		return `${side}:${symbol}`;
	}

	async function poll() {
		try {
			const res = await fetch(`/api/contest/${contestId}/live`);
			if (!res.ok) {
				if (res.status === 401) {
					window.location.href = '/?auth=required';
					return;
				}
				throw new Error('Could not load the game');
			}
			const data: Live = await res.json();
			live = data;
			msRemaining = data.msRemaining ?? 0;

			if (data.status === 'resolved' || data.finished) {
				// Watching the race: hold on the chequered flag while the cars roll to
				// a stop, then go to the result. Anywhere else, go straight there.
				if (phase === 'racing' && !leaving) {
					leaving = true;
					msRemaining = 0;
					// Long enough for the cars to stop and the podium to show.
					setTimeout(() => (window.location.href = `/contest/result?contestId=${contestId}`), 7000);
				} else if (phase !== 'racing') {
					window.location.href = `/contest/result?contestId=${contestId}`;
				}
				return;
			}

			// Convert stored prices into % moves against each pick's locked entry.
			// Entry prices live on the picks, so history only has to carry prices.
			const entryFor = new Map<string, { key: string; entry: number }>();
			for (const p of data.me?.picks ?? [])
				entryFor.set(p.currencyId, { key: keyFor('me', p.symbol), entry: p.entryPrice });
			for (const p of data.opponent?.picks ?? [])
				entryFor.set(p.currencyId, { key: keyFor('opp', p.symbol), entry: p.entryPrice });

			const rebuilt = (data.history ?? []).map((tick) => {
				const vals: Record<string, number> = {};
				for (const [currencyId, price] of Object.entries(tick.prices)) {
					const meta = entryFor.get(currencyId);
					if (!meta || meta.entry <= 0) continue;
					vals[meta.key] = ((price - meta.entry) / meta.entry) * 100;
				}
				return { at: new Date(tick.at).getTime(), vals };
			});

			// Always end on the freshest numbers, even if this tick wasn't stored
			// (writes are throttled, polls are not).
			const latest: Record<string, number> = {};
			for (const p of data.me?.picks ?? []) latest[keyFor('me', p.symbol)] = p.pct;
			for (const p of data.opponent?.picks ?? []) latest[keyFor('opp', p.symbol)] = p.pct;

			series = [...rebuilt, { at: Date.now(), vals: latest }].slice(-300);

			// Contest stays 'open' (no clock yet) until both sides have locked a
			// lineup — see the lineup endpoint. Keep polling in that state rather
			// than showing a countdown/race for an opponent who hasn't drafted.
			if (data.status === 'open') {
				phase = 'waiting';
			} else if (phase === 'loading' || phase === 'waiting') {
				// Straight to the track: before the start it shows the pre-race screen.
				phase = 'racing';
			}
		} catch (e) {
			if (phase === 'loading') {
				phase = 'error';
				errorMessage = e instanceof Error ? e.message : 'Could not load the game';
			}
			// Mid-race failures are ignored — the next tick retries rather than
			// tearing down a running race for one dropped poll.
		}
	}

	onMount(async () => {
		await poll();
		pollTimer = setInterval(poll, POLL_MS);
		tickTimer = setInterval(() => {
			msRemaining = Math.max(0, msRemaining - 1000);
		}, 1000);
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		if (tickTimer) clearInterval(tickTimer);
	});

	function lastVal(key: string) {
		return series.at(-1)?.vals[key] ?? 0;
	}

	const racers = $derived([
		...(live?.me?.picks ?? []).map((p) => ({
			key: keyFor('me', p.symbol),
			pick: p,
			mine: true
		})),
		...(live?.opponent?.picks ?? []).map((p) => ({
			key: keyFor('opp', p.symbol),
			pick: p,
			mine: false
		}))
	]);

	// One distinct color per TOKEN, not per sector — sector color collides the
	// moment both sides draft the same sector (both pick an L1, say), making
	// individual coins impossible to tell apart in a 10-line race. Assigned by
	// each symbol's position in the sorted unique list, so it's deterministic
	// across polls (same set of symbols always sorts the same way) and
	// collision-free up to 10 palette entries — the max a race ever has (5
	// picks × 2 sides).
	const RACE_PALETTE = [
		'#F78E79',
		'#5FA8D8',
		'#68C2A8',
		'#F7C978',
		'#B57EDC',
		'#E8709A',
		'#7EC8E3',
		'#A3D977',
		'#E2555A',
		'#4FBDBD'
	];
	const symbolColor = $derived.by(() => {
		const uniqueSymbols = [...new Set(racers.map((r) => r.pick.symbol.toUpperCase()))].sort();
		const map = new Map<string, string>();
		uniqueSymbols.forEach((sym, i) => map.set(sym, RACE_PALETTE[i % RACE_PALETTE.length]));
		return map;
	});

	// Shapes the race data for the chart component.
	const chartRacers = $derived(
		racers.map((r) => ({
			key: r.key,
			label: r.pick.symbol.toUpperCase(),
			sector: r.pick.sector,
			colour: symbolColor.get(r.pick.symbol.toUpperCase()) ?? sectorTheme(r.pick.sector).color,
			mine: r.mine
		}))
	);
	const chartTimestamps = $derived(series.map((s) => s.at));
	const chartValues = $derived(racers.map((r) => series.map((s) => s.vals[r.key] ?? 0)));

	const leader = $derived.by(() => {
		if (racers.length === 0) return null;
		return racers.reduce((a, b) => (lastVal(a.key) >= lastVal(b.key) ? a : b));
	});

	// ── 3D race ─────────────────────────────────────────────────────────────
	// The server poll stays the source of truth for scoring; per-second prices
	// from the browser stream only drive how the cars move between polls.
	let view = $state<'race' | 'chart'>('race');
	let livePrices = $state<Record<string, number>>({});
	let commentary = $state<string[]>([]);

	const streamSymbols = $derived(
		[...(live?.me?.picks ?? []), ...(live?.opponent?.picks ?? [])]
			.map((p) => p.symbol.toUpperCase())
			.sort()
			.join(',')
	);

	$effect(() => {
		if (phase !== 'racing' || !streamSymbols) return;
		return streamPrices(streamSymbols.split(','), (symbol, price) => {
			livePrices[symbol] = price;
		});
	});

	const binary = $derived(isBinaryMode(live?.mode));
	// The world this race runs in: a different place for each kind of race.
	const theme = $derived(
		trackThemeFor({ mode: live?.mode, isPaper: live?.isPaper, carRace: live?.carRace })
	);
	const priceNow = (p: Pick) => livePrices[p.symbol.toUpperCase()] ?? p.currentPrice;
	// Binary mode (F9): one gate per call, green while it's right.
	const myCalls = $derived(
		binary
			? (live?.me?.picks ?? []).map((p) =>
					priceNow(p) === p.entryPrice ? null : callRight(p.call, p.entryPrice, priceNow(p))
				)
			: undefined
	);

	function liveTotal(side: Side): number {
		if (!side) return 0;
		// Binary: pace follows how many calls are right right now.
		if (binary) {
			return binaryPace(
				side.picks.map((p) => ({
					call: p.call ?? null,
					entryPrice: p.entryPrice,
					currentPrice: priceNow(p)
				}))
			);
		}
		const moves = side.picks.map((p) => {
			const now = livePrices[p.symbol.toUpperCase()] ?? p.currentPrice;
			return {
				symbol: p.symbol,
				sector: p.sector,
				pct: p.entryPrice > 0 ? ((now - p.entryPrice) / p.entryPrice) * 100 : 0
			};
		});
		// Same item multipliers the server scores with ($lib/race/items).
		const factors = itemFactors(moves, side.item);
		return moves.reduce((sum, m, i) => sum + m.pct * factors[i], 0);
	}

	/** The pick pushing a side forward the most right now. */
	function topPick(side: Side): Pick | null {
		if (!side || side.picks.length === 0) return null;
		const move = (p: Pick) => {
			const now = livePrices[p.symbol.toUpperCase()] ?? p.currentPrice;
			return p.entryPrice > 0 ? (now - p.entryPrice) / p.entryPrice : 0;
		};
		return side.picks.reduce((a, b) => (move(a) >= move(b) ? a : b));
	}

	const raceCars = $derived<RaceCar[]>(
		[
			live?.me && {
				id: live.me.userId,
				name: live.me.name ?? 'You',
				color: paintColor(live.me.car?.look) ?? 'var(--color-primary)',
				pct: liveTotal(live.me),
				isMe: true
			},
			live?.opponent && {
				id: live.opponent.userId,
				name: live.opponent.name ?? 'Opponent',
				color: paintColor(live.opponent.car?.look) ?? 'var(--color-blue)',
				pct: liveTotal(live.opponent),
				isMe: false
			}
		].filter((c): c is RaceCar => Boolean(c))
	);

	function onOvertake(passer: RaceCar, passed: RaceCar) {
		const side = passer.isMe ? live?.me : live?.opponent;
		const pick = topPick(side ?? null)?.symbol.toUpperCase();
		const who = passer.isMe ? 'you' : passer.name;
		const line = pick
			? `${pick} pulls ${who} past ${passed.isMe ? 'you' : passed.name}!`
			: `${passer.isMe ? 'You overtake' : `${passer.name} overtakes`} ${passed.isMe ? 'you' : passed.name}!`;
		const lines = [line];

		// A bot opponent answers the overtake in its own voice. At most one line
		// every 20s, so it reacts rather than spams.
		const now = Date.now();
		if (live?.rival && botChat === 'on' && now - lastTaunt > 20_000) {
			lastTaunt = now;
			const bot = personalityOf(live.rival.username);
			const taunt = lineFor(bot, live.rival.mood, passer.isMe ? 'youPass' : 'passesYou', {
				you: live.me?.name ?? 'you',
				coin: pick,
				record: live.rival.record
			});
			lines.push(`${live.rival.username}: “${taunt}”`);
		}
		commentary = [...lines.reverse(), ...commentary].slice(0, 4);
	}

	// ── Bot opponent ─────────────────────────────────────────────────────────
	// Bot chat: on (grid, overtakes, result) · quiet (grid and result only) · off.
	let botChat = $state<'on' | 'quiet' | 'off'>('on');
	let lastTaunt = 0;
	let gridLine = $state<string | null>(null);

	onMount(() => {
		try {
			const saved = localStorage.getItem('botChat');
			if (saved === 'on' || saved === 'quiet' || saved === 'off') botChat = saved;
		} catch {
			// Storage blocked: keep the default.
		}
	});

	function setBotChat(mode: 'on' | 'quiet' | 'off') {
		botChat = mode;
		try {
			localStorage.setItem('botChat', mode);
		} catch {
			// Storage blocked: the choice lasts for this visit.
		}
	}

	// Picked once per visit, so the line doesn't change on every poll.
	$effect(() => {
		if (live?.rival && gridLine === null) {
			gridLine = lineFor(personalityOf(live.rival.username), live.rival.mood, 'grid', {
				you: live.me?.name ?? 'you',
				record: live.rival.record
			});
		}
	});

	// ── Pre-race (GAMEPLAY_FLOWS.md, F2 step 6) ──────────────────────────────
	// The race starts a few seconds after both lineups lock. Until then the cars
	// wait on the grid under the pre-race screen; the start lights count the
	// last three seconds and the cars go at the exact start.
	let now = $state(Date.now());
	let preRaceSkipped = $state(false);
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 200);
		return () => clearInterval(t);
	});
	const startMs = $derived(live?.startAt ? new Date(live.startAt).getTime() : 0);
	const msToStart = $derived(Math.max(0, startMs - now));
	const holding = $derived(msToStart > 0);
	const showPreRace = $derived(holding && !preRaceSkipped);
	const lightsOn = $derived(msToStart > 3000 ? 0 : Math.min(3, 3 - Math.floor(msToStart / 1000)));
	const justStarted = $derived(startMs > 0 && now >= startMs && now - startMs < 1200);

	// ── Spare Tyre (F8): swap one coin in the first 10% of the race ─────────
	let swapFrom = $state<string | null>(null);
	let swapOptions = $state<{ symbol: string; name: string; currencyId: string }[]>([]);
	let swapping = $state(false);
	const spareOpenUntil = $derived(
		live?.startAt && live.durationMinutes
			? new Date(live.startAt).getTime() + live.durationMinutes * 60_000 * SPARE_WINDOW
			: 0
	);
	const canSwap = $derived(
		live?.me?.item?.kind === 'spare' && !live.me.item.used && now >= startMs && now < spareOpenUntil
	);

	async function openSwap(symbol: string, sector: string) {
		swapFrom = symbol;
		swapOptions = [];
		const res = await fetch(`/api/tokens?sector=${encodeURIComponent(sector)}`).catch(() => null);
		if (!res?.ok) return;
		const all: { symbol?: string; name?: string; currency_id?: string; currencyId?: string }[] =
			await res.json();
		const inLineup = new Set((live?.me?.picks ?? []).map((p) => p.symbol.toUpperCase()));
		swapOptions = all
			.filter((t) => t.symbol && !inLineup.has(t.symbol.toUpperCase()))
			.slice(0, 8)
			.map((t) => ({
				symbol: t.symbol!.toUpperCase(),
				name: t.name ?? t.symbol!,
				currencyId: String(t.currency_id ?? t.currencyId)
			}));
	}

	async function doSwap(to: { symbol: string; name: string; currencyId: string }) {
		if (!swapFrom) return;
		swapping = true;
		try {
			const res = await fetch(`/api/contest/${contestId}/swap`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ from: swapFrom, to })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Swap failed');
			commentary = [`🛞 Pit stop: ${swapFrom} out, ${to.symbol} in.`, ...commentary].slice(0, 6);
			swapFrom = null;
			await poll();
		} catch (e) {
			commentary = [e instanceof Error ? e.message : 'Swap failed', ...commentary].slice(0, 6);
		} finally {
			swapping = false;
		}
	}
	const TIPS = [
		"Every second, your coins' move speeds your car up or slows it down.",
		'The car in front is always the lineup up the most. Cars and tracks never change that.',
		'Tap Chase for the view from behind your car.',
		'Bots remember you. Beat one three times and see how it talks to you.',
		'Gears from this race go straight to your garage, recorded on NEAR.'
	];
	const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

	type GridDriver = {
		key: string;
		name: string;
		side: Side;
		isMe: boolean;
	};
	const gridDrivers = $derived<GridDriver[]>(
		[
			{ key: 'me', name: live?.me?.name ?? 'You', side: live?.me ?? null, isMe: true },
			{
				key: 'opp',
				name: live?.opponent?.name ?? 'Opponent',
				side: live?.opponent ?? null,
				isMe: false
			}
		].filter((d) => d.side)
	);

	function fmtPrice(p: number) {
		return p > 0 ? `${p < 1 ? p.toPrecision(3) : p.toFixed(2)}` : '—';
	}
</script>

<div class="m-page">
	{#if phase === 'loading'}
		<div class="h-64 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else if phase === 'waiting'}
		<div class="rounded-[24px] border border-border bg-surface p-11 text-center max-sm:p-6">
			<div class="anim-blink mx-auto h-2.5 w-2.5 rounded-full bg-primary"></div>
			<div class="mt-4 text-[28px] font-black tracking-[-0.03em]">Waiting for your opponent</div>
			<p class="mt-3 text-[15px] text-text-muted">
				Your lineup is locked in. The clock hasn't started — it only begins once
				{live?.opponent?.name ?? 'they'} lock theirs too, so neither of you loses draft time waiting on
				the other.
			</p>
		</div>
	{:else if phase === 'error'}
		<div class="rounded-[24px] border border-border bg-surface p-11 text-center">
			<div class="text-[28px] font-black tracking-[-0.03em]">Can't load this game</div>
			<p class="mt-3 text-[15px] text-text-muted">{errorMessage}</p>
			<a
				href="/dashboard"
				class="mt-6 inline-flex h-12 items-center rounded-full bg-primary px-8 text-sm font-extrabold text-text no-underline"
				>Back to dashboard</a
			>
		</div>

		<!-- ── RACE SCREEN ──────────────────────────────────────────────── -->
	{:else if phase === 'racing'}
		{@const mine = liveTotal(live?.me ?? null)}
		{@const theirs = liveTotal(live?.opponent ?? null)}
		{@const gap = mine - theirs}
		{@const rivalName = live?.opponent?.name ?? (binary ? 'The market' : 'Opponent')}
		{@const endMs = live?.endAt ? new Date(live.endAt).getTime() : 0}
		{@const progress =
			startMs && endMs > startMs
				? Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs)))
				: 0}
		<!-- The scoreboard: who's ahead, by how much, and how long is left. -->
		<section class="m-card mb-4 !p-4" aria-label="Race status">
			<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
				<div class="min-w-0">
					<h1 class="font-display text-[clamp(1.5rem,4.5vw,2.25rem)] leading-none font-extrabold">
						{#if holding}
							On the grid
						{:else if msRemaining <= 0}
							Chequered flag
						{:else if !live?.opponent}
							{binary ? `${Math.floor(mine)} of 5 calls right` : 'Racing'}
						{:else if Math.abs(gap) < 0.005}
							Neck and neck
						{:else if gap > 0}
							You lead
						{:else}
							{rivalName} leads
						{/if}
					</h1>
					{#if live?.opponent && !holding}
						<p class="mt-1 text-sm font-semibold text-text-body">
							{binary
								? `${Math.floor(mine)} right for you, ${Math.floor(theirs)} for ${rivalName}`
								: `by ${Math.abs(gap).toFixed(2)} points of market move`}
						</p>
					{/if}
				</div>
				<div class="text-end">
					<div class="m-num text-[clamp(1.5rem,4.5vw,2.25rem)] leading-none font-bold" role="timer">
						{clock}
					</div>
					<div class="m-eyebrow mt-1">left</div>
				</div>
			</div>

			<div
				class="mt-3 h-3.5 overflow-hidden rounded-full border-2 border-border bg-surface-alt"
				role="progressbar"
				aria-label="Race progress"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={Math.round(progress * 100)}
			>
				<div class="h-full bg-primary" style="width:{progress * 100}%"></div>
			</div>

			<div class="mt-3 grid grid-cols-2 gap-3">
				{#each [{ who: 'You', v: mine, me: true }, { who: rivalName, v: theirs, me: false }] as d (d.who)}
					<div
						class="flex items-center justify-between gap-2 rounded-[14px] border-2 border-border px-3 py-2 {d.me
							? 'bg-brand-tint'
							: 'bg-surface-alt'}"
					>
						<span class="truncate text-sm font-extrabold">{d.who}</span>
						<span
							class="m-num text-lg font-bold {d.v >= 0 ? 'text-positive-ink' : 'text-negative-ink'}"
							>{binary ? `${Math.floor(d.v)}/5` : `${d.v >= 0 ? '+' : ''}${d.v.toFixed(2)}%`}</span
						>
					</div>
				{/each}
			</div>
		</section>

		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div class="flex gap-1.5" role="group" aria-label="View">
				{#each [['race', '🏁 Race'], ['chart', '📈 Chart']] as [mode, label] (mode)}
					<button
						type="button"
						onclick={() => (view = mode as 'race' | 'chart')}
						aria-pressed={view === mode}
						class="m-chip">{label}</button
					>
				{/each}
			</div>
			{#if live?.rival}
				<div class="flex items-center gap-1.5 text-xs font-bold" role="group" aria-label="Bot chat">
					<span class="text-text-muted max-sm:hidden">Bot chat</span>
					{#each [['on', 'On'], ['quiet', 'Quiet'], ['off', 'Off']] as [mode, label] (mode)}
						<button
							type="button"
							onclick={() => setBotChat(mode as 'on' | 'quiet' | 'off')}
							aria-pressed={botChat === mode}
							class="m-chip !min-h-8 !px-3 !text-xs">{label}</button
						>
					{/each}
				</div>
			{/if}
		</div>

		{#if view === 'race'}
			<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
				<span class="m-plate"><span>{TRACK_THEMES[theme].label}</span></span>
				<p class="text-xs font-bold text-text-muted">
					{circuit.name}, {circuit.place} · {circuit.lengthKm} km · {circuit.character}
				</p>
			</div>
			{#if live?.stakeId}
				<div class="mb-3"><StakeCommit stakeId={live.stakeId} /></div>
			{/if}
			{#if canSwap}
				<div class="mb-3 rounded-2xl border border-border bg-surface p-3 text-sm">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<span class="font-black">🛞 Pit lane open</span>
						<span class="font-mono text-xs text-text-muted"
							>{Math.ceil((spareOpenUntil - now) / 1000)}s left to swap a coin</span
						>
					</div>
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each live?.me?.picks ?? [] as p (p.symbol)}
							<button
								type="button"
								onclick={() => openSwap(p.symbol.toUpperCase(), p.sector)}
								class="h-8 cursor-pointer rounded-full border px-3 text-xs font-bold {swapFrom ===
								p.symbol.toUpperCase()
									? 'border-text bg-text text-surface'
									: 'border-border bg-bg'}">{p.symbol.toUpperCase()} out</button
							>
						{/each}
					</div>
					{#if swapFrom}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each swapOptions as o (o.symbol)}
								<button
									type="button"
									disabled={swapping}
									onclick={() => doSwap(o)}
									class="h-8 cursor-pointer rounded-full border border-border bg-bg px-3 text-xs font-bold disabled:opacity-50"
									>{o.symbol} in</button
								>
							{:else}
								<span class="text-xs text-text-muted">Finding coins in that sector…</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			<div class="relative">
				{#key `${circuit.id}|${theme}`}
					<RaceTrack3D
						{theme}
						tall
						circuit={circuit.id}
						cars={raceCars}
						{holding}
						finished={msRemaining <= 0}
						{onOvertake}
						onUnsupported={() => (view = 'chart')}
						checkpoints={myCalls}
						ads={live?.ads ?? []}
					/>
				{/key}
				{#if binary && live?.me}
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each live.me.picks as p (p.symbol)}
							{@const right = callRight(p.call, p.entryPrice, priceNow(p))}
							<span
								class="rounded-full px-3 py-1 font-mono text-xs font-bold {right
									? 'bg-positive text-text'
									: 'bg-negative text-text'}"
								>{p.symbol.toUpperCase()} {p.call === 'up' ? '▲' : '▼'} {right ? '✓' : '✗'}</span
							>
						{/each}
					</div>
				{/if}

				{#if showPreRace}
					<!-- Pre-race: the grid before lights out -->
					<div
						class="absolute inset-0 flex flex-col justify-between rounded-[24px] bg-black/55 p-5 text-white max-sm:p-3"
					>
						<div class="flex items-start justify-between gap-3">
							<div>
								<div class="font-mono text-[11px] font-bold tracking-[0.14em] uppercase opacity-80">
									On the grid
								</div>
								<div class="text-2xl font-black">{circuit.name}</div>
								<div class="text-xs opacity-80">
									{circuit.place} · {circuit.lengthKm} km · {circuit.character}
								</div>
							</div>
							<button
								type="button"
								onclick={() => (preRaceSkipped = true)}
								class="cursor-pointer rounded-full border border-white/40 bg-transparent px-3 py-1 text-xs font-bold text-white"
								>Skip</button
							>
						</div>

						<div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
							{#each gridDrivers as d (d.key)}
								<div class="rounded-2xl bg-black/50 p-3">
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-black">{d.isMe ? 'You' : d.name}</span>
										{#if !d.isMe && live?.rival}
											<span
												class="rounded bg-white px-1.5 py-0.5 text-[9px] font-extrabold text-black"
												>BOT</span
											>
											<span class="text-[11px] opacity-80">{live.rival.tagline}</span>
										{/if}
									</div>
									{#if d.side?.car}
										<div class="mt-1 text-xs">
											{d.side.car.model}
											<span
												class="ml-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold text-black uppercase"
												style="background:{rarityColor(d.side.car.rarity)}"
												>{d.side.car.rarity}</span
											>
										</div>
									{/if}
									{#if d.side?.item}
										{@const it = d.side.item}
										<div class="mt-1 text-xs font-bold">
											{ITEMS[it.kind].icon}
											{ITEMS[it.kind].label}{it.sector
												? ` · ${it.sector.toUpperCase()}`
												: it.symbol
													? ` · ${it.symbol}`
													: ''}
										</div>
									{/if}
									<div class="mt-2 flex flex-wrap gap-1.5 font-mono text-[11px]">
										{#each d.side?.picks ?? [] as p (p.symbol)}
											<span class="rounded bg-white/15 px-1.5 py-0.5"
												>{p.symbol.toUpperCase()} {fmtPrice(p.currentPrice)}</span
											>
										{/each}
									</div>
									{#if !d.isMe && live?.rival}
										<div class="mt-2 text-[11px] opacity-80">
											{MOOD_LABEL[live.rival.mood]}{live.rival.record.races > 0
												? ` · you're ${live.rival.record.playerWins}–${live.rival.record.botWins}`
												: ''}
										</div>
										{#if gridLine && botChat !== 'off'}
											<p class="mt-1 text-sm font-bold">“{gridLine}”</p>
										{/if}
									{/if}
								</div>
							{/each}
						</div>

						<div>
							<div class="mb-2 flex justify-center gap-3" aria-label="Start lights">
								{#each [0, 1, 2] as i (i)}
									<span
										class="h-6 w-6 rounded-full border-2 border-white/60 transition {lightsOn > i
											? 'bg-red-500'
											: 'bg-transparent'}"
									></span>
								{/each}
							</div>
							<div class="h-1.5 overflow-hidden rounded-full bg-white/20">
								<div
									class="h-full bg-white transition-[width]"
									style="width:{Math.min(100, ((10000 - msToStart) / 10000) * 100)}%"
								></div>
							</div>
							<p class="mt-2 text-center text-xs opacity-80">
								Loading track… {tip}
							</p>
						</div>
					</div>
				{:else if justStarted}
					<div class="pointer-events-none absolute inset-0 grid place-items-center">
						<span class="rounded-full bg-black/60 px-6 py-2 text-3xl font-black text-white"
							>GO!</span
						>
					</div>
				{/if}

				{#if msRemaining <= 0}
					<!-- Podium -->
					<div class="absolute inset-x-0 top-14 flex justify-center">
						<div class="rounded-2xl bg-black/65 px-5 py-3 text-white">
							<div
								class="text-center font-mono text-[11px] font-bold tracking-[0.14em] uppercase opacity-80"
							>
								Podium
							</div>
							<ol class="mt-1 flex flex-col gap-1">
								{#each [...raceCars].sort((x, y) => y.pct - x.pct) as c, i (c.id)}
									<li class="flex items-center gap-3 text-sm font-bold">
										<span class="w-6 text-lg">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
										<span>{c.isMe ? 'You' : c.name}</span>
										<span class="ml-auto font-mono">{c.pct >= 0 ? '+' : ''}{c.pct.toFixed(2)}%</span
										>
									</li>
								{/each}
							</ol>
							<div class="mt-1 text-center text-[11px] opacity-80">Final prices coming in…</div>
						</div>
					</div>
				{/if}
			</div>
			{#if commentary.length > 0}
				<ul class="mt-3 flex flex-col items-start gap-1.5" aria-live="polite">
					{#each commentary.slice(0, 3) as line, i (line + i)}
						<li
							class="m-tag !min-h-9 !py-1.5 !whitespace-normal {i === 0
								? 'anim-pop bg-butter'
								: ''}"
							style="opacity:{1 - i * 0.3}"
						>
							{line}
						</li>
					{/each}
				</ul>
			{/if}
		{:else if series.length < 2}
			<div
				class="grid h-[380px] place-items-center rounded-[24px] border border-border bg-surface text-center"
			>
				<div>
					<p class="text-sm font-bold text-text">Waiting for the first ticks…</p>
					<p class="mt-2 text-[13px] text-text-muted">
						Prices are sampled every {SAMPLE_SECONDS}s. The race draws itself as they arrive.
					</p>
				</div>
			</div>
		{:else}
			<RaceChart racers={chartRacers} timestamps={chartTimestamps} values={chartValues} />
		{/if}

		<!-- The two engines, side by side: what each car is running on. -->
		<div
			class="mt-6 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-4"
		>
			{#each [{ title: binary ? 'Your calls' : 'Your engine', mine: true }, { title: `${live?.opponent?.name ?? 'Opponent'}'s ${binary ? 'calls' : 'engine'}`, mine: false }] as side (side.title)}
				{@const list = racers.filter((r) => r.mine === side.mine)}
				{#if list.length}
					<section class="m-card !p-4">
						<h2 class="font-display text-lg font-extrabold">{side.title}</h2>
						<ul class="mt-3 flex flex-col gap-2">
							{#each list as r (r.key)}
								{@const th = sectorTheme(r.pick.sector)}
								{@const v = lastVal(r.key)}
								<li class="flex items-center gap-3">
									<TokenIcon symbol={r.pick.symbol} size={30} bg={th.color} fg="var(--color-ink)" />
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-extrabold"
											>{r.pick.symbol.toUpperCase()}{r.pick.call
												? r.pick.call === 'up'
													? ' ▲'
													: ' ▼'
												: ''}</span
										>
										<span class="block text-[11px] font-bold" style="color:{th.ink}"
											>{th.label}</span
										>
									</span>
									<span class="m-chg {v >= 0 ? 'up' : 'down'}"
										>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span
									>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/each}
		</div>
		{#if leader}
			<p class="mt-3 text-sm font-bold">
				Fastest coin on track: {leader.pick.symbol.toUpperCase()} ({lastVal(leader.key) >= 0
					? '+'
					: ''}{lastVal(leader.key).toFixed(2)}%)
			</p>
		{/if}

		<p class="mt-4 text-xs text-text-muted">
			Prices are sampled every {SAMPLE_SECONDS}s and stored, so the race survives a refresh and both
			drivers see the same thing. Results are always scored from the prices locked at the start.
		</p>
	{/if}
</div>

<Toast />
