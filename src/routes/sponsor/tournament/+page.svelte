<script lang="ts">
	// Sponsor a tournament (GAMEPLAY_FLOWS.md, F12): name, dates, prize, branding
	// (logo, livery on the cars) → preview → request (invoice) → approval → live.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import SponsorContact from '$lib/components/SponsorContact.svelte';
	import CarPreview from '$lib/components/garage/CarPreview.svelte';
	import { fileToDataUrl } from '$lib/imageUpload';
	import { TOURNAMENT_SPONSOR_CENTS, usd } from '$lib/sponsors';

	const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
	const today = plusDays(0);

	let title = $state('');
	let start = $state(plusDays(3));
	let end = $state(plusDays(3));
	let prize = $state('');
	let logo = $state('');
	let livery = $state('#5fa8d8');
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
		if (res?.ok) {
			const d = await res.json();
			known = Boolean(d.sponsor);
			if (d.sponsor) name = d.sponsor.name;
		}
	});

	async function upload(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			logo = await fileToDataUrl(file, 600);
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
				body: JSON.stringify({
					kind: 'tournament',
					title,
					start,
					end,
					prize,
					logo,
					livery,
					name,
					email
				})
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

<div class="m-page mid">
	<a href={resolve('/sponsor')} class="text-sm font-bold text-text-muted no-underline"
		>&larr; Sponsors</a
	>
	<h1 class="m-title mt-3">Sponsor a tournament</h1>

	<div class="mt-6 grid gap-6 md:grid-cols-2">
		<div class="flex flex-col gap-4">
			<label class="text-sm font-bold"
				>Tournament name
				<input
					bind:value={title}
					maxlength="80"
					placeholder="Acme Grand Prix"
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				/>
			</label>
			<div class="flex flex-wrap gap-3">
				<label class="text-xs font-bold text-text-muted"
					>Draw and start
					<input
						type="date"
						min={today}
						bind:value={start}
						class="mt-1 block h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text"
					/>
				</label>
				<label class="text-xs font-bold text-text-muted"
					>Ends by
					<input
						type="date"
						min={start}
						bind:value={end}
						class="mt-1 block h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text"
					/>
				</label>
			</div>
			<label class="text-sm font-bold"
				>Prize for the winner
				<input
					bind:value={prize}
					maxlength="200"
					placeholder="e.g. a limited-edition hoodie"
					class="mt-1 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
				/>
				<span class="text-xs font-normal text-text-muted"
					>On top of the game's Gears prizes. You deliver it to the winner.</span
				>
			</label>
			<div>
				<div class="text-sm font-bold">Logo</div>
				<input
					type="file"
					accept="image/png,image/jpeg,image/webp"
					onchange={upload}
					class="mt-1 text-sm"
				/>
			</div>
			<label class="text-sm font-bold"
				>Livery colour (every car in your tournament)
				<input
					type="color"
					bind:value={livery}
					class="mt-1 block h-11 w-20 cursor-pointer rounded-xl border border-border"
				/>
			</label>
			<SponsorContact {known} bind:name bind:email />
		</div>

		<div>
			<div class="text-sm font-black">Preview</div>
			<div class="m-card mt-2">
				<div class="m-eyebrow">Tournament</div>
				<div class="mt-1 text-2xl font-black">{title || 'Your tournament'}</div>
				<div class="mt-2 flex items-center gap-2 text-sm">
					{#if logo}<img src={logo} alt="Your logo" class="h-8 w-auto rounded" />{/if}
					<span>Presented by <span class="font-bold">{name || 'your brand'}</span></span>
				</div>
				{#if prize}<p class="mt-2 text-sm font-bold">🏆 + {prize}</p>{/if}
				<div class="mt-4 flex justify-center">
					<!-- The car's paint is a token in the app; the preview shows your exact colour. -->
					<div style="--color-coral:{livery}">
						<CarPreview look={{ paint: 'coral' }} size={240} model="Apex" />
					</div>
				</div>
			</div>
			<div class="m-card mt-4">
				<div class="flex items-baseline justify-between">
					<span class="text-sm font-bold">Flat fee</span>
					<span class="font-mono text-2xl font-bold">{usd(TOURNAMENT_SPONSOR_CENTS)}</span>
				</div>
				<p class="mt-1 text-xs text-text-muted">
					We'll email an invoice. Once paid and approved, the tournament opens for entries and draws
					on your start date.
				</p>
				<button
					type="button"
					disabled={busy || !title.trim() || !prize.trim() || !logo}
					onclick={submit}
					class="m-btn primary mt-3 w-full disabled:opacity-50">Request sponsorship</button
				>
			</div>
		</div>
	</div>
</div>

<Toast />
