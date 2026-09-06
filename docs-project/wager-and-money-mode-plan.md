# Wager (G-03) & Tournament Money Mode (G-05) — Plan

_Created 2026-08-28. Covers the two parked items blocked on the escrow decision. Written to be actionable without that decision being made — because most of the work genuinely doesn't depend on it._

**Your standing instruction this drives from:** *"just create the mechanic first, once I can test it we can discuss wager"* and *"have space for wager across all modes so it'll be a plug-and-play integration."* Both are load-bearing here — the plan is built around them, not around picking an escrow provider first.

---

## The reframe: money is a *settlement adapter*, not a feature

Read G-03's acceptance criteria closely and something useful falls out:

1. Both players confirm 18+ before any amount can be set.
2. Each player proposes an amount; the other sees it live.
3. Full negotiation: propose, accept, counter, decline.
4. 30s no-response timeout defaults to the amount currently on the table.

**None of these require money to move.** They're all about two people agreeing on a *number*. The same is true of G-05's payout structures — `winner_take_all` vs. `top3_weighted` is arithmetic over a pool, and the arithmetic is identical whether the pool is XP, testnet 0G, or dollars.

So the escrow decision gates **one** thing: what happens at the moment of settlement. Everything else — negotiation UI, state machine, timeout, 18+ gate, cross-mode attachment, payout math — can be built, tested, and hardened first. That's what makes it plug-and-play rather than a rewrite later.

---

## Phase 0 — The mechanic, with zero money (build now, no decision needed)

### 0.1 Schema: stakes attach to *any* mode

Per the cross-mode requirement, stakes are a sidecar, not a column on `contests`. One table references whichever entity is being played:

```
stakes
  id
  contestId | lobbyId | tournamentId   -- exactly one set (mirrors the
                                       --  existing lineups.contestId/lobbyId pattern)
  amount            numeric
  currency          text   -- 'xp' now; '0g' | 'usd' later
  settlementMode    text   -- 'xp' now; 'onchain' | 'custodial' later
  status            text   -- proposed|agreed|locked|settled|refunded|cancelled
  createdAt

stake_proposals            -- the negotiation trail
  id, stakeId, proposedBy, amount
  status            text   -- open|accepted|countered|declined|expired
  createdAt, expiresAt

stake_participants
  id, stakeId, userId
  committed         numeric
  payout            numeric
  confirmedAdult    boolean
```

`lineups` already uses the "exactly one of contestId/lobbyId" pattern, so this is a convention the codebase already has, not a new idea.

**Why this shape delivers plug-and-play:** attaching a wager to Single Match, Multiplayer, or a Tournament is setting a different FK. No mode needs to know how settlement works. Scrimmage is the deliberate exception — bot opponents, so a wager is meaningless there; the schema permits it, the UI won't offer it.

### 0.2 The settlement interface — the actual seam

```ts
interface SettlementProvider {
  hold(stakeId, userId, amount): Promise<{ ok: boolean; ref?: string }>;
  release(stakeId, payouts: { userId: string; amount: number }[]): Promise<void>;
  refund(stakeId, reason): Promise<void>;
  balanceOf(userId): Promise<number>;
}
```

Ship `XpSettlement` first — it debits/credits `users.xpTotal`, which is real, already-tracked, and something players actually care about losing. That makes Phase 0 genuinely testable rather than a mock: the negotiation, the timeout, the payout split, and the win/loss consequence are all exercised end to end.

Later providers (`OnChainSettlement`, `CustodialSettlement`) implement the same four methods. **That's the whole plug-and-play story** — chosen by the same env-flag pattern `USE_0G_COMPUTE` already established and which is now proven in production.

### 0.3 Negotiation state machine

`proposed → countered* → agreed → locked → settled | refunded | cancelled`

The 30s timeout resolves to the amount currently on the table (your Q4 answer). Worth stating explicitly because it's the one rule that will look like a bug when someone hits it: **if A proposes 100 and B counters 50 with no reply, it settles at 50** — the last active proposal wins, not the higher figure.

### 0.4 Tournament money-mode plumbing

`tournaments.fundingMode` already exists, documented `'free' only, for now`. Phase 0 adds `'pooled'` (entrants fund) and `'sponsored'` (creator/sponsor funds) as *values*, wired to the same `stakes` sidecar. The payout math is already written and live — `applyPayoutStructure()` in [tournament-resolution.ts](../src/lib/server/tournament-resolution.ts) — so this phase reuses it rather than adding a second, divergent split implementation.

---

## Phase 1 — Integrity gates. Non-negotiable before real value.

