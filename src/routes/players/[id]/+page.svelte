<script lang="ts">
	// A player's or a bot's card (GAMEPLAY_FLOWS.md, F6). Opened by tapping a
	// name anywhere. Players: showcased car, record, badges, your head-to-head,
	// Challenge. Bots: personality, racing style, garage and Gears, mood towards
	// you, and their recent Car Market moves with reasons.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import CarPreview from '$lib/components/garage/CarPreview.svelte';
	import { rarityColor } from '$lib/economy/rarity';
	import { MOOD_LABEL, type Mood } from '$lib/bots/personalities';
	import { sectorTheme } from '$lib/sectorTheme';

	type Card = {
		id: string;
		username: string;
		isBot: boolean;
		isMe: boolean;
		xp: number;
		stats: {
			races: number;
			wins: number;
			podiums: number;
			bestSector: { sector: string; avgPct: number } | null;
		};
		car: { model: string; rarity: string; look: Record<string, string> | null } | null;
		badges: { code: string; name: string; emoji: string; description: string }[];
		headToHead: { wins: number; losses: number } | null;
		bot: {
			tagline: string;
			draft: string;
			trade: { askMarkup: number; payTolerance: number };
			mood: Mood | null;
			gears: number;
			garage: { model: string; rarity: string }[];
			moves: {
				kind: string;
				price: number;
				reason: string | null;
				at: string | null;
				model: string;
			}[];
		} | null;
	};

	const STYLE: Record<string, string> = {
		momentum: 'Takes the coin pumping hardest in each sector',
		contrarian: 'Buys the dip: the coin down the most',
		steady: 'Picks the calmest coin in each sector',
		volatile: 'Picks the wildest coin, up or down',
		chaos: 'Anything goes'
	};
	const LENGTHS = [5, 15, 30, 60, 1440];

	let card = $state<Card | null>(null);
	let error = $state('');
	let challenging = $state(false);
	let minutes = $state(15);
	let message = $state('');
	let busy = $state(false);

	onMount(async () => {
		const res = await fetch(`/api/players/${encodeURIComponent(page.params.id ?? '')}`);
		const data = await res.json().catch(() => ({}));
		if (res.ok) card = data;
		else error = data.error ?? 'Player not found';
	});

	async function challenge() {
		if (!card) return;
		busy = true;
		try {
			const res = await fetch('/api/challenges', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ toUserId: card.id, durationMinutes: minutes, message })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? "Couldn't send the challenge");
			toast(`Challenge sent to ${card.username}`, 'success');
			challenging = false;
			message = '';
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			busy = false;
		}
	}

	const lengthLabel = (m: number) =>
		m >= 1440 ? '24 hours' : m >= 60 ? `${m / 60} hour` : `${m} min`;
</script>

