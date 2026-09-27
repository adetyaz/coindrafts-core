<script lang="ts">
	import { toastState } from '$lib/toast';
</script>

<div class="fixed right-4 bottom-4 z-1000 flex flex-col gap-2" role="status" aria-live="polite">
	{#each $toastState as t (t.id)}
		<div
			class="animate-in fade-in slide-in-from-bottom-4 rounded-lg border px-4 py-3 text-sm font-medium shadow-sm duration-300"
			class:bg-surface={t.type !== 'success'}
			class:border-border={t.type === 'info'}
			class:text-text={t.type !== 'error'}
			class:border-negative={t.type === 'error'}
			class:text-negative-ink={t.type === 'error'}
			class:bg-positive={t.type === 'success'}
			class:border-positive={t.type === 'success'}
		>
			{t.message}
		</div>
	{/each}
</div>
