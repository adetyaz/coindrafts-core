<script lang="ts">
	// League night and seasons (GAMEPLAY_FLOWS.md, F5), for the league page.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	type Night = {
		nextNight: string;
		latest: { night: string; status: string; note: string | null } | null;
		grids: { lobbyId: string; status: string; drivers: string[] }[];
		myGrid: { lobbyId: string; status: string; drafted: boolean } | null;
		seasons: { month: string; points: number; prize: number; winner: string | null }[];
	};

	let { night, homeTrack }: { night: Night; homeTrack: string | null } = $props();

	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	function until(iso: string) {
		const s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
	}
	const when = $derived(
		new Date(night.nextNight).toLocaleString(undefined, {
			weekday: 'long',
			hour: '2-digit',
			minute: '2-digit'
		})
	);
	// "This month" ends at the next UTC month boundary.
	const seasonEnds = $derived.by(() => {
		const d = new Date(now);
		return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
	});
	const live = $derived(night.latest?.status === 'racing' && night.grids.length > 0);
	const monthLabel = (m: string) =>
		new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
</script>

<div class="m-card">
	<div class="m-eyebrow text-text-muted">League night</div>
	{#if live && night.myGrid}
		<p class="mt-2 font-black">Tonight's grid is open.</p>
		<p class="text-sm text-text-muted">
			{night.myGrid.status === 'drafting'
				? night.myGrid.drafted
					? 'Locked in. Lights out at the scheduled time.'
					: "Draft before lights out, or you'll race an auto-drafted lineup."
				: night.myGrid.status === 'live'
					? 'Racing now.'
					: 'Your race is finished.'}
		</p>
		{#if night.myGrid.status === 'drafting' && !night.myGrid.drafted}
			<!-- resolve() can't carry a query string; the path itself is resolved. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a href={`${resolve('/draft')}?lobbyId=${night.myGrid.lobbyId}`} class="m-btn primary mt-3"
				>Draft now &rarr;</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<a href={resolve('/race/[id]', { id: night.myGrid.lobbyId })} class="m-btn dark mt-3"
				>{night.myGrid.status === 'resolved' ? 'Results' : 'Watch'} &rarr;</a
			>
		{/if}
	{:else}
		<p class="mt-2 font-black">{when}</p>
		<p class="text-sm text-text-muted">
			Lights out in {until(night.nextNight)} on {homeTrack ?? 'the home track'}. Grids open an hour
			before.
		</p>
	{/if}
	{#if night.latest?.status === 'skipped'}
		<p class="mt-2 text-xs text-text-muted">{night.latest.note}</p>
	{/if}
	{#if night.grids.length > 1}
		<ul class="mt-3 flex flex-col gap-1.5 text-xs">
			{#each night.grids as g, i (g.lobbyId)}
				<li>
					<a href={resolve('/race/[id]', { id: g.lobbyId })} class="font-bold text-text"
						>Grid {i + 1}</a
					>
					<span class="text-text-muted">· {g.drivers.join(', ')}</span>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="mt-4 text-xs text-text-muted">
		Each driver you finish ahead of on league night is a win (3 pts). Versus races between members
		count too.
	</p>
</div>

<div class="m-card">
	<div class="m-eyebrow text-text-muted">Season</div>
	<p class="mt-2 text-sm">
		Ends in <span class="font-mono font-bold">{until(seasonEnds)}</span>. The leader wins the 🏆
		trophy and ⚙️ Gears, then the table resets.
	</p>
	{#if night.seasons.length}
		<ul class="mt-3 flex flex-col gap-1.5 text-sm">
			{#each night.seasons as s (s.month)}
				<li class="flex justify-between gap-2">
					<span class="text-text-muted">{monthLabel(s.month)}</span>
					<span class="font-bold"
						>{s.winner ? `🏆 ${s.winner} · ${s.points} pts` : 'No winner'}{s.prize
							? ` · ⚙️ ${s.prize}`
							: ''}</span
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
