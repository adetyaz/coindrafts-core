# Midnight Integration — Grounded Findings

_Written 2026-08-26, in direct response to `answers.md` H-01 ("Can midnight blockchain play a role in this?"). Researched from official docs (docs.midnight.network) plus a full read of a real, working reference implementation (`github.com/mashharuki/midnight-prediction-market-sample-app`) — including its actual `.compact` contract source, not just its README. Nothing here is carried forward from the earlier `midnight-0g-timeline.md`, which itself flagged its Midnight claims as "unresolved" and pointed at a `midnight-integration-notes.md` file that — like `CoinDraft.dc.html` before it — **turns out not to exist in this repo**. Treat anything from that older doc as unverified until it appears here._

**Note on scope, per your instruction:** this is research only. Nothing below has been implemented. It's written so the *next* conversation can go straight to a build decision instead of a research pass.

---

## 1. Direct answer to H-01: no — and here's exactly why

**H-01 is a plain web-session-cookie signing bug.** `createSessionToken` in `src/lib/server/auth.ts` produces a signature via `base64(payload + SECRET).slice(0,16)`, and because base64 encodes sequentially, that slice never actually reaches the part of the string containing `SECRET` — the signature is a pure function of the payload, so anyone can forge a session for any user id. This was verified two ways: three different secrets (real, wrong, empty) all produced the identical signature, and a forged token for an arbitrary user id was accepted by the real parser.

**Midnight does not fix this, and pulling it in to try would be a large, wrong-shaped tool for the job.** The reasoning:

- Midnight's privacy model (Compact contracts, ZK proofs, the Lace wallet, a proof server) exists to authorize and hide **on-chain smart-contract state and calls** — "did the holder of this secret correctly execute this circuit." It has no concept of, and nothing to say about, **a web server issuing an HTTP session cookie to a browser**. Those are different layers of the stack; nothing about H-01 involves a blockchain today, and fixing it doesn't require adding one.
- Using it anyway would mean every page load — not just contest actions — now depends on a Lace wallet being installed, a proof server being reachable, and a ZK proof being generated, just to prove "I'm still logged in." That's real, ongoing latency and a hard requirement (a *second* wallet, on top of the EVM/Solana wallet already used for identity) added to the single most basic interaction in the product, to solve a problem that has nothing to do with privacy.
- The actual fix is small and unrelated to any of this: sign the payload with a real keyed hash — `crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url')`, compared with `crypto.timingSafeEqual` — and, since it's touching this code anyway, start checking the `ts` field that's currently written but never validated, so sessions actually expire.

**Where your instinct *was* pointing at something real, though:** the reference Compact contract's own identity primitive —
```
derive_participant_key(sk) = hash("forecast:participant:v1" + sk)
```
— is the exact same *category* of construction as a correct session HMAC: prove knowledge of a secret via a one-way function, without ever transmitting the secret itself. Midnight's own contract code is, in effect, a live example of the pattern the H-01 fix should also use. That's a genuine conceptual connection — it's just not a reason to route session cookies through a blockchain.

**So H-01's fix proceeds exactly as already scoped, independent of anything below.**

---

## 2. What Midnight actually is, verified

