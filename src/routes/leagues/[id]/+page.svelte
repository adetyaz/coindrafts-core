<script lang="ts">
	import PlayerLink from '$lib/components/ui/PlayerLink.svelte';
	import { onMount, type ComponentProps } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';
	import LeagueNight from '$lib/components/LeagueNight.svelte';

	type Member = {
		id: string;
		userId: string;
		username: string;
		wins: number;
		losses: number;
		points: number;
		joinedAt: string;
	};

	type League = {
		id: string;
		name: string;
		type: string;
		inviteCode: string | null;
		seasonStart: string;
		seasonEnd: string;
	};

	let league = $state<League | null>(null);
	let members = $state<Member[]>([]);
	let viewer = $state<{ isMember: boolean; isCreator: boolean }>({
		isMember: false,
		isCreator: false
	});
	let loading = $state(true);
	let night = $state<ComponentProps<typeof LeagueNight>['night'] | null>(null);
	let homeTrack = $state<string | null>(null);
	let confirmingDelete = $state(false);
	let busy = $state(false);

	async function leaveOrDelete() {
		if (!league) return;
		busy = true;
		try {
			const res = viewer.isCreator
				? await fetch(`/api/leagues/${league.id}`, { method: 'DELETE' })
				: await fetch(`/api/leagues/${league.id}/leave`, { method: 'POST' });
			if (!res.ok) {
				toast((await res.json().catch(() => ({})))?.error ?? 'Something went wrong', 'error');
				return;
			}
			toast(viewer.isCreator ? 'League deleted' : 'You left the league', 'success');
			goto(resolve('/leagues'));
		} finally {
			busy = false;
		}
	}

	onMount(async () => {
		const id = page.params.id;
		try {
			const res = await fetch(`/api/leagues/${id}`);
			if (res.ok) {
				const data = await res.json();
				league = data.league;
				members = data.members;
				viewer = data.viewer ?? viewer;
				night = data.night ?? null;
				homeTrack = data.homeTrack ?? null;
			} else {
				toast('League not found', 'error');
				goto(resolve('/leagues'));
			}
		} catch {
			toast('Failed to load league', 'error');
		} finally {
			loading = false;
		}
	});

	function copyInviteCode() {
		if (league?.inviteCode) {
			navigator.clipboard.writeText(league.inviteCode);
			toast('Invite code copied!', 'success');
		}
	}
</script>

<div class="m-page">
	{#if loading}
		<div class="h-32 animate-pulse rounded-[20px] bg-surface-alt"></div>
	{:else if league}
		<header>
			<a href={resolve('/leagues')} class="text-sm font-bold text-text no-underline">← Leagues</a>
			<div class="mt-2 flex flex-wrap items-center gap-2">
				<span class="m-plate"
					><span>{league.type === 'private' ? 'Private league' : 'Public league'}</span></span
				>
				{#if homeTrack}<span class="m-tag bg-sky-tint">🏁 Home track: {homeTrack}</span>{/if}
			</div>
			<h1 class="m-title mt-2">{league.name}</h1>
			<p class="m-lead mt-1">
				{members.length}
				{members.length === 1 ? 'member' : 'members'}. Every driver you finish ahead of is a win,
				worth 3 points.
			</p>
		</header>

		<!-- Phones: league night first (it's what you act on); the table follows. -->
		<div class="mt-6 grid items-start gap-6 nav:grid-cols-[minmax(0,1fr)_22rem]">
			<section class="min-w-0 max-nav:order-2" aria-labelledby="standings">
				<h2 id="standings" class="m-eyebrow mb-3">Standings this season</h2>
				{#if members.length === 0}
					<p class="dashed m-card text-center text-sm font-semibold">No members yet.</p>
				{:else}
					<ol class="flex flex-col gap-2">
						<li
							class="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem_2.5rem_3.5rem] gap-2 px-3 text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase"
							aria-hidden="true"
						>
							<span>#</span><span>Driver</span><span class="text-end">W</span><span class="text-end"
								>L</span
							><span class="text-end">Pts</span>
						</li>
						{#each members as member, i (member.id)}
							<li
								class="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem_2.5rem_3.5rem] items-center gap-2 rounded-[14px] border-2 border-border px-3 py-2.5 {i ===
								0
									? 'bg-butter'
									: 'bg-surface'}"
							>
								<span class="m-num text-sm font-bold">{i === 0 ? '🏆' : i + 1}</span>
								<PlayerLink
									id={member.userId}
									name={member.username}
									class="truncate text-sm font-bold"
								/>
								<span class="m-num text-end text-sm font-bold text-positive-ink"
									><span class="sr-only">Wins </span>{member.wins}</span
								>
								<span class="m-num text-end text-sm font-bold text-negative-ink"
									><span class="sr-only">Losses </span>{member.losses}</span
								>
								<span class="m-num text-end text-sm font-bold"
									><span class="sr-only">Points </span>{member.points}</span
								>
							</li>
						{/each}
					</ol>
				{/if}
			</section>

			<div class="flex min-w-0 flex-col gap-4 max-nav:order-1">
				{#if night && viewer.isMember}
					<LeagueNight {night} {homeTrack} />
				{/if}
				{#if league.inviteCode}
					<div class="halftone m-card !bg-butter">
						<div class="m-eyebrow mb-3">Invite code</div>
						<div class="mb-4.5 font-mono text-[26px] font-bold tracking-[0.06em]">
							{league.inviteCode}
						</div>
						<button onclick={copyInviteCode} class="m-btn dark w-full">Copy invite code</button>
					</div>
				{/if}
				<a href={resolve('/leagues')} class="m-btn lg w-full">&larr; All leagues</a>
				{#if viewer.isCreator}
					{#if confirmingDelete}
						<div class="rounded-[20px] border border-negative bg-surface p-4 text-sm">
							<p class="mb-3 font-bold">Delete {league.name}? Standings are lost for everyone.</p>
							<div class="flex gap-2">
								<button
									type="button"
									onclick={leaveOrDelete}
									disabled={busy}
									class="flex-1 cursor-pointer rounded-full bg-negative py-2.5 font-extrabold text-text disabled:opacity-60"
									>Delete</button
								>
								<button
									type="button"
									onclick={() => (confirmingDelete = false)}
									class="m-btn flex-1">Cancel</button
								>
							</div>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => (confirmingDelete = true)}
							class="w-full cursor-pointer rounded-full py-3 text-sm font-bold text-negative-ink hover:bg-hover"
							>Delete league</button
						>
					{/if}
				{:else if viewer.isMember}
					<button
						type="button"
						onclick={leaveOrDelete}
						disabled={busy}
						class="w-full cursor-pointer rounded-full py-3 text-sm font-bold text-negative-ink hover:bg-hover disabled:opacity-60"
						>Leave league</button
					>
				{/if}
			</div>
		</div>
	{/if}
</div>

<Toast />
