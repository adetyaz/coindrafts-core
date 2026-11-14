<script lang="ts">
	import WorldThumb from '$lib/components/race/WorldThumb.svelte';
	// Tournaments (GAMEPLAY_FLOWS.md, F4): the game's scheduled cups, open
	// tournaments, yours in progress, and creating one. Each opens its own page
	// (registration, the draw, groups, final). Invite links land here
	// (?id=…&invite=…) and join before opening it.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import { CIRCUITS } from '$lib/race/circuits';
	import { SECTOR_LIST } from '$lib/sectorTheme';

	type Row = {
		id: string;
		name: string;
		status: string;
		cup: string | null;
		players: number;
		joined: boolean;
		durationMinutes: number | null;
		groupTrack: string | null;
		finalTrack: string | null;
		prizes: number[];
		entryFee: number;
		carPrize: string | null;
		sectorRestriction: string | null;
		registrationClosesAt: string | null;
	};

	const LENGTHS = [
		{ m: 5, label: '5 min' },
		{ m: 15, label: '15 min' },
		{ m: 30, label: '30 min' },
		{ m: 60, label: '1 hour' },
		{ m: 240, label: '4 hours' },
		{ m: 1440, label: '24 hours' }
	];
	const CLOSES = [
		{ m: 10, label: 'in 10 minutes' },
		{ m: 30, label: 'in 30 minutes' },
		{ m: 60, label: 'in 1 hour' },
		{ m: 240, label: 'in 4 hours' },
		{ m: 1440, label: 'tomorrow' }
	];

	let rows = $state<Row[]>([]);
	let phase = $state<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
	let now = $state(Date.now());
	let busy = $state(false);
	let creating = $state(false);
	let form = $state({
		name: '',
		accessType: 'public',
		durationMinutes: 15,
		groupTrack: CIRCUITS[0].id,
		finalTrack: CIRCUITS[1]?.id ?? CIRCUITS[0].id,
		sectorRestriction: '',
		closesInMinutes: 60,
		entryFee: 0
	});

	async function load() {
		try {
			const res = await fetch('/api/tournament');
			if (res.status === 401) {
				phase = 'signed-out';
				return;
			}
			if (!res.ok) throw new Error();
			rows = await res.json();
			phase = 'ready';
		} catch {
			phase = 'error';
		}
	}

	async function join(id: string, invite?: string) {
		busy = true;
		try {
			const res = await fetch(`/api/tournament/${id}/join`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invite ? { invite } : {})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				const why: Record<string, string> = {
					closed: 'Registration has closed',
					not_enough_gears: "You don't have enough Gears for the entry fee"
				};
				throw new Error(why[data.error] ?? data.error ?? "Couldn't join");
			}
			await goto(resolve('/tournament/[id]', { id }));
		} catch (e) {
			toast(e instanceof Error ? e.message : "Couldn't join", 'error');
		} finally {
			busy = false;
		}
	}

	async function create() {
		busy = true;
		try {
			const res = await fetch('/api/tournaments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...form, sectorRestriction: form.sectorRestriction || null })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? "Couldn't create the tournament");
			await goto(resolve('/tournament/[id]', { id: data.id }));
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		const p = new URLSearchParams(window.location.search);
		const id = p.get('id');
		if (id) join(id, p.get('invite') ?? undefined);
		load();
		const c = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(c);
	});

	const cups = $derived(rows.filter((r) => r.cup && r.status === 'open'));
	const mine = $derived(rows.filter((r) => r.joined && !r.cup));
	const open = $derived(rows.filter((r) => !r.cup && !r.joined && r.status === 'open'));

	function closesIn(r: Row) {
		if (r.status !== 'open') return 'Racing now';
		if (!r.registrationClosesAt) return '';
		const s = Math.max(0, Math.floor((new Date(r.registrationClosesAt).getTime() - now) / 1000));
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		return `Draw in ${d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`}`;
	}
	const lengthLabel = (m: number | null) =>
		LENGTHS.find((l) => l.m === m)?.label ?? (m ? `${m} min` : '');
</script>

{#snippet card(r: Row)}
	<div class="m-card flex flex-col gap-1">
		<div class="relative mb-2">
			<WorldThumb theme="village" paint="var(--color-mint)" label={false} />
			{#if r.cup}<span class="m-tag absolute -end-1 -top-2 rotate-3 bg-butter">🏆 Cup</span>{/if}
		</div>
		<div class="font-display text-xl font-extrabold">{r.name}</div>
		<div class="m-num text-xs font-bold">{closesIn(r)}</div>
		<div class="mt-3 text-sm">
			{r.groupTrack} groups → {r.finalTrack} final · {lengthLabel(r.durationMinutes)} races
		</div>
		<div class="mt-1 text-sm">
			🏆 ⚙️ {r.prizes.map((p) => p.toLocaleString()).join(' / ')}
			{#if r.carPrize}<span class="font-bold"> + a {r.carPrize} car</span>{/if}
		</div>
		<div class="mt-1 text-xs text-text-muted">
			{r.players}
			{r.players === 1 ? 'driver' : 'drivers'} ·
			{r.entryFee ? `entry ⚙️ ${r.entryFee}` : 'free entry'}
			{#if r.sectorRestriction}· {r.sectorRestriction.toUpperCase()} only{/if}
		</div>
		<div class="mt-4 flex gap-2">
			{#if r.joined}
				<a href={resolve('/tournament/[id]', { id: r.id })} class="m-btn dark sm"
					>{r.status === 'open' ? "You're in · View" : 'Go to your race'}</a
				>
			{:else}
				<button
					type="button"
					disabled={busy}
					onclick={() => join(r.id)}
					class="m-btn primary sm disabled:opacity-50"
					>Join{r.entryFee ? ` · ⚙️ ${r.entryFee}` : ''}</button
				>
				<a href={resolve('/tournament/[id]', { id: r.id })} class="m-btn sm">View</a>
			{/if}
		</div>
	</div>
{/snippet}

<div class="m-page">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<span class="m-eyebrow">Compete</span>
			<h1 class="m-title mt-1">Tournaments.</h1>
			<p class="m-lead mt-1">
				At the closing time, drivers are drawn into groups of 5 by strength; bots fill empty seats.
				Group winners race a final on a marquee track. Prizes go to the best-placed humans.
			</p>
		</div>
		<button type="button" onclick={() => (creating = !creating)} class="m-btn"
			>{creating ? 'Close' : 'Create a tournament'}</button
		>
	</div>

	{#if creating}
		<div class="m-card mt-6 grid gap-4 sm:grid-cols-2">
			<label class="text-sm font-bold sm:col-span-2"
				>Name
				<input
					bind:value={form.name}
					maxlength="80"
					placeholder="Friday Night Grand Prix"
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				/>
			</label>
			<label class="text-sm font-bold"
				>Who can join
				<select
					bind:value={form.accessType}
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				>
					<option value="public">Anyone</option>
					<option value="private">Invite link only</option>
				</select>
			</label>
			<label class="text-sm font-bold"
				>Race length
				<select
					bind:value={form.durationMinutes}
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				>
					{#each LENGTHS as l (l.m)}<option value={l.m}>{l.label}</option>{/each}
				</select>
			</label>
			<label class="text-sm font-bold"
				>Group-stage track
				<select
					bind:value={form.groupTrack}
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				>
					{#each CIRCUITS as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
				</select>
			</label>
			<label class="text-sm font-bold"
				>Final track
				<select
					bind:value={form.finalTrack}
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				>
					{#each CIRCUITS.filter((c) => c.id !== form.groupTrack) as c (c.id)}<option value={c.id}
							>{c.name}</option
						>{/each}
				</select>
			</label>
			<label class="text-sm font-bold"
				>Sectors
				<select
					bind:value={form.sectorRestriction}
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				>
					<option value="">All five</option>
					{#each SECTOR_LIST as s (s.id)}<option value={s.id}>{s.label} only</option>{/each}
				</select>
			</label>
			<label class="text-sm font-bold"
				>Registration closes (the draw)
				<select
					bind:value={form.closesInMinutes}
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				>
					{#each CLOSES as c (c.m)}<option value={c.m}>{c.label}</option>{/each}
				</select>
			</label>
			<label class="text-sm font-bold"
				>Entry fee in Gears (optional)
				<input
					type="number"
					min="0"
					step="10"
					bind:value={form.entryFee}
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 font-mono text-sm font-normal"
				/>
				<span class="text-xs font-normal text-text-muted"
					>The pot goes to the top 3 humans: 50 / 30 / 20.</span
				>
			</label>
			<p class="text-xs text-text-muted sm:col-span-2">
				The game adds ⚙️ 1,000 / 400 / 200 in prizes once 4 or more people have joined.
			</p>
			<div class="sm:col-span-2">
				<button
					type="button"
					disabled={busy || !form.name.trim()}
					onclick={create}
					class="m-btn primary disabled:opacity-50">Create and enter</button
				>
			</div>
		</div>
	{/if}

	{#if phase === 'loading'}
		<div class="mt-8 h-48 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else if phase === 'signed-out'}
		<p class="mt-8 text-sm text-text-muted">Sign in to enter tournaments.</p>
	{:else if phase === 'error'}
		<p class="mt-8 text-sm text-negative-ink">Couldn't load tournaments. Refresh to try again.</p>
	{:else}
		{#if mine.length}
			<h2 class="m-eyebrow mt-10">Yours</h2>
			<div
				class="mt-3 grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4"
			>
				{#each mine as r (r.id)}{@render card(r)}{/each}
			</div>
		{/if}
		<h2 class="m-eyebrow mt-10">Cups</h2>
		<div
			class="mt-3 grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4"
		>
			{#each cups as r (r.id)}{@render card(r)}{:else}<p class="text-sm text-text-muted">
					The next cups are being scheduled.
				</p>{/each}
		</div>
		<h2 class="m-eyebrow mt-10">Open tournaments</h2>
		<div
			class="mt-3 grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4"
		>
			{#each open as r (r.id)}{@render card(r)}{:else}<p class="text-sm text-text-muted">
					None open right now. Create one and invite your friends.
				</p>{/each}
		</div>
	{/if}
</div>

<Toast />
