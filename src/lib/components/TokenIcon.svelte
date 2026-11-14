<script lang="ts" module>
	// Symbols the icon set doesn't have, learnt this session: skip the request.
	// A plain cache on purpose: each icon re-renders from its own `failedSlug`.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const MISSING = new Set<string>();
</script>

<script lang="ts">
	// Real token logos. SoSoValue is the app's price source but returns no logo
	// field on either /currencies or /market-snapshot (checked directly), so
	// icons come from the pinned `cryptocurrency-icons` package on jsDelivr,
	// keyed by lowercase symbol.
	//
	// Coverage is good but not total — the set doesn't include every long-tail
	// token in the draft pool. Anything missing falls back to the same letter
	// badge that was there before, so a missing icon degrades to the old
	// appearance rather than a broken-image glyph.
	let {
		symbol,
		size = 34,
		bg = 'var(--color-surface-alt)',
		fg = 'var(--color-text-muted)'
	}: { symbol: string | undefined; size?: number; bg?: string; fg?: string } = $props();

	const slug = $derived((symbol ?? '').trim().toLowerCase());
	const letter = $derived((symbol ?? '?').charAt(0).toUpperCase());

	// Remember which symbol failed, not just that something did. The old
	// boolean was reset by an effect after mount, and when the 404 was already
	// cached (NEAR and ARB in the draft slots) the error fired first, the reset
	// undid it, and the image never retried: a blank white circle.
	let failedSlug = $state<string | null>(null);
	const failed = $derived(failedSlug === slug || MISSING.has(slug));
</script>

{#if slug && !failed}
	<img
		src={`https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/32/color/${slug}.png`}
		alt=""
		width={size}
		height={size}
		loading="lazy"
		onerror={() => {
			MISSING.add(slug);
			failedSlug = slug;
		}}
		class="shrink-0 rounded-full object-contain"
		style="width:{size}px;height:{size}px;background:{bg}"
	/>
{:else}
	<div
		class="grid shrink-0 place-items-center rounded-full font-black"
		style="width:{size}px;height:{size}px;background:{bg};color:{fg};font-size:{Math.round(
			size * 0.42
		)}px"
		aria-hidden="true"
	>
		{letter}
	</div>
{/if}
