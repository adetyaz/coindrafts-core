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
	};
	type Side = {
		userId: string;
		name: string | null;
		car: { model: string; rarity: string } | null;
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

	function liveTotal(side: Side): number {
		if (!side) return 0;
		return side.picks.reduce((sum, p) => {
			const now = livePrices[p.symbol.toUpperCase()] ?? p.currentPrice;
			return sum + (p.entryPrice > 0 ? ((now - p.entryPrice) / p.entryPrice) * 100 : 0);
		}, 0);
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
				color: 'var(--color-primary)',
				pct: liveTotal(live.me),
				isMe: true
			},
			live?.opponent && {
				id: live.opponent.userId,
				name: live.opponent.name ?? 'Opponent',
				color: 'var(--color-blue)',
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

<div class="mx-auto max-w-[1100px] px-7 pt-7 pb-18">
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
		<div class="mb-4.5 flex flex-wrap items-end justify-between gap-5">
			<div>
				<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
					Live · {live?.me?.name ?? 'You'} vs {live?.opponent?.name ?? 'Opponent'}
				</div>
				<h1 class="mt-2 text-[40px] leading-none font-black tracking-[-0.04em] max-sm:text-[28px]">
					{clock} left
				</h1>
			</div>
			<div class="flex gap-7">
				<div>
					<div
						class="font-mono text-[28px] leading-none font-bold"
						style="color:{(live?.me?.totalPct ?? 0) >= 0
							? 'var(--color-mint-ink)'
							: 'var(--color-red-ink)'}"
					>
						{(live?.me?.totalPct ?? 0) >= 0 ? '+' : ''}{(live?.me?.totalPct ?? 0).toFixed(2)}%
					</div>
					<div class="mt-1.5 text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase">
						You
					</div>
				</div>
				<div>
					<div
						class="font-mono text-[28px] leading-none font-bold opacity-70"
						style="color:{(live?.opponent?.totalPct ?? 0) >= 0
							? 'var(--color-mint-ink)'
							: 'var(--color-red-ink)'}"
					>
						{(live?.opponent?.totalPct ?? 0) >= 0 ? '+' : ''}{(
							live?.opponent?.totalPct ?? 0
						).toFixed(2)}%
					</div>
					<div class="mt-1.5 text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase">
						{live?.opponent?.name ?? 'Opponent'}
					</div>
				</div>
			</div>
		</div>

		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<div class="flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
				{#each [['race', 'Race'], ['chart', 'Chart']] as [mode, label] (mode)}
					<button
						type="button"
						onclick={() => (view = mode as 'race' | 'chart')}
						class="cursor-pointer rounded-full border-none px-4 py-1.5 text-xs font-extrabold transition {view ===
						mode
							? 'bg-text text-surface'
							: 'bg-transparent text-text-muted'}">{label}</button
					>
				{/each}
			</div>
			{#if live?.rival}
				<div class="flex items-center gap-1 text-[11px] font-bold text-text-muted">
					Bot chat
					{#each [['on', 'On'], ['quiet', 'Quiet'], ['off', 'Off']] as [mode, label] (mode)}
						<button
							type="button"
							onclick={() => setBotChat(mode as 'on' | 'quiet' | 'off')}
							class="cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-extrabold {botChat ===
							mode
								? 'border-text bg-text text-surface'
								: 'border-border bg-transparent text-text-muted'}">{label}</button
						>
					{/each}
				</div>
			{/if}
		</div>

		{#if view === 'race'}
			<p class="mb-2 text-xs font-bold text-text-muted">
				{circuit.name}, {circuit.place} · {circuit.lengthKm} km · {circuit.character}
			</p>
			{#if live?.stakeId}
				<div class="mb-3"><StakeCommit stakeId={live.stakeId} /></div>
			{/if}
			<div class="relative">
				{#key circuit.id}
					<RaceTrack3D
						circuit={circuit.id}
						cars={raceCars}
						{holding}
						finished={msRemaining <= 0}
						{onOvertake}
						onUnsupported={() => (view = 'chart')}
					/>
				{/key}

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
				<div class="mt-3 flex flex-col gap-1 px-1">
					{#each commentary as line, i (line + i)}
						<p class="text-sm font-extrabold" style="opacity:{1 - i * 0.3}">📣 {line}</p>
					{/each}
				</div>
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

		<div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[11px] text-text-muted">
			<span
				><span
					class="mr-1.5 inline-block h-0.5 w-5 align-middle"
					style="background:var(--color-text)"
				></span>Solid = your picks</span
			>
			<span
				><span
					class="mr-1.5 inline-block h-0.5 w-5 align-middle opacity-45"
					style="background:var(--color-text)"
				></span>Dashed = opponent</span
			>
			{#if leader}
				<span class="font-bold text-text"
					>Leading: {leader.pick.symbol.toUpperCase()} ({lastVal(leader.key) >= 0
						? '+'
						: ''}{lastVal(leader.key).toFixed(2)}%)</span
				>
			{/if}
		</div>

		<div class="mt-4.5 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
			{#each racers as r (r.key)}
				{@const th = sectorTheme(r.pick.sector)}
				{@const v = lastVal(r.key)}
				<div
					class="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5"
					style={r.mine ? '' : 'opacity:0.7'}
				>
					<TokenIcon symbol={r.pick.symbol} size={30} bg={th.color} fg="var(--color-ink)" />
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-extrabold">{r.pick.symbol.toUpperCase()}</div>
						<div
							class="text-[10px] font-extrabold tracking-[0.1em] uppercase"
							style="color:{th.ink}"
						>
							{r.mine ? 'You' : (live?.opponent?.name ?? 'Opponent')} · {th.label}
						</div>
					</div>
					<span
						class="font-mono text-sm font-bold"
						style="color:{v >= 0 ? 'var(--color-mint-ink)' : 'var(--color-red-ink)'}"
						>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span
					>
				</div>
			{/each}
		</div>

		<p class="mt-5 text-center text-[12px] text-text-muted">
			Prices are sampled every {SAMPLE_SECONDS}s and stored, so the race survives a refresh and both
			players see the same line. Results are always scored from locked entry prices, never from this
			graph.
		</p>
	{/if}
</div>

<Toast />
