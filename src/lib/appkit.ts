import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import {
	mainnet,
	arbitrum,
	base,
	polygon,
	optimism,
	sepolia,
	baseSepolia,
	// Solana. The adapter was already registered below, but no Solana network
	// was ever listed here — AppKit needs the networks too, so Solana wallets
	// could never actually be selected despite `users.chainType` supporting them.
	solana,
	solanaDevnet
} from '@reown/appkit/networks';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { PUBLIC_REOWN_PROJECT_ID } from '$env/static/public';

const PROJECT_ID = PUBLIC_REOWN_PROJECT_ID;

type AppKitInstance = ReturnType<typeof createAppKit>;

declare global {
	var __coindraftAppKit: AppKitInstance | undefined;
}

let instance: AppKitInstance | null = null;

if (typeof window !== 'undefined') {
	if (!globalThis.__coindraftAppKit) {
		// EVM chains for the Wagmi adapter.
		const evmNetworks = [mainnet, arbitrum, base, polygon, optimism, sepolia, baseSepolia] as const;

		// Solana chains for the Solana adapter.
		const solanaNetworks = [solana, solanaDevnet] as const;

		const wagmiAdapter = new WagmiAdapter({
			projectId: PROJECT_ID,
			networks: [...evmNetworks]
		});

		const solanaAdapter = new SolanaAdapter({
			wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
		});

		globalThis.__coindraftAppKit = createAppKit({
			projectId: PROJECT_ID,
			adapters: [wagmiAdapter, solanaAdapter],
			// Both families are listed so users can pick either. Previously this
			// was EVM-only, which left the Solana adapter unreachable.
			networks: [...evmNetworks, ...solanaNetworks],
			// No `defaultNetwork` — sign-in is a chain-agnostic SIWE signature, not
			// a transaction, so connecting shouldn't push the wallet anywhere.
			// `url` MUST match the page's real origin — wallets compare this
			// against where the connection request actually came from, and a
			// mismatch is exactly the signal phishing detectors look for. This
			// was hardcoded to 'coindraft.io', a domain that isn't even live,
			// while the app runs somewhere else entirely — that's what was
			// triggering "malicious site" warnings. No `icons` for the same
			// reason: it pointed at a file that doesn't exist anywhere in the
			// project, which is its own broken-metadata red flag.
			metadata: {
				name: 'CoinDraft',
				description: 'Fantasy crypto draft platform',
				url: window.location.origin,
				icons: [`${window.location.origin}/icon.svg`]
			},
			// Email and social login (NEAR HACKATHON, Track 09: no seed phrases,
			// popups or gas prompts in the game loop). Reown creates an embedded
			// wallet for these users; it signs the same SIWE message as any other
			// EVM wallet, so /api/auth/verify needs no changes. Wallets stay
			// listed for crypto players.
			features: {
				analytics: false,
				email: true,
				socials: ['google', 'x', 'discord', 'apple'],
				emailShowWallets: true
			},
			// Embedded wallets default to a smart-contract account on some chains.
			// Its signature is validated by a contract (ERC-1271), which the
			// server-side `siwe.verify` can't do without an RPC — so sign-in would
			// fail for every email/social user. A plain EOA signs normally.
			defaultAccountTypes: { eip155: 'eoa' }
		});
	}

	instance = globalThis.__coindraftAppKit;
}

export const appKit = instance;
