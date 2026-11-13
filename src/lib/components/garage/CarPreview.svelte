<script lang="ts">
	// A side-on car with its paint, decal and number plate, for Garage →
	// Customise and the Showroom. Plain SVG with token colours, so it restyles
	// with the design system.
	import { paintColor, type CarLook } from '$lib/economy/rules';

	let { look = {}, size = 220 }: { look?: CarLook; size?: number } = $props();

	const body = $derived(paintColor(look) ?? 'var(--color-coral)');
	const decal = $derived(look.decal ?? 'none');
	const CHECKS = Array.from({ length: 12 }, (_v, i) => i);
</script>

<svg
	viewBox="0 0 220 100"
	width={size}
	height={(size * 100) / 220}
	role="img"
	aria-label="Car preview"
>
	<!-- body -->
	<path
		d="M14 66 L30 44 Q38 34 56 32 L120 30 Q140 30 156 42 L186 50 Q206 54 208 66 L208 72 L14 72 Z"
		fill={body}
		stroke="var(--color-ink)"
		stroke-width="2.5"
		stroke-linejoin="round"
	/>
	<!-- window -->
	<path
		d="M58 38 L116 36 Q132 36 144 46 L60 48 Z"
		fill="var(--color-surface)"
		stroke="var(--color-ink)"
		stroke-width="2"
		opacity="0.9"
	/>
	{#if decal === 'stripe'}
		<rect x="14" y="56" width="194" height="6" fill="var(--color-surface)" opacity="0.9" />
	{:else if decal === 'twin'}
		<rect x="14" y="54" width="194" height="3.5" fill="var(--color-surface)" opacity="0.9" />
		<rect x="14" y="60" width="194" height="3.5" fill="var(--color-surface)" opacity="0.9" />
	{:else if decal === 'checker'}
		{#each CHECKS as i (i)}
			<rect
				x={60 + i * 8}
				y={i % 2 ? 54 : 60}
				width="8"
				height="6"
				fill="var(--color-ink)"
				opacity="0.85"
			/>
		{/each}
	{:else if decal === 'bolt'}
		<path
			d="M92 50 L112 50 L104 58 L120 58 L94 70 L102 61 L88 61 Z"
			fill="var(--color-amber)"
			stroke="var(--color-ink)"
			stroke-width="1.5"
		/>
	{/if}
	<!-- plate -->
	{#if look.plate}
		<rect
			x="176"
			y="60"
			width="30"
			height="10"
			rx="2"
			fill="var(--color-surface)"
			stroke="var(--color-ink)"
			stroke-width="1.2"
		/>
		<text
			x="191"
			y="67.8"
			text-anchor="middle"
			font-family="JetBrains Mono, monospace"
			font-size="6.5"
			font-weight="700"
			fill="var(--color-ink)">{look.plate}</text
		>
	{/if}
	<!-- wheels -->
	<circle cx="56" cy="74" r="13" fill="var(--color-ink)" />
	<circle cx="56" cy="74" r="5" fill="var(--color-border)" />
	<circle cx="170" cy="74" r="13" fill="var(--color-ink)" />
	<circle cx="170" cy="74" r="5" fill="var(--color-border)" />
</svg>
