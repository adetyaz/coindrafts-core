<script lang="ts">
	// Landing (GAMEPLAY_FLOWS.md, F1): a live race in the hero, "Run your game"
	// (what's racing and what's being drafted right now), and "Back your takes"
	// (the three ways to race). Structure and mechanics only — the visual design
	// is being replaced, so this sticks to existing tokens.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { appKit } from '$lib/appkit';
	import { classifySector } from '$lib/sectors';
	import { SECTOR_LIST, sectorTheme } from '$lib/sectorTheme';
	import { PERSONALITIES, type DraftStyle } from '$lib/bots/personalities';
	import { CIRCUITS } from '$lib/race/circuits';
	import { streamPrices } from '$lib/race/priceStream';
	import RaceTrack3D, { type RaceCar } from '$lib/components/race/RaceTrack3D.svelte';
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';

	const appkitReady = Boolean(appKit);

	type Token = { symbol?: string; price?: number | null; change24h?: number | null };
	type LiveRace = {
		id: string;
		drivers: string[];
		vsBot: boolean;
		scrimmage: boolean;
		durationMinutes: number | null;
		msLeft: number | null;
		circuit: { id: string; name: string };
	};
	type HotCoin = {
		symbol: string;
		sector: string;
		drafts: number;
		price: number | null;
		change24h: number | null;
	};

	let stats = $state<{ players: number; liveContests: number } | null>(null);
	let tokens = $state<Token[]>([]);
	let liveRaces = $state<LiveRace[]>([]);
	let hotCoins = $state<HotCoin[]>([]);
	let updatedAt = $state<number | null>(null);
	let now = $state(Date.now());

	// ── Hero: a demo race between four bots ─────────────────────────────────
	// Each bot drafts one coin per sector its own way, from live prices. A car's
	// position is its lineup's real 24h move, nudged every second by Binance's
	// stream — so the race on the landing page is the real market, not a loop.
	const DEMO_DRIVERS = ['CryptoWhale_99', 'SatoshiKnight', 'DegenScout', 'ChartWizard']
		.map((u) => PERSONALITIES.find((p) => p.username === u))
		.filter((p): p is (typeof PERSONALITIES)[number] => Boolean(p));
	// Car paints (saturated), so the cars read against the grass.
	const DEMO_COLORS = [
		'var(--color-coral)',
		'var(--color-blue)',
		'var(--color-amber)',
		'var(--color-sky)'
	];
	const demoCircuit = CIRCUITS[Math.floor(Math.random() * CIRCUITS.length)];
	let live3d = $state(true);
	let livePrices = $state<Record<string, number>>({});

	function pickFor(style: DraftStyle, pool: Token[]): Token | undefined {
		const ch = (t: Token) => t.change24h ?? 0;
		const sorted = [...pool];
		if (style === 'momentum') sorted.sort((a, b) => ch(b) - ch(a));
		else if (style === 'contrarian') sorted.sort((a, b) => ch(a) - ch(b));
		else if (style === 'steady') sorted.sort((a, b) => Math.abs(ch(a)) - Math.abs(ch(b)));
		else if (style === 'volatile') sorted.sort((a, b) => Math.abs(ch(b)) - Math.abs(ch(a)));
		else return pool[Math.floor(Math.random() * pool.length)];
		return sorted[0];
	}

	const bySector = $derived.by(() => {
		const out: Record<string, Token[]> = {};
		for (const t of tokens) {
			if (!t.symbol || t.price == null || t.change24h == null) continue;
			(out[classifySector([t.symbol])] ??= []).push(t);
		}
		return out;
	});

	// Drafted once, when prices first arrive — a lineup doesn't change mid-race.
	let demoLineups = $state<{ name: string; color: string; picks: Token[] }[]>([]);
	$effect(() => {
		if (demoLineups.length || !tokens.length) return;
		demoLineups = DEMO_DRIVERS.map((p, i) => ({
			name: p.username,
			color: DEMO_COLORS[i % DEMO_COLORS.length],
			picks: SECTOR_LIST.map((s) => pickFor(p.draft, bySector[s.id] ?? [])).filter(
				(t): t is Token => Boolean(t)
			)
		})).filter((l) => l.picks.length > 0);
	});

	function movePct(t: Token): number {
		const symbol = (t.symbol ?? '').toUpperCase();
		const price = t.price ?? 0;
		const open = price / (1 + (t.change24h ?? 0) / 100);
		const nowPrice = livePrices[symbol] ?? price;
		return open > 0 ? (nowPrice / open - 1) * 100 : 0;
	}

	const demoCars = $derived<RaceCar[]>(
		demoLineups.map((l) => ({
			id: l.name,
			name: l.name,
			color: l.color,
			pct: l.picks.reduce((sum, t) => sum + movePct(t), 0) / l.picks.length,
			isMe: false
		}))
	);

	$effect(() => {
		const symbols = [...new Set(demoLineups.flatMap((l) => l.picks.map((t) => t.symbol ?? '')))];
		if (!symbols.length) return;
		return streamPrices(symbols, (symbol, price) => {
			livePrices[symbol] = price;
		});
	});

	// ── Run your game: live board ───────────────────────────────────────────
	let sectorTab = $state<string>('all');
	const shownCoins = $derived(
		sectorTab === 'all' ? hotCoins : hotCoins.filter((c) => c.sector === sectorTab)
	);
	// Fallback when nobody has drafted in the last day: the biggest movers.
	const movers = $derived(
		[...tokens]
			.filter((t) => t.symbol && t.change24h != null)
			.filter((t) => sectorTab === 'all' || classifySector([t.symbol!]) === sectorTab)
			.sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
			.slice(0, 12)
	);

	async function loadBoard() {
		try {
			const res = await fetch('/api/landing');
			if (!res.ok) return;
			const data = await res.json();
			liveRaces = data.liveRaces ?? [];
			hotCoins = data.hotCoins ?? [];
			updatedAt = Date.now();
		} catch {
			// Board keeps its last good state; the "updated" stamp ages honestly.
		}
	}

	// Everything on this page that reads as a fact is fetched. When a fetch
	// fails the figure renders as an em-dash — never an invented number.
	onMount(() => {
		(async () => {
			const [statsRes, tokensRes] = await Promise.allSettled([
				fetch('/api/stats'),
				fetch('/api/tokens')
			]);
			if (statsRes.status === 'fulfilled' && statsRes.value.ok) stats = await statsRes.value.json();
			if (tokensRes.status === 'fulfilled' && tokensRes.value.ok)
				tokens = await tokensRes.value.json();
		})();
		loadBoard();
		const board = setInterval(loadBoard, 30_000);
		const clock = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(board);
			clearInterval(clock);
		};
	});

	const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString());
	const pctFmt = (n: number | null | undefined) =>
		n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
	const priceFmt = (p: number | null | undefined) => {
		if (p == null) return '—';
		if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
		if (p >= 1) return `$${p.toFixed(2)}`;
		if (p >= 0.01) return `$${p.toFixed(3)}`;
		return `$${p.toPrecision(2)}`;
	};
	function timeLeft(race: LiveRace): string {
		if (race.msLeft == null || updatedAt == null) return '—';
		const ms = Math.max(0, race.msLeft - (now - updatedAt));
		const s = Math.floor(ms / 1000);
		if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left`;
		if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s left`;
		return s > 0 ? `${s}s left` : 'Finishing';
	}
	const lengthLabel = (m: number | null) =>
		m == null
			? ''
			: m >= 1440
				? `${Math.round(m / 1440)}-day`
				: m >= 60
					? `${m / 60}-hour`
					: `${m}-min`;
	const updatedLabel = $derived.by(() => {
		if (updatedAt == null) return 'Connecting…';
		const s = Math.floor((now - updatedAt) / 1000);
		return s < 10 ? 'updated just now' : `updated ${s}s ago`;
	});

	// ── Back your takes: the three ways to race ─────────────────────────────
	const MODES = [
		{
			id: 'scrimmage',
			label: 'Scrimmage',
			pitch: 'Practice against a bot. Nothing on the line.',
			steps: [
				['Pick a car and a circuit', 'Any car from your garage. The circuit is just for looks.'],
				['Draft five coins', 'One per sector. The coins you pick are your engine.'],
				['Race for 1 to 15 minutes', 'Live prices move the cars. Learn how the bots draft.']
			]
		},
		{
			id: 'versus',
			label: 'Versus',
			pitch: 'One opponent, one car each. Winner takes the Gears.',
			steps: [
				['Get matched', 'A real driver if someone is waiting, a bot with a grudge if not.'],
				['Lock your lineup', 'Picks freeze when the lights go out. No swaps.'],
				['Win Gears', 'Gears buy cars and upgrades in the Car Market.']
			]
		},
		{
			id: 'tournaments',
			label: 'Tournaments',
			pitch: 'Bigger grids, longer races, a podium.',
			steps: [
				['Enter a grid', '4, 6 or 8 drivers, or open lobbies anyone can join.'],
				['Race the clock', 'Everyone drafts the same window. Best lineup wins.'],
				['Finish on the podium', 'Rewards scale with your finishing place.']
			]
		}
	] as const;
	let modeTab = $state<(typeof MODES)[number]['id']>('scrimmage');
	const curMode = $derived(MODES.find((m) => m.id === modeTab) ?? MODES[0]);

	const FOOTER_COLS = [
		{
			title: 'Race',
			links: [
				{ label: 'Dashboard', href: '/dashboard' },
				{ label: 'Find a match', href: '/matchmaking' },
				{ label: 'Tournaments', href: '/tournament' }
			]
		},
		{
			title: 'Garage',
			links: [
				{ label: 'My garage', href: '/garage' },
				{ label: 'Car Market', href: '/car-market' },
				{ label: 'Leagues', href: '/leagues' }
			]
		},
		{
			title: 'Learn',
			links: [
				{ label: 'How to play', href: '/guide' },
				{ label: 'Leaderboard', href: '/leaderboard' },
				{ label: 'For sponsors', href: '/sponsor' }
			]
		}
	] as const;
