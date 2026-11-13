// NEAR client for the garage contract (contracts/near). Server-only.
//
// The game server is the contract's operator: every on-chain write is signed
// by NEAR_OPERATOR_ID with NEAR_OPERATOR_PRIVATE_KEY, so players never sign a
// transaction or pay gas.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { Account, KeyPair, KeyPairSigner, providers, transactions } from 'near-api-js';

type KeyPairString = `ed25519:${string}` | `secp256k1:${string}`;

type NearConfig = {
	network: string;
	rpcUrl: string;
	contractId: string;
	operatorId: string;
	operatorKey: KeyPairString;
};

let warned = false;

/**
 * NEAR settings, or null when cars should stay database-only. A half-filled
 * config falls back to the database with one warning instead of failing every
 * car action — same rule the old AI backend switch used.
 */
export function nearConfig(): NearConfig | null {
	if (env.CAR_LEDGER !== 'near') return null;
	const missing = [
		!env.NEAR_CONTRACT_ID && 'NEAR_CONTRACT_ID',
		!env.NEAR_OPERATOR_ID && 'NEAR_OPERATOR_ID',
		!env.NEAR_OPERATOR_PRIVATE_KEY && 'NEAR_OPERATOR_PRIVATE_KEY'
	].filter(Boolean);
	if (missing.length > 0) {
		if (!warned) {
			console.warn(
				`[near] CAR_LEDGER=near but ${missing.join(', ')} unset — cars stay in the database`
			);
			warned = true;
		}
		return null;
	}
	const network = env.NEAR_NETWORK || 'testnet';
	return {
		network,
		rpcUrl: env.NEAR_RPC_URL || `https://rpc.${network}.near.org`,
		contractId: env.NEAR_CONTRACT_ID!,
		operatorId: env.NEAR_OPERATOR_ID!,
		operatorKey: env.NEAR_OPERATOR_PRIVATE_KEY! as KeyPairString
	};
}

export function explorerUrl(accountOrTx: string, kind: 'address' | 'txns' = 'address'): string {
	const network = nearConfig()?.network ?? env.NEAR_NETWORK ?? 'testnet';
	const host = network === 'mainnet' ? 'nearblocks.io' : 'testnet.nearblocks.io';
	return `https://${host}/${kind}/${accountOrTx}`;
}

let cached: {
	key: string;
	provider: InstanceType<typeof providers.JsonRpcProvider>;
	operator: Account;
} | null = null;

function client(cfg: NearConfig) {
	const key = `${cfg.rpcUrl}|${cfg.operatorId}`;
	if (!cached || cached.key !== key) {
		const provider = new providers.JsonRpcProvider({ url: cfg.rpcUrl });
		const signer = KeyPairSigner.fromSecretKey(cfg.operatorKey);
		cached = { key, provider, operator: new Account(cfg.operatorId, provider, signer) };
	}
	return cached;
}

// A mint or trade measures ~3–5 Tgas; 25 leaves headroom. Ten calls per
// transaction stays under the 300 Tgas per-transaction cap.
const GAS_PER_CALL = 25_000_000_000_000n;
export const MAX_CALLS_PER_TX = 10;

/**
 * Signs one transaction as the operator carrying one or more contract calls.
 * The calls run in order and all-or-nothing: if any one panics, none of their
 * changes stick. Returns the transaction hash.
 *
 * Batching exists because one transaction per write measured ~20–30s each on
 * testnet (three RPC round-trips plus finality per write), far too slow to pay
 * out a 5-player race.
 */
export async function callContract(
	calls: { method: string; args: Record<string, unknown> }[]
): Promise<string> {
	const cfg = nearConfig();
	if (!cfg) throw new Error('NEAR is not configured');
	if (calls.length === 0 || calls.length > MAX_CALLS_PER_TX) {
		throw new Error(`Between 1 and ${MAX_CALLS_PER_TX} calls per transaction`);
	}
	const { operator } = client(cfg);

	// Two writes in flight from the same key can collide on the nonce. The loser
	// fails before anything executes, so a short retry is safe.
	for (let attempt = 1; ; attempt++) {
		try {
			const outcome = await operator.signAndSendTransaction({
				receiverId: cfg.contractId,
				actions: calls.map((c) => transactions.functionCall(c.method, c.args, GAS_PER_CALL, 0n)),
				waitUntil: 'EXECUTED_OPTIMISTIC',
				throwOnFailure: true
			});
			return outcome.transaction_outcome.id;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (attempt < 3 && /nonce/i.test(msg)) {
				await new Promise((r) => setTimeout(r, 300 * attempt));
				continue;
			}
			throw e;
		}
	}
}

/** Read-only contract view. */
export async function viewContract<T>(
	method: string,
	args: Record<string, unknown>
): Promise<T | null> {
	const cfg = nearConfig();
	if (!cfg) return null;
	const { provider } = client(cfg);
	return ((await provider.callFunction(cfg.contractId, method, args)) ?? null) as T | null;
}

// ── Player accounts ────────────────────────────────────────────────────────

/**
 * A fresh implicit account: its id is the hex of an ed25519 public key, so it
 * exists for the contract the moment we name it — no creation transaction,
 * no cost, nothing for the player to approve.
 */
export function newImplicitAccount(): { accountId: string; keyCipher: string } {
	const keyPair = KeyPair.fromRandom('ed25519');
	const accountId = Buffer.from(keyPair.getPublicKey().data).toString('hex');
	return { accountId, keyCipher: encryptKey(keyPair.toString()) };
}

// The key is never needed for the game loop (the operator moves tokens); it's
// kept so a player can take full custody later. Encrypted with a key derived
// from SESSION_SECRET so a leaked database row alone can't move anything.
function cipherKey(): Buffer {
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET is required to store NEAR keys');
	return createHash('sha256').update(`${secret}:near-keys`).digest();
}

function encryptKey(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', cipherKey(), iv);
	const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}

export function decryptKey(stored: string): string {
	const [iv, tag, body] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
	const decipher = createDecipheriv('aes-256-gcm', cipherKey(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

// ── Bot accounts ───────────────────────────────────────────────────────────

/** `CryptoWhale_99` → `cryptowhale99.coindraft.testnet` */
export function botAccountId(username: string): string | null {
	const cfg = nearConfig();
	if (!cfg) return null;
	const slug = username.toLowerCase().replace(/[^a-z0-9]/g, '');
	return `${slug}.${cfg.operatorId}`;
}

/**
 * Creates a named bot account under the operator, so judges and players see
 * `nina.coindraft.testnet` on the explorer instead of a hex id. Bots never
 * sign either, so the new key is the operator's own public key.
 */
export async function createBotAccount(accountId: string): Promise<void> {
	const cfg = nearConfig();
	if (!cfg) return;
	const { provider, operator } = client(cfg);
	try {
		await provider.viewAccount(accountId);
		return; // already exists
	} catch {
		// not found: create it below
	}
	const publicKey = KeyPair.fromString(cfg.operatorKey).getPublicKey();
	await operator.createAccount(accountId, publicKey, 100_000_000_000_000_000_000_000n); // 0.1 NEAR
}
