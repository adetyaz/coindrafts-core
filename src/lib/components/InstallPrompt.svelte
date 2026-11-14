<script lang="ts">
	// "Add CoinDraft to your home screen" (GAMEPLAY_FLOWS.md, F11), shown after a
	// finished race. Android/desktop Chrome get the real install prompt; iPhones
	// get the Share → Add to Home Screen steps (push only works after that).
	import { onMount } from 'svelte';
	import { canPromptInstall, isIos, isStandalone, promptInstall } from '$lib/push';

	const KEY = 'installPrompt';
	let show = $state(false);
	let ios = $state(false);

	onMount(() => {
		try {
			if (localStorage.getItem(KEY) === 'dismissed') return;
		} catch {
			// Storage blocked: still offer it.
		}
		if (isStandalone()) return;
		ios = isIos();
		// The browser's prompt can arrive a moment after the page.
		const check = () => (show = ios || canPromptInstall());
		check();
		const t = setTimeout(check, 1500);
		return () => clearTimeout(t);
	});

	function dismiss() {
		show = false;
		try {
			localStorage.setItem(KEY, 'dismissed');
		} catch {
			// Fine: it just shows again next time.
		}
	}

	async function install() {
		if (await promptInstall()) dismiss();
	}
</script>

{#if show}
	<div class="m-card" role="region" aria-label="Install CoinDraft">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<div class="font-black">Add CoinDraft to your home screen</div>
				{#if ios}
					<ol class="mt-2 list-decimal pl-5 text-sm text-text-muted">
						<li>Tap the <span class="font-bold text-text">Share</span> button in Safari.</li>
						<li>Choose <span class="font-bold text-text">Add to Home Screen</span>.</li>
						<li>Open CoinDraft from your home screen to turn on notifications.</li>
					</ol>
				{:else}
					<p class="mt-1 text-sm text-text-muted">
						One tap to your next race, plus notifications when your result is in.
					</p>
				{/if}
			</div>
			<div class="flex gap-2">
				{#if !ios}
					<button type="button" onclick={install} class="m-btn primary sm">Install</button>
				{/if}
				<button type="button" onclick={dismiss} class="m-btn sm">Not now</button>
			</div>
		</div>
	</div>
{/if}
