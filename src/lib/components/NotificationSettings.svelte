<script lang="ts">
	// Me → Settings → Notifications (GAMEPLAY_FLOWS.md, F11): turn them on for
	// this device, choose which kinds, and quiet hours in your local time.
	import { onMount } from 'svelte';
	import {
		currentSubscription,
		disablePush,
		enablePush,
		pushSupport,
		type PushSupport
	} from '$lib/push';
	import {
		DEFAULT_QUIET,
		NOTIFY_KINDS,
		NOTIFY_KIND_IDS,
		type NotifyKind,
		type NotifySettings
	} from '$lib/notifications';

	let {
		settings,
		save
	}: { settings: NotifySettings; save: (s: NotifySettings) => Promise<unknown> } = $props();

	let support = $state<PushSupport>('unsupported');
	let on = $state(false);
	let denied = $state(false);
	let busy = $state(false);
	// svelte-ignore state_referenced_locally
	let kinds = $state<Partial<Record<NotifyKind, boolean>>>({ ...(settings.notify ?? {}) });
	// svelte-ignore state_referenced_locally
	let quietStart = $state(settings.quietStart ?? DEFAULT_QUIET.start);
	// svelte-ignore state_referenced_locally
	let quietEnd = $state(settings.quietEnd ?? DEFAULT_QUIET.end);

	onMount(async () => {
		support = pushSupport();
		denied = 'Notification' in window && Notification.permission === 'denied';
		on = support === 'ok' && Boolean(await currentSubscription());
	});

	async function toggleDevice() {
		busy = true;
		try {
			if (on) {
				await disablePush();
				on = false;
			} else {
				const r = await enablePush();
				on = r === 'on';
				denied = r === 'denied';
			}
		} catch {
			on = false;
		} finally {
			busy = false;
		}
	}

	function setKind(k: NotifyKind, v: boolean) {
		kinds[k] = v;
		save({ notify: { [k]: v } });
	}

	function setQuiet() {
		save({ quietStart, quietEnd });
	}

	const hours = Array.from({ length: 24 }, (_v, h) => h);
	const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="font-bold">Notifications on this device</span>
		{#if support === 'ok'}
			<button
				type="button"
				disabled={busy || denied}
				aria-pressed={on}
				onclick={toggleDevice}
				class="m-chip !min-h-11 !px-5 !text-sm text-xs disabled:opacity-50"
				>{on ? 'On' : 'Turn on'}</button
			>
		{/if}
	</div>
	{#if support === 'ios-install'}
		<p class="text-xs text-text-muted">
			On iPhone, add CoinDraft to your home screen first (Share → Add to Home Screen), then turn
			notifications on from there.
		</p>
	{:else if support === 'unsupported'}
		<p class="text-xs text-text-muted">This browser doesn't support notifications.</p>
	{:else if support === 'no-key'}
		<p class="text-xs text-text-muted">Notifications aren't set up on this server yet.</p>
	{:else if denied}
		<p class="text-xs text-text-muted">
			Notifications are blocked for this site. Allow them in your browser's site settings.
		</p>
	{/if}

	<fieldset class="flex flex-col gap-2">
		<legend class="sr-only">What to be told about</legend>
		{#each NOTIFY_KIND_IDS as k (k)}
			<label class="flex items-center justify-between gap-3 text-sm">
				<span>{NOTIFY_KINDS[k].label}</span>
				<input
					type="checkbox"
					checked={kinds[k] !== false}
					onchange={(e) => setKind(k, e.currentTarget.checked)}
					class="h-5 w-5 shrink-0"
				/>
			</label>
		{/each}
	</fieldset>

	<div class="flex flex-wrap items-center gap-2 text-sm">
		<span class="font-bold">Quiet hours</span>
		<select
			bind:value={quietStart}
			onchange={setQuiet}
			aria-label="Quiet hours start"
			class="h-9 rounded-xl border border-border bg-bg px-2"
		>
			{#each hours as h (h)}<option value={h}>{hh(h)}</option>{/each}
		</select>
		<span>to</span>
		<select
			bind:value={quietEnd}
			onchange={setQuiet}
			aria-label="Quiet hours end"
			class="h-9 rounded-xl border border-border bg-bg px-2"
		>
			{#each hours as h (h)}<option value={h}>{hh(h)}</option>{/each}
		</select>
		<span class="text-xs text-text-muted">your local time</span>
	</div>
</div>
