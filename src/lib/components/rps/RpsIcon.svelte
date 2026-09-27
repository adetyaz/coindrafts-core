<script lang="ts">
	import type { RpsShape } from '$lib/rps';

	// Placeholder glyphs drawn to match the design's flat, single-colour hand
	// silhouettes. Swap for the design's own SVG assets when available — every
	// caller goes through this component, so it's a one-file change.
	let {
		shape,
		size = 48,
		x,
		y
	}: { shape: RpsShape; size?: number | string; x?: number; y?: number } = $props();
</script>

<svg {x} {y} width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
	{#if shape === 'rock'}
		<rect x="14" y="24" width="36" height="30" rx="9" />
		<rect x="14" y="16" width="9" height="16" rx="4.5" />
		<rect x="23" y="14" width="9" height="16" rx="4.5" />
		<rect x="32" y="15" width="9" height="16" rx="4.5" />
		<rect x="41" y="18" width="9" height="16" rx="4.5" />
		<rect x="8" y="30" width="22" height="9" rx="4.5" transform="rotate(-8 19 34)" />
	{:else if shape === 'paper'}
		<rect x="17" y="30" width="30" height="26" rx="9" />
		<rect x="18" y="12" width="7" height="26" rx="3.5" />
		<rect x="26" y="7" width="7" height="30" rx="3.5" />
		<rect x="34" y="9" width="7" height="28" rx="3.5" />
		<rect x="42" y="15" width="7" height="24" rx="3.5" />
		<rect x="9" y="28" width="7" height="20" rx="3.5" transform="rotate(-38 12.5 38)" />
	{:else if shape === 'scissors'}
		<rect x="18" y="34" width="28" height="22" rx="9" />
		<rect x="20" y="8" width="7" height="32" rx="3.5" transform="rotate(-18 23.5 38)" />
		<rect x="31" y="8" width="7" height="32" rx="3.5" transform="rotate(14 34.5 38)" />
		<circle cx="44" cy="37" r="5" />
		<circle cx="42" cy="46" r="4.5" />
	{:else if shape === 'spock'}
		<rect x="16" y="32" width="30" height="24" rx="9" />
		<g transform="rotate(-8 24 34)">
			<rect x="15" y="12" width="7" height="26" rx="3.5" />
			<rect x="23" y="9" width="7" height="28" rx="3.5" />
		</g>
		<g transform="rotate(8 38 34)">
			<rect x="33" y="9" width="7" height="28" rx="3.5" />
			<rect x="41" y="12" width="7" height="26" rx="3.5" />
		</g>
		<rect x="46" y="30" width="7" height="18" rx="3.5" transform="rotate(36 49.5 39)" />
	{:else}
		<ellipse cx="30" cy="36" rx="15" ry="7" transform="rotate(-24 30 36)" />
		<ellipse cx="46" cy="24" rx="8" ry="5.5" transform="rotate(-24 46 24)" />
		<path
			d="M18 42 Q8 46 9 55 Q12 49 21 45"
			fill="none"
			stroke="currentColor"
			stroke-width="5"
			stroke-linecap="round"
		/>
		<g stroke="currentColor" stroke-width="4" stroke-linecap="round">
			<line x1="24" y1="36" x2="18" y2="28" />
			<line x1="27" y1="41" x2="24" y2="50" />
			<line x1="37" y1="31" x2="36" y2="21" />
			<line x1="40" y1="35" x2="47" y2="41" />
		</g>
	{/if}
</svg>
