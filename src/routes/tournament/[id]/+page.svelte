<script lang="ts">
	import PlayerLink from '$lib/components/ui/PlayerLink.svelte';
	// One tournament (GAMEPLAY_FLOWS.md, F4): registration → the draw → groups →
	// final → podium. The draw animates the first time you see it (pots fill the
	// groups seat by seat) and the page is shareable as is.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';

	type Seat = {
		userId: string;
		username: string;
		isBot: boolean;
		isMe: boolean;
		pot: number | null;
		rank: number | null;
		drafted: boolean;
	};
	type Stage = {
		lobbyId: string;
		label: string;
		isFinal: boolean;
		status: string;
		circuit: string | null;
		draftClosesAt: string | null;
		startAt: string | null;
		endAt: string | null;
		seats: Seat[];
	};
	type Detail = {
		id: string;
		name: string;
		status: string;
		cup: string | null;
		accessType: string;
		isCreator: boolean;
		durationMinutes: number | null;
		groupTrack: string | null;
		finalTrack: string | null;
		sectorRestriction: string | null;
		prizes: number[];
		entryFee: number;
		pot: number;
		carPrize: string | null;
		registrationClosesAt: string | null;
		drawnAt: string | null;
		joined: boolean;
		entrants: {
			username: string;
			xp: number;
			pot: number | null;
			groupNo: number | null;
			isMe: boolean;
		}[];
		stages: Stage[];
		myStage: {
			lobbyId: string;
			label: string;
			status: string;
			drafted: boolean;
			draftClosesAt: string | null;
		} | null;
		results: { username: string; place: number; gears: number; car?: string }[] | null;
	};

	const id = page.params.id ?? '';
	let t = $state<Detail | null>(null);
	let error = $state('');
	let busy = $state(false);
	let now = $state(Date.now());
	let inviteLink = $state('');
	// The draw animates once per visit, and only when it's fresh.
	let animateDraw = $state(false);
	let seenDraw = false;

	async function load() {
		try {
			const res = await fetch(`/api/tournament/${id}`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? "Couldn't load the tournament");
			if (!seenDraw && data.drawnAt) {
				seenDraw = true;
				animateDraw = Date.now() - new Date(data.drawnAt).getTime() < 10 * 60_000;
			}
			t = data;
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		}
	}

	onMount(() => {
		load();
		const p = setInterval(load, 5000);
		const c = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(p);
			clearInterval(c);
		};
	});

	async function post(path: string, body: Record<string, unknown> = {}) {
		busy = true;
		try {
			const res = await fetch(`/api/tournament/${id}/${path}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
			return data;
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
			return null;
		} finally {
			busy = false;
		}
	}

	async function join() {
		if (await post('join')) await load();
	}
	async function startNow() {
		if (await post('close-registration')) await load();
	}
	async function invite() {
		const data = await post('invite');
		if (data?.joinUrl) inviteLink = data.joinUrl;
	}
	async function share() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast('Link copied', 'success');
		} catch {
			toast(window.location.href, 'info');
		}
	}

	function countdown(to: string | null) {
		if (!to) return '';
		const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
	}

	const groups = $derived(t?.stages.filter((s) => !s.isFinal) ?? []);
	const final = $derived(t?.stages.find((s) => s.isFinal) ?? null);
	const potCount = $derived(Math.max(0, ...(t?.entrants.map((e) => e.pot ?? 0) ?? [0])));
	const PLACE = ['🥇', '🥈', '🥉'];
</script>

{#snippet seatRow(s: Seat, i: number, stageIndex: number)}
	<li
		class="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm {s.isMe
			? 'bg-text text-surface'
			: 'bg-bg'} {animateDraw ? 'draw-in' : ''}"
		style={animateDraw ? `animation-delay:${(i * groups.length + stageIndex) * 140}ms` : ''}
	>
		<span class="flex min-w-0 items-center gap-2">
			{#if s.rank}<span class="w-5 font-mono text-xs font-bold">{s.rank}</span>{/if}
			<PlayerLink id={s.userId} name={s.isMe ? 'You' : s.username} class="truncate font-bold" />
			{#if s.isBot}<span
					class="rounded px-1.5 py-0.5 text-[9px] font-extrabold {s.isMe
						? 'bg-surface text-text'
						: 'bg-text text-surface'}">BOT</span
				>{/if}
		</span>
		<span class="shrink-0 font-mono text-[10px] opacity-70"
			>{s.pot ? `Pot ${s.pot}` : s.isBot ? 'fills a seat' : ''}</span
		>
	</li>
{/snippet}

<div class="mx-auto max-w-[1100px] px-7 pt-7 pb-18 max-sm:px-4">
	<a href={resolve('/tournament')} class="text-sm font-bold text-text-muted no-underline"
		>&larr; Tournaments</a
	>
	{#if !t}
		{#if error}<p class="mt-6 text-sm text-negative-ink">{error}</p>{:else}<div
				class="mt-6 h-64 animate-pulse rounded-[24px] bg-surface-alt"
			></div>{/if}
	{:else}
		<div class="mt-4 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
					{t.cup ? 'Cup' : t.accessType === 'private' ? 'Private tournament' : 'Tournament'} ·
					{t.status === 'open'
						? 'Registration open'
						: t.status === 'active'
							? 'Racing'
							: t.status === 'resolved'
								? 'Finished'
								: 'Cancelled'}
				</div>
				<h1 class="mt-1 text-[38px] leading-none font-black tracking-[-0.04em] max-sm:text-[28px]">
					{t.name}
				</h1>
				<p class="mt-2 text-sm text-text-muted">
					Groups at {t.groupTrack} · final at {t.finalTrack} · {t.durationMinutes} min races
					{#if t.sectorRestriction}· {t.sectorRestriction.toUpperCase()} only{/if}
				</p>
			</div>
			<div class="text-right">
				<div class="text-sm font-bold">
					🏆 ⚙️ {t.prizes.map((p) => p.toLocaleString()).join(' / ')}
				</div>
				{#if t.carPrize}<div class="text-sm font-bold">
						+ a {t.carPrize} car for the winner
					</div>{/if}
				{#if t.entryFee}<div class="text-xs text-text-muted">
						Entry ⚙️ {t.entryFee} · pot ⚙️ {t.pot}
					</div>{/if}
				<button
					type="button"
					onclick={share}
					class="mt-2 h-9 cursor-pointer rounded-full border border-border bg-surface px-4 text-xs font-bold"
					>Share</button
				>
			</div>
		</div>

		{#if t.myStage && t.status === 'active'}
			<div
				class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-text p-5 text-surface"
			>
				<div>
					<div class="font-black">You're in {t.myStage.label}</div>
					<div class="text-sm opacity-80">
						{#if t.myStage.status === 'drafting' && !t.myStage.drafted}
							Draft your lineup: auto-draft in {countdown(t.myStage.draftClosesAt)}
						{:else if t.myStage.status === 'drafting'}
							Locked in. Waiting for the others.
						{:else if t.myStage.status === 'live'}
							Racing now.
						{:else}
							Race finished.
						{/if}
					</div>
				</div>
				{#if t.myStage.status === 'drafting' && !t.myStage.drafted}
					<!-- resolve() can't carry a query string; the path itself is resolved. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={`${resolve('/draft')}?lobbyId=${t.myStage.lobbyId}`}
						class="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-extrabold text-text no-underline"
						>Draft now &rarr;</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<a
						href={resolve('/race/[id]', { id: t.myStage.lobbyId })}
						class="inline-flex h-11 items-center rounded-full bg-surface px-6 text-sm font-extrabold text-text no-underline"
						>{t.myStage.status === 'resolved' ? 'Standings' : 'Watch'} &rarr;</a
					>
				{/if}
			</div>
		{/if}

		{#if t.status === 'open'}
			<div class="mt-6 rounded-[24px] border border-border bg-surface p-6">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div class="font-mono text-3xl font-bold">{countdown(t.registrationClosesAt)}</div>
						<div class="text-xs text-text-muted">until the draw and the start</div>
					</div>
					<div class="flex flex-wrap gap-2">
						{#if !t.joined}
							<button
								type="button"
								disabled={busy}
								onclick={join}
								class="h-11 cursor-pointer rounded-full border-none bg-primary px-6 text-sm font-extrabold text-text disabled:opacity-50"
								>Join{t.entryFee ? ` · ⚙️ ${t.entryFee}` : ''}</button
							>
						{:else}
							<span class="inline-flex h-11 items-center rounded-full bg-bg px-5 text-sm font-bold"
								>You're in</span
							>
						{/if}
						{#if t.isCreator}
							<button
								type="button"
								disabled={busy}
								onclick={startNow}
								class="h-11 cursor-pointer rounded-full border border-border bg-transparent px-5 text-sm font-bold"
								>Draw now</button
							>
							{#if t.accessType === 'private'}
								<button
									type="button"
									disabled={busy}
									onclick={invite}
									class="h-11 cursor-pointer rounded-full border border-border bg-transparent px-5 text-sm font-bold"
									>Invite link</button
								>
							{/if}
						{/if}
					</div>
				</div>
				{#if inviteLink}
					<p class="mt-3 font-mono text-xs break-all">{inviteLink}</p>
					<p class="text-xs text-text-muted">Each link lets one person in.</p>
				{/if}
				<h2 class="mt-6 text-sm font-black tracking-[0.06em] uppercase">
					Registered ({t.entrants.length})
				</h2>
				<p class="mt-1 text-xs text-text-muted">
					At the draw, drivers are ranked by XP into pots. Each group of 5 gets one driver from
					every pot; bots take any empty seats.
				</p>
				<ul class="mt-3 grid gap-2 sm:grid-cols-3">
					{#each t.entrants as e (e.username)}
						<li class="flex justify-between rounded-xl bg-bg px-3 py-2 text-sm">
							<span class="font-bold">{e.isMe ? 'You' : e.username}</span>
							<span class="font-mono text-xs text-text-muted">{e.xp.toLocaleString()} XP</span>
						</li>
					{:else}
						<li class="text-sm text-text-muted">No one yet. Be the first.</li>
					{/each}
				</ul>
			</div>
		{:else if t.status === 'cancelled'}
			<p class="mt-6 text-sm text-text-muted">
				Nobody joined before the closing time, so this one didn't run. Any entry fees were refunded.
			</p>
		{/if}

		{#if t.results}
			<section class="mt-8">
				<h2 class="text-2xl font-black tracking-[-0.03em]">Podium</h2>
				<p class="mt-1 text-xs text-text-muted">Prizes go to the best-placed humans.</p>
				<ol class="mt-3 grid gap-3 sm:grid-cols-3">
					{#each t.results.slice(0, 3) as r (r.place)}
						<li class="rounded-[20px] border border-border bg-surface p-5">
							<div class="text-3xl">{PLACE[r.place - 1]}</div>
							<div class="mt-1 font-black">{r.username}</div>
							<div class="font-mono text-sm">+⚙️ {r.gears.toLocaleString()}</div>
							{#if r.car}<div class="text-sm font-bold">+ {r.car}</div>{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if final}
			<section class="mt-8">
				<div class="flex flex-wrap items-end justify-between gap-2">
					<h2 class="text-2xl font-black tracking-[-0.03em]">Final · {final.circuit}</h2>
					<a href={resolve('/race/[id]', { id: final.lobbyId })} class="text-sm font-bold text-text"
						>{final.status === 'resolved' ? 'Standings' : 'Watch'} &rarr;</a
					>
				</div>
				<ul class="mt-3 grid gap-2 sm:grid-cols-2">
					{#each final.seats as s, i (s.userId)}{@render seatRow(s, i, 0)}{/each}
				</ul>
			</section>
		{/if}

		{#if groups.length}
			<section class="mt-8">
				<div class="flex flex-wrap items-end justify-between gap-2">
					<h2 class="text-2xl font-black tracking-[-0.03em]">The draw</h2>
					<span class="text-xs text-text-muted"
						>{potCount}
						{potCount === 1 ? 'pot' : 'pots'} · {groups.length}
						{groups.length === 1 ? 'group' : 'groups'} of 5 ·
						{groups.length >= 3
							? 'winners advance'
							: `top ${Math.ceil(4 / groups.length)} advance`}</span
					>
				</div>
				<div class="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each groups as g, gi (g.lobbyId)}
						<div class="rounded-[20px] border border-border bg-surface p-4">
							<div class="flex items-center justify-between">
								<div class="font-black">{g.label}</div>
								<a
									href={resolve('/race/[id]', { id: g.lobbyId })}
									class="text-xs font-bold text-text"
									>{g.status === 'drafting'
										? 'Drafting'
										: g.status === 'live'
											? 'Live · watch'
											: 'Finished'} &rarr;</a
								>
							</div>
							<div class="text-xs text-text-muted">{g.circuit}</div>
							<ul class="mt-3 flex flex-col gap-1.5">
								{#each g.seats as s, i (s.userId)}{@render seatRow(s, i, gi)}{/each}
							</ul>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<Toast />

<style>
	/* The draw: each seat drops into its group in turn. */
	.draw-in {
		animation: draw-in 420ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
	}
	@keyframes draw-in {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.draw-in {
			animation: none;
		}
	}
</style>
