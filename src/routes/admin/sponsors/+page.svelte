<script lang="ts">
	// Operator review for sponsor bookings (GAMEPLAY_FLOWS.md, F12): mark paid,
	// approve or reject. Only accounts in ADMIN_USER_IDS get data back.
	import { onMount } from 'svelte';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import { circuitById } from '$lib/race/circuits';
	import { AD_SLOTS, STATUS_LABEL, usd, type AdSlot, type BookingStatus } from '$lib/sponsors';

	type Row = {
		id: string;
		kind: 'ad' | 'tournament';
		status: BookingStatus;
		startDate: string;
		endDate: string;
		circuit: string | null;
		slot: AdSlot | null;
		title: string | null;
		prize: string | null;
		livery: string | null;
		artwork: string | null;
		priceCents: number;
		views: number;
		sponsor: string;
		email: string;
	};

	let rows = $state<Row[] | null>(null);
	let denied = $state(false);
	let busy = $state(false);
	let notes = $state<Record<string, string>>({});

	async function load() {
		const res = await fetch('/api/admin/sponsors').catch(() => null);
		if (!res?.ok) {
			denied = true;
			return;
		}
		rows = await res.json();
	}
	onMount(load);

	async function act(id: string, action: 'paid' | 'approve' | 'reject') {
		busy = true;
		try {
			const res = await fetch('/api/admin/sponsors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, action, note: notes[id] })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Failed');
			await load();
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<div class="mx-auto max-w-[1000px] px-7 pt-7 pb-18 max-sm:px-4">
	<h1 class="text-[32px] leading-none font-black tracking-[-0.04em]">Sponsor bookings</h1>
	{#if denied}
		<p class="mt-6 text-sm text-text-muted">Not found.</p>
	{:else if !rows}
		<div class="mt-6 h-40 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else}
		<ul class="mt-6 flex flex-col gap-3">
			{#each rows as r (r.id)}
				<li class="rounded-[20px] border border-border bg-surface p-5 text-sm">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div class="font-black">
								{r.sponsor} ·
								{r.kind === 'ad'
									? `${AD_SLOTS[r.slot as AdSlot]?.label} at ${circuitById(r.circuit).name}`
									: `Tournament: ${r.title}`}
							</div>
							<div class="font-mono text-xs text-text-muted">
								{r.startDate} → {r.endDate} · {usd(r.priceCents)} · {r.email}
							</div>
							{#if r.prize}<div class="text-xs">Prize: {r.prize}</div>{/if}
							{#if r.livery}<div class="text-xs">
									Livery <span
										class="inline-block h-3 w-6 rounded align-middle"
										style="background:{r.livery}"
									></span>
								</div>{/if}
							<div class="mt-1 text-xs font-bold">
								{STATUS_LABEL[r.status]}{r.kind === 'ad' ? ` · ${r.views} views` : ''}
							</div>
						</div>
						{#if r.artwork}<img
								src={r.artwork}
								alt="Artwork from {r.sponsor}"
								class="max-h-24 max-w-60 rounded border border-border"
							/>{/if}
					</div>
					{#if r.status === 'awaiting_payment' || r.status === 'awaiting_approval'}
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<input
								bind:value={notes[r.id]}
								placeholder="Note to the sponsor (optional)"
								class="h-9 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-xs"
							/>
							{#if r.status === 'awaiting_payment'}
								<button
									type="button"
									disabled={busy}
									onclick={() => act(r.id, 'paid')}
									class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-4 text-xs font-bold"
									>Mark paid</button
								>
							{:else}
								<button
									type="button"
									disabled={busy}
									onclick={() => act(r.id, 'approve')}
									class="h-9 cursor-pointer rounded-full border-none bg-primary px-4 text-xs font-extrabold text-text"
									>Approve</button
								>
							{/if}
							<button
								type="button"
								disabled={busy}
								onclick={() => act(r.id, 'reject')}
								class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-4 text-xs font-bold text-negative-ink"
								>Reject</button
							>
						</div>
					{/if}
				</li>
			{:else}<li class="text-sm text-text-muted">No bookings yet.</li>{/each}
		</ul>
	{/if}
</div>

<Toast />
