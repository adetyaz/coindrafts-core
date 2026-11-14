<script lang="ts">
	let { items }: { items: string[] } = $props();
</script>

<div
	class="mx-auto mt-3 max-w-[76rem] overflow-hidden rounded-full border-2 border-border bg-butter py-1.5 whitespace-nowrap text-text"
	aria-hidden="true"
>
	<div class="anim-marquee flex w-max">
		{#each [0, 1] as rep (rep)}
			<div class="flex">
				{#each items as item, i (rep + '-' + i)}
					<span class="pr-10 font-mono text-[11px] font-bold tracking-[0.08em] whitespace-nowrap"
						>{item}</span
					>
				{/each}
			</div>
		{/each}
	</div>
</div>
