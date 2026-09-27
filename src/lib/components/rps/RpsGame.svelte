<script lang="ts">
	import { onMount } from 'svelte';
	import {
		compare,
		SHAPES,
		THROW_SECONDS,
		type RpsRoundResult,
		type RpsShape,
		type RpsVariant,
		type RpsView
	} from '$lib/rps';
	import RpsToken from './RpsToken.svelte';
	import RpsRules from './RpsRules.svelte';

	let {
		mode = 'match',
		variant: practiceVariant = 'spock',
		matchId = '',
		opponentLabel = 'Opponent',
		onDone
	}: {
		/** 'practice' plays the house locally; 'match' is a live best-of-3 via the API. */
		mode?: 'practice' | 'match';
		variant?: RpsVariant;
		matchId?: string;
		opponentLabel?: string;
		onDone?: (iWon: boolean) => void;
	} = $props();

	type Outcome = 'win' | 'loss' | 'tie';

	const REVEAL_MS = 2600;

	let rulesOpen = $state(false);
	let now = $state(Date.now());

	// ── Practice (vs the house, client-only) ─────────────────────────────
	let pScore = $state(0);
	let pMine = $state<RpsShape | null>(null);
	let pTheirs = $state<RpsShape | null>(null);

	function practiceThrow(shape: RpsShape) {
		pMine = shape;
		pTheirs = null;
		setTimeout(() => {
			const shapes = SHAPES[practiceVariant];
			const house = shapes[Math.floor(Math.random() * shapes.length)];
			pTheirs = house;
			pScore += compare(shape, house);
		}, 900);
	}

	function practiceReset() {
		pMine = null;
		pTheirs = null;
	}

	// ── Match (live, server-authoritative) ───────────────────────────────
	let view = $state<RpsView | null>(null);
	let loadError = $state('');
	let clockOffset = 0;
	let seenRounds = -1;
	let reveal = $state<RpsRoundResult | null>(null);
	let revealUntil = $state(0);
	let throwing = $state(false);

	function ingest(v: RpsView) {
		clockOffset = new Date(v.serverNow).getTime() - Date.now();
		// Replay a reveal only for rounds settled while we're watching; on first
		// load, jump straight to the current round (or the final result).
		if (seenRounds === -1) {
			seenRounds = v.history.length;
			if (v.winnerId) reveal = v.history.at(-1) ?? null;
		} else if (v.history.length > seenRounds) {
			seenRounds = v.history.length;
			reveal = v.history.at(-1) ?? null;
			revealUntil = Date.now() + REVEAL_MS;
		}
		view = v;
	}

	async function poll() {
		try {
			const res = await fetch(`/api/rps/${matchId}`);
			if (!res.ok)
				throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to load match');
			ingest(await res.json());
			loadError = '';
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load match';
		}
	}

	async function matchThrow(shape: RpsShape) {
		if (throwing) return;
		throwing = true;
		try {
			const res = await fetch(`/api/rps/${matchId}/throw`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ shape })
			});
			if (res.ok) ingest(await res.json());
			else await poll();
		} finally {
			throwing = false;
		}
	}

	onMount(() => {
		const tick = setInterval(() => (now = Date.now()), 250);
		if (mode !== 'match') return () => clearInterval(tick);
		poll();
		const p = setInterval(() => {
			if (!view?.winnerId) poll();
		}, 1000);
		return () => {
			clearInterval(tick);
			clearInterval(p);
		};
	});

	// ── One render model for both modes ──────────────────────────────────
	const variant = $derived<RpsVariant>(
		mode === 'match' ? (view?.variant ?? 'spock') : practiceVariant
	);
	const isFinal = $derived(mode === 'match' && !!view?.winnerId);

	const screen = $derived.by(() => {
		if (mode === 'practice') {
			if (!pMine) return { phase: 'pick' as const };
			if (!pTheirs) return { phase: 'waiting' as const, mine: pMine };
			const o = compare(pMine, pTheirs);
			const outcome: Outcome = o === 1 ? 'win' : o === -1 ? 'loss' : 'tie';
			return { phase: 'result' as const, mine: pMine, theirs: pTheirs, outcome };
		}
		if (!view) return { phase: 'loading' as const };
		if (reveal && (isFinal || now < revealUntil)) {
			return {
				phase: 'result' as const,
				mine: reveal.mine,
				theirs: reveal.theirs,
				outcome: reveal.outcome,
				round: reveal
			};
		}
		if (view.myThrow) return { phase: 'waiting' as const, mine: view.myThrow };
		return { phase: 'pick' as const };
	});

	const secondsLeft = $derived(
		view
			? Math.max(
					0,
					Math.min(
						THROW_SECONDS,
						Math.ceil((new Date(view.deadline).getTime() - (now + clockOffset)) / 1000)
					)
				)
			: THROW_SECONDS
	);

	const headline = $derived.by(() => {
		if (screen.phase !== 'result') return '';
		if (isFinal) return view?.iWon ? 'You win' : 'You lose';
		if (mode === 'match')
			return screen.outcome === 'win'
				? 'Round to you'
				: screen.outcome === 'loss'
					? 'Round to them'
					: 'Tie — go again';
		return screen.outcome === 'win' ? 'You win' : screen.outcome === 'loss' ? 'You lose' : 'Draw';
	});

	const theirLabel = $derived(mode === 'practice' ? 'The house picked' : `${opponentLabel} picked`);
	const title = $derived(
		variant === 'classic'
			? ['Rock', 'Paper', 'Scissors']
			: ['Rock', 'Paper', 'Scissors', 'Lizard', 'Spock']
	);

	// Picker layout: shape → position in a 0–100 box, same arrangement as the rules diagram.
	const LAYOUT: Record<RpsVariant, Partial<Record<RpsShape, [number, number]>>> = {
		classic: { paper: [22, 22], scissors: [78, 22], rock: [50, 78] },
		spock: {
			scissors: [50, 14],
			paper: [86, 42],
			rock: [72, 86],
			lizard: [28, 86],
			spock: [14, 42]
		}
	};
	const points = $derived(SHAPES[variant].map((s) => LAYOUT[variant][s]!));
	const polygon = $derived(points.map(([x, y]) => `${x},${y}`).join(' '));
	const pickSize = $derived(
		variant === 'classic' ? 'clamp(120px, 26vw, 196px)' : 'clamp(96px, 20vw, 144px)'
	);
	const bigSize = 'clamp(130px, 22vw, 290px)';
