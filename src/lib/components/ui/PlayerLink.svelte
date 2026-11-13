<script lang="ts">
	// A name that opens that player's (or bot's) card (GAMEPLAY_FLOWS.md, F6).
	import { resolve } from '$app/paths';

	let {
		id,
		name,
		class: cls = ''
	}: { id: string | null | undefined; name: string; class?: string } = $props();
</script>

{#if id}
	<a href={resolve('/players/[id]', { id })} class="text-inherit no-underline hover:underline {cls}"
		>{name}</a
	>
{:else}
	<span class={cls}>{name}</span>
{/if}
