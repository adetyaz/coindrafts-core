<script lang="ts">
	// Brand name and invoice email, asked once (on a sponsor's first booking).
	let {
		name = $bindable(''),
		email = $bindable(''),
		known
	}: { name?: string; email?: string; known: boolean } = $props();
</script>

{#if !known}
	<div class="grid gap-3 sm:grid-cols-2">
		<label class="text-sm font-bold"
			>Company or brand
			<input
				bind:value={name}
				maxlength="80"
				class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
			/>
		</label>
		<label class="text-sm font-bold"
			>Email for the invoice
			<input
				type="email"
				bind:value={email}
				autocomplete="email"
				class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
			/>
		</label>
	</div>
{/if}