- A privacy-focused L1 (a Cardano-linked "sidechain" in most framing) using zk-SNARKs — specifically a Halo2/Plonk-derived proof system supporting recursive proofs, no trusted setup required in the standard configuration.
- **Selective disclosure** is the core idea: a contract can prove a fact about private data (e.g., "this hash matches a committed value") without revealing the data itself. In Compact, this is the explicit `disclose()` function — anything not wrapped in `disclose()` never leaves the prover's local machine as plaintext; only the proof that a correct computation happened does.
- **Compact** is a statically-typed DSL "based on TypeScript" that compiles into ZK circuits. You write `circuit` functions with asserts and ledger reads/writes; the compiler handles the cryptography.
- A **proof server** is required to generate proofs — either self-hosted (Docker container, confirmed via the reference repo's `pkgs/cli/proof-server.yml` and `standalone.yml`), or a hosted one Midnight itself runs per network (confirmed URLs below). This is a real, separate piece of infrastructure, not optional.
- Wallet integration goes through **Lace** (Cardano's wallet, now Midnight-aware) via the `@midnight-ntwrk/dapp-connector-api` npm package — conceptually parallel to `window.ethereum` for EVM or `window.solana` for Phantom, but it's a **third, separate wallet ecosystem** from the two (EVM, Solana) CoinDraft already supports.
- Two-token model: **NIGHT** (governance) and **DUST** (a regenerating fee resource, explicitly designed to decouple transaction cost from token price volatility — worth treating as a genuinely different economic model from a normal gas token, and not yet fully researched here; flagged as an open item in §6).

### Network status (this resolves the old doc's open question)

**Mainnet is live** — genesis March 30/31 2026, current phase named **"Kūkolu"** (federated mainnet). This is real, but **not fully decentralized yet**: validation currently runs through nine named federated operators (Google Cloud, MoneyGram, Worldpay, Bullish, Pairpoint by Vodafone, eToro, AlphaTON Capital, Blockdaemon, Shielded Technologies), not open/permissionless participation. Roadmap: **Mōhalu** (Q2–Q3 2026, broader participation, incentivized testnet, DUST capacity exchange) then **Hua** (Q3 2026+, cross-chain "Hybrid DApps," full decentralization). Worth stating plainly for any buildathon pitch: "deployed on Midnight mainnet" today means "deployed on a live but validator-federated network," not a fully trustless one yet — an honest framing beats an overstated one.

Two public **testnets** confirmed live and distinct from mainnet, with separate endpoints for everything:

| Network | Indexer (GraphQL) | Node RPC | Proof server | Faucet |
| --- | --- | --- | --- | --- |
| `preview` | `indexer.preview.midnight.network/api/v4/graphql` | `rpc.preview.midnight.network` | `proof-server.preview.midnight.network` | `faucet.preview.midnight.network` |
| `preprod` | `indexer.preprod.midnight.network/api/v4/graphql` | `rpc.preprod.midnight.network` | `proof-server.preprod.midnight.network` | `faucet.preprod.midnight.network` |
| `undeployed` (local) | `127.0.0.1:8088` | `127.0.0.1:9944` | `127.0.0.1:6300` (Docker) | none |

(Source: the reference repo's `pkgs/shared/src/network-config.ts`, which both its CLI and frontend read from a single place specifically so the two can't drift — a pattern worth copying if CoinDraft ever wires this up.)

---

## 3. The commit-reveal pattern, verified from real, working contract code

The reference repo isn't a toy — it's a complete prediction market: players commit a pick + stake while hidden, results get revealed, an admin resolves the winner, and pari-mutuel rewards get paid out. This maps unusually well onto CoinDraft's own draft/lineup/resolve loop. Read in full from `pkgs/contract/src/prediction-market.compact`:

**Identity, without a stored address:**
```
witness local_secret_key(): Bytes<32>;   // never leaves the user's machine

circuit derive_participant_key(sk: Bytes<32>): Bytes<32> {
  return persistentHash([pad(32, "forecast:participant:v1"), sk]);
}
```
The chain only ever sees a hash of the secret, not the secret or a wallet address — pseudonymous by construction.

**The commit — pick and salt are private, stake is public:**
```
witness get_selected_team(): Team;
witness get_prediction_salt(): Bytes<32>;

circuit make_prediction_commitment(participant_key, team, stake, salt): Bytes<32> {
  return persistentHash([pad(32,"forecast:pick:v1"), participant_key, team_bytes, stake_bytes, salt]);
}

export circuit commit_prediction(stake: Uint<64>): [] {
  const public_stake = disclose(stake);          // stake IS public
  // ... team and salt are witnesses — never disclosed here
  const commitment = make_prediction_commitment(key, team, public_stake, salt);
  commitments.insert(disclose(key), disclose(commitment));   // only the HASH is stored
}
```
This is the exact "hide the lineup until lock, reveal after" shape CoinDraft's own `new-feature-ideas.md` (§7.2, the "Scouting" perk) and `midnight-0g-timeline.md` already gesture at, now backed by real, tested circuit code rather than a description.

**The reveal — re-derive the hash, compare, only then use the real value:**
```
export circuit reveal_prediction(): [] {
  const expected = make_prediction_commitment(key, team, stake, salt);
  assert(disclose(expected == commitments.lookup(public_key)), "Prediction commitment mismatch");
  // only now does the pool actually get credited with this player's real pick
}
```

**Pari-mutuel payout math, done without division inside the circuit** — a non-obvious, reusable pattern:
```
export circuit claim_reward(reward: Uint<64>): [] {
  const payout_numerator = total_pool * stake;
  assert(public_reward * winning_pool <= payout_numerator, "Reward exceeds entitlement");
  assert((public_reward + 1) * winning_pool > payout_numerator, "Reward below floor-rounded entitlement");
  assert(total_claimed_rewards + public_reward <= total_pool, "Reward conservation violated");
}
```
Rather than computing a division on-chain (expensive/awkward in a ZK circuit), the *prover* computes the exact floor-rounded reward off-chain and the circuit merely *verifies* it's correct via two bound checks. If a real-money wager mode (`X-02` in `user-stories-by-surface.md`) is ever built, this is a directly transferable pattern, and it resolves that story's open "escrow mechanism undecided" question with a concrete, working answer: locked stake pools in contract ledger state (`Map<Bytes<32>, Uint<64>>`), released only via a verified claim.

---

## 4. The honest limitation: Midnight does not solve CoinDraft's actual oracle problem

This is the finding that most changes the shape of any real proposal, and it comes straight from the reference repo's own architecture guidance (`.agents/skills/prediction-market-architect/references/oracle-and-resolution.md`), not from speculation:

The sample contract's `resolve_market(winner: Team)` is called directly by a single admin key — no bond, no dispute window, no on-chain data feed. The repo's own reference doc explicitly names this the **weakest of three resolution tiers** ("Trusted admin / creator-reports") and says outright: *"When it's not [fine]: anything with real external money and an unaccountable resolver... flag this as a finding whenever you see it in a review of a production-intended system."*

**Applied to CoinDraft:** contests resolve against real SoSoValue price data today via CoinDraft's own backend. If lineups moved onto a Midnight commit-reveal contract, **the resolution step would still be CoinDraft's backend calling `resolve_market()` with the outcome it computed from SoSoValue** — same trust model as today, just with the additional property that *other players* can't see your pick before you reveal it. That's a real, valuable property (it's the actual "Scouting" / anti-copying use case), but it is **not** "trustless" or "decentralized resolution," and shouldn't be pitched as such. Getting to genuine trust-minimized resolution would mean building one of the two stronger tiers the reference doc describes (an optimistic propose-and-dispute oracle, or resolution via a validator/token-holder vote) — both are materially bigger builds than the commit-reveal contract itself, and neither is needed for the "hide picks from other players" use case alone.

---

## 4a. Stated intent, 2026-08-27: use Midnight to privately store results

**Logged as your decision, not a recommendation, and not yet scoped.** Recording it here so it isn't lost, with the one distinction from §4 above that determines what this actually means in practice:

**"Privately store results" splits into two very different things, and only one of them Midnight does well:**

1. **Hiding picks/results from *other players* — strong fit, already verified.** This is the commit-reveal pattern in §3, and it's exactly the lineup-privacy and "Scouting" use case in §5's table. Genuinely valuable, genuinely supported.

2. **Making the *stored result itself* private/trustless — partial fit, with the §4 caveat intact.** A result committed to a Midnight contract is still a result **CoinDraft's own backend computed from SoSoValue and submitted**. The privacy property is real; the trust property is not changed. Whoever resolves still has to be trusted, exactly as today. So this is worth building for confidentiality, but it should not be described (internally or publicly) as trustless or decentralized resolution.

**Where it does *not* overlap with anything already planned:** this is unrelated to the 0G Storage item in `0g-usable-inventory.md` §2.2. Those solve opposite problems — 0G Storage makes a payout record **permanent and publicly verifiable**; Midnight makes a result **confidential**. If both ever get built, they'd apply to different data, not the same data, and picking both for the same record would be self-contradictory.

**Still open before any build** — all of §6 below applies unchanged, and one item matters more now: **which** results are meant to be private (all contests? a dedicated private contest mode? tournaments only?). §5's table deliberately scoped Midnight lineup privacy to *a separate opt-in contest type*, not the default path, because it requires players to also have a Lace wallet.

---

## 5. Where this actually fits CoinDraft — mapped onto real surfaces, not abstractly

| CoinDraft surface | Midnight fit | Why |
| --- | --- | --- |
| Lineup privacy pre-lock (`/draft`, `lineups`/`lineupPicks` tables) | **Strong** | Exact match to the verified commit-reveal pattern above. Today, `contest-resolution.ts` and the schema store picks in plaintext Postgres the instant they're submitted — anyone with DB access (or, per **H-01**, anyone who forges a session) can already see them. Commit-reveal genuinely closes that specific gap for a *private contest mode*, as a genuinely separate contest type — not a replacement for the existing one. |
| "Scouting" perk (`X-15` in `new-feature-ideas.md` / `user-stories-by-surface.md`) | **Strong, and now unblocked conceptually** | The old notes correctly said this waits on "lineups can be hidden via Midnight commit-reveal" — that's now a concrete, verified pattern rather than an assumption. |
| Wager mode escrow (`X-02`) | **Strong** | The pari-mutuel `claim_reward` pattern is a directly reusable answer to X-02's open "escrow mechanism undecided" question — see §3. |
| Contest **resolution** against real price data | **No fit, don't pitch as such** | See §4. CoinDraft's backend remains the trusted resolver either way. |
| General session/auth (**H-01**) | **No fit** | See §1. |
| Identity (wallet-only login, `F-01`) | **Adds a third wallet ecosystem, not a replacement** | Players already connect EVM or Solana wallets. A Midnight-backed private contest mode would require *also* having Lace installed for that specific mode — an opt-in cost, not something to default the whole product into. |

---

## 6. What's still genuinely open — do not assume, verify before building

- **DUST's actual mechanics** (how it accrues relative to NIGHT held, whether a new player needs to acquire DUST before their first transaction, what that means for player-facing friction) — not yet researched past the one-line description above. This matters a lot for UX if players would ever pay their own gas.
- **Whether the federated "Kūkolu" mainnet phase has any deployment restrictions** for third-party dApps (allowlisting, review process) beyond "it's live" — not checked.
- **Actual proof-generation latency** in a real browser (not just server-side, per the reference repo's Node CLI tests) — this determines whether "lock lineup" would feel instant or would need its own loading/waiting UX, which `design-prd.md` doesn't currently account for.
- **Cross-wallet UX**: how a player who already has an EVM/Solana session would be asked to *also* connect Lace for a Midnight-mode contest, and whether that's an acceptable amount of friction for what's presumably a niche, opt-in mode rather than the default.
- **Whether the reference repo's `preview`/`preprod` testnets are still the current recommended pair post-mainnet-launch**, or whether docs.midnight.network now steers new projects toward a different default (e.g., mainnet directly, given Kūkolu is live) — the repo was last pushed 2026-07-29, before some of the mainnet-status search results above; worth a fresh check against `docs.midnight.network` immediately before any build starts.

---

## 7. Sources

- [What is Midnight? — docs.midnight.network](https://docs.midnight.network/what-is-midnight)
- [Midnight Documentation home](https://docs.midnight.network/)
- GitHub — [mashharuki/midnight-prediction-market-sample-app](https://github.com/mashharuki/midnight-prediction-market-sample-app), specifically:
  - `pkgs/contract/src/prediction-market.compact` (full contract, read verbatim)
  - `pkgs/contract/src/prediction-market-witnesses.ts`
  - `pkgs/shared/src/network-config.ts`
  - `pkgs/app/src/lib/wallet.ts`
  - `.agents/skills/prediction-market-architect/references/oracle-and-resolution.md` (read verbatim)
- [Midnight Is on Mainnet — Cardanians.io](https://cardanians-io.medium.com/midnight-is-on-mainnet-heres-where-things-stand-8f3863eb29ee)
- [Midnight blog — State of the Network, February 2026](https://midnight.network/blog/state-of-the-network-february-2026)
- [Midnight blog — Introducing Midnight mainnet trusted node operators](https://midnight.network/blog/introducing-midnight-mainnet-trusted-node-operators)
- [Midnight blog — Guide to the NIGHT token launch and Redemption](https://midnight.network/blog/guide-to-the-night-token-launch-and-redemption)
- [Midnight Network Confirms Mainnet Launch for Late March 2026 — LaikaLabs](https://laikalabs.ai/news/midnight-network-mainnet-launch-march-2026)

---

## 8. The other three answers from `answers.md`, for the record (no research needed, just logged)

- **H-02** (bot contest score contradicts the displayed result) — acknowledged: "we will be fixing this and game mechanics in general." Queued, not yet scoped in detail.
- **H-03** (practice wins leaking into real badges/win-rate) — acknowledged: "This should be corrected." Straightforward, no open design question.
- **H-04** (matchmaking states) — acknowledged, and expanded: distinguish matchmaking states explicitly, including a real vs-bot state the player is *told about* rather than the current silent fallback (today's `/matchmaking` shows "Opponent found!" identically whether it's a real player or the 30s bot fallback — see `P-04`/`F-11` in `user-stories-by-surface.md`). This is a UI/state-machine design question, not a research one — worth a dedicated pass listing every matchmaking state (searching / matched-real / matched-bot / no-opponent-timeout / error) before touching the code, same "full picture first" spirit as this document.
