<script lang="ts">
	// Scrimmage is a real mode, so it gets a real page. It used to be reachable
	// only from a dashboard button or after waiting 20s in matchmaking, which
	// made the mode meant for brand-new players the hardest one to find.
	import { DURATION_OPTIONS, DEFAULT_DURATION_MINUTES, durationLabel } from '$lib/constants';
	import Toast from '$lib/components/Toast.svelte';
	import { resolve } from '$app/paths';
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';

	// Practice races are short by design: you learn how it works in minutes.
	const LENGTHS = DURATION_OPTIONS.filter((d) => d.minutes <= 60);

	let durationMinutes = $state(Math.min(DEFAULT_DURATION_MINUTES, 5));
	let starting = $state(false);
	let errorMessage = $state('');

	async function startScrimmage() {
		starting = true;
		errorMessage = '';
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'daily', mode: 'paper', durationMinutes })
			});
			if (res.status === 401) {
				window.location.href = '/?auth=required';
				return;
			}
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload?.error ?? 'Could not start a Scrimmage. Please try again.');
			}
			const contest = await res.json();
			window.location.href = `/draft?contestId=${contest.id}&type=${contest.type}&mode=paper`;
		} catch (error) {
			starting = false;
			errorMessage = (error as Error)?.message ?? 'Could not start a Scrimmage. Please try again.';
		}
	}
</script>

<div class="m-page mid">
	<a href={resolve('/play')} class="text-sm font-bold text-text no-underline">← All races</a>

	<div
		class="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-center gap-6"
	>
		<header class="flex flex-col gap-3">
			<span class="m-plate w-fit"><span>Scrimmage · Sunny meadow</span></span>
			<h1 class="m-title">Practice against a bot.</h1>
			<p class="m-lead">
				The same race as everywhere else, with nothing on the line. Your rank, win rate and badges
				stay exactly as they are.
			</p>
		</header>
		<WorldThumb theme="meadow" />
	</div>

	<ol class="mt-8 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4">
		{#each [['Pick a car and a track', 'Any car you own, any real circuit.'], ['Draft five coins', 'One per sector. They are your engine.'], ['Race the bot', 'It drafts the moment you lock, so there is no waiting.']] as [title, body], i (title)}
			<li class="flat m-card flex gap-3 !p-4">
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-border bg-butter font-display font-extrabold"
					>{i + 1}</span
				>
				<span>
					<span class="block font-bold">{title}</span>
					<span class="block text-sm text-text-body">{body}</span>
				</span>
			</li>
		{/each}
	</ol>

	<section class="m-card mt-6" aria-labelledby="length">
		<h2 id="length" class="font-display text-xl font-extrabold">How long?</h2>
		<p class="text-sm text-text-muted">Short races are best for learning.</p>
		<div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Race length">
			{#each LENGTHS as opt (opt.minutes)}
				<button
					type="button"
					onclick={() => (durationMinutes = opt.minutes)}
					aria-pressed={durationMinutes === opt.minutes}
					class="m-chip !min-h-11 !px-5 !text-sm">{opt.label}</button
				>
			{/each}
		</div>

		{#if errorMessage}
			<p class="m-tag mt-4 w-fit bg-pink !whitespace-normal" role="alert">{errorMessage}</p>
		{/if}

		<button onclick={startScrimmage} disabled={starting} class="m-btn primary lg mt-5 block">
			{starting
				? 'Getting the car to the grid…'
				: `Start a ${durationLabel(durationMinutes)} practice →`}
		</button>
		<p class="mt-3 text-center text-sm text-text-muted">
			Ready for a real rival? <a href={resolve('/matchmaking')} class="font-bold text-text"
				>Race Versus</a
			>
		</p>
	</section>
</div>

<Toast />
