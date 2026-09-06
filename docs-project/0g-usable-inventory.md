# 0G — What CoinDraft Can Actually Use

_Created 2026-08-27. Scope: **only the things that are genuinely usable**, broken down against this codebase specifically. Ruled-out items (0G Pay, DA, 0g-cc/VIBEZ) are covered in `game-modes-redesign.md`'s full usage table and are not repeated here._

**Everything below is grouped by what it would actually take to get it running, not by which 0G product it is** — because that's the question that decides what happens next.

---

## Tier 1 — Already built. One env flag away from being live.

### 1.1 Compute (Router) — three call sites, all shipped

Every AI call in the app already routes through one function: `getAiClient()` in [aiCompute.ts](../src/lib/server/aiCompute.ts). It returns a Groq-shaped client pointed at either Groq or the 0G Compute Router, decided entirely by env vars. Three call sites use it today:

| Call site | File | What it does | 0G-verified? |
| --- | --- | --- | --- |
| AI Mentor | [api/mentor/+server.ts:91](../src/routes/api/mentor/+server.ts) | Streaming chat grounded in live sector/token/news data | Curl-verified against the real testnet Router (streaming confirmed) |
| Result breakdown | [api/breakdown/+server.ts:83](../src/routes/api/breakdown/+server.ts) | Non-streaming post-match analysis | Curl-verified (non-streaming completion) |
| AI Draft Agent | [draftAgent.ts:83](../src/lib/server/draftAgent.ts) | Picks tokens per sector from the real candidate pool | Built + live-tested 2026-08-27 (via Groq path) |

### ✅ FLIPPED AND VERIFIED LIVE — 2026-08-28

`USE_0G_COMPUTE=true`. All three call sites confirmed serving real responses from the 0G Compute Router through the app. Timings: Mentor 5.5s (streaming), breakdown 3.6s, draft agent 3.7s.

**A real bug was found and fixed by doing this — the integration had never actually worked through the app.**

`groq-sdk` **hardcodes** its request path as `/openai/v1/chat/completions`. Appended to 0G's base URL (which already ends in `/v1`), that produced `.../v1/openai/v1/chat/completions` → **404**. All prior "verification" had curl'd the Router directly, never through `groq-sdk`, so this was invisible until the flag was flipped. The premise in the original findings doc — that groq-sdk is a drop-in OpenAI-compatible client — was wrong on this one specific point.

**How it surfaced, and why the test design mattered:** the draft agent was tested *first* and appeared to work — because its procedural fallback silently absorbed the 404. Mentor was tested second precisely because it has **no fallback**, and it returned the 404 immediately. Had only the agent been checked, this would have shipped looking healthy while never once using 0G.

**Fix:** `createChatCompletion()` in [aiCompute.ts](../src/lib/server/aiCompute.ts) now routes to the correct path per provider, reusing groq-sdk's HTTP/auth/streaming layer via its generic `.post()`. **No new dependency.** All three call sites use it instead of `client.chat.completions.create()`.

**Proof the LLM is genuinely being invoked** (not the fallback silently answering): for identical input, the procedural fallback yields ADA/XMR/STETH/XMR/XMR, while the 0G path returned BNB/ICP/LINK/DOGE/USDT.

**One honest quality note:** on `qwen2.5-omni` (0G) the draft agent picked **USDT — a stablecoin — for the wildcard slot**, which is a weak draft pick since it barely moves. `openai/gpt-oss-120b` (Groq) produced more sensible momentum plays. Both are *valid* (real tokens, correct sectors, no crashes), but pick *quality* is visibly lower on the current 0G model. Worth weighing: this is the difference between "0G works" and "0G is the better choice here." Revisit if the Router's model catalog grows.

**What flipping it actually buys:**
- Cost — 0G's published numbers are ~90–96% cheaper than cloud equivalents.
- TEE-verifiable inference. This one is worth flagging for a specific reason below.

**The TEE angle is genuinely more interesting now than when we first integrated Compute.** The Draft Agent charges players real XP for AI help (15 XP/slot). That creates a claim the app currently can't back up: *"we penalize AI-assisted drafting."* With TEE-verified inference, the AI's involvement becomes cryptographically provable — a player can't fake not having used it, and the app can't fake whether they did. That turns a trust-me mechanic into a verifiable one. **Not built, and not needed for the Draft Agent to work** — but it's the single strongest product-level argument for 0G in this codebase, and it only became available when the Draft Agent shipped today.

**Effort to use: near zero.** Flip one env var, then re-test the three call sites.

---

## Tier 2 — Usable, real work, no blockers.

### 2.1 Compute (Router) — smarter bots

`bots-service` (separate branch) currently drafts with `[...tokens].sort(() => Math.random() - 0.5)` — pure randomness, no reasoning at all. `draftAgent.ts` now proves the exact pattern that would replace it: bucket live tokens by real sector, ask the model to choose among genuine candidates, validate the answer, fall back procedurally on a bad response.

**Two distinct places this could land, and they're not the same thing:**
- `bots-service`'s queue-based bots (the separate branch).
- `botDraft.ts`'s Scrimmage bots (in this repo, shipped today) — which already use `classifySector` for correct sector assignment but still pick *randomly within* a sector.

**Effort: low.** The reasoning code already exists and is tested; this is a call-site swap, not new infrastructure.