**These aren't hardening niceties. Each is a documented, verified defect that is currently harmless only because nothing is at stake.** Attaching money changes the severity of every one of them, and two are outright exploits.

| # | Defect | Why it becomes critical with money |
| --- | --- | --- |
| **H-01** | Session tokens are forgeable — the signature is a pure function of the payload; `SESSION_SECRET` never reaches the output | Anyone who knows a user id can act as them. With stakes attached that's **direct theft** — accept wagers, drain balances, settle as the victim. Absolute hard gate. |
| **Hole #8** | Lazy resolution ignores `endAt` — any contest can be self-settled on demand (F-12) | **Settle-when-ahead.** A player watching a favorable swing triggers resolution early and banks it. This is a money printer against the house and the opponent, and it is live today. |
| **H-01b** | Session `ts` is written but never validated — tokens never expire | A leaked cookie is valid forever against a real balance. |
| **Hole #10** | Private league invite codes readable by any user | Same class of leak applies to private/invite-only tournaments — which is exactly the access type money mode introduces. |
| **Hole #6** | Result page ships fabricated data as its initial state | A screen that can render a plausible fake result is unacceptable once that screen reports a payout. |

**Ordering note:** you pushed back — correctly — when I bundled H-01 into a game-modes discussion, because there it was unrelated. Here it isn't. It's the top of this list on its own merits: it's the only item that makes every other protection unenforceable while it stands.

---

## Phase 2 — The escrow decision

### What's actually settled

- **0G Pay does not exist.** Verified three independent ways; not a candidate.
- **0G Chain is viable and low-friction.** EVM-compatible, standard tooling. `viem` — already a dependency — ships `zeroG` / `zeroGTestnet` chain definitions, so no hand-rolled config. Testnet chain ID `16602`, RPC `https://evmrpc-testnet.0g.ai`, faucet 0.1 0G/day. Any audited OpenZeppelin-style escrow deploys as-is; **there is no 0G-specific escrow pattern to learn.**
- The app is already wallet-native (Reown AppKit + SIWE), so wallet plumbing exists.

### The two real options

**A — On-chain, non-custodial (0G Chain).** Contract holds funds; CoinDraft never touches them.
*For:* no custody exposure, verifiable settlement, fits the wallet-native product and the broader 0G story.
*Against:* users need $0G for stake **and** gas; contract bugs are unrecoverable; refunds need an explicit path.

**B — Custodial, DB-backed.** CoinDraft holds real balances; ledger in Postgres.
*For:* best UX, no gas, no chain dependency, trivial refunds.
*Against:* **CoinDraft becomes a custodian of user funds.** That's money-transmission/AML territory — a licensing and banking question, not an engineering one.

### Recommendation: **A, on-chain**

Chiefly because it removes the custody question entirely rather than deferring it. The UX cost is real but smallest here specifically — this product already requires a connected wallet to sign in at all, so it isn't asking a web-native audience to become crypto-native. B's advantages are UX; its disadvantage is a regulated-entity obligation, which is a far larger and less reversible commitment than deploying a contract.

**The adapter means this is reversible.** If on-chain friction proves fatal in testing, swapping providers is one implementation, not a rewrite. That's the point of doing Phase 0 first.

### ⚠️ A consequence nobody has raised yet: Solana users can't wager

`users.chainType` is `'evm' | 'solana'`, and the app authenticates both. **An 0G Chain escrow is EVM-only, so Solana-authenticated users are structurally excluded from any real-money mode.** Three ways out, all product decisions:

1. Wagering requires an EVM wallet — simplest, but silently locks out an existing, supported user class.
2. A second Solana-side escrow — roughly doubles the contract work.
3. Custodial (option B) — the only option that's chain-agnostic by construction. *This is the strongest argument in B's favour and it deserves weighing before A is locked in.*

I don't think this reverses the recommendation, but it's a real cost of A that should be a decision rather than a discovery.

### One factual flag, not a blocker

Real-money contests settled on crypto price movement can fall under gambling or derivatives regulation depending on jurisdiction. The 18+ gate in G-03 shows this is already on your radar; worth proper advice before the flag flips. Noting it as a factor to plan around — it doesn't change any of the engineering above.

---

## Phase 3 — Wire the chosen adapter

1. Implement the provider against the Phase 0 interface.
2. Run it on **0G testnet** first — the faucet makes this genuinely free to exercise end to end.
3. Flag-gate exactly as `USE_0G_COMPUTE` does, defaulting off.
4. Flip only once Phase 1 is fully closed.

---

## Sequencing

