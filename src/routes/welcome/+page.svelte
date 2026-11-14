<script lang="ts">
	// Onboarding (GAMEPLAY_FLOWS.md, F1). First sign-in (?first=1): your first
	// car, your racing name and email, then straight into a 1-minute race
	// against a bot. Older accounts that never gave an email land here too, for
	// just the details step.
	import { onMount } from 'svelte';
	import { appKit } from '$lib/appkit';
	import { rarityColor } from '$lib/economy/rarity';
	import CarPreview from '$lib/components/garage/CarPreview.svelte';

	type Car = { id: string; model: string; rarity: string };

	let first = $state(false);
	let car = $state<Car | null>(null);
	let gears = $state(0);
	let name = $state('');
	let email = $state('');
	let loading = $state(true);
	let starting = $state(false);
	let error = $state('');

	const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	onMount(async () => {
		first = new URLSearchParams(window.location.search).get('first') === '1';
		try {
			const [g, me] = await Promise.all([fetch('/api/garage'), fetch('/api/me')]);
			if (g.status === 401) {
				window.location.href = '/?auth=required';
				return;
			}
			if (g.ok) {
				const garage = await g.json();
				car = garage.cars?.[0] ?? null;
				gears = garage.gears ?? 0;
			}
			if (me.ok) {
				const u = await me.json();
				// Leave the box empty for automatic names, so typing one is the obvious move.
				name = String(u.username ?? '').startsWith('player_') ? '' : (u.username ?? '');
				email = u.email ?? '';
			}
			// Signed in with email or Google: Reown knows the address, so pre-fill it.
			if (!email) {
				const fromLogin = appKit?.getAccount?.()?.embeddedWalletInfo?.user?.email;
				if (fromLogin) email = fromLogin;
			}
		} finally {
			loading = false;
		}
	});

	async function saveDetails(useName: boolean) {
		const body: Record<string, string> = { email: email.trim() };
		if (useName && name.trim()) body.username = name.trim();
		const res = await fetch('/api/me', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error ?? "Couldn't save your details");
	}

	async function start(useName: boolean) {
		starting = true;
		error = '';
		try {
			await saveDetails(useName);
			if (!first) {
				window.location.href = '/dashboard';
				return;
			}
			// Your first race: a 1-minute Scrimmage against a bot.
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'daily', mode: 'paper', durationMinutes: 1 })
			});
			const contest = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(contest.error ?? "Couldn't set up your first race");
			window.location.href = `/draft?contestId=${contest.id}&type=${contest.type}&mode=paper`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
			starting = false;
		}
	}

	const emailOk = $derived(EMAIL.test(email.trim()));
</script>

<div class="m-page narrow">
	{#if loading}
		<div class="h-64 animate-pulse rounded-[22px] bg-surface-alt"></div>
	{:else}
		<header class="text-center">
			<span class="m-eyebrow">Welcome to CoinDraft</span>
			<h1 class="m-title mt-2">{first ? 'Meet your first car.' : 'A couple of details.'}</h1>
		</header>

		{#if first}
			{#if car}
				<!-- The reveal: your car drives in over the grass. -->
				<div class="m-card mt-6 overflow-hidden !p-0">
					<div class="m-sky relative px-4 pt-8">
						<div class="anim-drive mx-auto w-fit"><CarPreview size={260} /></div>
					</div>
					<div class="m-ground h-5"></div>
					<div class="flex flex-wrap items-center justify-between gap-3 p-5">
						<div>
							<div class="font-display text-3xl font-extrabold tracking-[-0.03em]">{car.model}</div>
							<span
								class="anim-stamp mt-1 inline-block rounded-lg border-2 border-border px-2.5 py-0.5 text-[11px] font-extrabold tracking-[0.08em] uppercase"
								style="background:{rarityColor(car.rarity)}">{car.rarity}</span
							>
						</div>
						<div class="text-end">
							<div class="m-num text-2xl font-bold">+⚙️ {gears}</div>
							<div class="m-eyebrow">Gears to spend</div>
						</div>
					</div>
					<p class="border-t-2 border-border bg-butter px-5 py-3 text-sm font-semibold">
						It's yours, recorded on NEAR. You'll never need a wallet.
					</p>
				</div>
			{:else}
				<div class="dashed m-card mt-6 text-center text-sm font-semibold">
					Your car is still being prepared. It'll be waiting in your garage.
				</div>
			{/if}
		{:else}
			<p class="m-lead mx-auto mt-3 text-center">
				So we can tell you when your race result is in, a bot challenges you, or your car sells.
			</p>
		{/if}

		<div class="m-card mt-6 flex flex-col gap-5">
			<div>
				<label for="racing-name" class="text-sm font-extrabold">Your racing name</label>
				<p class="mt-0.5 text-xs text-text-muted">
					Bots and other drivers will call you this. You can change it later.
				</p>
				<input
					id="racing-name"
					bind:value={name}
					maxlength="20"
					placeholder="e.g. NitroNova"
					autocomplete="nickname"
					class="mt-2 h-12 w-full rounded-[14px] border-2 border-border bg-surface-alt px-4 text-base"
				/>
			</div>
			<div>
				<label for="email" class="text-sm font-extrabold">Your email</label>
				<p class="mt-0.5 text-xs text-text-muted">
					For race results and notifications. Never shown to other players.
				</p>
				<input
					id="email"
					type="email"
					bind:value={email}
					autocomplete="email"
					placeholder="you@example.com"
					class="mt-2 h-12 w-full rounded-[14px] border-2 border-border bg-surface-alt px-4 text-base"
				/>
			</div>
			{#if error}<p class="m-tag w-fit bg-pink" role="alert">{error}</p>{/if}

			<div class="flex flex-col gap-3">
				<button
					type="button"
					disabled={starting || !name.trim() || !emailOk}
					onclick={() => start(true)}
					class="m-btn primary lg block"
				>
					{starting
						? first
							? 'Getting the car to the grid…'
							: 'Saving…'
						: first
							? 'Start your first race →'
							: 'Save and continue →'}
				</button>
				<button
					type="button"
					disabled={starting || !emailOk}
					onclick={() => start(false)}
					class="m-btn ghost block">Keep my current name</button
				>
			</div>
			{#if first}
				<p class="text-center text-xs text-text-muted">
					A 1-minute race against a bot. Nothing to lose.
				</p>
			{/if}
		</div>
	{/if}
</div>
