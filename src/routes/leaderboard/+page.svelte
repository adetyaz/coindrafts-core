<script lang="ts">
	import PlayerLink from '$lib/components/ui/PlayerLink.svelte';
	import { onMount } from 'svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';

	type LeaderboardRow = {
		rank: number;
		id: string;
		username: string;
		walletShort: string;
		xp: number;
		streak: number;
		isMe: boolean;
	};

	let rows = $state<LeaderboardRow[]>([]);
	let loading = $state(true);

	const podium = $derived(rows.slice(0, 3));
	const ladder = $derived(rows.slice(3));

	onMount(async () => {
		try {
			const res = await fetch('/api/leaderboard');
			if (res.ok) {
				rows = await res.json();
			}
		} catch {
			toast('Failed to load leaderboard', 'error');
		} finally {
			loading = false;
		}
	});
</script>

<div class="m-page mid">
	<header>
		<span class="m-eyebrow">Compete</span>
		<h1 class="m-title mt-1">Leaderboard.</h1>
		<p class="m-lead mt-1">The top 50 drivers by XP. Tap a name to see their card.</p>
	</header>

	{#if loading}
		<div class="mt-6 flex flex-col gap-2">
			{#each [0, 1, 2] as i (i)}
				<div class="h-14 animate-pulse rounded-[14px] bg-surface-alt"></div>
			{/each}
		</div>
	{:else if rows.length === 0}
		<p class="dashed m-card mt-6 text-center font-semibold">No drivers yet. Be the first!</p>
	{:else}
		<!-- The podium: first place stands tallest. -->
		<ol
			class="mt-6 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr))] items-end gap-4"
		>
			{#each podium as row, i (row.id)}
				<li
					class="m-card flex flex-col gap-1 {i === 0
						? '!bg-butter nav:-translate-y-3'
						: ''} {row.isMe ? 'ring-4 ring-primary' : ''}"
				>
					<div class="flex items-center justify-between">
						<span class="text-3xl" aria-label="Place {row.rank}"
							>{row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'}</span
						>
						{#if row.streak > 0}<span class="m-chg up">{row.streak} 🔥</span>{/if}
					</div>
					<div class="mt-2 truncate font-display text-xl font-extrabold">
						<PlayerLink id={row.id} name={row.username} />
					</div>
					<div class="m-num text-2xl font-bold">{row.xp.toLocaleString()} XP</div>
				</li>
			{/each}
		</ol>

		{#if ladder.length > 0}
			<ol class="mt-6 flex flex-col gap-2" start="4">
				{#each ladder as row (row.id)}
					<li
						class="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border-2 border-border px-3 py-2.5 {row.isMe
							? 'bg-brand-tint'
							: 'bg-surface'}"
					>
						<span class="m-num text-sm font-bold text-text-muted">{row.rank}</span>
						<span class="flex min-w-0 items-center gap-2">
							<span class="truncate text-sm font-bold"
								><PlayerLink id={row.id} name={row.username} /></span
							>
							{#if row.isMe}<span class="m-chg up">You</span>{/if}
							{#if row.streak > 0}<span class="text-xs max-sm:hidden">{row.streak} 🔥</span>{/if}
						</span>
						<span class="m-num text-sm font-bold">{row.xp.toLocaleString()}</span>
					</li>
				{/each}
			</ol>
		{/if}
	{/if}
</div>

<Toast />