| Phase | Depends on | Blocked? |
| --- | --- | --- |
| **0** — mechanic + adapter seam + XP settlement | Nothing | **No — buildable today** |
| **1** — H-01, self-settle, token expiry, invite leak, fake-result state | Nothing | **No — buildable today** |
| **2** — escrow choice | Your call (incl. the Solana question) | Yes |
| **3** — real settlement | 0, 1, 2 | Yes |

**Bottom line:** Phases 0 and 1 are the bulk of the work and neither needs the escrow decision. The parked items aren't actually blocked — only their final settlement step is. When you're ready, Phase 0 is the natural next build, and it's exactly the "create the mechanic first so I can test it" you asked for.

---

## How 0G itself solves this — researched 2026-08-29

Asked directly: does 0G's ecosystem already handle escrow, and can we reuse it?
Findings are from 0G's docs plus on-chain verification, not inference.

### 0G's own model is a **hybrid**, not on-chain vs custodial

0G Compute has exactly this problem — users must pay providers without trusting
them, and per-request on-chain settlement would be absurdly expensive. Their answer:

1. **Deposit once, on-chain**, into the **0G Payment Layer** — described as "a shared
   contract across all 0G products". Mainnet `0xA3b15Bd2aD18BFB6b5f92D8AA9F444Dd59d1cE32`,
   testnet `0x0AD9690e0b34aB2d493DE02cDF149ee34f6C9939`. **Both verified live on-chain**
   (EIP-1967 upgradeable proxies, real bytecode).
2. A background **PaymentWorker** watches for balances below a threshold and moves
   **tranches** into the Router's internal contract.
3. The Router **debits that internal balance off-chain** as you consume — no gas per request.
4. It **periodically settles the consumed amount to providers on-chain**.

There's a second contract layer, the **Compute Ledger** (mainnet
`0x2dE54c845Cd948B72D2e32e39586fe89607074E3`, also verified live), which resolves the
address discrepancy noted earlier in `0g-ai-context-reference.md`: the Payment Layer and
the Compute Ledger are **different layers**, not conflicting values for the same thing.

### What this means for our decision

**The main objection to on-chain escrow — gas on every game — is solvable, and 0G shows
how.** Deposit once, play many games against an off-chain balance, settle periodically.
A player pays gas at deposit and withdrawal, not per wager. That materially changes the
UX maths.

**But note what 0G actually did: they did not avoid custody, they bounded it.** Between
settlements the Router holds and debits your balance off-chain, and you trust the
operator for that window. So the honest reading is that **the serious answer to
"custodial vs on-chain" is neither — it's a hybrid**, and the real design question is
*how much value sits off-chain, for how long, before it settles.*

### Two cautions

- **We can copy the pattern, not the contract.** The Payment Layer is documented as
  shared across *0G's* products, for paying 0G service providers. There is no documented
  interface for a third-party app to escrow arbitrary user-to-user stakes. Assume we
  deploy our own, informed by theirs.
- **Withdrawals and refunds are undocumented.** 0G's deposit docs cover paying in and
  settling out to providers, but say nothing about recovering unspent balance. For us
  that's the *critical* path — a cancelled game, an abandoned negotiation, or a player
  cashing out all demand a refund route. 0G does not answer it, so it's ours to design.

### Where this leaves the recommendation

Unchanged in direction, sharper in shape: **on-chain custody of funds, off-chain
accounting of play, periodic settlement.** It keeps CoinDraft out of holding user funds
while avoiding per-game gas — and it's a pattern with a working, live reference
implementation on the same chain we'd deploy to.

**The Solana exclusion is untouched by any of this.** An EVM Payment-Layer-style escrow
still leaves Solana-authenticated users unable to wager.

---

## Idea: staking against the bot in Scrimmage — assessed 2026-08-29

**The idea:** as in some chess apps — free play, or stake against the bot for money.

The pattern is real and works elsewhere, but it does not transfer cleanly here. Four
problems, the first two structural.

### 1. It makes CoinDraft the counterparty, not the escrow agent

Player-vs-player wagering is **zero-sum between two players**. CoinDraft holds the
stakes and pays the winner; the house takes no position and can't lose. That's why the
escrow design above works.

Player-vs-**bot** wagering is different in kind: **the house is the other side of every
bet.** You win, CoinDraft pays out of its own funds. You lose, CoinDraft keeps it.
That's not escrow — it's bookmaking, and it's a different legal category from
peer-to-peer stakes. Every regulatory question in this document gets harder, not easier.

### 2. We control the opponent's moves — and we'd be the counterparty