</script>

<section
	class="relative flex min-h-[100dvh] flex-col items-center px-6 pt-12 pb-14 text-white"
	style="font-family:var(--font-rps);background:radial-gradient(circle at 50% 0%, var(--color-rps-bg-top), var(--color-rps-bg-bottom))"
>
	<!-- Header -->
	<header
		class="flex w-full max-w-[700px] items-center justify-between rounded-2xl p-5 max-sm:rounded-lg max-sm:p-3 max-sm:pl-6"
		style="border:3px solid var(--color-rps-outline)"
	>
		<h1
			class="text-[40px] leading-[0.85] font-bold uppercase max-sm:text-[21px] {variant === 'spock'
				? 'text-[32px]'
				: ''}"
			style="text-shadow:0 3px 3px rgba(0,0,0,0.2)"
		>
			{#each title as word (word)}<span class="block">{word}</span>{/each}
		</h1>
		<div
			class="flex min-w-[150px] flex-col items-center rounded-lg bg-white px-6 py-3 max-sm:min-w-[80px] max-sm:px-4 max-sm:py-2"
		>
			<span
				class="text-base font-semibold tracking-[0.15em] uppercase max-sm:text-[10px]"
				style="color:var(--color-rps-score)"
			>
				{mode === 'match' ? 'Best of 3' : 'Score'}
			</span>
			<span
				class="text-[64px] leading-none font-bold max-sm:text-[40px]"
				style="color:var(--color-rps-ink)"
			>
				{#if mode === 'match'}{view?.myScore ?? 0}<span class="px-1 opacity-40">–</span
					>{view?.theirScore ?? 0}{:else}{pScore}{/if}
			</span>
		</div>
	</header>

	{#if mode === 'match' && view && !isFinal && screen.phase !== 'result'}
		<p class="mt-6 text-sm font-semibold tracking-[0.2em] uppercase opacity-80" aria-live="polite">
			Round {view.round} · {secondsLeft}s{#if screen.phase === 'waiting'}
				· {view.theyHaveThrown ? 'they’re in' : 'waiting for them'}{/if}
		</p>
	{/if}

	<div class="flex w-full flex-1 items-center justify-center py-10">
		{#if screen.phase === 'loading'}
			<p class="tracking-[0.2em] uppercase opacity-70">{loadError || 'Loading match…'}</p>
		{:else if screen.phase === 'pick'}
			<div class="relative aspect-square w-full max-w-[440px]">
				<svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full" aria-hidden="true">
					<polygon
						points={polygon}
						fill="none"
						stroke="rgba(0,0,0,0.2)"
						stroke-width="3"
						stroke-linejoin="round"
					/>
				</svg>
				{#each SHAPES[variant] as shape (shape)}
					{@const [x, y] = LAYOUT[variant][shape]!}
					<div class="absolute -translate-x-1/2 -translate-y-1/2" style="left:{x}%;top:{y}%">
						<RpsToken
							{shape}
							size={pickSize}
							disabled={throwing}
							onclick={() => (mode === 'practice' ? practiceThrow(shape) : matchThrow(shape))}
						/>
					</div>
				{/each}
			</div>
		{:else}
			{@const mine = screen.mine}
			{@const theirs = screen.phase === 'result' ? screen.theirs : null}
			<div
				class="grid w-full max-w-[940px] grid-cols-[1fr_auto_1fr] items-center gap-8 max-md:grid-cols-2 max-md:gap-y-10"
			>
				<div class="flex flex-col items-center gap-10 max-md:flex-col-reverse max-md:gap-6">
					<span class="text-2xl font-bold tracking-[0.12em] uppercase max-sm:text-[15px]"
						>You picked</span
					>
					<RpsToken
						shape={mine}
						size={bigSize}
						winner={screen.phase === 'result' && screen.outcome === 'win'}
					/>
				</div>

				<div
					class="flex flex-col items-center gap-4 max-md:order-last max-md:col-span-2 {screen.phase ===
					'result'
						? ''
						: 'invisible max-md:hidden'}"
				>
					<p
						class="text-[56px] leading-none font-bold uppercase max-sm:text-[48px]"
						aria-live="polite"
					>
						{headline}
					</p>
					{#if screen.phase === 'result' && 'round' in screen && (screen.round?.iTimedOut || screen.round?.theyTimedOut)}
						<p class="text-sm tracking-wide uppercase opacity-70">
							{screen.round?.iTimedOut
								? 'You ran out of time — random throw'
								: 'They ran out of time — random throw'}
						</p>
					{/if}
					{#if mode === 'practice'}
						<button
							type="button"
							onclick={practiceReset}
							class="w-[220px] cursor-pointer rounded-lg bg-white py-4 text-base tracking-[0.15em] uppercase transition hover:text-[var(--color-rps-rock)]"
							style="color:var(--color-rps-ink)">Play again</button
						>
					{:else if isFinal}
						<p class="text-sm tracking-wide uppercase opacity-70">
							{view?.iWon ? 'Your terms apply' : 'Their terms apply'}
						</p>
						<button
							type="button"
							onclick={() => onDone?.(!!view?.iWon)}
							class="w-[220px] cursor-pointer rounded-lg bg-white py-4 text-base tracking-[0.15em] uppercase transition hover:text-[var(--color-rps-rock)]"
							style="color:var(--color-rps-ink)">Continue</button
						>
					{/if}
				</div>

				<div class="flex flex-col items-center gap-10 max-md:flex-col-reverse max-md:gap-6">
					<span
						class="text-center text-2xl font-bold tracking-[0.12em] uppercase max-sm:text-[15px]"
						>{theirLabel}</span
					>
					{#if theirs}
						<RpsToken
							shape={theirs}
							size={bigSize}
							winner={screen.phase === 'result' && screen.outcome === 'loss'}
						/>
					{:else}
						<span class="grid place-items-center" style="width:{bigSize};height:{bigSize}">
							<span class="h-[78%] w-[78%] rounded-full" style="background:rgba(0,0,0,0.12)"></span>
						</span>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<button
		type="button"
		onclick={() => (rulesOpen = true)}
		class="absolute right-8 bottom-8 cursor-pointer rounded-lg border border-white/70 px-9 py-2.5 text-base tracking-[0.15em] uppercase transition hover:bg-white/10 max-sm:static max-sm:mt-auto"
	>
		Rules
	</button>
</section>

{#if rulesOpen}
	<RpsRules {variant} onclose={() => (rulesOpen = false)} />
{/if}
