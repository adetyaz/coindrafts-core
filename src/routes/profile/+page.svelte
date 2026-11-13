<script lang="ts">
	import NotificationSettings from '$lib/components/NotificationSettings.svelte';
	import type { NotifySettings } from '$lib/notifications';
	// Me (GAMEPLAY_FLOWS.md, F6): your name and showcased car, stats, the badges
	// you show (up to 3), rivals (bots' moods and humans you race often),
	// challenges, links to the Garage and NEAR, and settings.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import CarPreview from '$lib/components/garage/CarPreview.svelte';
	import { rarityColor } from '$lib/economy/rarity';
	import { MOOD_LABEL, type Mood } from '$lib/bots/personalities';
	import { BADGES } from '$lib/badges';
	import { sectorTheme } from '$lib/sectorTheme';

	type Settings = {
		botChat: 'on' | 'quiet' | 'off';
		notifications: boolean;
		reducedMotion: boolean;
	} & NotifySettings;
	type Profile = {
		card: {
			id: string;
			username: string;
			xp: number;
			stats: {
				races: number;
				wins: number;
				podiums: number;
				bestSector: { sector: string; avgPct: number } | null;
			};
			car: {
				id: string;
				model: string;
				rarity: string;
				look: Record<string, string> | null;
			} | null;
		};
		rivals: {
			bots: {
				id: string;
				username: string;
				tagline: string;
				mood: Mood;
				record: { races: number; playerWins: number; botWins: number };
			}[];
			humans: {
				id: string;
				username: string;
				races: number;
				record: { wins: number; losses: number };
			}[];
		};
		challenges: {
			id: string;
			incoming: boolean;
			other: string;
			otherId: string;
			durationMinutes: number;
			message: string | null;
			status: string;
			contestId: string | null;
		}[];
		cars: { id: string; model: string; rarity: string }[];
		showcaseCarId: string | null;
		showcaseBadges: string[];
		settings: Settings;
		nearAccountId: string | null;
		nearAccountUrl: string | null;
		email: string | null;
	};

	let p = $state<Profile | null>(null);
	let earned = $state<string[]>([]);
	let phase = $state<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
	let name = $state('');
	let email = $state('');
	let busy = $state(false);

	async function load() {
		try {
			const [res, badgesRes] = await Promise.all([fetch('/api/me/profile'), fetch('/api/badges')]);
			if (res.status === 401) {
				phase = 'signed-out';
				return;
			}
			if (!res.ok) throw new Error();
			p = await res.json();
			name = p!.card.username;
			email = p!.email ?? '';
			if (badgesRes.ok) {
				const list: { code: string; earned: boolean }[] = await badgesRes.json();
				earned = list.filter((b) => b.earned).map((b) => b.code);
			}
			phase = 'ready';
		} catch {
			phase = 'error';
		}
	}
	onMount(load);

	async function save(body: Record<string, unknown>, done?: string) {
		busy = true;
		try {
			const res = await fetch('/api/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? "Couldn't save");
			if (done) toast(done, 'success');
			return true;
		} catch (e) {
			toast(e instanceof Error ? e.message : "Couldn't save", 'error');
			return false;
		} finally {
			busy = false;
		}
	}

	async function setShowcase(carId: string) {
		if (await save({ showcaseCarId: carId }, 'Showcase updated')) await load();
	}

	function toggleBadge(code: string) {
		if (!p) return;
		const cur = p.showcaseBadges;
		const next = cur.includes(code)
			? cur.filter((c) => c !== code)
			: cur.length < 3
				? [...cur, code]
				: cur;
		if (next === cur) {
			toast('You can show up to 3 badges', 'info');
			return;
		}
		p.showcaseBadges = next;
		save({ showcaseBadges: next });
	}

	async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
		if (!p) return;
		p.settings[key] = value;
		// Applied right away in this browser; the server copy follows you to others.
		try {
			if (key === 'botChat') localStorage.setItem('botChat', String(value));
			if (key === 'reducedMotion') {
				localStorage.setItem('reducedMotion', value ? '1' : '0');
				if (value) document.documentElement.dataset.reducedMotion = '';
				else delete document.documentElement.dataset.reducedMotion;
			}
		} catch {
			// Storage blocked: the server setting still saves.
		}
		await save({ settings: { [key]: value } });
	}

	async function respond(id: string, accept: boolean) {
		busy = true;
		try {
			const res = await fetch(`/api/challenges/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: accept ? 'accept' : 'decline' })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
			if (data.contestId) window.location.href = `/draft?contestId=${data.contestId}&type=daily`;
			else await load();
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
		window.location.href = '/';
	}

	const lengthLabel = (m: number) => (m >= 1440 ? '24h' : m >= 60 ? `${m / 60}h` : `${m} min`);
	const earnedBadges = $derived(BADGES.filter((b) => earned.includes(b.code)));
</script>

<div class="mx-auto max-w-[1000px] px-7 pt-7 pb-18 max-sm:px-4">
	{#if phase === 'loading'}
		<div class="h-64 animate-pulse rounded-[24px] bg-surface-alt"></div>
	{:else if phase === 'signed-out'}
		<p class="text-sm text-text-muted">Sign in to see your profile.</p>
	{:else if phase === 'error' || !p}
		<p class="text-sm text-negative-ink">Couldn't load your profile. Refresh to try again.</p>
	{:else}
		<div class="flex flex-wrap items-start justify-between gap-6">
			<div class="min-w-0 flex-1">
				<div class="font-mono text-[11px] font-bold tracking-[0.14em] text-primary-ink uppercase">
					Me
				</div>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<input
						bind:value={name}
						maxlength="20"
						aria-label="Racing name"
						class="h-12 min-w-0 rounded-2xl border border-border bg-surface px-4 text-2xl font-black"
					/>
					{#if name.trim() !== p.card.username}
						<button
							type="button"
							disabled={busy}
							onclick={async () => {
								if (await save({ username: name.trim() }, 'Name saved')) await load();
							}}
							class="h-11 cursor-pointer rounded-full border-none bg-primary px-5 text-sm font-extrabold text-text"
							>Save</button
						>
					{/if}
				</div>
				<p class="mt-2 font-mono text-xs text-text-muted">{p.card.xp.toLocaleString()} XP</p>
				<a
					href={resolve('/players/[id]', { id: p.card.id })}
					class="mt-1 inline-block text-xs font-bold text-text">See your card as others do &rarr;</a
				>
			</div>
			{#if p.card.car}
				<div class="text-right">
					<CarPreview look={p.card.car.look ?? {}} size={200} />
					<div class="text-sm font-bold">{p.card.car.model}</div>
				</div>
			{/if}
		</div>

		<div class="mt-6 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
			{#each [['Races', p.card.stats.races], ['Wins', p.card.stats.wins], ['Podiums', p.card.stats.podiums]] as [label, n] (label)}
				<div class="rounded-2xl border border-border bg-surface p-4">
					<div class="font-mono text-3xl font-bold">{n}</div>
					<div class="text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase">
						{label}
					</div>
				</div>
			{/each}
			<div class="rounded-2xl border border-border bg-surface p-4">
				<div class="text-xl font-black">
					{p.card.stats.bestSector ? sectorTheme(p.card.stats.bestSector.sector).label : '—'}
				</div>
				<div class="text-[10px] font-extrabold tracking-[0.1em] text-text-muted uppercase">
					Best sector{p.card.stats.bestSector
						? ` · avg ${p.card.stats.bestSector.avgPct >= 0 ? '+' : ''}${p.card.stats.bestSector.avgPct}%`
						: ''}
				</div>
			</div>
		</div>

		{#if p.challenges.length}
			<section class="mt-8">
				<h2 class="text-sm font-black tracking-[0.06em] uppercase">Challenges</h2>
				<ul class="mt-3 flex flex-col gap-2">
					{#each p.challenges as c (c.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-4 text-sm"
						>
							<div>
								<span class="font-bold"
									>{c.incoming ? `${c.other} challenged you` : `You challenged ${c.other}`}</span
								>
								<span class="text-text-muted"> · {lengthLabel(c.durationMinutes)} Versus</span>
								{#if c.message}<p class="text-xs text-text-muted">“{c.message}”</p>{/if}
							</div>
							{#if c.status === 'pending' && c.incoming}
								<div class="flex gap-2">
									<button
										type="button"
										disabled={busy}
										onclick={() => respond(c.id, true)}
										class="h-9 cursor-pointer rounded-full border-none bg-primary px-4 text-xs font-extrabold text-text"
										>Accept</button
									>
									<button
										type="button"
										disabled={busy}
										onclick={() => respond(c.id, false)}
										class="h-9 cursor-pointer rounded-full border border-border bg-transparent px-4 text-xs font-bold"
										>Decline</button
									>
								</div>
							{:else if c.status === 'accepted' && c.contestId}
								<!-- resolve() can't carry a query string; the path itself is resolved. -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									href={`${resolve('/draft')}?contestId=${c.contestId}&type=daily`}
									class="inline-flex h-9 items-center rounded-full bg-text px-4 text-xs font-extrabold text-surface no-underline"
									>Draft &rarr;</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{:else}
								<span class="text-xs text-text-muted">{c.status}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="mt-8 grid gap-4 md:grid-cols-2">
			<section class="rounded-[20px] border border-border bg-surface p-5">
				<h2 class="text-sm font-black tracking-[0.06em] uppercase">Showcased car</h2>
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#each p.cars as c (c.id)}
						<button
							type="button"
							disabled={busy}
							aria-pressed={p.card.car?.id === c.id}
							onclick={() => setShowcase(c.id)}
							class="h-9 cursor-pointer rounded-full border-2 px-3 text-xs font-bold {p.card.car
								?.id === c.id
								? 'border-text'
								: 'border-transparent'}"
							style="background:{rarityColor(c.rarity)}">{c.model}</button
						>
					{:else}<p class="text-sm text-text-muted">No cars yet.</p>{/each}
				</div>
				<div class="mt-4 flex gap-3 text-sm">
					<a href={resolve('/garage')} class="font-bold text-text">Garage &rarr;</a>
					{#if p.nearAccountUrl}
						<!-- External NEAR explorer link: resolve() is for app routes only -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={p.nearAccountUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="font-bold text-text">NEAR account ↗</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			</section>

			<section class="rounded-[20px] border border-border bg-surface p-5">
				<h2 class="text-sm font-black tracking-[0.06em] uppercase">
					Badges · showing {p.showcaseBadges.length}/3
				</h2>
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#each earnedBadges as b (b.code)}
						<button
							type="button"
							aria-pressed={p.showcaseBadges.includes(b.code)}
							title={b.description}
							onclick={() => toggleBadge(b.code)}
							class="h-9 cursor-pointer rounded-full border px-3 text-xs font-bold {p.showcaseBadges.includes(
								b.code
							)
								? 'border-text bg-text text-surface'
								: 'border-border bg-bg'}">{b.emoji} {b.name}</button
						>
					{:else}<p class="text-sm text-text-muted">Win races to earn badges.</p>{/each}
				</div>
			</section>
		</div>

		<section class="mt-8">
			<h2 class="text-sm font-black tracking-[0.06em] uppercase">Rivals</h2>
			<div class="mt-3 grid gap-2 sm:grid-cols-2">
				{#each p.rivals.bots as r (r.id)}
					<a
						href={resolve('/players/[id]', { id: r.id })}
						class="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-4 text-sm text-text no-underline"
					>
						<span>
							<span class="font-bold">{r.username}</span>
							<span
								class="ml-1 rounded bg-text px-1.5 py-0.5 text-[9px] font-extrabold text-surface"
								>BOT</span
							>
							<span class="block text-xs text-text-muted">{MOOD_LABEL[r.mood]}</span>
						</span>
						<span class="font-mono font-bold">{r.record.playerWins}–{r.record.botWins}</span>
					</a>
				{/each}
				{#each p.rivals.humans as h (h.id)}
					<a
						href={resolve('/players/[id]', { id: h.id })}
						class="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-4 text-sm text-text no-underline"
					>
						<span>
							<span class="font-bold">{h.username}</span>
							<span class="block text-xs text-text-muted">{h.races} races together</span>
						</span>
						<span class="font-mono font-bold">{h.record.wins}–{h.record.losses}</span>
					</a>
				{/each}
			</div>
		</section>

		<section class="mt-8 rounded-[20px] border border-border bg-surface p-5">
			<h2 class="text-sm font-black tracking-[0.06em] uppercase">Settings</h2>
			<div class="mt-4 flex flex-col gap-4 text-sm">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class="font-bold">Bot chat</span>
					<div class="flex gap-1.5">
						{#each ['on', 'quiet', 'off'] as const as v (v)}
							<button
								type="button"
								aria-pressed={p.settings.botChat === v}
								onclick={() => setSetting('botChat', v)}
								class="h-8 cursor-pointer rounded-full border px-3 text-xs font-bold capitalize {p
									.settings.botChat === v
									? 'border-text bg-text text-surface'
									: 'border-border bg-bg'}">{v}</button
							>
						{/each}
					</div>
				</div>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<label for="me-email" class="font-bold">Email</label>
					<div class="flex gap-2">
						<input
							id="me-email"
							type="email"
							bind:value={email}
							autocomplete="email"
							class="h-9 w-56 rounded-xl border border-border bg-bg px-3 text-sm"
						/>
						{#if email.trim() !== (p.email ?? '')}
							<button
								type="button"
								disabled={busy}
								onclick={async () => {
									if (await save({ email: email.trim() }, 'Email saved')) await load();
								}}
								class="h-9 cursor-pointer rounded-full border-none bg-primary px-4 text-xs font-extrabold text-text"
								>Save</button
							>
						{/if}
					</div>
				</div>
				<div class="border-y border-border py-4">
					<NotificationSettings settings={p.settings} save={(s) => save({ settings: s })} />
				</div>
				<label class="flex items-center justify-between gap-2">
					<span class="font-bold">Reduce motion</span>
					<input
						type="checkbox"
						checked={p.settings.reducedMotion}
						onchange={(e) => setSetting('reducedMotion', e.currentTarget.checked)}
						class="h-5 w-5"
					/>
				</label>
				<button
					type="button"
					onclick={signOut}
					class="h-10 w-fit cursor-pointer rounded-full border border-border bg-transparent px-5 text-sm font-bold"
					>Sign out</button
				>
			</div>
		</section>
	{/if}
</div>

<Toast />
