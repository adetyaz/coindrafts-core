# CoinDraft — Architecture

A technical overview for reviewers. Everything below reflects the current, working state of the repo — not the original plan (see `README.md` for the product PRD; some of its Wave 2/3 goals shipped differently than originally scoped).

## Stack

- **SvelteKit 5** (runes) — SSR pages + API routes in one repo, TypeScript throughout.
- **Drizzle ORM** over **Postgres** (Supabase) — schema in `src/lib/server/schema.ts`, applied via `drizzle-kit push` (no migration files; direct schema-to-DB sync).
- **Auth**: wallet-only. Reown AppKit for wallet connection (EVM + Solana), SIWE message signing for EVM, ed25519 signature verification for Solana. No passwords, no email. Session is an HMAC-signed cookie (`src/lib/server/auth.ts`) — `createHmac('sha256', SESSION_SECRET)`, compared with `crypto.timingSafeEqual`.
- **Market data**: Binance `/api/v3/ticker/24hr` (batch price + 24h change + volume for the whole draftable pool in one call) + SoSoValue API (sector performance, ETF whale-flow alerts, news).
- **AI**: pluggable backend, see below.

## Core game loop

1. **Draft** (`/draft`) — pick one token per sector (L1, L2, DeFi, Meme, Wildcard). Prices lock the instant a lineup is submitted (`entryPrice` captured from the same batch price map the draft screen itself uses — not a separate fragile per-token call, which used to be the source of silent $0 entry prices under rate-limit pressure).
2. **Match start** — for a real 1v1, the clock (`startAt`/`endAt`) only starts once **both** players have locked a lineup, not on the first submission. For Scrimmage, a bot opponent auto-drafts synchronously the moment the human submits, so both sides are always in place together.
3. **Race** (`/game/[id]`) — a live chart polls `/api/contest/[id]/live` every few seconds, sampling current prices server-side (again from the batch source) and persisting each tick to a `price_samples` table so the line survives a refresh and both players see the same race. Each of the up to 10 tokens in a match (5 per side) gets its own stable color from a fixed palette — colored by individual token, not by sector, so two players who both drafted an L1 pick are still visually distinguishable.
4. **Resolution** — refuses to run before `endAt`; refuses to score if any exit price is missing (an outage used to silently score as "no movement," which is wrong with a wager attached). A request-driven sweep (`hooks.server.ts` + `sweep.ts`) resolves due contests on any incoming request, not just a once-daily cron — needed because contests can now be as short as 10 minutes.

## Modes

