<script lang="ts">
	// A postcard of a track world (layout.css `.track-*`): sky, ground, a bend of
	// road and a car. Used wherever a mode or race needs to show where it runs.
	import { TRACK_THEMES, type TrackTheme } from '$lib/race/trackTheme';

	let {
		theme,
		paint = 'var(--color-coral)',
		label = true
	}: { theme: TrackTheme; paint?: string; label?: boolean } = $props();

	const world = $derived(TRACK_THEMES[theme]);
</script>

<div
	class="track-{theme} relative aspect-[16/9] w-full overflow-hidden rounded-[16px] border-2 border-border"
	style="background:var(--race-sky)"
>
	<svg viewBox="0 0 160 90" class="absolute inset-0 h-full w-full" aria-hidden="true">
		{#if world.night}
			<!-- stars and a moon -->
			{#each [[18, 10], [44, 6], [70, 14], [96, 8], [128, 12], [146, 20]] as [x, y] (x)}
				<circle cx={x} cy={y} r="0.9" fill="var(--color-race-line)" />
			{/each}
			<circle cx="134" cy="16" r="7" fill="var(--color-race-sun)" opacity="0.9" />
		{:else}
			<circle cx="132" cy="16" r="9" fill="var(--color-race-sun)" />
			<path d="M22 20h18a6 6 0 0 0 0-12 8 8 0 0 0-15-2 7 7 0 0 0-3 14Z" fill="var(--color-surface-alt)" opacity="0.9" />
		{/if}
		<!-- hills -->
		<path d="M0 52 Q40 34 80 50 T160 44 V90 H0Z" fill="var(--color-race-grass-dark)" />
		<path d="M0 62 Q50 48 100 60 T160 56 V90 H0Z" fill="var(--color-race-grass)" />
		<!-- road -->
		<path
			d="M-6 88 C40 60 70 86 104 66 S150 56 168 62"
			fill="none"
			stroke="var(--color-race-road)"
			stroke-width="15"
			stroke-linecap="round"
		/>
		<path
			d="M-6 88 C40 60 70 86 104 66 S150 56 168 62"
			fill="none"
			stroke="var(--color-race-line)"
			stroke-width="1.2"
			stroke-dasharray="5 6"
		/>
		<!-- trees -->
		{#each [[20, 50], [58, 46], [140, 42]] as [x, y] (x)}
			<rect x={x - 1} {y} width="2" height="6" fill="var(--color-race-trunk)" />
			<path d="M{x - 6} {y + 1} L{x} {y - 12} L{x + 6} {y + 1}Z" fill="var(--color-race-tree)" />
		{/each}
		<!-- flowers / lamps -->
		{#each [[34, 70], [76, 58], [120, 80], [150, 74], [12, 80]] as [x, y] (x)}
			<circle cx={x} cy={y} r="1.6" fill="var(--color-race-flower)" />
		{/each}
		<!-- the car -->
		<g transform="translate(92 62) rotate(-18)">
			{#if world.night}
				<path d="M15 3 L44 -6 L44 14 Z" fill="var(--color-race-sun)" opacity="0.45" />
			{/if}
			<rect
				x="-12"
				y="-4"
				width="26"
				height="9"
				rx="3"
				fill={paint}
				stroke="var(--color-ink)"
				stroke-width="1.6"
			/>
			<rect
				x="-6"
				y="-9"
				width="12"
				height="7"
				rx="2"
				fill="var(--color-surface)"
				stroke="var(--color-ink)"
				stroke-width="1.6"
			/>
			<circle cx="-6" cy="6" r="3.4" fill="var(--color-ink)" />
			<circle cx="8" cy="6" r="3.4" fill="var(--color-ink)" />
		</g>
	</svg>
	{#if label}
		<span class="m-plate absolute start-2 bottom-2 text-[10px]"><span>{world.label}</span></span>
	{/if}
</div>
