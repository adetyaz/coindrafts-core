<script lang="ts">
	// "Yesterday in the bot world" (GAMEPLAY_FLOWS.md, F10): what the daily job's
	// bot day did. Races, cars won, Car Market trades and Showroom buys.
	import { onMount } from 'svelte';

	type Day = {
		day: string;
		summary: {
			date: string;
			races: { a: string; b: string; winner: string; carWon?: { model: string; rarity: string } }[];
			market: string[];
			showroom: string[];
		} | null;
	};

	let days = $state<Day[]>([]);
	let open = $state(false);

	onMount(async () => {
		const res = await fetch('/api/bot-days').catch(() => null);
		if (res?.ok) days = (await res.json()).filter((d: Day) => d.summary);
	});

	const latest = $derived(days[0]?.summary ?? null);
	const carRaces = $derived(latest?.races.filter((r) => r.carWon) ?? []);
</script>

{#if latest}
	<div class="m-card mb-7">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<div class="text-sm font-black">Yesterday in the bot world</div>
				<p class="mt-1 text-xs text-text-muted">
					The bots race, trade and shop every day on their own, on real market moves from
					{latest.date}. {latest.races.length} races · {carRaces.length} for cars ·
					{latest.market.length} Car Market moves · {latest.showroom.length} new cars bought.
				</p>
			</div>
			<button type="button" onclick={() => (open = !open)} class="m-btn sm"
				>{open ? 'Hide' : 'What happened'}</button
			>
		</div>
		{#if open}
			<ul class="mt-4 flex flex-col gap-1.5 text-sm">
				{#each latest.races as r, i (i)}
					<li>
						🏁 <span class="font-bold">{r.winner}</span> beat {r.winner === r.a
							? r.b
							: r.a}{r.carWon ? ` and took their ${r.carWon.rarity} ${r.carWon.model}` : ''}
					</li>
				{/each}
				{#each latest.showroom as line, i (i)}<li>🆕 {line}</li>{/each}
				{#each latest.market as line, i (i)}<li class="text-text-muted">💱 {line}</li>{/each}
			</ul>
		{/if}
	</div>
{/if}
