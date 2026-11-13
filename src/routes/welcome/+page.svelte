<script lang="ts">
	// First sign-in (GAMEPLAY_FLOWS.md, F1): your first car, your racing name,
	// then straight into a 1-minute race against a bot.
	import { onMount } from 'svelte';
	import { rarityColor } from '$lib/economy/rarity';

	type Car = { id: string; model: string; rarity: string };

	let car = $state<Car | null>(null);
	let gears = $state(0);
	let name = $state('');
	let loading = $state(true);
	let starting = $state(false);
	let error = $state('');

	onMount(async () => {
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
			}
		} finally {
			loading = false;
		}
	});

	async function start(useName: boolean) {
		starting = true;
		error = '';
		try {
			if (useName && name.trim()) {
				const res = await fetch('/api/me', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username: name.trim() })
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error ?? "Couldn't save that name");
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
</script>

<div class="mx-auto max-w-[640px] px-6 py-14 text-center">
	{#if loading}
		<div class="mx-auto h-64 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else}
		<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-text-muted uppercase">
			Welcome to CoinDraft
		</div>
		<h1 class="mt-3 text-[40px] leading-none font-black tracking-[-0.04em]">Your first car</h1>

		{#if car}
			<div class="mt-8 rounded-[24px] border border-border bg-surface p-8">
				<div class="text-4xl font-black tracking-[-0.03em]">{car.model}</div>
				<span
					class="mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-extrabold tracking-[0.08em] uppercase"
					style="background:{rarityColor(car.rarity)}">{car.rarity}</span
				>
				<div class="mt-5 font-mono text-2xl font-bold">+⚙️ {gears} Gears</div>
				<p class="mx-auto mt-4 max-w-[40ch] text-sm text-text-muted">
					It's yours. Recorded on NEAR. You'll never need a wallet.
				</p>
			</div>
		{:else}
			<p class="mt-6 text-sm text-text-muted">
				Your car is still being prepared. It'll be waiting in your garage.
			</p>
		{/if}

		<div class="mt-8 text-left">
			<label for="racing-name" class="text-sm font-black">Your racing name</label>
			<p class="mt-1 text-xs text-text-muted">
				Bots and other drivers will call you this. You can change it later.
			</p>
			<input
				id="racing-name"
				bind:value={name}
				maxlength="20"
				placeholder="e.g. NitroNova"
				autocomplete="nickname"
				class="mt-2 h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base"
			/>
			{#if error}<p class="mt-2 text-sm font-bold text-negative-ink">{error}</p>{/if}
		</div>

		<div class="mt-6 flex flex-col gap-2">
			<button
				type="button"
				disabled={starting || !name.trim()}
				onclick={() => start(true)}
				class="h-13 cursor-pointer rounded-full border-none bg-text text-sm font-extrabold text-surface disabled:cursor-not-allowed disabled:opacity-50"
			>
				{starting ? 'Getting the car to the grid…' : 'Start your first race →'}
			</button>
			<button
				type="button"
				disabled={starting}
				onclick={() => start(false)}
				class="h-11 cursor-pointer rounded-full border border-border bg-transparent text-sm font-bold text-text-muted disabled:opacity-50"
			>
				Skip the name for now
			</button>
		</div>
		<p class="mt-4 text-xs text-text-muted">A 1-minute race against a bot. Nothing to lose.</p>
	{/if}
</div>
