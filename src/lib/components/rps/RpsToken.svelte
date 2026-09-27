<script lang="ts">
	import type { RpsShape } from '$lib/rps';
	import RpsIcon from './RpsIcon.svelte';

	let {
		shape,
		size,
		winner = false,
		onclick,
		disabled = false
	}: {
		shape: RpsShape;
		/** Outer diameter as any CSS length (e.g. `clamp(96px, 20vw, 144px)`); everything inside scales from it. */
		size: string;
		winner?: boolean;
		onclick?: () => void;
		disabled?: boolean;
	} = $props();

	const label = $derived(shape[0].toUpperCase() + shape.slice(1));
	const halo =
		', 0 0 0 calc(var(--s) * 0.25) rgba(255,255,255,0.04), 0 0 0 calc(var(--s) * 0.5) rgba(255,255,255,0.03), 0 0 0 calc(var(--s) * 0.75) rgba(255,255,255,0.02)';
</script>

{#snippet disc()}
	<span
		class="grid h-full w-full place-items-center rounded-full"
		style="background:var(--color-rps-{shape});box-shadow:0 calc(var(--s) * 0.04) 0 var(--color-rps-{shape}-shade){winner
			? halo
			: ''}"
	>
		<span
			class="grid h-[76%] w-[76%] place-items-center rounded-full"
			style="background:var(--color-rps-disc);color:var(--color-rps-ink);box-shadow:inset 0 calc(var(--s) * 0.04) 0 var(--color-rps-disc-shade)"
		>
			<RpsIcon {shape} size="46%" />
		</span>
	</span>
{/snippet}

{#if onclick}
	<button
		type="button"
		{onclick}
		{disabled}
		aria-label={label}
		class="block cursor-pointer rounded-full transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-default disabled:hover:scale-100"
		style="--s:{size};width:var(--s);height:var(--s)"
	>
		{@render disc()}
	</button>
{:else}
	<span
		class="block"
		style="--s:{size};width:var(--s);height:var(--s)"
		role="img"
		aria-label={label}
	>
		{@render disc()}
	</span>
{/if}