</script>

<div>
	<!-- ── Hero: the sky, the grass, and a race that's really running ────── -->
	<section class="m-sky relative overflow-hidden">
		<div class="m-page !pb-0">
			<!-- Pinned tags: three facts, hanging off the nav -->
			<div class="flex flex-wrap gap-x-5 gap-y-2 ps-4 max-sm:hidden" aria-hidden="true">
				{#each [{ t: stats ? `${fmt(stats.liveContests)} races live` : 'Live market racing', c: 'bg-pink', dot: true }, { t: 'Free to start · no wallet', c: 'bg-butter' }, { t: 'Your car is yours, on NEAR', c: 'bg-sky-tint' }] as pin, i (pin.t)}
					<div
						class="anim-rise flex flex-col items-center"
						style="animation-delay:{0.3 + i * 0.1}s"
					>
						<span class="h-4 w-0.5 bg-text"></span>
						<span class="h-2 w-2 rounded-full bg-text"></span>
						<span class="m-tag {pin.c} {i % 2 ? 'rotate-[1.5deg]' : '-rotate-2'}">
							{#if pin.dot}<span
									class="anim-blink h-2 w-2 rounded-full border border-border bg-primary"
								></span>{/if}
							{pin.t}
						</span>
					</div>
				{/each}
			</div>

			<div
				class="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr))] items-center gap-x-12 gap-y-8 pt-10 pb-12 max-sm:pt-6"
			>
				<div class="flex flex-col gap-6">
					<div class="flex flex-col gap-3">
						<span class="m-eyebrow anim-rise">A racing game the market drives</span>
						<h1
							class="m-display anim-rise text-[clamp(3.25rem,9vw,6.5rem)]"
							style="animation-delay:.08s"
						>
							Draft coins.<br />Race them.
						</h1>
					</div>
					<p class="m-lead anim-rise" style="animation-delay:.16s">
						Pick five coins. They're your engine. Live prices push your car around real circuits,
						against bots with grudges and drivers like you.
					</p>

					<div class="anim-rise flex flex-wrap items-center gap-3" style="animation-delay:.24s">
						{#if page.data.user}
							<a href={resolve('/play')} class="m-btn primary lg">Go race →</a>
							<a href={resolve('/garage')} class="m-btn lg">My garage</a>
						{:else if appkitReady}
							<div class="*:h-14 *:rounded-[14px] *:px-7">
								<appkit-button label="Sign in to race"></appkit-button>
							</div>
							<a href={resolve('/guide')} class="m-btn lg">How it works</a>
						{:else}
							<button class="m-btn lg" disabled>Loading…</button>
						{/if}
					</div>
					{#if !page.data.user}
						<p class="text-sm font-semibold text-text-body">
							Email or Google. No wallet, no gas. Your first car is free.
						</p>
					{/if}
					{#if page.url.searchParams.get('auth') === 'required'}
						<p class="m-tag w-fit bg-pink" role="status">Sign in with email or Google to race.</p>
					{/if}
					{#if stats && stats.players > 0}
						<p class="text-sm text-text-body">
							<span class="m-num font-bold">{fmt(stats.players)}</span>
							{stats.players === 1 ? 'driver has' : 'drivers have'} joined
						</p>
					{/if}
				</div>

				<!-- The live demo race -->
				<div class="anim-rise min-w-0" style="animation-delay:.2s">
					<div class="m-card overflow-hidden !p-0">
						<div
							class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-butter px-4 py-2.5"
						>
							<span class="font-display text-sm font-extrabold tracking-[-0.01em]"
								>{demoCircuit.name} · {demoCircuit.place}</span
							>
							<span class="m-tag">
								<span class="anim-blink h-2 w-2 rounded-full border border-border bg-primary"
								></span>
								Live prices
							</span>
						</div>
						{#if demoCars.length >= 2 && live3d}
							<div class="[&>div]:rounded-none [&>div]:border-0">
								<RaceTrack3D
									cars={demoCars}
									circuit={demoCircuit.id}
									theme="meadow"
									onUnsupported={() => (live3d = false)}
								/>
							</div>
						{:else if demoCars.length >= 2}
							<ol class="flex flex-col gap-2 p-5">
								{#each [...demoCars].sort((a, b) => b.pct - a.pct) as car, i (car.id)}
									<li class="flex items-center gap-3 text-sm">
										<span class="m-num w-5 font-bold text-text-muted">{i + 1}</span>
										<span
											class="h-3.5 w-3.5 rounded-full border-2 border-border"
											style="background:{car.color}"
										></span>
										<span class="flex-1 font-bold">{car.name}</span>
										<span class="m-chg {car.pct >= 0 ? 'up' : 'down'}">{pctFmt(car.pct)}</span>
									</li>
								{/each}
							</ol>
						{:else}
							<div class="h-[440px] animate-pulse bg-surface-alt max-sm:h-[320px]"></div>
						{/if}
						<p class="border-t-2 border-border px-4 py-3 text-xs text-text-body">
							Four bots, each drafting its own way. Their positions are their coins' real moves
							today.
						</p>
					</div>
				</div>
			</div>
		</div>
		<div class="m-ground h-10"></div>
	</section>

	<!-- ── How it works: three steps ─────────────────────────────────── -->
	<section class="m-page !pt-14 !pb-4">
		<span class="m-eyebrow">How it works</span>
		<h2 class="m-title mt-2">Three steps, one race.</h2>
		<ol
			class="mt-6 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-5"
		>
			{#each [{ n: '1', c: 'bg-brand-tint', t: 'Pick a car and a track', d: 'Your first car is free. The circuits are real: Monza, Suzuka, Spa, Interlagos.' }, { n: '2', c: 'bg-butter', t: 'Draft five coins', d: 'One per sector. They are your engine: when they pump, you speed up.' }, { n: '3', c: 'bg-pink', t: 'Race, win Gears', d: 'Beat your rival to earn Gears. Spend them on cars, paint, and power-ups.' }] as s (s.n)}
				<li class="m-card flex flex-col gap-3">
					<span
						class="grid h-11 w-11 place-items-center rounded-full border-2 border-border font-display text-lg font-extrabold {s.c}"
						>{s.n}</span
					>
					<h3 class="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
						{s.t}
					</h3>
					<p class="text-[15px] text-text-body">{s.d}</p>
				</li>
			{/each}
		</ol>
	</section>

	<!-- ── Run your game: what's live right now ───────────────────────── -->
	<section class="m-page !pt-14 !pb-4">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<span class="m-eyebrow">Run your game</span>
				<h2 class="m-title mt-2">On track right now.</h2>
			</div>
			<span class="m-tag bg-surface">
				<span class="anim-blink h-2 w-2 rounded-full border border-border bg-primary"></span>
				Live · {updatedLabel}
			</span>
		</div>

		<h3 class="m-eyebrow mt-8 mb-2">Racing now</h3>
		{#if liveRaces.length}
			<div class="m-rail">
				{#each liveRaces as race (race.id)}
					<div class="flat m-card w-[15rem] !p-4">
						<div class="m-num text-[11px] font-bold text-text-muted uppercase">
							{race.circuit.name} · {lengthLabel(race.durationMinutes)}
						</div>
						<div class="mt-2 truncate font-display text-lg font-extrabold">
							{race.drivers[0] ?? '—'}
						</div>
						<div class="text-xs text-text-muted">vs</div>
						<div class="truncate font-display text-lg font-extrabold">
							{race.drivers[1] ?? 'a bot'}
						</div>
						<div class="mt-3 flex items-center justify-between gap-2 text-xs">
							<span class="m-num font-bold">{timeLeft(race)}</span>
							{#if race.scrimmage}
								<span class="m-chg up">Scrimmage</span>
							{:else if race.vsBot}
								<span class="m-chg">vs bot</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="dashed m-card text-sm font-semibold">
				{updatedAt == null ? 'Checking the track…' : 'The track is quiet. Be the first out.'}
			</div>
		{/if}

		<div class="mt-8 mb-2 flex flex-wrap items-center justify-between gap-3">
			<h3 class="m-eyebrow">
				{shownCoins.length ? 'Most drafted today' : 'Biggest movers today'}
			</h3>
			<div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Sector">
				<button
					type="button"
					role="tab"
					aria-selected={sectorTab === 'all'}
					onclick={() => (sectorTab = 'all')}
					class="m-chip">All</button
				>
				{#each SECTOR_LIST as s (s.id)}
					<button
						type="button"
						role="tab"
						aria-selected={sectorTab === s.id}
						onclick={() => (sectorTab = s.id)}
						class="m-chip">{s.label}</button
					>
				{/each}
			</div>
		</div>
		<div class="m-rail">
			{#if shownCoins.length}
				{#each shownCoins as coin (coin.symbol + coin.sector)}
					<div
						class="flat m-card flex w-[10.5rem] flex-col items-center gap-2 !p-4 text-center"
						style="background:{sectorTheme(coin.sector).color}"
					>
						<span class="m-eyebrow">{sectorTheme(coin.sector).label}</span>
						<span
							class="grid h-14 w-14 place-items-center rounded-full border-2 border-border bg-surface-alt font-display text-sm font-extrabold"
							>{coin.symbol}</span
						>
						<span class="m-num text-sm font-bold">{priceFmt(coin.price)}</span>
						<span class="m-chg {(coin.change24h ?? 0) >= 0 ? 'up' : 'down'}"
							>{pctFmt(coin.change24h)}</span
						>
						<span class="text-xs font-semibold"
							>In {coin.drafts} {coin.drafts === 1 ? 'lineup' : 'lineups'}</span
						>
					</div>
				{/each}
			{:else if movers.length}
				{#each movers as t (t.symbol)}
					{@const sec = classifySector([t.symbol ?? ''])}
					<div
						class="flat m-card flex w-[10.5rem] flex-col items-center gap-2 !p-4 text-center"
						style="background:{sectorTheme(sec).color}"
					>
						<span class="m-eyebrow">{sectorTheme(sec).label}</span>
						<span
							class="grid h-14 w-14 place-items-center rounded-full border-2 border-border bg-surface-alt font-display text-sm font-extrabold"
							>{t.symbol?.toUpperCase()}</span
						>
						<span class="m-num text-sm font-bold">{priceFmt(t.price)}</span>
						<span class="m-chg {(t.change24h ?? 0) >= 0 ? 'up' : 'down'}"
							>{pctFmt(t.change24h)}</span
						>
					</div>
				{/each}
			{:else}
				<div class="dashed m-card text-sm font-semibold">Prices are loading.</div>
			{/if}
		</div>
	</section>

	<!-- ── Back your takes: a different world for each kind of race ───── -->
	<section class="m-page !pt-14">
		<span class="m-eyebrow">Back your takes</span>
		<h2 class="m-title mt-2">Think SOL outruns ETH this hour? Find out.</h2>

		<div class="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Race mode">
			{#each MODES as m (m.id)}
				<button
					type="button"
					role="tab"
					aria-selected={modeTab === m.id}
					onclick={() => (modeTab = m.id)}
					class="m-chip !min-h-11 !px-5 !text-sm">{m.label}</button
				>
			{/each}
		</div>

		<div
			class="m-card mt-5 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-center gap-6"
		>
			<div class="max-w-md">
				<WorldThumb
					theme={modeTab === 'scrimmage' ? 'meadow' : modeTab === 'versus' ? 'golden' : 'village'}
				/>
			</div>
			<div>
				<p class="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em]">
					{curMode.pitch}
				</p>
				<ol class="mt-4 flex flex-col gap-3">
					{#each curMode.steps as [title, desc], i (title)}
						<li class="flex gap-3">
							<span
								class="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-border bg-butter font-display text-sm font-extrabold"
								>{i + 1}</span
							>
							<div>
								<div class="font-bold">{title}</div>
								<p class="text-sm text-text-body">{desc}</p>
							</div>
						</li>
					{/each}
				</ol>
				<div class="mt-5">
					{#if page.data.user}
						<a href={resolve('/play')} class="m-btn primary">Start a {curMode.label} race →</a>
					{:else if appkitReady}
						<div class="*:h-12 *:rounded-[14px] *:px-6">
							<appkit-button label="Sign in and get your free car"></appkit-button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<footer class="m-ground">
		<div class="m-page !pt-10 !pb-8">
			<div
				class="m-card grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-8"
			>
				<div class="[grid-column:span_2] max-sm:[grid-column:auto]">
					<div class="flex items-center gap-2.5">
						<span
							class="grid h-9 w-9 place-items-center rounded-xl border-2 border-border bg-primary"
							aria-hidden="true"
						>
							<svg width="18" height="18" viewBox="0 0 24 24"
								><path
									d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z"
									fill="var(--color-ink)"
								/></svg
							>
						</span>
						<span class="font-display text-xl font-extrabold tracking-[-0.04em]">coindraft</span>
					</div>
					<p class="mt-3 max-w-[36ch] text-sm text-text-body">
						Draft coins, race them on real circuits. Cars you own, recorded on NEAR.
					</p>
				</div>
				{#each FOOTER_COLS as col (col.title)}
					<div>
						<div class="m-eyebrow mb-3">{col.title}</div>
						<div class="flex flex-col gap-2">
							{#each col.links as link (link.href)}
								<a
									href={resolve(link.href)}
									class="text-sm font-semibold text-text no-underline hover:underline"
									>{link.label}</a
								>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<p class="m-num mt-5 text-center text-[11px] font-bold">
				© 2026 COINDRAFT · NOT INVESTMENT ADVICE
			</p>
		</div>
	</footer>
</div>