This is the one that would sink it. In chess the engine is deterministic and publicly
auditable; anyone can verify the bot played honestly. Here, `draftBotLineup()` is **our
code picking the opponent's tokens from a live pool**. If the house is simultaneously
the counterparty, the referee, *and* the author of the opponent's picks, there is no
way for a player to know the bot wasn't tuned to win — and no way for us to prove it.

**Being accused of it is as damaging as doing it.** Every loss looks suspicious.

### 3. There is currently no house edge, so the house loses

`botDraft.ts` picks **at random** within each sector (`pool[Math.floor(Math.random() *
pool.length)]`). Against a player who reads the market at all, that's at best a coin
flip — and a coin flip with payouts and no rake is a slow bleed for whoever's funding it.
Making the bot *better* to create an edge means deliberately building a house advantage
against players, which is the opposite of Scrimmage's purpose.

### 4. It contradicts what Scrimmage is for

`G-01` defines Scrimmage as the safe on-ramp: bot-only, no real stakes, no rank impact,
explicitly for players learning the scoring system. **Putting money in it targets
precisely the least experienced users** — the ones the mode exists to protect. If
stakes-vs-bot ships, it should not be inside Scrimmage.

---

### A version that does work: pooled benchmark

Keep the appeal — play alone, whenever you like, for money — without the house taking a
position:

- Many players each stake into a **shared pool** for a given window.
- Everyone drafts against **the same bot lineup** as a benchmark.
- Everyone who **beats the benchmark** splits the pool; CoinDraft takes a fixed rake.

Why this is materially better:

- **Economically peer-to-peer.** The house never takes the other side, so it can't lose
  and isn't bookmaking. The escrow design above applies unchanged.
- **The bot's picks stop being a conflict.** It's a common yardstick applied identically
  to everyone, not an opponent we control for profit. Publishing the bot's lineup at
  lock time makes it fully auditable.
- **Solo experience preserved.** No waiting for an opponent — the thing that made the
  original idea attractive.
- **Reuses everything already built:** bot drafting, the stakes sidecar, and
  `applyPayoutStructure()`'s split logic.

Open questions if pursued: what happens when **nobody** beats the benchmark (rollover,
or refund?), and whether the benchmark is one bot lineup or the median of several.

**Recommendation:** keep Scrimmage free and stakes-free, and treat this as a separate
mode. The pooled-benchmark shape gets the idea you liked without making CoinDraft a
bookmaker against its own newest players.

### Follow-on: should the bot use AI to pick? — noted 2026-08-29

**Yes for free play and for a benchmark; no for house-vs-player staking.**

The code already exists — `draftAgent.ts` buckets live tokens by sector, reasons over
price and momentum, and validates against the real pool. Pointing `botDraft.ts` at it
instead of `pool[Math.floor(Math.random() * pool.length)]` is a small change.

**Why it's worth doing:** it fixes the coin-flip problem, and it unlocks **difficulty
tiers** a random bot can't offer — cautious, aggressive, momentum-chasing personas via
prompt constraints. For a mode whose purpose is teaching, beatable-but-real opponents
that scale with the player is a real product win.

