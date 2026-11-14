<script lang="ts">
	// How to play: the racing game in plain words, in the order you meet it.
	import { resolve } from '$app/paths';
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';
	import { ITEMS, ITEM_KINDS, WEEKLY_ITEM_CAP } from '$lib/race/items';
	import type { TrackTheme } from '$lib/race/trackTheme';

	const STEPS = [
		{
			t: 'Sign in with email or Google',
			d: "No wallet, no seed phrase, no gas. Your first car and 500 Gears are waiting, and they're yours: the game records them on NEAR for you."
		},
		{
			t: 'Pick a car and a track',
			d: 'Cars and circuits are for show. Monza, Suzuka, Spa and Interlagos are traced from real track data.'
		},
		{
			t: 'Draft five coins',
			d: 'One per sector: L1, L2, DeFi, Meme and Wildcard. Those five coins are your engine.'
		},
		{
			t: 'Race on the market',
			d: 'Every second, your coins move your car. When they go up you speed up and overtake; when they dip you fall back.'
		},
		{
			t: 'Win Gears',
			d: 'Win and you earn Gears. Spend them on new cars, paint, number plates and power-ups.'
		}
	];

	const MODES: {
		name: string;
		theme: TrackTheme;
		href: '/scrimmage' | '/matchmaking' | '/binary' | '/car-race' | '/tournament' | '/leagues';
		d: string;
	}[] = [
		{
			name: 'Scrimmage',
			theme: 'meadow',
			href: '/scrimmage',
			d: 'Practice against a bot. Nothing to lose.'
		},
		{
			name: 'Versus',
			theme: 'golden',
			href: '/matchmaking',
			d: 'One real rival. Most market move wins.'
		},
		{
			name: 'Binary',
			theme: 'neon',
			href: '/binary',
			d: 'Call five coins up or down. Three right beats the market.'
		},
		{
			name: 'Car race',
			theme: 'night',
			href: '/car-race',
			d: 'Stake a car. Winner drives home in both.'
		},
		{
			name: 'Tournaments',
			theme: 'village',
			href: '/tournament',
			d: 'Groups of five, then a final, with Gears prizes.'
		},
		{
			name: 'League night',
			theme: 'village',
			href: '/leagues',
			d: 'Your league races every week; a champion every month.'
		}
	];

	const GEARS = [
		['Win a race', '+150'],
		['Finish a race', '+40'],
		['Practice win / finish', '+50 / +10'],
		['Weekly races', '×2'],
		['A new car (Showroom)', '300 – 7,000'],
		['Paint · decal · plate', '120 · 180 · 250'],
		['Sell now (to a bot)', '80% of the going rate']
	];

	const TERMS = [
		['Gears ⚙️', 'The in-game currency. Earned by racing, never bought with money.'],
		[
			'Sector',
			'A group of coins: L1 (base chains), L2 (scaling), DeFi, Meme, Wildcard (everything else).'
		],
		[
			'Going rate',
			"What a car of each rarity sells for right now. It moves with how many are for sale and how fast they're selling."
		],
		[
			'Rarity',
			'Common, Rare, Epic, Legendary. Rarer cars are scarcer in the Showroom; racing speed is the same.'
		],
		[
			'Bot mood',
			'Every bot remembers your head-to-head: stranger, cocky, afraid, a grudge, or respect.'
		],
		[
			'XP',
			'Experience from racing and trivia. It ranks you on the leaderboard and seeds tournament draws.'
		],
		[
			'On NEAR',
			'Your cars and Gears are recorded on the NEAR blockchain. The game signs and pays for you.'
		]
	];
</script>

<div class="m-page mid">
	<header>
		<span class="m-eyebrow">How to play</span>
		<h1 class="m-title mt-1">The market drives. You pick the engine.</h1>
		<p class="m-lead mt-2">Everything you need, in the order you'll meet it.</p>
	</header>

	<section class="mt-8" aria-labelledby="steps">
		<h2 id="steps" class="m-eyebrow mb-3">Your first race</h2>
		<ol class="flex flex-col gap-3">
			{#each STEPS as s, i (s.t)}
				<li class="flat m-card flex gap-4 !p-4">
					<span
						class="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-border bg-butter font-display text-lg font-extrabold"
						>{i + 1}</span
					>
					<span>
						<span class="block font-display text-lg font-extrabold">{s.t}</span>
						<span class="block text-[15px] text-text-body">{s.d}</span>
					</span>
				</li>
			{/each}
		</ol>
	</section>

	<section class="mt-10" aria-labelledby="modes">
		<h2 id="modes" class="m-eyebrow mb-3">Ways to race</h2>
		<p class="mb-4 text-sm text-text-body">
			Each kind of race runs in its own world, so you always know what you're in.
		</p>
		<div class="grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-4">
			{#each MODES as m (m.name)}
				<a
					href={resolve(m.href)}
					class="m-card flex flex-col gap-2 text-text no-underline transition-transform hover:-translate-y-1"
				>
					<WorldThumb theme={m.theme} label={false} />
					<span class="font-display text-lg font-extrabold">{m.name}</span>
					<span class="text-sm text-text-body">{m.d}</span>
				</a>
			{/each}
		</div>
	</section>

	<section
		class="mt-10 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-6"
	>
		<div class="m-card" aria-labelledby="items">
			<h2 id="items" class="font-display text-xl font-extrabold">Power-ups</h2>
			<p class="text-sm text-text-muted">
				One per race, up to {WEEKLY_ITEM_CAP} races a week. Chosen just before you lock.
			</p>
			<ul class="mt-3 flex flex-col gap-2">
				{#each ITEM_KINDS as k (k)}
					<li class="flex gap-3 rounded-[14px] border-2 border-border bg-surface-alt p-2.5">
						<span class="text-2xl" aria-hidden="true">{ITEMS[k].icon}</span>
						<span>
							<span class="block font-bold">{ITEMS[k].label}</span>
							<span class="block text-sm text-text-body">{ITEMS[k].does}</span>
						</span>
					</li>
				{/each}
			</ul>
			<p class="mt-3 text-xs text-text-muted">
				Won from daily trivia, or bought in the Garage for Gears.
			</p>
		</div>

		<div class="m-card" aria-labelledby="gears">
			<h2 id="gears" class="font-display text-xl font-extrabold">Gears ⚙️</h2>
			<p class="text-sm text-text-muted">What you earn, and what things cost.</p>
			<dl class="mt-3 flex flex-col gap-2">
				{#each GEARS as [what, n] (what)}
					<div class="flex items-center justify-between gap-3 border-b-2 border-border-soft pb-2">
						<dt class="text-sm font-semibold">{what}</dt>
						<dd class="m-num text-sm font-bold">{n}</dd>
					</div>
				{/each}
			</dl>
			<p class="mt-3 text-xs text-text-muted">
				Gears spent in the Showroom and on paint are gone for good.
			</p>
		</div>
	</section>

	<section class="m-card mt-10" aria-labelledby="terms">
		<h2 id="terms" class="font-display text-xl font-extrabold">Words you'll see</h2>
		<dl
			class="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-x-6 gap-y-3"
		>
			{#each TERMS as [term, def] (term)}
				<div>
					<dt class="font-bold">{term}</dt>
					<dd class="text-sm text-text-body">{def}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<div class="mt-8 flex flex-wrap gap-3">
		<a href={resolve('/play')} class="m-btn primary lg">Start racing →</a>
		<a href={resolve('/scrimmage')} class="m-btn lg">Practice first</a>
	</div>
</div>
