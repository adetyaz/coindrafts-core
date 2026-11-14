<script lang="ts">
	// Book trackside ads (GAMEPLAY_FLOWS.md, F12): a real circuit, a slot on its
	// map, dates (booked ones shown), artwork → 3D preview → request (invoice) →
	// the operator's approval → live.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import SponsorContact from '$lib/components/SponsorContact.svelte';
	import RaceTrack3D, { type RaceCar } from '$lib/components/race/RaceTrack3D.svelte';
	import { CIRCUITS, circuitById } from '$lib/race/circuits';
	import { buildTrackPath } from '$lib/race/trackPath';
	import { fileToDataUrl } from '$lib/imageUpload';
	import {
		AD_SLOTS,
		AD_SLOT_IDS,
		adQuoteCents,
		daysBetween,
		usd,
		type AdSlot
	} from '$lib/sponsors';

	const today = new Date().toISOString().slice(0, 10);
	const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

	let circuit = $state(CIRCUITS[0].id);
	let slot = $state<AdSlot>('billboard');
	let start = $state(plusDays(1));
	let end = $state(plusDays(7));
	let artwork = $state('');
	let booked = $state<{ start: string; end: string }[]>([]);
	let known = $state(true);
	let name = $state('');
	let email = $state('');
	let busy = $state(false);

	onMount(async () => {
		const res = await fetch('/api/sponsor').catch(() => null);
		if (res?.status === 401) {
			window.location.href = '/?auth=required';
			return;
		}
		if (res?.ok) known = Boolean((await res.json()).sponsor);
	});

	$effect(() => {
		const c = circuit;
		const s = slot;
		fetch(`/api/sponsor/booked?circuit=${c}&slot=${s}`)
			.then((r) => (r.ok ? r.json() : []))
			.then((rows) => (booked = rows))
			.catch(() => (booked = []));
	});

	// The circuit's outline with the three slots marked, fitted to a 100×100 box.
	const map = $derived.by(() => {
		const path = buildTrackPath(circuitById(circuit));
		const pts = path.points;
		const xs = pts.map((p) => p.x);
		const zs = pts.map((p) => p.z);
		const minX = Math.min(...xs);
		const minZ = Math.min(...zs);
		const size = Math.max(Math.max(...xs) - minX, Math.max(...zs) - minZ);
		const fit = (x: number, z: number) => [
			8 + ((x - minX) / size) * 84,
			8 + ((z - minZ) / size) * 84
		];
		const d =
			pts
				.filter((_p, i) => i % 2 === 0)
				.map((p, i) => {
					const [x, y] = fit(p.x, p.z);
					return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
				})
				.join(' ') + ' Z';
		const marks = AD_SLOT_IDS.map((id) => {
			const p = path.at(AD_SLOTS[id].at);
			const [x, y] = fit(p.x, p.z);
			return { id, x, y };
		});
		return { d, marks };
	});

	const clash = $derived(booked.some((r) => r.start <= end && r.end >= start));
	const days = $derived(daysBetween(start, end));
	const quote = $derived(days > 0 ? adQuoteCents(slot, start, end) : 0);
	const previewCars: RaceCar[] = [
		{ id: 'a', name: 'Preview', color: 'var(--color-coral)', pct: 0.4, isMe: false },
		{ id: 'b', name: 'Preview', color: 'var(--color-blue)', pct: 0.1, isMe: false }
	];

	async function upload(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			artwork = await fileToDataUrl(file);
		} catch (err) {
			toast(err instanceof Error ? err.message : "Couldn't read that image", 'error');
		}
	}

	async function submit() {
		busy = true;
		try {
			const res = await fetch('/api/sponsor', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ kind: 'ad', circuit, slot, start, end, artwork, name, email })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? "Couldn't send the booking");
			toast(`Booked. We'll email an invoice for ${usd(data.priceCents)}.`, 'success');
			await goto(resolve('/sponsor'));
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<div class="m-page">
	<a href={resolve('/sponsor')} class="text-sm font-bold text-text-muted no-underline"
		>&larr; Sponsors</a
	>
	<h1 class="m-title mt-3">Book trackside ads</h1>

	<div class="mt-6 grid gap-6 lg:grid-cols-2">
		<div class="flex flex-col gap-5">
			<div>
				<div class="text-sm font-black">1 · Circuit</div>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each CIRCUITS as c (c.id)}
						<button
							type="button"
							aria-pressed={circuit === c.id}
							onclick={() => (circuit = c.id)}
							class="m-chip !min-h-11 !px-5 !text-sm text-sm">{c.name}</button
						>
					{/each}
				</div>
			</div>

			<div>
				<div class="text-sm font-black">2 · Slot</div>
				<div class="mt-2 flex items-start gap-4">
					<svg
						viewBox="0 0 100 100"
						class="h-40 w-40 shrink-0 rounded-2xl bg-surface-alt"
						aria-label="{circuitById(circuit).name} map"
					>
						<path
							d={map.d}
							fill="none"
							stroke="var(--color-text)"
							stroke-width="2.5"
							stroke-linejoin="round"
						/>
						{#each map.marks as m (m.id)}
							<circle
								cx={m.x}
								cy={m.y}
								r={slot === m.id ? 5 : 3.5}
								fill={slot === m.id ? 'var(--color-primary)' : 'var(--color-surface)'}
								stroke="var(--color-text)"
								stroke-width="1.5"
							/>
						{/each}
					</svg>
					<div class="flex flex-col gap-2">
						{#each AD_SLOT_IDS as id (id)}
							<button
								type="button"
								aria-pressed={slot === id}
								onclick={() => (slot = id)}
								class="cursor-pointer rounded-2xl border p-3 text-start text-sm {slot === id
									? 'border-text'
									: 'border-border'} bg-surface"
							>
								<span class="font-bold">{AD_SLOTS[id].label}</span>
								<span class="text-text-muted"> · {usd(AD_SLOTS[id].perDayCents)}/day</span>
								<span class="block text-xs text-text-muted">{AD_SLOTS[id].blurb}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div>
				<div class="text-sm font-black">3 · Dates</div>
				<div class="mt-2 flex flex-wrap gap-3">
					<label class="text-xs font-bold text-text-muted"
						>From
						<input
							type="date"
							min={today}
							bind:value={start}
							class="mt-1 block h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text"
						/>
					</label>
					<label class="text-xs font-bold text-text-muted"
						>To
						<input
							type="date"
							min={start}
							bind:value={end}
							class="mt-1 block h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text"
						/>
					</label>
				</div>
				{#if booked.length}
					<p class="mt-2 text-xs text-text-muted">
						Already booked: {booked.map((b) => `${b.start} → ${b.end}`).join(', ')}
					</p>
				{/if}
				{#if clash}<p class="mt-1 text-xs font-bold text-negative-ink">
						Those dates overlap a booking for this slot.
					</p>{/if}
			</div>

			<div>
				<div class="text-sm font-black">4 · Artwork</div>
				<p class="mt-1 text-xs text-text-muted">
					PNG, JPEG or WebP. Shaped about {AD_SLOTS[slot].aspect}:1 for this slot.
				</p>
				<input
					type="file"
					accept="image/png,image/jpeg,image/webp"
					onchange={upload}
					class="mt-2 text-sm"
				/>
			</div>

			<SponsorContact {known} bind:name bind:email />
		</div>

		<div>
			<div class="text-sm font-black">Preview</div>
			<div class="mt-2 overflow-hidden rounded-[24px] border border-border">
				{#key `${circuit}|${slot}|${artwork.length}`}
					<RaceTrack3D
						{circuit}
						cars={previewCars}
						holding
						ads={artwork ? [{ slot, image: artwork, sponsor: name || 'You' }] : []}
					/>
				{/key}
			</div>
			<div class="m-card mt-4">
				<div class="flex items-baseline justify-between">
					<span class="text-sm font-bold"
						>{days > 0 ? `${days} day${days === 1 ? '' : 's'}` : '—'}</span
					>
					<span class="font-mono text-2xl font-bold">{usd(quote)}</span>
				</div>
				<p class="mt-1 text-xs text-text-muted">
					We'll email an invoice. Once it's paid we review the artwork, then it runs on its dates.
				</p>
				<button
					type="button"
					disabled={busy || !artwork || clash || days < 1}
					onclick={submit}
					class="m-btn primary mt-3 w-full disabled:opacity-50">Request booking</button
				>
			</div>
		</div>
	</div>
</div>

<Toast />