**Three costs to weigh:** every Scrimmage game becomes an inference (~$0.00024 on 0G
mainnet — trivial per game, real at volume, where today it's free); the LLM call lands
at lineup lock, already the slowest moment in the game; and it **undercuts the paid AI
draft agent**, which charges players 15 XP per slot for the same help the bot would get
free. That last one needs an answer — weaker model for bots, thinner prompt, or accept
that the agent sells convenience rather than edge.

**On staking it cuts the other way:** if the house is the counterparty, an AI bot is
*worse* than a random one — random is demonstrably unbiased, AI picks are opaque and
unprovable. In the pooled-benchmark model it's ideal, since the house isn't on the other
side and a published benchmark is auditable.

---

## Confirmed wager flow — 2026-08-29

Combines the tier-locked and blind-commit shapes, with a rematch loop.

### The flow

```
1. Pick terms      duration + stake tier (default pre-selected) — or "no stake"
2. Match           against someone who chose the same tier
3. Commit          each player privately confirms or RAISES their amount
                   → the LOWER of the two is the wager; both risk the same
4. Draft
5. Start screen    "Both staked $50" — final confirmation, then the clock starts
6. Race
7. Result          winner takes the pot
8. Play again      one click — same opponent, same terms, rematch
```

### Why this shape

**The tier is the consent (Option 1).** Being matched on a tier means both players
already agreed to that stake. The default is pre-selected, so the fast path is: pick a
duration, hit go, and never think about money again.

**Raising is safe (Option 3).** A player may raise, but the wager settles at the
**lower** of the two figures — so nobody can ever be pushed above their own number.
This is what removes every hard problem from the negotiation: no timer, no counter, no
deadlock, no abandonment case, and no way to be pressured. It always resolves.

It also stays strategically interesting: raising signals confidence, but only ever
risks the smaller amount. The bluff is free; the exposure is capped.

### The rematch loop — the actual point

Your reasoning: *"people may want to win their money back, making it fun to have a
nemesis."* That's the strongest idea in this design and it deserves first-class support:

- **"Play again"** on the result screen — same opponent, same terms, one click. No
  re-queue, no re-negotiation.
- **Both must accept**, or it falls back to normal matchmaking. Nobody is trapped in a
  losing streak by a button.
- **Head-to-head record** against that opponent (`3–1 vs @degen_ana`) is what turns a
  stranger into a nemesis. Cheap to build — it's a query over resolved contests — and
  it's what makes the rematch feel like a rivalry rather than a new game.

**The one guard worth building in.** Chasing losses is the mechanic this deliberately
encourages, so it needs a limit: a **rematch cap per session**, or a cool-off after N
consecutive losses. This matters more here than in most designs precisely *because* the
loop is designed to be compelling — and it's the difference between a rivalry and a
harm pattern. Cheap to add now, awkward to retrofit.

### Build order

1. **Stake tiers + blind commit + XP settlement** — full mechanic, no real money.
2. **Play again + head-to-head record** — the loop that makes it fun.
3. **Rematch cap / cool-off.**
4. **Testnet escrow** on 0G, behind the `SettlementProvider` seam.

Steps 1–3 need no escrow decision and no real funds.

---

## Escrow & gasless on 0G — what exists, verified on-chain 2026-08-29

### Escrow: nothing reusable, but a good pattern to copy

0G's **Payment Layer** (mainnet `0xA3b15Bd2aD18BFB6b5f92D8AA9F444Dd59d1cE32`, testnet
`0x0AD9690e0b34aB2d493DE02cDF149ee34f6C9939`) is live and verified, but it exists to pay
**0G's own service providers**. There is no documented interface for a third-party dApp
to escrow arbitrary user-to-user stakes. **We deploy our own contract**, informed by
their design — deposit once, account off-chain, settle periodically.

No escrow standard, template, or library is offered anywhere in the 0G ecosystem. 0G
Chain is plain EVM, so an audited OpenZeppelin-style escrow deploys unchanged.

### Gasless: not documented by 0G — but the infrastructure is deployed

**0G's docs never mention account abstraction, ERC-4337, paymasters, gasless
transactions, meta-transactions or relayers.** Asked directly, the answer from their
documentation is "no".

**The chain says otherwise.** Checked by reading contract code directly at the canonical
deterministic EntryPoint addresses:

| Contract | Mainnet | Testnet |
| --- | --- | --- |
| EntryPoint **v0.7** (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`) | **deployed** | **deployed** |
| EntryPoint **v0.6** (`0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`) | **deployed** | **deployed** |

So **ERC-4337 works on 0G**, undocumented but real. That matters a great deal here: a
**paymaster** can sponsor gas, meaning a player never needs 0G tokens to play — which
removes the single biggest objection to on-chain escrow, and the main reason custodial
looked attractive.

### What EntryPoint being deployed does *not* give us

Necessary, not sufficient. A working gasless flow still needs:

1. **A bundler** — packages UserOperations and submits them on-chain. Public bundlers
   (Pimlico, Alchemy, Biconomy) support many chains; **0G support is unconfirmed and
   should be assumed absent**. Running our own is real infrastructure.
2. **A paymaster contract** we deploy *and fund* — gas becomes an operating cost we pay
   rather than the player. Small per transaction; a real line item at volume, and an
   abuse surface if unmetered.
3. **Smart accounts** for players, or EIP-7702 to let their existing EOA act as one.

**Honest read:** gasless on 0G is *possible* and nobody has to take our word for it —
the EntryPoint is on-chain. But it is **days of infrastructure work**, not a config
flag, and the bundler is the piece with no ready answer.

### Recommendation

**Stage it, and don't let gasless block the mechanic.**

1. **Now:** wager mechanic against XP settlement, behind `SettlementProvider`. No chain,
   no gas, fully testable.
2. **Next:** a plain escrow contract on 0G **testnet** — players pay their own gas. Ugly
   UX, but it proves the settlement path end to end with worthless tokens.
3. **Later, if the UX demands it:** add a paymaster so deposits and withdrawals are
   gasless. The EntryPoint being live means this is an upgrade, not a rewrite — and it
   can be decided after seeing whether gas friction actually hurts.

Deposit-once/settle-periodically already reduces gas events to two per player, so
step 3 may prove unnecessary. Worth measuring before building.
