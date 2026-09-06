# CoinDraft × 0G — Integration Plan

_Grounded in 0G's actual docs (docs.0g.ai), not the buildathon marketing copy. Every claim below about how a piece works was pulled from their real developer documentation. To be built in a separate forked repo, not a branch of this one._

**Superseded for the Compute piece specifically:** see [`0g-compute-integration-findings.md`](0g-compute-integration-findings.md) (2026-08-25) for a re-verified, more precise breakdown of the Router vs. Direct split, exact testnet/mainnet URLs and contract addresses, the deposit/API-key setup flow, and exactly where this wires into `/api/mentor` and `/api/breakdown`. That doc corrects a few things this one got only approximately right (notably: it's not a pure base-URL swap — there's a manual wallet/deposit/API-key step first — and mainnet has since gone live, resolving the "is 0G production-ready" question below as a yes).

---

## 1. The 0G ecosystem, understood

0G is a modular stack — five independent pieces you can use individually or combine. Here's what each one actually is, verified:

### 0G Chain
EVM-compatible L1. Galileo testnet: Chain ID `16602`, native token `0G`, RPC `https://evmrpc-testnet.0g.ai`, explorer `chainscan-galileo.0g.ai`, faucet at `faucet.0g.ai` (0.1 0G/day per wallet). **MetaMask, ethers.js, wagmi all work directly, no new wallet ecosystem required** — this is the single biggest practical difference from the Midnight integration we scoped earlier, which needed an entirely separate wallet (Lace). CoinDraft already supports EVM wallets via Reown AppKit; adding 0G is realistically "add a network," not "add a wallet."

### 0G Compute
A decentralized GPU marketplace for LLM inference, structured as a **Router**: `https://router-api.0g.ai/v1` is **OpenAI-API-compatible** — point an existing OpenAI-shaped SDK at it and it works as a drop-in replacement. Requests get processed by providers running inside TEEs (Trusted Execution Environments), returning cryptographically signed results — the network proves the inference actually ran as specified, rather than trusting a centralized provider's word for it. Priced roughly 90% below typical inference costs per their docs.

### 0G Storage
Decentralized file/blob storage, content-addressed by merkle root hash (`indexer.upload(file, rpcUrl, signer)` → root hash; `indexer.download(rootHash, path, withProof)` retrieves it, with optional merkle proof verification). A separate 0G-KV layer exists for structured key-value access. **Explicitly not suited for real-time or frequently-updated data** — their own docs call out latency-sensitive, high-write-frequency use cases as a bad fit. Good fit: immutable, write-once records — archival, not live state.

### Agentic ID (ERC-7857)
An ERC-721 NFT standard where the token represents a functioning AI agent, not just a certificate. On-chain: token ID, owner, a metadata hash, and an **encrypted URI** pointing to the agent's actual data (model/config/capabilities) — which in their own example code is stored via `ogStorage` (i.e., Agentic ID's metadata layer is built on top of 0G Storage). Three core contract operations:

- `mint(to, encryptedURI, metadataHash)` — creates the agent.
- `transfer(from, to, tokenId, sealedKey, proof)` — ownership transfer, oracle-mediated: the oracle decrypts the original data and re-encrypts it for the new owner's key before the transfer finalizes. The new owner gets a fully functional agent, not an empty pointer.
- `authorizeUsage(tokenId, executor, permissions)` — grants computational/execution rights to a third party **without** transferring ownership. This is the piece most relevant to CoinDraft, covered below.

0G's own flagship example for this standard: *"buy and sell trained trading bots with guaranteed functionality transfer."*

### 0G Pay
Payment rails built for agent-to-agent and agent-to-dApp microtransactions. Relevant once real-money prize pools exist (Wave 3.4), not before.

### 0G DA
High-throughput data availability, aimed at rollups/L2-scale data needs. **Not a fit for CoinDraft at its current scale** — flagged here only to rule it out explicitly rather than silently omit it.

---

## 2. Mapping 0G onto what CoinDraft actually has

Rather than inventing new scope, here's every existing CoinDraft surface checked against the 0G stack for a genuine fit:

| CoinDraft surface | 0G piece | Fit | Why |
| --- | --- | --- | --- |
| AI Mentor (`/api/mentor`) | **Compute** | Strong | Already an OpenAI-shaped SDK call (Groq) for a real, live feature. Swapping the base URL/key to 0G's Router is close to a config change, and upgrades a black-box call into a verifiable, TEE-signed one. |
| AI result breakdown (`/api/breakdown`) | **Compute** | Strong | Same mechanism as above — same SDK shape, same swap. |
| Always-online bot opponents (`bots-service`) | **Agentic ID** | Strong | These are already functioning autonomous agents (queue, draft real lineups from live data, play matches). Tokenizing them turns a backend implementation detail into an actual product feature — ownable, tradeable AI opponents. This is 0G's own headline use case, not a stretch. |
| `bots-service`'s execution model | **Agentic ID's `authorizeUsage`** | Strong, and specific | The bots-service script runs bot accounts on their "owner's" behalf without being the owner. `authorizeUsage(tokenId, executor, permissions)` is *exactly* this relationship, expressed on-chain: mint a bot as an Agentic ID owned by CoinDraft (or eventually a user), authorize the bots-service's executor address to run it, without transferring ownership. |
| Contest results (post-resolution, immutable) | **Storage** | Moderate | Once a contest resolves, the result never changes — a legitimate write-once record. Good fit *specifically because* it's no longer live data by that point. |
| Locked lineups (post-lock, immutable) | **Storage** | Moderate | Same reasoning — a lineup is frozen the instant it locks. |
| Live game state (queues, open contests, in-progress drafts) | — | **No fit, explicitly** | This is exactly the "frequently-updated, latency-sensitive" case 0G's own docs warn against. Stays on Postgres. Worth stating plainly so nobody tries to force it later. |
| Real-money prize pools (Wave 3.4, not yet built) | **0G Pay** | Roadmap-aligned | Same framing as it had under Midnight — real fit, but gated on the feature existing first. |
| Sector/price data feed (SoSoValue) | — | No fit | This is fine as centralized, low-stakes market data. Decentralizing a public price feed doesn't solve a real problem here. |

