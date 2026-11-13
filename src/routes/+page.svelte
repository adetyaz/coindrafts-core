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
	const DEMO_COLORS = [
		'var(--color-sector-meme)',
		'var(--color-sector-l1)',
		'var(--color-sector-l2)',
		'var(--color-sector-defi)'
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
	<!-- ── Hero ─────────────────────────────────────────────────────────── -->
	<section class="dot-grid relative overflow-hidden bg-bg px-6 pt-16 pb-12 max-md:pt-10">
		<div class="relative mx-auto flex max-w-6xl flex-wrap items-center gap-12">
			<div class="min-w-0 flex-[1_1_380px]">
				<div
					class="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 font-mono text-[11px] font-bold tracking-[0.1em] text-text-muted uppercase"
				>
					<span class="anim-blink h-1.5 w-1.5 rounded-full bg-positive"></span>
					{stats ? `${fmt(stats.liveContests)} races live` : 'Live market racing'}
				</div>
				<h1
					class="text-[68px] leading-[0.9] font-black tracking-[-0.05em] max-lg:text-[52px] max-md:text-[38px]"
				>
					Draft coins.
				</h1>
				<h1
					class="text-[68px] leading-[0.9] font-black tracking-[-0.05em] text-primary-ink max-lg:text-[52px] max-md:text-[38px]"
				>
					Race them.
				</h1>
				<p class="mt-6 text-lg leading-relaxed text-text-muted max-md:text-base">
					Your five coins are your engine. Real prices move your car around real circuits, against
					bots with grudges and drivers like you. Your first car is free and it's yours, recorded on
					NEAR.
				</p>

				<div class="mt-8 flex flex-wrap items-center gap-3">
					{#if page.data.user}
						<a
							href={resolve('/dashboard')}
							class="inline-flex h-13 items-center rounded-full bg-primary px-8 text-sm font-extrabold text-text no-underline transition hover:-translate-y-0.5 hover:bg-primary-hover"
						>
							Go race &rarr;
						</a>
					{:else if appkitReady}
						<div class="*:h-13 *:rounded-full *:px-8">
							<appkit-button label="Sign in to race"></appkit-button>
						</div>
						<span class="text-xs text-text-muted">Email or Google. No wallet needed.</span>
					{:else}
						<button
							class="inline-flex h-13 cursor-not-allowed items-center rounded-full bg-primary/50 px-8 text-sm font-extrabold text-text/50"
							disabled>Loading…</button
						>
					{/if}
				</div>
				{#if page.url.searchParams.get('auth') === 'required'}
					<p class="mt-4 text-xs text-negative-ink">Sign in with email or Google to race.</p>
				{/if}
				{#if stats && stats.players > 0}
					<p class="mt-6 text-[13px] text-text-muted">
						{fmt(stats.players)}
						{stats.players === 1 ? 'driver has' : 'drivers have'} joined
					</p>
				{/if}
			</div>

			<div class="relative min-w-0 flex-[1_1_480px]">
				<div class="overflow-hidden rounded-3xl border border-border bg-surface">
					<div
						class="flex items-center justify-between gap-3 border-b border-border px-4 py-3 font-mono text-[11px] font-bold tracking-[0.08em] text-text-muted uppercase"
					>
						<span>{demoCircuit.name} · {demoCircuit.place}</span>
						<span class="flex items-center gap-1.5">
							<span class="anim-blink h-1.5 w-1.5 rounded-full bg-positive"></span>
							Live prices
						</span>
					</div>
					{#if demoCars.length >= 2 && live3d}
						<div class="aspect-[4/3] w-full">
							<RaceTrack3D
								cars={demoCars}
								circuit={demoCircuit.id}
								onUnsupported={() => (live3d = false)}
							/>
						</div>
					{:else if demoCars.length >= 2}
						<ol class="flex flex-col gap-2 p-5">
							{#each [...demoCars].sort((a, b) => b.pct - a.pct) as car, i (car.id)}
								<li class="flex items-center gap-3 text-sm">
									<span class="w-5 font-mono font-bold text-text-muted">{i + 1}</span>
									<span class="h-3 w-3 rounded-full" style="background:{car.color}"></span>
									<span class="flex-1 font-bold">{car.name}</span>
									<span class="font-mono">{pctFmt(car.pct)}</span>
								</li>
							{/each}
						</ol>
					{:else}
						<div class="aspect-[4/3] w-full animate-pulse bg-surface-alt"></div>
					{/if}
					<div class="border-t border-border px-4 py-3 text-xs text-text-muted">
						Four bots, each drafting its own way. Positions are their lineups' real moves today.
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ── Run your game ───────────────────────────────────────────────── -->
	<section class="bg-bg px-6 py-20 max-md:py-14">
		<div class="mx-auto max-w-6xl">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 class="text-[38px] font-black tracking-[-0.03em] max-md:text-[28px]">
						Run your game
					</h2>
					<p class="mt-2 max-w-[52ch] text-[15px] text-text-muted">
						What's on track right now, and the coins drivers are putting in their engines.
					</p>
				</div>
				<span
					class="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-[0.08em] text-text-muted uppercase"
				>
					<span class="anim-blink h-1.5 w-1.5 rounded-full bg-positive"></span>
					Live · {updatedLabel}
				</span>
			</div>

			<h3 class="mt-10 text-sm font-black tracking-[0.06em] uppercase">Racing now</h3>
			{#if liveRaces.length}
				<div class="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
					{#each liveRaces as race (race.id)}
						<div
							class="w-[240px] shrink-0 snap-start rounded-2xl border border-border bg-surface p-4"
						>
							<div class="font-mono text-[11px] font-bold text-text-muted uppercase">
								{race.circuit.name} · {lengthLabel(race.durationMinutes)}
							</div>
							<div class="mt-2 truncate font-black">{race.drivers[0] ?? '—'}</div>
							<div class="text-xs text-text-muted">vs</div>
							<div class="truncate font-black">{race.drivers[1] ?? 'a bot'}</div>
							<div class="mt-3 flex items-center justify-between text-xs">
								<span class="font-mono">{timeLeft(race)}</span>
								{#if race.scrimmage}
									<span class="rounded-full bg-surface-alt px-2 py-0.5 font-bold">Scrimmage</span>
								{:else if race.vsBot}
									<span class="rounded-full bg-surface-alt px-2 py-0.5 font-bold">vs bot</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mt-3 text-sm text-text-muted">
					{updatedAt == null ? 'Checking the track…' : 'The track is quiet. Be the first out.'}
				</p>
			{/if}

			<div class="mt-10 flex flex-wrap items-center justify-between gap-3">
				<h3 class="text-sm font-black tracking-[0.06em] uppercase">
					{shownCoins.length ? 'Most drafted today' : 'Biggest movers today'}
				</h3>
				<div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Sector">
					<button
						type="button"
						role="tab"
						aria-selected={sectorTab === 'all'}
						onclick={() => (sectorTab = 'all')}
						class="h-8 cursor-pointer rounded-full border border-border px-3 text-xs font-bold {sectorTab ===
						'all'
							? 'bg-text text-surface'
							: 'bg-surface text-text-muted'}">All</button
					>
					{#each SECTOR_LIST as s (s.id)}
						<button
							type="button"
							role="tab"
							aria-selected={sectorTab === s.id}
							onclick={() => (sectorTab = s.id)}
							class="h-8 cursor-pointer rounded-full border border-border px-3 text-xs font-bold {sectorTab ===
							s.id
								? 'bg-text text-surface'
								: 'bg-surface text-text-muted'}">{s.label}</button
						>
					{/each}
				</div>
			</div>
			<div class="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
				{#if shownCoins.length}
					{#each shownCoins as coin (coin.symbol + coin.sector)}
						<div
							class="w-[170px] shrink-0 snap-start rounded-2xl border border-border bg-surface p-4"
							style="border-top:4px solid {sectorTheme(coin.sector).color}"
						>
							<div class="text-lg font-black">{coin.symbol}</div>
							<div class="font-mono text-sm">{priceFmt(coin.price)}</div>
							<div
								class="font-mono text-sm font-bold {(coin.change24h ?? 0) >= 0
									? 'text-positive-ink'
									: 'text-negative-ink'}"
							>
								{pctFmt(coin.change24h)}
							</div>
							<div class="mt-2 text-xs text-text-muted">
								In {coin.drafts}
								{coin.drafts === 1 ? 'lineup' : 'lineups'}
							</div>
						</div>
					{/each}
				{:else if movers.length}
					{#each movers as t (t.symbol)}
						<div
							class="w-[170px] shrink-0 snap-start rounded-2xl border border-border bg-surface p-4"
							style="border-top:4px solid {sectorTheme(classifySector([t.symbol ?? ''])).color}"
						>
							<div class="text-lg font-black">{t.symbol?.toUpperCase()}</div>
							<div class="font-mono text-sm">{priceFmt(t.price)}</div>
							<div
								class="font-mono text-sm font-bold {(t.change24h ?? 0) >= 0
									? 'text-positive-ink'
									: 'text-negative-ink'}"
							>
								{pctFmt(t.change24h)}
							</div>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-text-muted">Prices are loading.</p>
				{/if}
			</div>
		</div>
	</section>

	<!-- ── Back your takes ─────────────────────────────────────────────── -->
	<section class="bg-surface px-6 py-20 max-md:py-14">
		<div class="mx-auto max-w-5xl">
			<h2 class="text-[38px] font-black tracking-[-0.03em] max-md:text-[28px]">Back your takes</h2>
			<p class="mt-2 max-w-[52ch] text-[15px] text-text-muted">
				Think SOL outruns ETH this hour? Put it in your engine and find out.
			</p>

			<div class="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Race mode">
				{#each MODES as m (m.id)}
					<button
						type="button"
						role="tab"
						aria-selected={modeTab === m.id}
						onclick={() => (modeTab = m.id)}
						class="h-10 cursor-pointer rounded-full border border-border px-5 text-sm font-extrabold {modeTab ===
						m.id
							? 'bg-text text-surface'
							: 'bg-bg text-text-muted'}">{m.label}</button
					>
				{/each}
			</div>

			<p class="mt-6 text-lg font-bold">{curMode.pitch}</p>
			<ol class="mt-5 grid gap-4 md:grid-cols-3">
				{#each curMode.steps as [title, desc], i (title)}
					<li class="rounded-2xl border border-border bg-bg p-5">
						<div class="font-mono text-xs font-bold text-text-muted">0{i + 1}</div>
						<div class="mt-2 font-black">{title}</div>
						<p class="mt-1.5 text-sm text-text-muted">{desc}</p>
					</li>
				{/each}
			</ol>

			<div class="mt-8">
				{#if page.data.user}
					<a
						href={resolve('/dashboard')}
						class="inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-extrabold text-text no-underline transition hover:bg-primary-hover"
						>Start a {curMode.label} race &rarr;</a
					>
				{:else if appkitReady}
					<div class="*:h-12 *:rounded-full *:px-7">
						<appkit-button label="Sign in and get your free car"></appkit-button>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<footer class="bg-bg px-6 pt-16 pb-8">
		<div class="mx-auto max-w-5xl">
			<div class="flex flex-wrap gap-8 border-b border-border pb-9">
				<div class="min-w-0 flex-[1_1_280px]">
					<div class="mb-3.5 flex items-center gap-2.5">
						<span class="relative h-6 w-6 shrink-0">
							<span class="absolute inset-0 rounded-md bg-primary" style="transform:rotate(45deg)"
							></span>
							<span
								class="absolute top-2 left-2 h-2 w-2 rounded-[2px] bg-text"
								style="transform:rotate(45deg)"
							></span>
						</span>
						<span class="text-lg font-black tracking-[-0.03em]">CoinDraft</span>
					</div>
					<p class="text-[13px] text-text-muted">
						Draft coins, race them on real circuits. Cars you own, recorded on NEAR.
					</p>
				</div>
				{#each FOOTER_COLS as col (col.title)}
					<div class="min-w-0 flex-[1_1_140px]">
						<div
							class="mb-3.5 text-[11px] font-extrabold tracking-[0.1em] text-text-muted uppercase"
						>
							{col.title}
						</div>
						<div class="flex flex-col gap-2.5">
							{#each col.links as link (link.href)}
								<a
									href={resolve(link.href)}
									class="text-[13px] text-text-muted no-underline transition hover:text-primary-ink"
									>{link.label}</a
								>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<div class="flex flex-wrap justify-between gap-3 pt-6">
				<span class="font-mono text-[11px] text-text-muted"
					>&copy; 2026 COINDRAFT &middot; NOT INVESTMENT ADVICE</span
				>
				<a
					href={resolve('/guide')}
					class="font-mono text-[11px] text-text-muted no-underline hover:text-primary-ink"
					>HOW IT WORKS &rarr;</a
				>
			</div>
		</div>
	</footer>
</div>
