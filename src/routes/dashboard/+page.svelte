<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Trivia from '$lib/components/Trivia.svelte';
	import TokenIcon from '$lib/components/TokenIcon.svelte';
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';
	import { resolve } from '$app/paths';
	import { trackThemeFor, type TrackTheme } from '$lib/race/trackTheme';
	import type { BadgeDef } from '$lib/badges';

	let contests = $state<Array<Record<string, unknown>>>([]);
	let myLobbies = $state<Array<Record<string, unknown>>>([]);
	let badges = $state<(BadgeDef & { earned: boolean; earnedAt: string | null })[]>([]);
	let sectors = $state<Array<Record<string, unknown>>>([]);
	let alerts = $state<Array<Record<string, unknown>>>([]);
	let tokens = $state<
		{
			currency_id: string;
			symbol?: string;
			name?: string;
			price: number | null;
			change24h: number | null;
			rank: number | null;
		}[]
	>([]);
	let news = $state<{ title?: string; date?: string; source?: string; url?: string }[]>([]);
	let loading = $state(true);
	let actionError = $state('');

	const user = $derived(page.data.user);
	const resolvedContests = $derived(contests.filter((c) => c.status === 'resolved'));
	// Win rate is a competitive-skill number, so Scrimmage (bot-only, no real
	// stakes) is excluded here — the "resolved" count above stays inclusive,
	// since that's a general activity stat, not a skill claim (H-03).
	const realResolvedContests = $derived(resolvedContests.filter((c) => !c.isPaper));
	const winCount = $derived(realResolvedContests.filter((c) => c.winnerId === user?.id).length);
	const winRate = $derived(
		realResolvedContests.length > 0 ? Math.round((winCount / realResolvedContests.length) * 100) : 0
	);

	onMount(async () => {
		await Promise.all([
			loadContests(),
			loadMyLobbies(),
			loadSectors(),
			loadAlerts(),
			loadTokens(),
			loadNews(),
			loadBadges()
		]);
		loading = false;
	});

	async function loadMyLobbies() {
		try {
			const res = await fetch('/api/lobby/mine');
			if (res.ok) myLobbies = await res.json();
		} catch (error) {
			console.error('Failed to load active lobbies:', error);
		}
	}

	async function loadBadges() {
		try {
			const res = await fetch('/api/badges');
			if (res.ok) badges = await res.json();
		} catch (error) {
			console.error('Failed to load badges:', error);
		}
	}

	async function loadContests() {
		try {
			const res = await fetch('/api/contests');
			if (res.ok) contests = await res.json();
		} catch (error) {
			console.error('Failed to load contests:', error);
		}
	}

	async function loadSectors() {
		try {
			const res = await fetch('/api/sectors');
			if (res.ok) {
				const data = await res.json();
				sectors = Array.isArray(data) ? data.slice(0, 6) : [];
			}
		} catch (error) {
			console.error('Failed to load sectors:', error);
		}
	}

	async function loadAlerts() {
		try {
			const res = await fetch('/api/etf');
			if (res.ok) {
				const data = await res.json();
				alerts = data.alerts ?? [];
			}
		} catch (error) {
			console.error('Failed to load alerts:', error);
		}
	}

	async function loadTokens() {
		try {
			const res = await fetch('/api/tokens');
			if (res.ok) tokens = await res.json();
		} catch (error) {
			console.error('Failed to load tokens:', error);
		}
	}

	async function loadNews() {
		try {
			const res = await fetch('/api/news');
			if (res.ok) {
				const data = await res.json();
				news = Array.isArray(data) ? data.slice(0, 5) : [];
			}
		} catch (error) {
			console.error('Failed to load news:', error);
		}
	}

	async function createContest(
		type: 'daily' | 'weekly' = 'daily',
		mode: 'real' | 'paper' = 'real'
	) {
		actionError = '';
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, mode })
			});
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				if (res.status === 401) {
					window.location.href = '/?auth=required';
					return;
				}
				throw new Error(payload?.error ?? 'Failed to create contest');
			}
			const contest = await res.json();
			const modeParam = contest.isPaper ? '&mode=paper' : '';
			window.location.href = `/draft?contestId=${contest.id}&type=${contest.type}${modeParam}`;
		} catch (error) {
			actionError = (error as Error)?.message ?? 'Failed to create contest';
			console.error('Failed to create contest:', error);
		}
	}

	function formatPct(value: number) {
		const signed = value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
		return `${signed}%`;
	}

	function avatarBg(sym: string): string {
		const colors = [
			'var(--color-primary)',
			'var(--color-sector-l1)',
			'var(--color-sector-l2)',
			'var(--color-sector-defi)',
			'var(--color-sector-meme)',
			'var(--color-sector-wildcard)'
		];
		let h = 0;
		for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0;
		return colors[h % colors.length];
	}

	// ── What to do next ─────────────────────────────────────────────────────
	// The dashboard's one job: point at the race that needs you, or at starting one.
	type Row = {
		id: string;
		name: string;
		state: string;
		href: string;
		cta: string;
		primary: boolean;
	};

	const raceName = (c: Record<string, unknown>) =>
		c.mode === 'binary' || c.mode === 'binary_solo'
			? 'Binary race'
			: c.isPaper
				? 'Scrimmage'
				: c.type === 'weekly'
					? 'Weekly Versus'
					: 'Versus';

	const raceRows = $derived.by<Row[]>(() => {
		const rows: Row[] = [];
		for (const l of myLobbies) {
			rows.push({
				id: `l-${l.id}`,
				name: `${l.tournamentName ?? 'Tournament'} · ${l.tournamentStage === 1 ? 'Final' : 'Group'}`,
				state: l.myLineupLocked ? (l.status === 'live' ? 'Live' : 'Waiting') : 'Draft',
				href: l.myLineupLocked ? `/race/${l.id}` : `/draft?lobbyId=${l.id}`,
				cta: l.myLineupLocked ? 'Watch' : 'Draft now',
				primary: !l.myLineupLocked || l.status === 'live'
			});
		}
		const order = { open: 0, live: 1, resolved: 2 } as Record<string, number>;
		const sorted = [...contests].sort(
			(a, b) => (order[String(a.status)] ?? 3) - (order[String(b.status)] ?? 3)
		);
		for (const c of sorted) {
			const done = c.status === 'resolved';
			const locked = Boolean(c.myLineupLocked);
			rows.push({
				id: `c-${c.id}`,
				name: raceName(c),
				state: done
					? c.winnerId === user?.id
						? 'Won'
						: 'Finished'
					: locked
						? c.status === 'live'
							? 'Live'
							: 'Waiting'
						: 'Draft',
				href: done
					? `/contest/result?contestId=${c.id}`
					: locked
						? `/game/${c.id}`
						: `/draft?contestId=${c.id}&type=${c.type ?? 'daily'}${c.isPaper ? '&mode=paper' : ''}`,
				cta: done ? 'Result' : locked ? 'Watch' : 'Draft now',
				primary: !done
			});
		}
		return rows;
	});

	const nextRace = $derived.by<{
		title: string;
		body: string;
		href: string;
		cta: string;
		theme: TrackTheme;
	} | null>(() => {
		const row =
			raceRows.find((r) => r.state === 'Draft') ?? raceRows.find((r) => r.state === 'Live');
		if (!row) return null;
		const c = contests.find((x) => `c-${x.id}` === row.id);
		const theme = c
			? trackThemeFor({ mode: c.mode as string, isPaper: Boolean(c.isPaper) })
			: 'village';
		return row.state === 'Draft'
			? {
					title: `Your ${row.name} is waiting`,
					body: 'Pick your five coins and lock them in. The race starts once everyone has.',
					href: row.href,
					cta: 'Draft now',
					theme
				}
			: {
					title: `Your ${row.name} is live`,
					body: 'Your car is on track right now. Go and watch it.',
					href: row.href,
					cta: 'Watch the race',
					theme
				};
	});

	const hotTokens = $derived(
		[...tokens]
			.filter((t) => t.change24h != null)
			.sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
			.slice(0, 5)
	);
