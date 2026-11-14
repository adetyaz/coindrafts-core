<script lang="ts">
	// Sponsor portal (GAMEPLAY_FLOWS.md, F12): sponsor a tournament or book
	// trackside ads, and the dashboard of your bookings, views and invoices.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { circuitById } from '$lib/race/circuits';
	import { AD_SLOTS, STATUS_LABEL, usd, type AdSlot, type BookingStatus } from '$lib/sponsors';

	type Booking = {
		id: string;
		kind: 'ad' | 'tournament';
		status: BookingStatus;
		startDate: string;
		endDate: string;
		circuit: string | null;
		slot: AdSlot | null;
		title: string | null;
		tournamentId: string | null;
		priceCents: number;
		views: number;
		note: string | null;
		createdAt: string;
		paidAt: string | null;
	};

	let data = $state<{
		sponsor: { name: string; contactEmail: string } | null;
		bookings: Booking[];
		isAdmin: boolean;
	} | null>(null);
	let signedOut = $state(false);

	onMount(async () => {
		const res = await fetch('/api/sponsor').catch(() => null);
		if (res?.status === 401) signedOut = true;
		else if (res?.ok) data = await res.json();
	});

	const today = new Date().toISOString().slice(0, 10);
	const isLive = (b: Booking) =>
		b.status === 'approved' && b.startDate <= today && b.endDate >= today;
	const active = $derived(
		(data?.bookings ?? []).filter((b) => b.status !== 'rejected' && b.endDate >= today)
	);
	const past = $derived(
		(data?.bookings ?? []).filter((b) => b.status === 'rejected' || b.endDate < today)
	);
</script>

{#snippet row(b: Booking)}
	<li class="flat m-card !p-4 text-sm">
		<div class="flex flex-wrap items-start justify-between gap-2">
			<div>
				<div class="font-black">
					{b.kind === 'ad'
						? `${AD_SLOTS[b.slot as AdSlot]?.label ?? 'Ad'} · ${circuitById(b.circuit).name}`
						: (b.title ?? 'Sponsored tournament')}
				</div>
				<div class="font-mono text-xs text-text-muted">{b.startDate} → {b.endDate}</div>
			</div>
			<span
				class="rounded-full px-2.5 py-1 text-[11px] font-bold {isLive(b)
					? 'bg-positive text-text'
					: 'bg-bg'}">{isLive(b) ? 'Live now' : STATUS_LABEL[b.status]}</span
			>
		</div>
		<div class="mt-2 flex flex-wrap gap-4 text-xs text-text-muted">
			{#if b.kind === 'ad'}<span>👀 {b.views.toLocaleString()} views</span>{/if}
			<span>Invoice {usd(b.priceCents)} · {b.paidAt ? 'paid' : 'unpaid'}</span>
			{#if b.tournamentId}<a
					href={resolve('/tournament/[id]', { id: b.tournamentId })}
					class="font-bold text-text">View tournament &rarr;</a
				>{/if}
		</div>
		{#if b.note}<p class="mt-1 text-xs">Note: {b.note}</p>{/if}
	</li>
{/snippet}

<div class="m-page mid">
	<span class="m-eyebrow">Sponsors</span>
	<h1 class="m-title mt-1">Put your brand on the grid.</h1>
	<p class="m-lead mt-2">
		Sponsor a tournament, with your livery on every car, or book trackside ads on a real circuit.
		Every booking is reviewed before it goes live.
	</p>

	<div class="mt-8 grid gap-4 sm:grid-cols-2">
		<a
			href={resolve('/sponsor/tournament')}
			class="m-card text-text no-underline transition hover:border-text"
		>
			<div class="text-2xl">🏆</div>
			<div class="mt-2 text-lg font-black">Sponsor a tournament</div>
			<p class="mt-1 text-sm text-text-muted">
				Your name on it, your prize, your logo and colours on the cars. {usd(50000)} flat.
			</p>
		</a>
		<a
			href={resolve('/sponsor/ads')}
			class="m-card text-text no-underline transition hover:border-text"
		>
			<div class="text-2xl">🪧</div>
			<div class="mt-2 text-lg font-black">Book trackside ads</div>
			<p class="mt-1 text-sm text-text-muted">
				A billboard, a banner or the start/finish arch on Monza, Suzuka, Spa or Interlagos. From
				{usd(AD_SLOTS.banner.perDayCents)} a day.
			</p>
		</a>
	</div>

	{#if signedOut}
		<p class="mt-8 text-sm text-text-muted">Sign in to book and to see your bookings.</p>
	{:else if data}
		{#if data.isAdmin}
			<a href={resolve('/admin/sponsors')} class="mt-6 inline-block text-sm font-bold text-text"
				>Review bookings (operator) &rarr;</a
			>
		{/if}
		{#if data.sponsor}
			<section class="mt-10">
				<h2 class="m-eyebrow">
					{data.sponsor.name} · active and upcoming
				</h2>
				<ul class="mt-3 flex flex-col gap-2">
					{#each active as b (b.id)}{@render row(b)}{:else}<li class="text-sm text-text-muted">
							Nothing booked yet.
						</li>{/each}
				</ul>
				{#if past.length}
					<h2 class="m-eyebrow mt-8">Past</h2>
					<ul class="mt-3 flex flex-col gap-2">
						{#each past as b (b.id)}{@render row(b)}{/each}
					</ul>
				{/if}
				<p class="mt-4 text-xs text-text-muted">
					Invoices go to {data.sponsor.contactEmail}.
				</p>
			</section>
		{/if}
	{/if}
</div>
