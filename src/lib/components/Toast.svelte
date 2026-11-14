<script lang="ts">
	import { toastState } from '$lib/toast';
</script>

<!-- Sticker toasts. Phones: above the tab bar, centred; desktop: bottom corner. -->
<div
	class="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[1000] flex flex-col items-center gap-2 nav:inset-x-auto nav:end-4 nav:bottom-4 nav:items-end"
	role="status"
	aria-live="polite"
>
	{#each $toastState as t (t.id)}
		<div
			class="anim-pop flex max-w-sm items-center gap-3 rounded-[16px] border-2 border-border bg-surface py-2.5 ps-2.5 pe-4 text-sm font-semibold shadow-[var(--shadow-hard)]"
		>
			<span
				class="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-border font-extrabold {t.type ===
				'success'
					? 'bg-primary'
					: t.type === 'error'
						? 'bg-pink'
						: 'bg-lavender'}"
				aria-hidden="true">{t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}</span
			>
			{t.message}
		</div>
	{/each}
</div>
