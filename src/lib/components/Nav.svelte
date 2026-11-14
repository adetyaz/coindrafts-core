<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { appKit } from '$lib/appkit';
	import { SiweMessage } from 'siwe';
	import bs58 from 'bs58';

	let { user }: { user: { xpTotal?: number | null; username?: string | null } | null } = $props();

	const appkitReady = Boolean(appKit);
	let authInFlight = $state(false);
	let lastAttemptedWallet = '';
	let walletConnected = $state(false);
	let signError = $state(false);
	// Why the last sign-in failed, when the server told us. Without this a
	// database outage looked identical to a rejected signature.
	let signErrorMessage = $state('');
	// `user` comes from +layout.server.ts, loaded once per navigation — it goes
	// stale the moment XP changes from an in-place action (answering the
	// Gauntlet, a contest resolving, a wager settling) with no navigation
	// after it, since nothing calls invalidateAll() for those. Nav stays
	// mounted for the whole session, so it polls its own live figure instead
	// of trusting that snapshot.
	let liveGears = $state<number | null>(null);
	// A persistent way back into whatever match/lobby you're already part of,
	// visible on every page — not just the dashboard, and not requiring a
	// detour through matchmaking's picker screen hoping it silently redirects
	// you. Nav stays mounted the whole session, so this polls too.
	let activeMatch = $state<{ href: string; label: string } | null>(null);

	// One flat list: every entry is somewhere you can act from a cold click.
	// "Race" is the mode picker (/play), so the modes don't each need a nav slot.
	type Link = { href: string; label: string; icon?: string; also?: string[] };
	const RACE_PATHS = [
		'/scrimmage',
		'/matchmaking',
		'/binary',
		'/car-race',
		'/draft',
		'/game',
		'/race',
		'/contest'
	];
	const LINKS: Link[] = [
		{ href: '/dashboard', label: 'Home' },
		{ href: '/play', label: 'Race', also: RACE_PATHS },
		{ href: '/garage', label: 'Garage' },
		{ href: '/car-market', label: 'Car Market' },
		{ href: '/tournament', label: 'Tournaments' },
		{ href: '/leagues', label: 'Leagues' },
		{ href: '/leaderboard', label: 'Leaderboard' }
	];
	const GUEST_LINKS: Link[] = [
		{ href: '/guide', label: 'How to play' },
		{ href: '/sponsor', label: 'For sponsors' }
	];
	const TABS: Link[] = [
		{ href: '/dashboard', label: 'Home', icon: '🏠' },
		{
			href: '/play',
			label: 'Race',
			icon: '🏁',
			also: [...RACE_PATHS, '/tournament', '/leagues', '/leaderboard']
		},
		{ href: '/garage', label: 'Garage', icon: '🚗', also: ['/car-race'] },
		{ href: '/car-market', label: 'Market', icon: '💱' },
		{ href: '/profile', label: 'Me', icon: '🙂', also: ['/players'] }
	];

	function isActive(link: Link): boolean {
		const path = page.url.pathname;
		return [link.href, ...(link.also ?? [])].some((p) => path === p || path.startsWith(p + '/'));
	}

	onMount(() => {
		if (!user) return;
		async function refreshXp() {
			try {
				const res = await fetch('/api/me');
				if (res.ok) liveGears = (await res.json())?.gears ?? null;
			} catch {
				/* keep whatever figure we last had rather than blank it */
			}
		}
		refreshXp();
		const t = setInterval(refreshXp, 20_000);
		return () => clearInterval(t);
	});

	onMount(() => {
		if (!user) return;
		async function refreshActiveMatch() {
			try {
				const res = await fetch('/api/contests');
				if (res.ok) {
					const contests: Array<Record<string, unknown>> = await res.json();
					const mine = contests.find((c) => c.status !== 'resolved');
					if (mine) {
						activeMatch = mine.myLineupLocked
							? {
									href: `/game/${mine.id}`,
									label: mine.status === 'live' ? 'Watch race' : 'Active match'
								}
							: {
									href: `/draft?contestId=${mine.id}&type=${mine.type ?? 'daily'}${mine.isPaper ? '&mode=paper' : ''}`,
									label: 'Continue draft'
								};
						return;
					}
				}
			} catch {
				/* fall through to checking lobbies */
			}
			try {
				const res = await fetch('/api/lobby/mine');
				if (res.ok) {
					const lobbies: Array<Record<string, unknown>> = await res.json();
					const mine = lobbies[0];
					if (mine) {
						activeMatch = mine.myLineupLocked
							? {
									href: `/race/${mine.id}`,
									label: mine.status === 'live' ? 'Watch' : 'Active match'
								}
							: { href: `/draft?lobbyId=${mine.id}`, label: 'Continue draft' };
						return;
					}
				}
			} catch {
				/* no active match found — that's fine, just hide the pill */
			}
			activeMatch = null;
		}
		refreshActiveMatch();
		const t = setInterval(refreshActiveMatch, 20_000);
		return () => clearInterval(t);
	});

	type MaybeEthereum = {
		request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
	};

	type MaybeSolana = {
		isConnected?: boolean;
		publicKey?: { toBase58: () => string };
		signMessage?: (
			message: Uint8Array,
			display?: string
		) => Promise<{ signature: Uint8Array } | Uint8Array>;
	};

	type WalletCandidate =
		| { type: 'evm'; address: string; provider: MaybeEthereum }
		| { type: 'solana'; address: string; provider: MaybeSolana };

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/';
	}

	function getAppKitProvider(): WalletCandidate | null {
		if (!appKit) return null;

		const account = appKit.getAccount?.();
		if (!account?.address) return null;

		// Use AppKit's own authorized provider — not window.ethereum/window.solana
		const walletProvider = appKit.getWalletProvider?.() as unknown;

		const w = window as Window & {
			ethereum?: MaybeEthereum;
			solana?: MaybeSolana;
		};

		// Solana
		if ((account as Record<string, unknown>).type === 'solana') {
			const sol = (walletProvider as MaybeSolana)?.signMessage
				? (walletProvider as MaybeSolana)
				: w.solana;
			if (sol?.signMessage) {
				console.log('[Auth] Found Solana wallet (AppKit):', account.address);
				return { type: 'solana', address: account.address, provider: sol };
			}
			return null;
		}

		// EVM — prefer AppKit's authorized provider, fall back to window.ethereum
		const evm = (walletProvider as MaybeEthereum)?.request
			? (walletProvider as MaybeEthereum)
			: w.ethereum;
		if (evm?.request) {
			console.log('[Auth] Found EVM wallet (AppKit):', account.address);
			return { type: 'evm', address: account.address, provider: evm };
		}

		return null;
	}

	let welcomeNext = false;
	// Signed in but no contact email yet: onboarding's details step.
	let detailsNext = false;

	async function signAndVerifyEvm(address: string, provider: MaybeEthereum): Promise<boolean> {
		const nonceRes = await fetch('/api/auth/nonce');
		if (!nonceRes.ok) return false;
		const { nonce } = await nonceRes.json();

		// Get chain ID from AppKit — avoids needing eth_chainId authorization on window.ethereum
		const appKitChain = appKit?.getChainId?.();
		const chainId = typeof appKitChain === 'number' ? appKitChain : 1;

		const siwe = new SiweMessage({
			domain: window.location.host,
			address,
			statement: 'Sign in to CoinDraft',
			uri: window.location.origin,
			version: '1',
			chainId,
			nonce
		});

		const message = siwe.prepareMessage();
		const signature = (await provider.request({
			method: 'personal_sign',
			params: [message, address]
		})) as string;

		const verifyRes = await fetch('/api/auth/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'evm', address, message, signature })
		});

		const payload = await verifyRes.json().catch(() => ({}));
		if (!verifyRes.ok) signErrorMessage = payload?.error ?? '';
		// First sign-in: the first-car reveal, not a reload in place.
		if (verifyRes.ok && payload?.welcome) welcomeNext = true;
		if (verifyRes.ok && payload?.needsDetails) detailsNext = true;
		return verifyRes.ok;
	}

	async function signAndVerifySolana(address: string, provider: MaybeSolana): Promise<boolean> {
		if (!provider.signMessage) return false;

		const nonceRes = await fetch('/api/auth/nonce');
		if (!nonceRes.ok) return false;
		const { nonce } = await nonceRes.json();

		const message = `CoinDraft Sign-In\nAddress: ${address}\nNonce: ${nonce}\nURI: ${window.location.origin}`;
		const encoded = new TextEncoder().encode(message);
		const signed = await provider.signMessage(encoded, 'utf8');
		const signatureBytes = signed instanceof Uint8Array ? signed : signed.signature;
		const signature = bs58.encode(signatureBytes);

		const verifyRes = await fetch('/api/auth/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'solana', address, message, signature })
		});

		if (!verifyRes.ok) {
			const payload = await verifyRes.json().catch(() => ({}));
			signErrorMessage = payload?.error ?? '';
		}
		return verifyRes.ok;
	}

	async function ensureWalletSession() {
		if (user || authInFlight) return;

		const wallet = getAppKitProvider();
		if (!wallet) {
			console.log('[Auth] No wallet detected');
			return;
		}

		const walletKey = `${wallet.type}:${wallet.address}`;
		if (lastAttemptedWallet === walletKey) {
			console.log('[Auth] Already attempted wallet:', walletKey);
			return;
		}

		authInFlight = true;
		lastAttemptedWallet = walletKey;
		console.log('[Auth] Starting sign for:', walletKey);
		try {
			const ok =
				wallet.type === 'evm'
					? await signAndVerifyEvm(wallet.address, wallet.provider)
					: await signAndVerifySolana(wallet.address, wallet.provider);

			console.log('[Auth] Sign+verify result:', ok);
			if (ok) {
				console.log('[Auth] Success! Reloading page');
				signError = false;
				await invalidateAll();
				if (welcomeNext) window.location.href = '/welcome?first=1';
				else if (detailsNext) window.location.href = '/welcome';
				else window.location.reload();
			} else {
				signError = true;
			}
		} catch (e) {
			console.error('[Auth] Error during sign/verify:', e);
			signError = true;
		} finally {
			authInFlight = false;
		}
	}

	function retrySign() {
		signError = false;
		signErrorMessage = '';
		lastAttemptedWallet = '';
		void ensureWalletSession();
	}

	onMount(() => {
		if (user) return;

		// Asks for the sign-in signature once per account per page. If it fails or
		// is dismissed, the "Try again" button is the only way to ask again.
		// This used to auto-retry up to 3 times on top of a 3-second poll and every
		// wallet event, which with an installed Phantom meant a signature prompt
		// that kept coming back.
		function tick() {
			walletConnected = !!getAppKitProvider();
			void ensureWalletSession();
		}

		// Listen to AppKit account changes
		const appKitAny = appKit as unknown as Record<string, unknown>;
		const unsubAccount =
			typeof appKitAny?.subscribe === 'function'
				? (appKitAny.subscribe as (...args: unknown[]) => unknown)('accountsChanged', tick)
				: undefined;
		const unsubChain =
			typeof appKitAny?.subscribe === 'function'
				? (appKitAny.subscribe as (...args: unknown[]) => unknown)('chainChanged', tick)
				: undefined;

		// Initial check with delay to let AppKit fully initialize
		const initTimer = window.setTimeout(tick, 500);

		// Fallback poll — less frequent to avoid race conditions
		const t = window.setInterval(tick, 3000);

		return () => {
			window.clearTimeout(initTimer);
			window.clearInterval(t);
			if (typeof unsubAccount === 'function') unsubAccount();
			if (typeof unsubChain === 'function') unsubChain();
		};
	});