<div class="m-page narrow">
	{#if !card}
		{#if error}<p class="text-sm text-negative-ink">{error}</p>{:else}<div
				class="h-64 animate-pulse rounded-[24px] bg-surface-alt"
			></div>{/if}
	{:else}
		<div class="m-card overflow-hidden !p-0">
			<div
				class="flex justify-center px-4 pt-6 [&>svg]:h-auto [&>svg]:w-[min(100%,16rem)] {card.isBot
					? 'bg-lavender'
					: 'm-sky'}"
			>
				<CarPreview look={card.car?.look ?? {}} model={card.car?.model} />
			</div>
			<div class="m-ground h-4"></div>
			<div class="flex flex-wrap items-end justify-between gap-3 px-5 pt-4">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="m-title">{card.username}</h1>
						{#if card.isBot}<span
								class="rounded-md border-2 border-border bg-lavender px-2 py-0.5 text-[10px] font-extrabold text-text"
								>BOT</span
							>{/if}
					</div>
					{#if card.bot}<p class="mt-1 text-sm font-semibold">“{card.bot.tagline}”</p>{/if}
				</div>
				<div class="text-end">
					<div class="m-num text-xl font-bold">{card.xp.toLocaleString()} XP</div>
					{#if card.car}
						<div class="text-sm font-bold">
							{card.car.model}
							<span
								class="ms-1 rounded-lg border-2 border-border px-2 py-0.5 text-[10px] font-extrabold uppercase"
								style="background:{rarityColor(card.car.rarity)}">{card.car.rarity}</span
							>
						</div>
					{/if}
				</div>
			</div>
			<div class="px-5 pb-5">
				<div class="mt-5 grid [grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
					{#each [['Races', card.stats.races], ['Wins', card.stats.wins], ['Podiums', card.stats.podiums]] as [label, n] (label)}
						<div class="rounded-2xl bg-bg p-3">
							<div class="font-mono text-2xl font-bold">{n}</div>
							<div class="m-eyebrow !text-[10px] text-text-muted">
								{label}
							</div>
						</div>
					{/each}
					<div class="rounded-2xl bg-bg p-3">
						<div class="text-lg font-black">
							{card.stats.bestSector ? sectorTheme(card.stats.bestSector.sector).label : '—'}
						</div>
						<div class="m-eyebrow !text-[10px] text-text-muted">Best sector</div>
					</div>
				</div>

				{#if card.badges.length}
					<div class="mt-4 flex flex-wrap gap-2">
						{#each card.badges as b (b.code)}
							<span class="rounded-full bg-bg px-3 py-1 text-sm font-bold" title={b.description}
								>{b.emoji} {b.name}</span
							>
						{/each}
					</div>
				{/if}

				{#if card.headToHead}
					<div class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg p-4">
						<div>
							<div class="m-eyebrow text-text-muted">
								You vs {card.username}
							</div>
							<div class="font-mono text-2xl font-bold">
								{card.headToHead.wins}–{card.headToHead.losses}
							</div>
							{#if card.bot?.mood}
								<div class="text-sm text-text-muted">{MOOD_LABEL[card.bot.mood]}</div>
							{/if}
						</div>
						{#if !card.isBot && !card.isMe}
							<button
								type="button"
								onclick={() => (challenging = !challenging)}
								class="m-btn primary">Challenge</button
							>
						{:else if card.isBot}
							<a href={resolve('/dashboard')} class="m-btn primary">Race a bot</a>
						{/if}
					</div>
				{/if}

				{#if challenging}
					<div class="mt-3 rounded-2xl border border-border p-4">
						<div class="text-sm font-black">Versus {card.username}</div>
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each LENGTHS as m (m)}
								<button
									type="button"
									aria-pressed={minutes === m}
									onclick={() => (minutes = m)}
									class="m-chip text-xs">{lengthLabel(m)}</button
								>
							{/each}
						</div>
						<input
							bind:value={message}
							maxlength="140"
							placeholder="Add a line (optional)"
							class="mt-2 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
						/>
						<button
							type="button"
							disabled={busy}
							onclick={challenge}
							class="m-btn dark sm mt-2 disabled:opacity-50">Send challenge</button
						>
						<p class="mt-1 text-xs text-text-muted">They have 24 hours to accept.</p>
					</div>
				{/if}
			</div>
		</div>

		{#if card.bot}
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<div class="m-card">
					<div class="m-eyebrow text-text-muted">How it races</div>
					<p class="mt-2 text-sm font-bold">{STYLE[card.bot.draft] ?? card.bot.draft}</p>
					<p class="mt-2 text-xs text-text-muted">
						Asks {Math.round(card.bot.trade.askMarkup * 100)}% of the going rate when selling, pays
						up to {Math.round(card.bot.trade.payTolerance * 100)}% when buying.
					</p>
				</div>
				<div class="m-card">
					<div class="m-eyebrow text-text-muted">
						Garage · ⚙️ {card.bot.gears.toLocaleString()}
					</div>
					<ul class="mt-2 flex flex-wrap gap-1.5">
						{#each card.bot.garage as c, i (i)}
							<li
								class="rounded-full px-2.5 py-0.5 text-xs font-bold"
								style="background:{rarityColor(c.rarity)}"
							>
								{c.model}
							</li>
						{:else}<li class="text-sm text-text-muted">Empty</li>{/each}
					</ul>
				</div>
			</div>
			<div class="m-card mt-4">
				<div class="m-eyebrow text-text-muted">Recent Car Market moves</div>
				<ul class="mt-2 flex flex-col gap-2 text-sm">
					{#each card.bot.moves as m, i (i)}
						<li>
							<span class="font-bold">{m.kind}</span> a {m.model} for ⚙️ {m.price}
							{#if m.reason}<span class="block text-xs text-text-muted">Why: {m.reason}</span>{/if}
						</li>
					{:else}<li class="text-text-muted">Nothing yet.</li>{/each}
				</ul>
			</div>
		{/if}
	{/if}
</div>

<Toast />