---

## 3. The combined architecture (how the pieces click together)

The strongest pitch isn't any one piece in isolation — it's that all four map onto **the same underlying story**: autonomous agents, verifiably reasoning, ownably tokenized.

```
User (or CoinDraft) mints a bot as an Agentic ID
        │
        ▼
Agent's config/persona/strategy → encrypted → stored on 0G Storage
        │  (encryptedURI + metadataHash recorded on-chain via mint())
        ▼
bots-service is granted authorizeUsage() as the executor
        │
        ▼
When the bot "thinks" (drafts a lineup, or — future — reasons via
Mentor-style logic about which token to pick), that inference call
runs through 0G Compute instead of a centralized API
        │
        ▼
Once a contest resolves, the immutable result gets written to
0G Storage as a permanent, verifiable record
        │
        ▼
Owner can trade the Agentic ID — new owner gets a fully
functional bot, oracle-mediated re-encryption included
```

This reframes the buildathon submission from "we bolted on some blockchain features" to "we decentralized the parts of an already-real product that were sitting on centralized infrastructure by default" — which is a materially more credible story to judges than a from-scratch demo.

---

## 4. Phased build plan

**Phase 1 — Compute swap (lowest risk, fastest to ship)**
Point `/api/mentor` and `/api/breakdown` at 0G's Router instead of Groq, behind a feature flag. Verify response quality/latency is acceptable. This alone is a legitimate, working submission if nothing else lands in time.

**Phase 2 — Agentic ID for the bots**
Deploy/use `AgenticID.sol` on 0G Chain testnet. Mint the existing 8 bot personas as Agentic IDs, encoding their persona (username, drafting tendency, whatever differentiates them) as the encrypted metadata, stored via 0G Storage. `authorizeUsage()` granted to a `bots-service` executor address.

**Phase 3 — Immutable result records**
Once a contest resolves, write the final result (scores, picks, winner) to 0G Storage, store the returned root hash alongside the existing Postgres row. Doesn't replace Postgres — Postgres stays the live source of truth; 0G Storage becomes the permanent, independently-verifiable copy.

**Phase 4 — User-owned bots (stretch)**
If time allows: let a real user mint *their own* Agentic ID bot (choose a persona/strategy), and either let it play autonomously or trade it. This is the piece that turns the integration from "infrastructure upgrade" into "new game mechanic," but it's the most product-design work of the four phases, not just plumbing.

---

## 5. Evolved mapping (2026-08-25) — anchoring 0G to new features, not old infrastructure

The original phased plan above anchors 0G to things that already exist but are largely invisible to a player (an API-provider swap behind Mentor/breakdown, tokenizing bot personas nobody directly interacts with). That's why it read as "meh" on reflection — the committed scope (Phase 1) is the least exciting piece, and the genuinely interesting piece (owning/trading bots) got pushed to a stretch goal.

The evolve: anchor each 0G piece to something in `new-feature-ideas.md` that a player touches every draft, instead of backend plumbing.

| 0G piece | Old anchor (meh) | Evolved anchor |
| --- | --- | --- |
| **Compute** | Mentor/breakdown — generic AI-provider swap | **The AI draft advisor (`new-feature-ideas.md` §6)** — TEE-verified inference isn't just "cheaper API," it's what makes the XP-handicap mechanic *enforceable*. The pitch: "we penalize AI-assisted wins, and the AI's involvement is cryptographically provable — you can't fake using it, we can't fake whether you did." A mechanic-driven story, not a plumbing story. |
| **Agentic ID** | Tokenizing the 8 bot personas — invisible unless matched against one | **The perks/boosts economy (§7)** — Captain, Free Hit, Shield, Late Swap, etc. as ownable, tradeable items. This is Agentic ID's actual flagship pattern (ownable assets with real utility/transferability) applied to something touched every single draft. |
| **Pay** | Parked — "gated on the feature existing first," nothing to attach to | **Sponsor tournaments + wager mode (§1–2)** — finally a real feature to attach to, not a hypothetical one. |
| **Storage** | Immutable contest results — nobody notices | Supporting layer under the above (perk-trade history, tournament payout records) — still not a headline on its own, but no longer the *only* thing Storage does. |

**Honest tension, not resolved:** none of the target features (AI advisor, perks/boosts) are built yet — they're still ideas in `new-feature-ideas.md`. This evolved mapping is the right *strategic direction* for the pitch and roadmap, but with the deadline pressure in `midnight-0g-timeline.md`, building both the underlying feature and the 0G integration in the remaining window isn't realistic. Working read at the time this was written: pitch the evolved vision as where this is headed, but the actual near-term submission should stay closer to the original Phase 1 scope (§4), which already works today against Mentor/breakdown as they exist now.

---

## 6. Open questions / things the docs didn't confirm

Being direct about what wasn't verifiable from public docs, so nobody builds on an assumption:
- Exact available model list on 0G Compute's Router (docs point to `pc.0g.ai` for the live list — needs checking at build time, not now).
- Exact per-byte/per-transaction cost for 0G Storage (docs mention "Turbo vs Standard" tiers but no published rate).
- Whether 0G Chain is production-ready (mainnet) or still testnet-primary for a buildathon submission timeline — worth confirming directly before committing to a network.
