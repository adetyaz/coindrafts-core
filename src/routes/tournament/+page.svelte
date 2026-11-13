<script lang="ts">
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
	<div class="flex flex-col rounded-[20px] border border-border bg-surface p-5">
		<div class="flex items-start justify-between gap-2">
			<div class="font-black">{r.name}</div>
			{#if r.cup}<span
					class="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase"
					>Cup</span
				>{/if}
		</div>
		<div class="mt-1 font-mono text-xs text-text-muted">{closesIn(r)}</div>
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
				<a
					href={resolve('/tournament/[id]', { id: r.id })}
					class="inline-flex h-10 items-center rounded-full bg-text px-5 text-xs font-extrabold text-surface no-underline"
					>{r.status === 'open' ? "You're in · View" : 'Go to your race'}</a
				>
			{:else}
				<button
					type="button"
					disabled={busy}
					onclick={() => join(r.id)}
					class="h-10 cursor-pointer rounded-full border-none bg-primary px-5 text-xs font-extrabold text-text disabled:opacity-50"
					>Join{r.entryFee ? ` · ⚙️ ${r.entryFee}` : ''}</button
				>
				<a
					href={resolve('/tournament/[id]', { id: r.id })}
					class="inline-flex h-10 items-center rounded-full border border-border px-4 text-xs font-bold text-text no-underline"
					>View</a
				>
			{/if}
		</div>
	</div>
{/snippet}

<div class="mx-auto max-w-[1100px] px-7 pt-7 pb-18 max-sm:px-4">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
				Tournaments
			</div>
			<h1 class="mt-2 text-[40px] leading-none font-black tracking-[-0.04em] max-sm:text-[30px]">
				Race for the podium
			</h1>
			<p class="mt-2 max-w-[60ch] text-sm text-text-muted">
				At the closing time, drivers are drawn into groups of 5 by strength; bots fill empty seats.
				Group winners race a final on a marquee track. Prizes go to the best-placed humans.
			</p>
		</div>
		<button
			type="button"
			onclick={() => (creating = !creating)}
			class="h-11 cursor-pointer rounded-full border border-border bg-surface px-5 text-sm font-bold"
			>{creating ? 'Close' : 'Create a tournament'}</button
		>
	</div>

	{#if creating}
		<div class="mt-6 grid gap-4 rounded-[24px] border border-border bg-surface p-6 sm:grid-cols-2">
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
					class="h-11 cursor-pointer rounded-full border-none bg-primary px-6 text-sm font-extrabold text-text disabled:opacity-50"
					>Create and enter</button
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
			<h2 class="mt-10 text-sm font-black tracking-[0.06em] uppercase">Yours</h2>
			<div class="mt-3 grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
				{#each mine as r (r.id)}{@render card(r)}{/each}
			</div>
		{/if}
		<h2 class="mt-10 text-sm font-black tracking-[0.06em] uppercase">Cups</h2>
		<div class="mt-3 grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
			{#each cups as r (r.id)}{@render card(r)}{:else}<p class="text-sm text-text-muted">
					The next cups are being scheduled.
				</p>{/each}
		</div>
		<h2 class="mt-10 text-sm font-black tracking-[0.06em] uppercase">Open tournaments</h2>
		<div class="mt-3 grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
			{#each open as r (r.id)}{@render card(r)}{:else}<p class="text-sm text-text-muted">
					None open right now. Create one and invite your friends.
				</p>{/each}
		</div>
	{/if}
</div>

<Toast />
