import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, base } from '@reown/appkit/networks';
import { PUBLIC_REOWN_PROJECT_ID } from '$env/static/public';

const PROJECT_ID = PUBLIC_REOWN_PROJECT_ID;

type AppKitInstance = ReturnType<typeof createAppKit>;

declare global {
	var __coindraftAppKit: AppKitInstance | undefined;
}

let instance: AppKitInstance | null = null;

if (typeof window !== 'undefined') {
	if (!globalThis.__coindraftAppKit) {
		// Sign-in is email and social only. Reown gives each player an embedded
		// EVM wallet behind the scenes; it signs the same SIWE message any wallet
		// would, so /api/auth/verify is unchanged. Players never see a wallet.
		//
		// Browser wallets were listed alongside until 2026-11-13 and caused real
		// trouble: an installed Phantom reconnected itself on every page load
		// (through the Solana adapter) and asked for a signature each time. So
		// the Solana adapter, injected wallets, WalletConnect and the wallet list
		// are all off. Existing wallet accounts still verify on the server.
		const networks = [mainnet, base] as const;
		const wagmiAdapter = new WagmiAdapter({ projectId: PROJECT_ID, networks: [...networks] });

		globalThis.__coindraftAppKit = createAppKit({
			projectId: PROJECT_ID,
			adapters: [wagmiAdapter],
			networks: [...networks],
			// No `defaultNetwork` — sign-in is a chain-agnostic SIWE signature, not
			// a transaction, so connecting shouldn't push the wallet anywhere.
			// `url` MUST match the page's real origin — wallets compare this
			// against where the connection request actually came from, and a
			// mismatch is exactly the signal phishing detectors look for. This
			// was hardcoded to 'coindraft.io', a domain that isn't even live,
			// while the app runs somewhere else entirely — that's what was
			// triggering "malicious site" warnings.
			metadata: {
				name: 'CoinDraft',
				description: 'A racing game driven by the crypto market',
				url: window.location.origin,
				icons: [`${window.location.origin}/icon.svg`]
			},
			features: {
				analytics: false,
				email: true,
				socials: ['google', 'x', 'discord', 'apple'],
				emailShowWallets: false,
				connectMethodsOrder: ['email', 'social']
			},
			allWallets: 'HIDE',
			enableWalletConnect: false,
			enableInjected: false,
			enableEIP6963: false,
			enableCoinbase: false,
			enableWalletGuide: false,
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
