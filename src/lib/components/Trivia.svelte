<script lang="ts">
	// Daily trivia (GAMEPLAY_FLOWS.md, F7): 8 questions, about a minute, pass at
	// 4/8. Questions one after another; a tap locks the answer, a quick
	// right/wrong, then the next.
	import { onDestroy, onMount } from 'svelte';
	import { ITEMS, type ItemKind } from '$lib/race/items';

	type Q = { question: string; options: { label: string; value: string }[] };
	type State = {
		total: number;
		passMark: number;
		timeLimitMs: number;
		streak: number;
		nextSetAt: number;
		run: {
			finished: boolean;
			answered: number;
			deadline: number;
			score: number | null;
			passed: boolean | null;
			rewards: { xp: number; items: ItemKind[]; streak: number } | null;
			questions: Q[];
		} | null;
	};

	let s = $state<State | null>(null);
	let loading = $state(true);
	let error = $state('');
	let index = $state(0);
	let feedback = $state<{ picked: string; correct: boolean; answer: string | null } | null>(null);
	let busy = $state(false);
	let now = $state(Date.now());
	const clock = setInterval(() => (now = Date.now()), 250);
	onDestroy(() => clearInterval(clock));

	async function load() {
		try {
			const res = await fetch('/api/trivia');
			if (res.status === 401) return;
			if (!res.ok) throw new Error();
			s = await res.json();
			index = s?.run?.answered ?? 0;
		} catch {
			error = "Couldn't load today's trivia";
		} finally {
			loading = false;
		}
	}
	onMount(load);

	async function post(body: Record<string, unknown>) {
		const res = await fetch('/api/trivia', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
		return data;
	}

	async function start() {
		busy = true;
		error = '';
		try {
			s = await post({ action: 'start' });
			index = s?.run?.answered ?? 0;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}

	async function answer(value: string) {
		if (busy || feedback) return;
		busy = true;
		try {
			const r = await post({ action: 'answer', index, answer: value });
			feedback = { picked: value, correct: r.correct, answer: r.answer };
			// A beat to see right/wrong, then on.
			setTimeout(async () => {
				feedback = null;
				if (r.finished || r.timeUp) await load();
				else index += 1;
				busy = false;
			}, 700);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
			busy = false;
			await load();
		}
	}

	const run = $derived(s?.run ?? null);
	const msLeft = $derived(run && !run.finished ? Math.max(0, run.deadline - now) : 0);
	// Time ran out with the card open: fetch the result (the server scores the rest as wrong).
	$effect(() => {
		if (run && !run.finished && msLeft === 0 && !busy) load();
	});
	const question = $derived(run?.questions[index] ?? null);

	function countdown(to: number) {
		const ms = Math.max(0, to - now);
		const h = Math.floor(ms / 3_600_000);
		const m = Math.floor((ms % 3_600_000) / 60_000);
		return h ? `${h}h ${m}m` : `${m}m`;
	}
</script>

<section class="m-card" aria-labelledby="trivia-title">
	<div class="flex items-start justify-between gap-3">
		<div>
			<span class="m-plate"><span>Daily trivia</span></span>
			<h2 id="trivia-title" class="mt-2 font-display text-xl font-extrabold">
				{s ? `${s.total} questions, about a minute` : 'Today’s questions'}
			</h2>
		</div>
		{#if s}
			<div class="m-tag !min-h-11 bg-butter !px-3" title="Days in a row you've passed">
				<span aria-hidden="true">🔥</span><span class="m-num text-base">{s.streak}</span>
				<span class="sr-only">day streak</span>
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="mt-4 h-24 animate-pulse rounded-[14px] bg-surface-alt"></div>
	{:else if !s}
		<p class="mt-4 text-sm text-text-muted">{error || 'Sign in to play today’s trivia.'}</p>
	{:else if !run}
		<ul class="mt-4 flex flex-col gap-1.5 text-sm">
			<li>✅ Get <strong>{s.passMark} of {s.total}</strong> right to keep your streak going.</li>
			<li>{ITEMS.nitro.icon} A perfect {s.total}/{s.total} wins a <strong>Nitro</strong>.</li>
			<li>🛞 Every 7 days in a row wins a pit-stop item.</li>
		</ul>
		<button type="button" disabled={busy} onclick={start} class="m-btn primary mt-4 block"
			>{busy ? 'Loading…' : 'Start trivia →'}</button
		>
	{:else if !run.finished && question}
		<div class="mt-4 flex items-center justify-between gap-2">
			<span class="m-num text-xs font-bold">Q{index + 1} / {s.total}</span>
			<span class="m-num m-tag !min-h-7 {msLeft < 10_000 ? 'bg-pink' : 'bg-surface'}" role="timer"
				>{Math.ceil(msLeft / 1000)}s</span
			>
		</div>
		<div class="mt-2 h-3.5 overflow-hidden rounded-full border-2 border-border bg-surface-alt">
			<div
				class="h-full transition-[width] duration-200 {msLeft < 10_000
					? 'bg-negative'
					: 'bg-primary'}"
				style="width:{(msLeft / s.timeLimitMs) * 100}%"
			></div>
		</div>
		<p class="mt-4 font-display text-lg leading-snug font-extrabold">{question.question}</p>
		<div class="mt-3 grid gap-2 {question.options.length > 2 ? 'sm:grid-cols-2' : 'grid-cols-2'}">
			{#each question.options as o (o.value)}
				{@const isPicked = feedback?.picked === o.value}
				{@const isAnswer = feedback?.answer === o.value}
				<button
					type="button"
					disabled={busy}
					onclick={() => answer(o.value)}
					class="m-btn !min-h-12 !justify-start !text-start !text-sm disabled:!cursor-default disabled:!border-solid disabled:!text-text {isAnswer
						? 'anim-pop !bg-primary'
						: isPicked
							? 'm-shake !bg-pink'
							: ''}"
					>{#if isAnswer}✓
					{:else if isPicked}✗
					{/if}{o.label}</button
				>
			{/each}
		</div>
	{:else}
		<div class="mt-4 flex flex-wrap items-center gap-4">
			<div
				class="anim-stamp grid h-20 w-20 place-items-center rounded-full border-2 border-border font-display text-2xl font-extrabold {run.passed
					? 'bg-primary'
					: 'bg-surface-alt'}"
			>
				{run.score ?? 0}/{s.total}
			</div>
			<div class="min-w-0 flex-1">
				{#if run.passed}
					<p class="font-display text-xl font-extrabold">Passed!</p>
					<p class="text-sm font-semibold">
						+{run.rewards?.xp ?? 0} XP · streak {run.rewards?.streak ?? s.streak} 🔥
					</p>
					{#each run.rewards?.items ?? [] as k (k)}
						<p class="m-tag mt-2 w-fit bg-butter">{ITEMS[k].icon} You won a {ITEMS[k].label}!</p>
					{/each}
				{:else}
					<p class="font-display text-xl font-extrabold">Not this time.</p>
					<p class="text-sm text-text-body">
						{s.passMark} to pass. Your streak only grows on a pass, so come back tomorrow.
					</p>
				{/if}
			</div>
		</div>
		<p class="m-num mt-3 text-xs font-bold">Next set in {countdown(s.nextSetAt)}</p>
	{/if}
</section>
