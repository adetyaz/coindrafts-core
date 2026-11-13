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

<div class="rounded-[24px] border border-border bg-surface p-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-text-muted uppercase">
				Daily trivia
			</div>
			<div class="mt-1 text-lg font-black">
				{s ? `${s.total} questions · about a minute` : 'Today’s questions'}
			</div>
		</div>
		{#if s}
			<div class="text-right">
				<div class="font-mono text-2xl font-bold">🔥 {s.streak}</div>
				<div class="text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase">
					day streak
				</div>
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="mt-4 h-24 animate-pulse rounded-2xl bg-surface-alt"></div>
	{:else if !s}
		<p class="mt-4 text-sm text-text-muted">{error || 'Sign in to play today’s trivia.'}</p>
	{:else if !run}
		<p class="mt-4 text-sm text-text-muted">
			Pass with {s.passMark}/{s.total} to keep your streak. A perfect {s.total}/{s.total} wins a
			{ITEMS.nitro.icon} Nitro; every 7 days in a row wins a pit-stop item.
		</p>
		<button
			type="button"
			disabled={busy}
			onclick={start}
			class="mt-4 h-11 cursor-pointer rounded-full border-none bg-primary px-6 text-sm font-extrabold text-text disabled:opacity-50"
			>{busy ? 'Loading…' : 'Start'}</button
		>
	{:else if !run.finished && question}
		<div class="mt-4 flex items-center justify-between font-mono text-xs text-text-muted">
			<span>Question {index + 1} of {s.total}</span>
			<span class={msLeft < 10_000 ? 'font-bold text-negative-ink' : ''}
				>{Math.ceil(msLeft / 1000)}s</span
			>
		</div>
		<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-alt">
			<div
				class="h-full bg-primary transition-[width] duration-200"
				style="width:{(msLeft / s.timeLimitMs) * 100}%"
			></div>
		</div>
		<p class="mt-4 font-bold">{question.question}</p>
		<div class="mt-3 grid gap-2 {question.options.length > 2 ? 'sm:grid-cols-2' : 'grid-cols-2'}">
			{#each question.options as o (o.value)}
				{@const isPicked = feedback?.picked === o.value}
				{@const isAnswer = feedback?.answer === o.value}
				<button
					type="button"
					disabled={busy}
					onclick={() => answer(o.value)}
					class="min-h-11 cursor-pointer rounded-2xl border px-4 py-2 text-left text-sm font-bold disabled:cursor-default {isAnswer
						? 'border-positive bg-positive text-text'
						: isPicked
							? 'border-negative bg-negative text-text'
							: 'border-border bg-bg'}">{o.label}</button
				>
			{/each}
		</div>
	{:else}
		<div class="mt-4">
			<div class="text-3xl font-black">{run.score ?? 0}/{s.total}</div>
			{#if run.passed}
				<p class="mt-1 text-sm font-bold text-positive-ink">
					Passed. +{run.rewards?.xp ?? 0} XP · streak {run.rewards?.streak ?? s.streak}
				</p>
				{#each run.rewards?.items ?? [] as k (k)}
					<p class="mt-1 text-sm font-bold">{ITEMS[k].icon} You won a {ITEMS[k].label}!</p>
				{/each}
			{:else}
				<p class="mt-1 text-sm text-text-muted">
					{s.passMark} to pass. Your streak only grows on a pass, so come back tomorrow.
				</p>
			{/if}
			<p class="mt-3 font-mono text-xs text-text-muted">
				Next set in {countdown(s.nextSetAt)}
			</p>
		</div>
	{/if}
</div>
