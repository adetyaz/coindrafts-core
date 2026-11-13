<script lang="ts">
	// Showroom → items (GAMEPLAY_FLOWS.md, F8). Bought with Gears (burned). The
	// weekly cap limits use, not buying, so nobody buys a win.
	import { onMount } from 'svelte';
	import { toast } from '$lib/toast';
	import { ITEMS, ITEM_KINDS, type Inventory, type ItemKind } from '$lib/race/items';

	let { gears, onBought }: { gears: number; onBought: () => void } = $props();

	let inv = $state<{ owned: Inventory; usedThisWeek: number; weeklyCap: number } | null>(null);
	let busy = $state(false);

	onMount(async () => {
		const res = await fetch('/api/items').catch(() => null);
		if (res?.ok) inv = await res.json();
	});

	async function buy(kind: ItemKind) {
		busy = true;
		try {
			const res = await fetch('/api/items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'buy', kind })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
			inv = data;
			toast(`${ITEMS[kind].icon} ${ITEMS[kind].label} added`, 'success');
			onBought();
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<section class="mt-10">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-2xl font-black tracking-[-0.03em]">Nitro & pit-stop items</h2>
			<p class="mt-1 text-sm text-text-muted">
				One per race, up to {inv?.weeklyCap ?? 3} races a week. Also won from daily trivia.
			</p>
		</div>
		{#if inv}
			<span class="font-mono text-xs text-text-muted"
				>{inv.usedThisWeek}/{inv.weeklyCap} used this week</span
			>
		{/if}
	</div>
	<div class="mt-4 grid grid-cols-4 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
		{#each ITEM_KINDS as k (k)}
			<div class="flex flex-col rounded-[20px] border border-border bg-surface p-4">
				<div class="text-2xl">{ITEMS[k].icon}</div>
				<div class="mt-1 font-black">{ITEMS[k].label}</div>
				<p class="mt-1 flex-1 text-xs text-text-muted">{ITEMS[k].does}</p>
				<div class="mt-2 font-mono text-xs">You own {inv?.owned[k] ?? 0}</div>
				<button
					type="button"
					disabled={busy || gears < ITEMS[k].price}
					onclick={() => buy(k)}
					class="mt-3 h-10 cursor-pointer rounded-full border-none bg-primary text-xs font-extrabold text-text disabled:opacity-50"
					>Buy · ⚙️ {ITEMS[k].price}</button
				>
			</div>
		{/each}
	</div>
</section>
