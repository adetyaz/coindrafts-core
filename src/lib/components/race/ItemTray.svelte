<script lang="ts">
	// The item tray (GAMEPLAY_FLOWS.md, F8): what you own, choose one, choose its
	// sector or coin. One per race, three races a week. Locked in with the lineup.
	import { onMount } from 'svelte';
	import {
		ITEMS,
		ITEM_KINDS,
		type Inventory,
		type ItemKind,
		type LineupItem
	} from '$lib/race/items';
	import { sectorTheme } from '$lib/sectorTheme';

	let {
		picks,
		value = $bindable(null)
	}: {
		picks: { symbol: string; sector: string }[];
		value?: LineupItem | null;
	} = $props();

	let inv = $state<{ owned: Inventory; usedThisWeek: number; weeklyCap: number } | null>(null);

	onMount(async () => {
		const res = await fetch('/api/items').catch(() => null);
		if (res?.ok) inv = await res.json();
	});

	const capped = $derived(inv ? inv.usedThisWeek >= inv.weeklyCap : false);
	const ownedKinds = $derived(ITEM_KINDS.filter((k) => (inv?.owned[k] ?? 0) > 0));

	function choose(kind: ItemKind) {
		if (value?.kind === kind) {
			value = null;
			return;
		}
		const target = ITEMS[kind].target;
		value = {
			kind,
			sector: target === 'sector' ? picks[0]?.sector : undefined,
			symbol: target === 'coin' ? picks[0]?.symbol : undefined
		};
	}
</script>

{#if inv && ownedKinds.length}
	<div class="rounded-[20px] border border-border bg-surface p-[18px]">
		<div class="flex items-center justify-between">
			<div class="text-[11px] font-extrabold tracking-[0.12em] text-text-muted uppercase">
				Item for this race
			</div>
			<div class="font-mono text-[11px] text-text-muted">
				{inv.usedThisWeek}/{inv.weeklyCap} this week
			</div>
		</div>
		{#if capped}
			<p class="mt-2 text-xs text-text-muted">You've used this week's items. More on Monday.</p>
		{:else}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each ownedKinds as k (k)}
					<button
						type="button"
						aria-pressed={value?.kind === k}
						title={ITEMS[k].does}
						onclick={() => choose(k)}
						class="h-9 cursor-pointer rounded-full border px-3 text-xs font-bold {value?.kind === k
							? 'border-text bg-text text-surface'
							: 'border-border bg-bg'}"
					>
						{ITEMS[k].icon}
						{ITEMS[k].label} ×{inv.owned[k]}
					</button>
				{/each}
			</div>
			{#if value}
				<p class="mt-2 text-xs text-text-muted">{ITEMS[value.kind].does}.</p>
				{#if ITEMS[value.kind].target === 'sector'}
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each picks as p (p.sector)}
							<button
								type="button"
								aria-pressed={value.sector === p.sector}
								onclick={() => (value = { ...value!, sector: p.sector })}
								class="h-8 cursor-pointer rounded-full border px-3 text-xs font-bold {value.sector ===
								p.sector
									? 'border-text'
									: 'border-border'}"
								style="background:{value.sector === p.sector ? sectorTheme(p.sector).color : ''}"
								>{sectorTheme(p.sector).label} · {p.symbol}</button
							>
						{/each}
					</div>
				{:else if ITEMS[value.kind].target === 'coin'}
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each picks as p (p.symbol)}
							<button
								type="button"
								aria-pressed={value.symbol === p.symbol}
								onclick={() => (value = { ...value!, symbol: p.symbol })}
								class="h-8 cursor-pointer rounded-full border px-3 text-xs font-bold {value.symbol ===
								p.symbol
									? 'border-text bg-text text-surface'
									: 'border-border'}">{p.symbol}</button
							>
						{/each}
					</div>
				{/if}
			{/if}
		{/if}
	</div>
{/if}