</script>

<!-- Top bar. Desktop: the whole nav. Phone: logo, the race you're in, Gears, you. -->
<header class="sticky top-0 z-50 px-[clamp(0.75rem,3vw,2rem)] pt-3">
	<nav
		aria-label="Main"
		class="mx-auto flex max-w-[76rem] items-center gap-2 rounded-[20px] border-2 border-border bg-surface py-2 ps-3 pe-2 shadow-[0_5px_0_var(--color-ink)]"
	>
		<a
			href={user ? '/dashboard' : '/'}
			class="flex shrink-0 items-center gap-2.5 text-text no-underline"
		>
			<span
				class="grid h-10 w-10 place-items-center rounded-xl border-2 border-border bg-primary"
				aria-hidden="true"
			>
				<svg width="20" height="20" viewBox="0 0 24 24"
					><path
						d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z"
						fill="var(--color-ink)"
					/></svg
				>
			</span>
			<span class="font-display text-[22px] font-extrabold tracking-[-0.04em] max-[380px]:hidden"
				>coindraft</span
			>
		</a>

		<!-- Desktop links -->
		<div class="ms-3 flex min-w-0 items-center gap-0.5 max-nav:hidden">
			{#each user ? LINKS : GUEST_LINKS as link (link.href)}
				<a
					href={link.href}
					aria-current={isActive(link) ? 'page' : undefined}
					class="flex h-10 items-center rounded-xl border-2 px-3 text-sm whitespace-nowrap text-text no-underline transition {isActive(
						link
					)
						? 'border-border bg-surface-alt font-bold shadow-[2px_2px_0_var(--color-ink)]'
						: 'border-transparent font-semibold hover:bg-hover'}">{link.label}</a
				>
			{/each}
		</div>

		<div class="ms-auto flex min-w-0 shrink-0 items-center gap-2">
			{#if user && activeMatch}
				<a
					href={activeMatch.href}
					class="flex h-10 items-center gap-2 rounded-xl border-2 border-border bg-pink px-3 text-xs font-bold whitespace-nowrap text-text no-underline shadow-[var(--shadow-hard-sm)]"
				>
					<span class="anim-blink h-2 w-2 rounded-full border border-border bg-primary"></span>
					{activeMatch.label}
				</a>
			{/if}
			{#if user}
				<a
					href="/garage"
					title="Your Gears"
					class="flex h-10 items-center gap-1.5 rounded-xl border-2 border-border bg-surface-alt px-3 font-mono text-sm font-bold whitespace-nowrap text-text no-underline shadow-[var(--shadow-brand)] max-[420px]:hidden"
				>
					<span aria-hidden="true">⚙️</span>{(liveGears ?? 0).toLocaleString()}
					<span class="sr-only">Gears</span>
				</a>
				<a
					href="/profile"
					aria-label="Me: {user.username ?? 'profile'}"
					class="grid h-10 w-10 place-items-center rounded-full border-2 border-border bg-butter font-display text-base font-extrabold text-text no-underline max-nav:hidden"
				>
					{user.username?.[0]?.toUpperCase() ?? '?'}
				</a>
				<button onclick={logout} class="m-btn ghost sm max-nav:hidden">Log out</button>
			{:else if walletConnected}
				{#if authInFlight}
					<span class="px-2 text-xs whitespace-nowrap text-text-muted">Signing you in…</span>
				{:else if signError}
					<span
						class="max-w-[30ch] truncate text-xs text-negative-ink max-sm:hidden"
						title={signErrorMessage || 'Sign-in failed.'}
					>
						{signErrorMessage || 'Sign-in failed.'}
					</span>
					<button onclick={retrySign} class="m-btn primary sm">Try again</button>
				{:else}
					<button onclick={retrySign} class="m-btn primary sm">Confirm sign-in</button>
				{/if}
			{:else if appkitReady}
				<appkit-button label="Sign in"></appkit-button>
			{:else}
				<button class="m-btn sm" disabled>Loading…</button>
			{/if}
		</div>
	</nav>
</header>

<!-- Phone tab bar: five real destinations, thumb-reachable, clear of the home indicator. -->
{#if user}
	<nav
		aria-label="Tabs"
		class="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] nav:hidden"
	>
		<div
			class="mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-[20px] border-2 border-border bg-surface p-1.5 shadow-[0_5px_0_var(--color-ink)]"
		>
			{#each TABS as tab (tab.href)}
				<a
					href={tab.href}
					aria-current={isActive(tab) ? 'page' : undefined}
					class="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 text-[11px] font-bold text-text no-underline {isActive(
						tab
					)
						? 'border-border bg-primary'
						: 'border-transparent'}"
				>
					<span class="text-lg leading-none" aria-hidden="true">{tab.icon}</span>
					<span class="truncate">{tab.label}</span>
				</a>
			{/each}
		</div>
	</nav>
{/if}