</script>

<div class="m-page">
	<!-- 1 · Your next move. One obvious action, sized to be the first thing you see. -->
	<section
		class="m-card grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-center gap-x-8 gap-y-5"
		aria-labelledby="next-move"
	>
		<div class="flex flex-col gap-3">
			<span class="m-eyebrow">Hi {user?.username ?? 'driver'}</span>
			{#if nextRace}
				<h1 id="next-move" class="m-title">{nextRace.title}</h1>
				<p class="m-lead">{nextRace.body}</p>
				<div class="flex flex-wrap gap-3">
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href={nextRace.href} class="m-btn primary lg">{nextRace.cta} →</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<a href={resolve('/play')} class="m-btn lg">Start another</a>
				</div>
			{:else}
				<h1 id="next-move" class="m-title">Ready to race?</h1>
				<p class="m-lead">
					Pick five coins, and live prices drive your car. A practice race takes a minute.
				</p>
				<div class="flex flex-wrap gap-3">
					<a href={resolve('/play')} class="m-btn primary lg">Choose a race →</a>
					<button type="button" class="m-btn lg" onclick={() => createContest('daily', 'paper')}
						>Quick practice</button
					>
				</div>
			{/if}
			{#if actionError}
				<p class="m-tag w-fit bg-pink" role="alert">{actionError}</p>
			{/if}
		</div>
		<div class="max-w-sm justify-self-end max-sm:hidden">
			<WorldThumb theme={nextRace?.theme ?? 'meadow'} />
		</div>
	</section>

	<!-- 2 · Where you stand -->
	<section class="mt-6 grid [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
		{#each [{ label: 'XP', value: (user?.xpTotal ?? 0).toLocaleString(), tone: 'bg-brand-tint' }, { label: 'Win streak', value: `${user?.streak ?? 0}`, tone: 'bg-butter' }, { label: 'Win rate', value: realResolvedContests.length ? `${winRate}%` : '—', tone: 'bg-lavender' }, { label: 'Races run', value: `${resolvedContests.length}`, tone: 'bg-sky-tint' }] as s (s.label)}
			<div class="flat m-card !p-4 {s.tone}">
				<div class="m-num text-3xl font-bold">{s.value}</div>
				<div class="m-eyebrow mt-1">{s.label}</div>
			</div>
		{/each}
	</section>

	<div
		class="mt-6 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))] items-start gap-6"
	>
		<!-- 3 · Daily trivia -->
		<Trivia />

		<!-- 4 · Your races -->
		<section class="m-card" aria-labelledby="your-races">
			<div class="flex items-center justify-between gap-3">
				<h2 id="your-races" class="font-display text-xl font-extrabold">Your races</h2>
				<a href={resolve('/play')} class="m-btn sm">New race</a>
			</div>
			{#if loading}
				<div class="mt-4 h-24 animate-pulse rounded-2xl bg-surface-alt"></div>
			{:else if raceRows.length === 0}
				<p class="mt-4 text-sm text-text-muted">No races yet. Your first one is a minute away.</p>
			{:else}
				<ul class="mt-3 flex flex-col gap-2">
					{#each raceRows.slice(0, 6) as r (r.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border-2 border-border bg-surface-alt px-3 py-2.5"
						>
							<span class="flex min-w-0 items-center gap-2">
								<span
									class="m-chg {r.state === 'Live' ? 'up' : ''} {r.state === 'Draft'
										? 'bg-butter'
										: ''}">{r.state}</span
								>
								<span class="truncate text-sm font-bold">{r.name}</span>
							</span>
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a href={r.href} class="m-btn sm {r.primary ? 'primary' : ''}">{r.cta}</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- 5 · The market today: what might be worth drafting -->
	<h2 class="m-eyebrow mt-10 mb-3">The market today</h2>
	<div
		class="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-6"
	>
		<section class="m-card" aria-labelledby="sectors">
			<h3 id="sectors" class="font-display text-lg font-extrabold">Sector form</h3>
			<p class="text-xs text-text-muted">How each sector has moved in 24 hours.</p>
			{#if loading}
				<div class="mt-4 h-28 animate-pulse rounded-2xl bg-surface-alt"></div>
			{:else if sectors.length === 0}
				<p class="mt-4 text-sm text-text-muted">Sector data is unavailable right now.</p>
			{:else}
				<ul class="mt-4 flex flex-col gap-2.5">
					{#each sectors as sector, i (sector?.sector ?? sector?.name ?? i)}
						{@const chg = Number(sector.change ?? 0)}
						<li class="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
							<span class="truncate text-xs font-bold"
								>{sector.sector ?? sector.name ?? 'Sector'}</span
							>
							<span
								class="h-3.5 overflow-hidden rounded-full border-2 border-border bg-surface-alt"
								aria-hidden="true"
							>
								<span
									class="block h-full {chg >= 0 ? 'bg-primary' : 'bg-negative'}"
									style="width:{Math.max(8, Math.min(100, Math.abs(chg) * 8))}%"
								></span>
							</span>
							<span class="m-chg {chg >= 0 ? 'up' : 'down'}">{formatPct(chg)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="m-card" aria-labelledby="hot">
			<h3 id="hot" class="font-display text-lg font-extrabold">Hot coins</h3>
			<p class="text-xs text-text-muted">The biggest movers in the draft pool.</p>
			{#if loading}
				<div class="mt-4 h-28 animate-pulse rounded-2xl bg-surface-alt"></div>
			{:else if tokens.length === 0}
				<p class="mt-4 text-sm text-text-muted">Prices are unavailable right now.</p>
			{:else}
				<ul class="mt-3 flex flex-col gap-2">
					{#each hotTokens as token (token.currency_id)}
						<li class="flex items-center gap-3">
							<TokenIcon symbol={token.symbol} size={32} bg={avatarBg(token.symbol ?? '')} />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-bold"
									>{(token.symbol ?? '').toUpperCase()}</span
								>
								<span class="block truncate text-xs text-text-muted">{token.name ?? ''}</span>
							</span>
							{#if token.change24h != null}
								<span class="m-chg {token.change24h >= 0 ? 'up' : 'down'}"
									>{formatPct(token.change24h)}</span
								>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="m-card" aria-labelledby="news">
			<h3 id="news" class="font-display text-lg font-extrabold">Headlines</h3>
			{#if alerts.length}
				<ul class="mt-3 flex flex-col gap-2">
					{#each alerts.slice(0, 2) as alert, i (alert?.date ?? i)}
						<li class="rounded-[14px] border-2 border-border bg-butter px-3 py-2 text-sm">
							<span class="font-bold">🐋 {alert.type} streak, {alert.streak} days</span>
							<span class="m-num block text-xs"
								>${Math.round(Number(alert.amount)).toLocaleString()} into BTC ETFs</span
							>
						</li>
					{/each}
				</ul>
			{/if}
			{#if loading}
				<div class="mt-4 h-28 animate-pulse rounded-2xl bg-surface-alt"></div>
			{:else if news.length === 0}
				<p class="mt-4 text-sm text-text-muted">No headlines right now.</p>
			{:else}
				<ul class="mt-3 flex flex-col gap-3">
					{#each news.slice(0, 4) as item, i (i)}
						<li>
							<p class="text-sm leading-snug font-bold">{item.title ?? 'Market update'}</p>
							<p class="text-xs text-text-muted">
								{item.source ?? 'SoSoValue'}{item.date ? ` · ${item.date}` : ''}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- 6 · Badges -->
	{#if badges.length}
		<h2 class="m-eyebrow mt-10 mb-3">
			Badges · {badges.filter((b) => b.earned).length} of {badges.length}
		</h2>
		<div class="m-rail">
			{#each badges as b (b.code)}
				<div
					class="flat m-card flex w-[9rem] flex-col items-center gap-1 !p-3 text-center {b.earned
						? ''
						: 'opacity-45'}"
					title={b.description}
				>
					<span class="text-2xl" aria-hidden="true">{b.emoji}</span>
					<span class="text-xs font-bold">{b.name}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
