<script lang="ts">
	// Race hub: every way to race on one screen, each explained in a line, with
	// the world it runs in. The phone tab bar's "Race" lands here.
	import { resolve } from '$app/paths';
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';
	import type { TrackTheme } from '$lib/race/trackTheme';

	type Mode = {
		href: '/scrimmage' | '/matchmaking' | '/binary' | '/car-race' | '/tournament' | '/leagues';
		name: string;
		theme: TrackTheme;
		paint: string;
		what: string;
		stakes: string;
		time: string;
		cta: string;
		tag?: string;
	};

	const RACE_NOW: Mode[] = [
		{
			href: '/scrimmage',
			name: 'Scrimmage',
			theme: 'meadow',
			paint: 'var(--color-coral)',
			what: 'Practice against a bot.',
			stakes: 'Nothing to lose. Small Gears either way.',
			time: '1–15 min',
			cta: 'Practice',
			tag: 'Start here'
		},
		{
			href: '/matchmaking',
			name: 'Versus',
			theme: 'golden',
			paint: 'var(--color-blue)',
			what: 'One rival. Your five coins against theirs.',
			stakes: 'Win ⚙️ 150 and XP. Your record follows you.',
			time: '5 min – 24 h',
			cta: 'Find a rival'
		},
		{
			href: '/binary',
			name: 'Binary',
			theme: 'neon',
			paint: 'var(--color-amber)',
			what: 'Call five coins up or down.',
			stakes: 'Three right beats the market. Each call lights a gate.',
			time: '5 min · 1 h · 24 h',
			cta: 'Make your calls'
		},
		{
			href: '/car-race',
			name: 'Car race',
			theme: 'night',
			paint: 'var(--color-red)',
			what: 'Stake a car against one of the same rarity.',
			stakes: 'Winner drives home in both.',
			time: '5–60 min',
			cta: 'Stake a car',
			tag: 'High stakes'
		}
	];

	const COMPETE: Mode[] = [
		{
			href: '/tournament',
			name: 'Tournaments',
			theme: 'village',
			paint: 'var(--color-mint)',
			what: 'A draw into groups of five, then a final.',
			stakes: 'Gears prizes for the podium. Daily and weekend cups.',
			time: 'Join any time before the draw',
			cta: 'See tournaments'
		},
		{
			href: '/leagues',
			name: 'League night',
			theme: 'village',
			paint: 'var(--color-sky)',
			what: 'Your league, your home track, every week.',
			stakes: 'A monthly champion takes the trophy.',
			time: 'Weekly',
			cta: 'See leagues'
		}
	];
</script>

{#snippet modeCard(m: Mode)}
	<!-- Phone: a compact row (postcard beside the words), so all the modes fit in a
	     couple of thumb-scrolls. Wider: a full card. -->
	<a
		href={resolve(m.href)}
		class="m-card grid gap-x-4 gap-y-3 text-text no-underline transition-transform hover:-translate-y-1 max-sm:grid-cols-[6.5rem_minmax(0,1fr)] max-sm:items-center max-sm:!p-3 sm:grid-rows-[auto_1fr_auto]"
	>
		<div class="relative max-sm:row-span-2 max-sm:self-start">
			<WorldThumb theme={m.theme} paint={m.paint} label={false} />
			{#if m.tag}
				<span class="m-tag absolute -end-1 -top-2 -rotate-2 bg-butter max-sm:hidden">{m.tag}</span>
			{/if}
		</div>
		<div class="flex min-w-0 flex-col gap-1">
			<h3 class="font-display text-2xl font-extrabold tracking-[-0.03em] max-sm:text-xl">
				{m.name}
			</h3>
			<p class="text-[15px] font-semibold max-sm:text-sm">{m.what}</p>
			<p class="text-sm text-text-muted max-sm:text-[13px]">{m.stakes}</p>
		</div>
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
			<span class="m-num text-xs text-text-muted">{m.time}</span>
			<span class="m-btn primary sm pointer-events-none">{m.cta} →</span>
		</div>
	</a>
{/snippet}

<div class="m-page">
	<header class="flex flex-col gap-2">
		<span class="m-eyebrow">Race</span>
		<h1 class="m-title">Pick how you race.</h1>
		<p class="m-lead">
			Every race works the same way: five coins are your engine, and live prices move your car. The
			mode decides who you're up against and what's on the line.
		</p>
	</header>

	<section class="mt-8" aria-labelledby="race-now">
		<h2 id="race-now" class="m-eyebrow mb-3">Race now</h2>
		<div class="grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,16.5rem),1fr))] gap-5">
			{#each RACE_NOW as m (m.href)}{@render modeCard(m)}{/each}
		</div>
	</section>

	<section class="mt-12" aria-labelledby="compete">
		<h2 id="compete" class="m-eyebrow mb-3">Compete</h2>
		<div class="grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,16.5rem),1fr))] gap-5">
			{#each COMPETE as m (m.href)}{@render modeCard(m)}{/each}
			<a
				href={resolve('/leaderboard')}
				class="ink m-card flex flex-col justify-between gap-6 no-underline transition-transform hover:-translate-y-1"
			>
				<div>
					<h3 class="font-display text-2xl font-extrabold tracking-[-0.03em] text-white">
						Leaderboard
					</h3>
					<p class="mt-1 text-sm text-white/70">
						The top 50 drivers by XP. Tap a name for their card.
					</p>
				</div>
				<span class="m-btn sm self-start">See the ladder →</span>
			</a>
		</div>
	</section>
</div>