**Worth weighing honestly:** an LLM call per bot per draft costs real money and adds latency to a path that currently costs nothing and is instant. Scrimmage bots exist to give new players an opponent, not to be hard to beat. Do this if bot quality becomes a real complaint — not on principle.

### 2.2 Storage — permanent records that matter

`@0gfoundation/0g-storage-ts-sdk` (v1.2.11, published 2026-08-06 — the current package; see the scope note in `game-modes-redesign.md`).

**The honest position:** the original integration plan proposed storing *free contest results* here, which nobody would ever care about or verify. That framing was weak. What's genuinely worth permanently recording is anything where a player could later dispute an outcome involving real value:
- Paid tournament payout records (`G-05` money mode)
- Settled wager matches (`G-03`)
- Agentic ID persona metadata, if 2.3 ever happens (Storage is a hard dependency there — the persona blob lives in Storage, only its hash goes on-chain)

**Blocked on:** nothing technical. Blocked on *there being something worth recording* — which means paid modes existing, which means the escrow decision. **Not blocked on 0G.**

> **Note (2026-08-27):** you've stated an intent to use **Midnight to privately store results**. That is not in conflict with this item, but they are opposites and shouldn't be pointed at the same data: 0G Storage makes a record **permanent and publicly verifiable**; Midnight makes a result **confidential**. Logged in `midnight-integration-findings.md` §4a.

### 2.3 Agentic ID (ERC-7857) — bot personas as ownable assets

The 8 Scrimmage bot personas (`SCRIMMAGE_BOTS` in [botDraft.ts](../src/lib/server/botDraft.ts)) become real, ownable, tradeable NFTs. 0G's own flagship framing for this standard is literally *"buy and sell trained trading bots with guaranteed functionality transfer."*

**The distinction that must not get blurred** (established in the Q5 research, restated here because it's the single easiest thing to get wrong): **Agentic ID tokenizes *ownership of an identity*. It does not make a bot draft better.** Whether a bot picks well is 2.1's job (Compute). Whether a bot can be owned and sold is this. They're independent — either can happen without the other.

**Real dependencies:** Storage (2.2) for the encrypted persona blob, plus a deployed ERC-7857 contract. Reference implementation exists at `0gfoundation/0g-agent-nft` (branch `eip-7857-draft`) — sample code, not a polished starter kit.

**Also usable here:** `authorizeUsage(tokenId, executor, permissions)` maps exactly onto the relationship the backend already has with the 8 seeded bot accounts — it drives them without owning them, which is precisely what that function is for.

**Effort: high.** Contract work + Storage integration + a real product decision about whether bots are meant to be owned at all. This is a feature, not an integration.

---

## Tier 3 — Usable, but gated on a decision that isn't technical.

### 3.1 Chain — custom escrow contract

Now the **only** 0G-native option for holding money, since 0G Pay doesn't exist (verified three independent ways — see `game-modes-redesign.md`).

**What's confirmed and genuinely low-friction:**
- 0G Chain is fully EVM-compatible; Hardhat/Foundry/Remix work unmodified.
- `viem` — already a dependency of this project — ships built-in 0G chain definitions (`zeroG`, `zeroGMainnet`, `zeroGTestnet`, `zeroGGalileoTestnet`). No hand-rolled chain config needed.
- The app already does real wallet auth via Reown AppKit + Wagmi, so the wallet plumbing exists.
- Testnet: chain ID `16602`, RPC `https://evmrpc-testnet.0g.ai`, faucet gives 0.1 0G/day.
- Any audited standard Solidity escrow (OpenZeppelin's, etc.) deploys as-is. There is no 0G-specific escrow pattern to learn.

**What's genuinely unresolved, and it isn't an engineering question:** whether escrow should be on-chain at all, versus a simpler custodial/DB-backed hold. On-chain means CoinDraft never touches user funds, but players need $0G in their wallet to play — real friction on mainnet, since almost nobody already holds it. Custodial means no wallet friction but makes CoinDraft the entity holding real user money, which is a money-transmission/custody question, not a technical one.

**Blocks:** `G-03` (Wager) entirely, and `G-05`'s money mode / private / sponsor access types. `G-05`'s free-to-play path is already built and unaffected.

---

## Not part of the product

### 0g-cc as a development workflow tool
`@0gfoundation/0g-cc` is an MCP server for AI coding assistants — it can't be imported into this app (covered in `game-modes-redesign.md`). But it can route *the coding assistant's own* inference through 0G at roughly 96% lower cost. That's a dev-workflow decision, entirely separate from CoinDraft's architecture. Listed here only so it doesn't get confused for a product capability.

---

## Summary

| What | Effort | Blocked on |
| --- | --- | --- |
| **Compute — flip the flag** | ~zero | Nothing. A decision to test it. |
| **Compute — TEE for provable AI-assist penalty** | Medium | Nothing technical. Newly relevant since the Draft Agent shipped. |
| **Compute — smarter bots** | Low | Nothing. Worth doing only if bot quality is a real complaint. |
| **Storage — payout/result records** | Low–Medium | Paid modes existing (→ escrow decision). Not blocked on 0G. |
| **Agentic ID — ownable bot personas** | High | Storage + contract work + a product decision. |
| **Chain — escrow contract** | Medium | **A product/legal decision: custodial vs. on-chain.** |

**The single highest-leverage item that is blocked on nothing:** flipping `USE_0G_COMPUTE=true` and testing the three live call sites through the app. Everything in Tier 1 is already paid for in engineering time — it just isn't switched on.
