<script lang="ts">
	import RpsGame from '$lib/components/rps/RpsGame.svelte';
	import type { RpsVariant } from '$lib/rps';

	// Design sandbox: plays the house locally so the tiebreaker UI can be
	// reviewed without two queued players. Live matches use mode="match".
	let variant = $state<RpsVariant>('spock');
</script>

<div class="relative">
	<div
		class="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full bg-white/10 p-1 text-xs font-bold text-white"
	>
		{#each ['classic', 'spock'] as const as v (v)}
			<button
				type="button"
				onclick={() => (variant = v)}
				class="cursor-pointer rounded-full px-3 py-1 uppercase {variant === v
					? 'bg-white text-text'
					: ''}"
			>
				{v === 'classic' ? 'Classic' : '+ Lizard Spock'}
			</button>
		{/each}
	</div>
	{#key variant}
		<RpsGame mode="practice" {variant} />
	{/key}
</div>