- **Single Match** — real-opponent-only matchmaking (`matchmaking_queue` table, survives cold starts), matched on duration + stake tier together.
- **Scrimmage** — same UI/scoring, bot opponent, XP earned goes to a separate `paperXpTotal` so it never touches competitive stats.
- **Multiplayer / Tournament** — a `lobbies` row tagged with `tournamentId`/`tournamentStage` _is_ a bracket stage; tournaments and plain multiplayer lobbies share the same underlying primitive rather than two implementations. Tournaments support public browsing and private invite-only access (`tournament_invites` — the invite token is the actual credential, single-use, claimed only after a successful join).
- **Wager** — tier-matched (0/25/50/100/250 XP) + blind commit: either player can privately raise before the game starts, and it settles at the **lower** of the two numbers, so raising can never cost more than your own figure. Settlement sits behind a `SettlementProvider` interface (`src/lib/server/settlement.ts`) with one real implementation today (XP, via Postgres) — the seam exists so a real-money implementation can be swapped in without touching the wager logic above it.
  **Roadmap note:** real-money wager rewards are planned once the escrow question is resolved — a custom 0G Chain escrow contract is the leading candidate (0G's own Payment Layer + an undocumented-but-verified ERC-4337 EntryPoint on both testnet and mainnet make a deposit-once/debit-off-chain pattern possible), pending a decision on custodial vs. fully on-chain holding. See `docs-project/wager-and-money-mode-plan.md` for the full research.

## 0G Integration

The AI backend is fully pluggable (`src/lib/server/aiCompute.ts`):

```
USE_0G_COMPUTE=true  →  0G Compute Router (testnet, model qwen2.5-omni)
USE_0G_COMPUTE=false →  Groq (fallback)
```

Both are called through one function, `createChatCompletion()`, with an identical OpenAI-shaped request/response — call sites never know or care which backend actually answered. This exists because 0G's Router is OpenAI-compatible but not byte-identical to Groq's SDK path (a hardcoded `/openai/v1/...` prefix in `groq-sdk` produces a 404 against 0G's base URL unless routed through the SDK's generic `.post()` with the corrected path — found live, not from documentation).

**Four features currently run on this:**

| Feature              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| AI Mentor            | Live chat grounded in real-time sector/token/news data            |
| Post-match breakdown | Short AI analysis of what drove a contest's result                |
| AI Draft Agent       | Picks tokens on request; costs XP; every use logs a receipt       |
| Daily Gauntlet quiz  | Generates a fresh quiz question each day instead of a static bank |

**The AI Draft Agent's fairness fix:** two players in the same match asking the agent for help used to get the _exact same_ recommendation, since both calls hit the same live data with the same fairly-deterministic model — defeating the point of competing. Fixed by asking the model for its top 3 ranked candidates per sector instead of one, then sampling from that ranking (weighted 55/30/15% toward 1st/2nd/3rd) server-side, so two simultaneous calls diverge.

**The `x_0g_trace` receipt**, attached to every 0G-backed response: `{ billing: {...}, provider: "0x...", request_id: "..." }`. This is a real, signed billing record naming a TEE-attested provider, independently addressable by request id — but 0G's Router exposes no `/attestation` endpoint, so it is **not** a self-verifiable cryptographic proof. UI copy says "verified on 0G," deliberately never "cryptographically proven" — this distinction was checked against the actual API surface, not assumed from docs.

**What's not yet on 0G:**

- **0G Storage** — the write path exists (`pushToStorage()` in `src/lib/server/gauntlet.ts`, intended to record each day's AI-generated quiz content with a real root hash) but hasn't executed yet — the `@0gfoundation/0g-storage-ts-sdk` package isn't installed. A dedicated testnet wallet key is already configured (`ZG_STORAGE_PRIVATE_KEY`) and `ethers` is already available.
- **0G Chain / on-chain escrow** — researched in depth (0G's own Payment Layer contracts and an undocumented ERC-4337 EntryPoint were verified live on both testnet and mainnet via direct bytecode reads), but no contract is deployed by this project. The wager mechanic above settles in XP through the `SettlementProvider` seam specifically so this can be swapped in later without a rewrite.

## Achievement Badges (0G Chain)

`contracts/` — a separate Hardhat project (own `package.json`, not part of the SvelteKit app's dependency tree) holding `CoinDraftAchievements.sol`: a soulbound (non-transferable) ERC-721 badge contract, **claimed by the player themselves**, not pushed to their wallet by the backend.

- The contract **owner** can define new achievement types at any time (`addAchievementType`) — no redeploy needed as the badge catalog grows.
- The backend never mints anything directly. It decides off-chain when a player has earned a type, and signs a **voucher** — a message scoped to `(this contract, that player's address, that typeId)`. The player's own wallet then calls `claimAchievement(typeId, signature)` themselves, paying their own gas; the contract verifies the signature on-chain (`ECDSA.recover`) before minting. One-shot per type per player, enforced on-chain (`hasAchievement`).
- Badges can't be transferred, sold, or approved to anyone once claimed — every path except the initial claim-mint reverts.

Seeded initial catalog (`contracts/scripts/seed-achievements.ts`): first win vs. a real opponent, first win vs. a bot (Scrimmage), a correct Gauntlet quiz answer, and a 5-answer quiz streak.

**App-side wiring, built:**

- `src/lib/server/achievements.ts` — checks off-chain eligibility (queries `contests`/`gauntlet_attempts` directly — no separate tracking columns), checks on-chain `hasAchievement` to avoid re-offering an already-claimed badge, and signs vouchers with the same wallet as `ZG_STORAGE_PRIVATE_KEY` (signing costs nothing, so no separate funded key is needed for this role).
- `GET /api/achievements/eligible`, `POST /api/achievements/claim-voucher` — the two endpoints the UI needs.
- Profile page (`/profile`) — an "Achievements — unclaimed on 0G" card lists what's claimable; clicking Claim fetches the voucher, then sends the transaction directly from the player's connected wallet via `ethers.BrowserProvider` (see `src/lib/evmWallet.ts` for provider access, extracted from the same pattern Nav.svelte already used for SIWE sign-in).

**Known gap:** claiming requires an EVM wallet address — Solana-signed-in users have nothing this contract can mint to. Same limitation already flagged for the escrow idea.

**Status: live on 0G testnet.**

- Contract: [`0xf1aff3eaaf85d61ba6ba61b8f5f9a7c5f7164a8d`](https://chainscan-galileo.0g.ai/address/0xf1aff3eaaf85d61ba6ba61b8f5f9a7c5f7164a8d) (0G Galileo testnet, chain id 16602)
- Signer role set and all 4 achievement types seeded — confirmed on-chain: [`setSigner`](https://chainscan-galileo.0g.ai/tx/0x4ac1c75b1a06f29f6a70adbbfad5af8224397e340b0516b014940bf2e8bc5fbc), 4× `addAchievementType`.
- `ACHIEVEMENTS_CONTRACT_ADDRESS` is set in `.env` — the claim flow is fully live end to end, pending mainnet redeploy.

## Known architectural notes (for reviewers, not hidden)

- The matchmaking queue and wager tables are Postgres-backed (not in-memory), specifically because an earlier in-memory version didn't survive serverless cold starts.
- Session tokens are HMAC-signed and time-boxed (7 days) — an earlier version used a bare base64 encoding with no real signature, forgeable by anyone; this was found and fixed by reading the code, not reported externally.
- The race chart's price series is captured live during the game window, not reconstructed after the fact — scoring itself only ever compares entry vs. exit price, so the mid-game line is a genuine live sample, not a scoring input.

---

## Tatum x Walrus "Total Recall" Hackathon Integration

**Hackathon:** [Total Recall](https://recall-tatum-walrus.vercel.app/) — Track 1: Markets & Sports Prediction  
**Submission Deadline:** 10 Nov 2026, 17:00 UTC

### Walrus Memory Integration

**Agent Setup:**

- Create agent at [memory.walrus.xyz/dashboard](https://memory.walrus.xyz/dashboard)
- Delegate key → `MEMWAL_AGENT_ID` env var
- SDK: `@walrus/memory` (or `walrus-memory` client)

**Memory Schema (10+ types, all written to Mainnet):**

```typescript
interface CoinDraftMemory {
	type:
		| 'contest_lineup'
		| 'contest_result'
		| 'gauntlet_answer'
		| 'trivia_session'
		| 'mentor_chat'
		| 'sector_boost'
		| 'league_standing'
		| 'badge_claim'
		| 'user_preferences'
		| 'price_snapshot';
	userId: string; // internal UUID
	walletAddress: string; // EVM or Solana
	timestamp: number; // epoch ms
	payload: any; // type-specific (see below)
	txHash?: string; // for on-chain actions (badge claims, future wagers)
}
```

**Write Points (server-side, in existing API routes):**

| Route                                       | Memory Type        | Payload Highlights                                                |
| ------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| `POST /api/contest/[id]/lineup`             | `contest_lineup`   | `contestId`, `picks[{symbol, sector, currencyId, entryPrice}]`    |
| `GET /api/contest/[id]/result` (resolution) | `contest_result`   | `winnerId`, `scoreA`, `scoreB`, `picks[{pctChange, points}]`      |
| `POST /api/gauntlet/answer`                 | `gauntlet_answer`  | `questionId`, `answer`, `correct`, `boostSector`                  |
| `POST /api/trivia/complete` (new)           | `trivia_session`   | `answers[{qId, answer, correct}]`, `score`, `xpEarned`, `streak`  |
| `POST /api/mentor` (stream end)             | `mentor_chat`      | `messages`, `summary`, `tokensDiscussed`, `sectorsDiscussed`      |
| `POST /api/boost/grant` (internal)          | `sector_boost`     | `sector`, `source`, `expiresAt`, `multiplier`                     |
| `POST /api/leagues/[id]/finalize` (cron)    | `league_standing`  | `leagueId`, `rank`, `wins`, `losses`, `points`                    |
| `POST /api/achievements/claim-voucher`      | `badge_claim`      | `badgeTypeId`, `contractAddress`, `txHash`                        |
| `POST /api/me/preferences`                  | `user_preferences` | `defaultMode`, `defaultSector`, `defaultDuration`, `defaultStake` |
| `POST /api/contest/[id]/lineup` (lock)      | `price_snapshot`   | `topGainers[5]`, `topLosers[5]`, `sectorSpotlight`                |

**Implementation Notes:**

- Memory writes are **fire-and-forget** (non-blocking) — failures log to console but don't fail the primary request
- Each write returns a Walrus blob ID; store blob ID in a new `walrus_memories` table for audit/retrieval
- Agent ID is per-user (derived from wallet) or app-level — hackathon requires app-level agent with user context in payload
- 10+ distinct memory types ✅ (we have 10 planned)

### Tatum Integration

**Tatum RPC (Sui):**

- Endpoint: `https://api.tatum.io/v3/sui/{network}/rpc` (API key in header)
- Use case: Read Sui token metadata, balances, transaction history for any Sui-based tokens added to draft pool
- Not currently needed (draft pool is EVM/Solana only) — **integration point ready for Sui sector expansion**

**Tatum Data APIs:**

- Token metadata: `GET /v3/data/tokens/{chain}/{address}`
- Price history: `GET /v3/data/tokens/{chain}/{address}/price-history`
- Holder analytics: `GET /v3/data/tokens/{chain}/{address}/holders`
- Use case: Enrich token cards in draft pool, AI Mentor context, post-match breakdown
- API key: `TATUM_API_KEY` env var (server-only)

**Tatum AI Builder (optional $500 bonus):**

- Generate starter code for Walrus Memory writer + Tatum data hooks at `ai.tatum.io`
- Prompt: "SvelteKit app with Walrus Memory client writing 10 memory types, Tatum Data API token enrichment for crypto fantasy game"
- Copy generated files to `src/lib/server/walrusMemory.ts`, `src/lib/server/tatumData.ts`

### Environment Variables (add to `.env`)

```bash
# Walrus Memory
MEMWAL_AGENT_ID=your_agent_delegate_key_from_dashboard
WALRUS_MEMORY_RPC=https://memory.walrus.xyz  # or mainnet endpoint

# Tatum
TATUM_API_KEY=your_tatum_dashboard_api_key
TATUM_SUI_RPC_URL=https://api.tatum.io/v3/sui/mainnet/rpc
```

### New Files to Create

| File                                    | Purpose                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| `src/lib/server/walrusMemory.ts`        | Walrus Memory client, `writeMemory(type, payload)` helper         |
| `src/lib/server/tatumData.ts`           | Tatum Data API client, token enrichment helpers                   |
| `src/lib/server/schema.ts`              | Add `walrus_memories` table (id, userId, type, blobId, createdAt) |
| `src/routes/api/walrus/test/+server.ts` | Dev endpoint to verify writes (remove before submit)              |

### Judging Criteria Mapping

| Criterion (30%)                | CoinDraft Evidence                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Walrus & Tatum Integration** | 10 memory types written to Mainnet; Tatum Data API enriches draft tokens; Tatum RPC ready for Sui |
| **Technical Quality (30%)**    | Clean SvelteKit 5 + Drizzle + HMAC auth; request-driven resolution; pluggable AI; 0G integration  |
| **Creativity (20%)**           | Fantasy sports → crypto; research→boost mechanic; racing game pivot; AI Mentor + Draft Agent      |
| **Presentation (20%)**         | Live demo at coindrafts.vercel.app; public repo; blog post with learning loop demo                |

### Blog Post Outline (required)

1. **What CoinDraft is** — fantasy crypto prediction game, racing game pivot
2. **How it learns** — every contest, trivia, chat creates a memory; memories → better draft suggestions, personalized AI Mentor, credibility scores
3. **Walrus Memory** — 10 memory types, Mainnet writes, blob IDs stored for audit
4. **Tatum** — Data API enriches token cards; RPC ready for Sui expansion
5. **Learning loop demo** — show a returning user getting better AI Draft Agent picks because their history is in Walrus Memory

---

## NEAR Hackathon Integration

**Hackathon:** [NEAR HACKATHON](https://nearhackathon.com/) — Track 09: Games With Real Economies  
**Deadline:** 14 Nov 2026, 23:59 UTC

### Architecture Extension Points

```
┌─────────────────────────────────────────────────────────────────┐
│                        COINDRAFT APP                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  EVM Wallet │  │ Solana      │  │  NEAR       │  ← NEW       │
│  │  (SIWE)     │  │  Wallet     │  │  Wallet     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│              ┌───────────────────────┐                           │
│              │  SettlementProvider   │  ← EXISTING INTERFACE    │
│              │  (XP / USDC / NEAR)   │                           │
│              └───────────┬───────────┘                           │
│                          │                                       │
│         ┌────────────────┼────────────────┐                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ XP Settle   │  │ USDC Direct │  │ NEAR Intents│  ← NEW       │
│  │ (Postgres)  │  │ Transfer    │  │ Settlement  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### New Components Required

| Component                | Location                                  | Purpose                                                        |
| ------------------------ | ----------------------------------------- | -------------------------------------------------------------- |
| `NearWalletProvider`     | `src/lib/nearWallet.ts`                   | NEAR wallet connection via Reown AppKit / NEAR Wallet Selector |
| `NearIntentsSettlement`  | `src/lib/server/nearIntentsSettlement.ts` | `SettlementProvider` impl using NEAR Intents testnet           |
| `CoinDraftGame` contract | `contracts/near/`                         | NEAR Rust contract: record contest, XP, badges, wager escrow   |
| `NearRpcClient`          | `src/lib/server/nearRpc.ts`               | NEAR JSON-RPC client (view/contract calls)                     |
| `Nep245Manifest`         | `public/nep245.json`                      | Game metadata for NEAR ecosystem discovery                     |

### NEAR Contract: `CoinDraftGame` (Rust)

```rust
// contracts/near/src/lib.rs
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct CoinDraftGame {
    pub owner: AccountId,
    pub contests: UnorderedMap<ContestId, ContestRecord>,
    pub player_stats: UnorderedMap<AccountId, PlayerStats>,
    pub wager_escrows: UnorderedMap<WagerId, WagerEscrow>,
}

#[derive(BorshStorageKey, BorshSerialize)]
pub enum StorageKey {
    Contests,
    PlayerStats,
    WagerEscrows,
}

#[near(serializers=[borsh, json])]
pub struct ContestRecord {
    pub id: ContestId,
    pub player_a: AccountId,
    pub player_b: AccountId,
    pub lineup_a: Vec<LineupPick>,
    pub lineup_b: Vec<LineupPick>,
    pub winner: Option<AccountId>,
    pub score_a: U128,
    pub score_b: U128,
    pub settled_at: u64,
    pub wager_id: Option<WagerId>,
}

#[near(serializers=[borsh, json])]
pub struct WagerEscrow {
    pub id: WagerId,
    pub player_a: AccountId,
    pub player_b: AccountId,
    pub amount: U128,           // yoctoNEAR or USDC via Intents
    pub token: String,          // "NEAR" | "USDC"
    pub status: WagerStatus,    // Pending | Settled | Disputed
    pub intent_hash: Option<String>, // NEAR Intent hash
}

#[near]
impl CoinDraftGame {
    #[init]
    pub fn new(owner: AccountId) -> Self { ... }

    #[payable]
    pub fn create_wager(&mut self, contest_id: ContestId, amount: U128, token: String) -> WagerId { ... }

    pub fn settle_wager(&mut self, wager_id: WagerId, winner: AccountId, intent_hash: String) { ... }

    pub fn record_contest(&mut self, record: ContestRecord) { ... }

    pub fn get_player_stats(&self, account: AccountId) -> PlayerStats { ... }
}
```

### SettlementProvider Interface Extension

```typescript
// src/lib/server/settlement.ts (existing)
export interface SettlementProvider {
	readonly type: 'xp' | 'usdc' | 'near_intents';
	createWager(params: WagerParams): Promise<WagerHandle>;
	settleWager(handle: WagerHandle, winner: 'A' | 'B'): Promise<SettlementResult>;
	refundWager(handle: WagerHandle): Promise<void>;
}

// NEW: src/lib/server/nearIntentsSettlement.ts
export class NearIntentsSettlement implements SettlementProvider {
	readonly type = 'near_intents' as const;

	async createWager(params: WagerParams): Promise<WagerHandle> {
		// 1. Create NEAR Intent for cross-chain USDC transfer
		// 2. Call CoinDraftGame.create_wager on NEAR testnet
		// 3. Return handle with NEAR intent hash + contract wager ID
	}

	async settleWager(handle: WagerHandle, winner: 'A' | 'B'): Promise<SettlementResult> {
		// 1. Execute NEAR Intent (cross-chain settlement)
		// 2. Call CoinDraftGame.settle_wager on NEAR
		// 3. Return tx receipts (NEAR + destination chain)
	}
}
```

### Environment Variables (add to `.env`)

```bash
# NEAR
NEAR_NETWORK=testnet                    # testnet | mainnet
NEAR_RPC_URL=https://rpc.testnet.near.org
NEAR_CONTRACT_ID=coindraft-game.testnet
NEAR_MASTER_ACCOUNT=your_account.testnet
NEAR_PRIVATE_KEY=ed25519:...            # for server-side contract calls

# NEAR Intents (testnet)
NEAR_INTENTS_RPC=https://intents-testnet.near.org
NEAR_INTENTS_CONTRACT=intents.testnet

# NEAR AI (optional)
NEAR_AI_API_URL=https://api.near.ai/v1
NEAR_AI_API_KEY=...
```

### Integration with Existing Systems

| Existing System                                  | NEAR Extension                                                |
| ------------------------------------------------ | ------------------------------------------------------------- |
| **Auth** (`auth.ts`)                             | Add NEAR account linking to `users` table (`near_account_id`) |
| **Contest Resolution** (`contest-resolution.ts`) | After XP/USDC settle, also call `record_contest` on NEAR      |
| **Wager** (`wager.ts`)                           | Add `NearIntentsSettlement` to provider registry              |
| **AI Compute** (`aiCompute.ts`)                  | Add NEAR AI as 3rd backend (Groq → 0G → NEAR AI)              |
| **Achievements** (`achievements.ts`)             | Mirror 0G Chain badge claims to NEAR contract                 |
| **Walrus Memory**                                | Add `near_tx_hash` field to memory payloads                   |

### Walrus Memory + NEAR Cross-Reference

Each Walrus memory write includes NEAR tx hash when applicable:

```typescript
interface CoinDraftMemory {
	// ... existing fields
	nearTxHash?: string; // NEAR contract call tx
	nearIntentHash?: string; // NEAR Intent hash for wagers
}
```

### Demo Script for NEAR Hackathon

1. **Connect NEAR wallet** via Reown AppKit (show chain abstraction)
2. **Enter Versus match** with 100 XP wager
3. **Draft 5 tokens** — show Sector Wars/Whale Watch context
4. **Watch live race** — market drives car positions
5. **Result screen** — shows "Settled via NEAR Intents" with cross-chain tx links
6. **Profile** — shows NEAR contract stats + 0G Chain badges + Walrus Memory count

### Judges' Hot Buttons (from NEAR Hackathon page)

| Judge               | Likely Focus               | CoinDraft Angle                                           |
| ------------------- | -------------------------- | --------------------------------------------------------- |
| Illia (NEAR)        | Chain abstraction, Intents | Unified wallet + cross-chain wager settlement             |
| Eddy (a16z)         | Consumer crypto, retention | Racing game loop, daily trivia, progression               |
| Mert (Helius)       | Perf, UX, real usage       | Sub-1-min draft→race, 60fps 3D on mobile                  |
| Avichal (Electric)  | Novel primitives           | Research→boost mechanic, AI Mentor with memory            |
| Kain (Synthetix)    | DeFi primitives, markets   | Sector Wars = perp market view, wager = prediction market |
| Haseeb (Dragonfly)  | Sustainability, tokenomics | XP/USDC dual economy, no inflationary token               |
| Stepan (cyber•Fund) | Infrastructure, AI         | 0G Compute/Storage/Chain + NEAR AI triple integration     |
| AI Judges           | Code quality, docs         | Clean SvelteKit 5, typed Drizzle, pluggable interfaces    |

## Building
