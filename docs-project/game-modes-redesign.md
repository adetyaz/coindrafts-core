# Game Modes Redesign — Idea Dump

_Captured 2026-08-26 from a live dictation, cleaned up for clarity. This is a capture-and-clarify pass — comparing this against the current implementation and updating `user-stories-by-surface.md` from it is a deliberate next step, not done here. Scope of this pass: single-player-base modes only. Tournament mode was explicitly deferred to a later discussion — noted below, not detailed._

---

## Every way 0G is or could be used — where, and why

Full inventory, asked directly before implementation starts. Built from what's already been verified this session (`0g-compute-integration-findings.md`, `0g-ai-context-reference.md`) plus the Q5 research above — not re-guessed. Confidence marked per item; an unresearched item is never presented with the same certainty as a verified one.

| 0G piece | Where | Why | Status |
| --- | --- | --- | --- |
| **Compute (Router)** | `src/lib/server/aiCompute.ts` → `/api/mentor` (streaming) and `/api/breakdown` (non-streaming) | Drop-in swap for Groq — same OpenAI-shaped call, TEE-verifiable inference, ~90% cheaper per 0G's own numbers. | **Live today.** Built, verified by curl (real completion, real billing, streaming confirmed). Flag `USE_0G_COMPUTE` still defaults off — Groq is the active path in production right now. |
| **Compute (Router), extended** | Built: the floating AI draft agent on `/draft` (`src/lib/server/draftAgent.ts`) | Same mechanism as Mentor — a chat completion reasoning over live sector/token data, constrained to real candidates per sector so it can't invent a token. | **Live today, same as Mentor.** Built and live-verified 2026-08-27 through the real dev server (real picks, real XP charges). Same flag: `USE_0G_COMPUTE` still defaults off, so Groq is the active path right now — the code is 0G-ready, not 0G-active. |
| **Compute (Router), possible** | `bots-service`'s drafting logic — currently `[...tokens].sort(() => Math.random() - 0.5)`, pure randomness | If "smarter bots" ever becomes a real goal, this is where an LLM call replacing the random shuffle would go — reasoning about sector momentum instead of a coin flip. | Noted, not committed. Distinct from Agentic ID below — this is about *how a bot picks*, not *who owns the bot*. |
| **Agentic ID (ERC-7857)** | The 8 bot personas in Practice/Bot Mode | Makes each bot an ownable, tradeable NFT — 0G's own flagship framing is literally "buy and sell trained trading bots." Real product feature if bots are ever meant to be owned/traded, not just always-on NPCs. | Researched in full under Q5. Recommendation: deliberate follow-on, once Practice Mode itself exists and is proven — not needed for Practice Mode to work on day one. |
| **Storage** | Resolved paid Tournaments and settled Wager-mode matches; also the metadata layer under Agentic ID if that gets built | Permanent, independently-verifiable payout record once real money is actually involved — a materially stronger justification than `0g-integration-plan.md`'s original framing (recording a *free* contest's score). | Not integrated. SDK/pattern already covered by the installed `0g-storage-upload-file` skill. Depends on paid Tournament/Wager mode existing first — nothing to record yet. |
| **Pay** | Would-be: the money-holding step in Wager mode and paid Tournaments | *If* it works as `0g-integration-plan.md` originally described (purpose-built agent/dApp payment rails), this is exactly the use case. | **Re-verified directly, 2026-08-27 — doesn't exist as a product.** Traced the original claim to `0g-integration-plan.md` itself, which cited no source. Checked three independent ways: the official `ai-context` page (zero mentions, fetched verbatim), a fresh web search (nothing), and the two escrow-*adjacent* things 0G's docs do mention — AgentMarket and Compute's payment escrow — neither is a general two-party payment primitive (AgentMarket is scoped to trading Agentic ID NFTs; Compute's escrow is scoped to paying AI providers). **0G has no off-the-shelf answer for this.** The question now is Chain vs. custodial, not Pay vs. Chain. |
| **Chain (custom escrow contract)** | Same money-holding step, now the only 0G-native option left | EVM-compatible, standard Hardhat/Foundry/Remix tooling, `viem` already ships 0G Galileo/Aristotle chain definitions — genuinely low-friction to add to the app's existing Wagmi/Reown wallet setup. No 0G-specific escrow pattern exists, but any audited standard Solidity escrow (e.g. OpenZeppelin's) deploys unmodified. | Technically well-researched. **Still open, and prior to it: whether escrow should be on-chain at all versus a simpler custodial/DB-backed hold** — a real product/legal decision (does CoinDraft become a money custodian?), not an engineering one, and it comes before contract specifics matter. |
| **DA** | — | Aimed at rollup/L2-scale data availability throughput. | **Ruled out.** Same conclusion as the original integration plan; nothing in this redesign changes that. |
| **`@0gfoundation/0g-cc` ("0G Code to Coin")** | Evaluated 2026-08-27 as a possible escrow/payment answer | Name suggested a payment product. | **Not applicable — it's a developer tool, not an app library.** It's an *MCP server* for AI coding assistants (Claude Code, Cursor, Windsurf) — it can't be imported into the SvelteKit app at all. The "Coin" half is **VIBEZ**, a bonding-curve token launchpad, and it is entirely unbuilt (every VIBEZ tool marked 🔮 "Future Vision", slated v0.6–v0.7; the package is at v1.0.2 with 2 published versions total and only ~6 of ~35 tools actually implemented). Its only payment-ish tools, `compute_deposit`/`compute_get_balance`, are the same Compute-ledger-for-paying-AI-providers we already knew about. **Zero two-party escrow capability.** Where it *could* genuinely be useful: routing this coding assistant's own inference through 0G for cost savings — a workflow tool for the developer, not a product feature for CoinDraft. |
| **`build.0g.ai`** | Evaluated 2026-08-27 alongside the above | Official builder portal. | **No new capability, but a useful third confirmation.** Lists 0G's products as exactly four — Compute, Storage, Chain, Agentic ID — **no Pay pillar**, independently matching the `ai-context` page and the web search. Its real value is a 173-project showcase (reference implementations) plus tools/SDK/tutorial links; also the natural surface for grants/visibility if that ever matters. |

### npm package-scope discrepancy, resolved 2026-08-27
Worth recording because it bit the evaluation above and would bite any future Direct-path work:
- `@0gfoundation/0g-storage-ts-sdk` — **current**, v1.2.11, published 2026-08-06. This is what our docs already reference; correct, keep using it.
- `@0glabs/0g-serving-broker` — **deprecated**, explicitly renamed to `@0gfoundation/0g-compute-ts-sdk`. Only matters if we ever take Compute's *Direct* path.
- `@0glabs/0g-ts-sdk` — the older storage SDK, last published 2025-10-22, superseded by the `@0gfoundation` one above.
- `0g-cc` still depends on the two stale `@0glabs` packages, which is part of why it reads as an early/unmaintained experiment rather than production infrastructure.
- **Retroactively validates our Router choice for Compute:** we integrated via the OpenAI-compatible Router (plain `baseURL` swap, no 0G SDK dependency at all), so none of this scope churn touches our code.

---

## Mode 1 — Scrimmage (formerly Practice / Bot Mode)

**Named 2026-08-27: "Scrimmage."** Subtitle so it's clear what it's for, e.g. *"draft against bots and earn XP, without touching your real rank."* Build kickoff and full requirements list are in `user-stories-by-surface.md`'s `G-01` entry — that's now the up-to-date version of this section; treat what follows here as the original captured intent, not the latest spec.

The on-ramp for new users: free, low-friction play against bots, no real opponent required. This is the "fruit play" concept — the idea being that a new player can jump straight into drafting against available bots rather than waiting on matchmaking or being asked to compete for real immediately.

- Earns XP, but **at a minimal rate compared to real-player games** — not zero.
- Explicitly flagged as a candidate for the 0G Agentic ID idea already sitting in `0g-integration-plan.md` (tokenizing bot personas as ERC-7857 agents) — **noted as something to look into, not a commitment to build it.**

**This is a material change from what exists today**, worth being explicit about rather than letting it slide past as a rename: the current Practice Mode (`contests.isPaper`) is designed to earn **zero** real XP — practice XP is tracked in a fully separate `paperXpTotal` pool specifically so it can never influence rank (Story 3.3 in `master-user-stories.md`, and it's one of the story register's `PARTIAL` items precisely because that separation currently leaks in two other places — see `H-03`). "Minimal but nonzero XP" is a different design than "separate pool, zero XP" — see Q1 below.

## Mode 2 — Single Match Mode

Real opponents only — bots do **not** participate in this mode.

- **Initial state** (small player base): match against whichever real players are available/new, no skill segmentation yet.
- **Later** (once there's a large enough pool of players at different experience levels): XP-banded matchmaking — a low-XP player won't be matched against, e.g., a 3,000-XP veteran. Players with closer XP totals compete with each other. (XP is already tracked per-user today, so the data this needs already exists — the matching logic doesn't yet.)

**Entry point, confirmed:** a mini-menu offers Practice (to be renamed), Single Match, and Tournament as independent options, each going to its own dedicated page — not nested inside each other.

**Matching mechanism, confirmed direction:** the current Postgres-backed `matchmaking_queue` (join → poll → 30s bot-fallback) is likely being removed in favor of something "more linear." Exact shape not yet specified — see Q3.

Still open: what actually happens if you pick Single Match and no real opponent is available right now — see the tightened Q2 below.

## Mode 3 — Wager Mode

Also real-opponents-only. Once two players are matched, there's an option to start a normal match, or to wager.

Flow as described:
1. Both players confirm they're 18+.
2. Each player independently enters a wagered amount.
3. The other player sees the proposed amount almost immediately (not a blind/sealed reveal — a live, visible negotiation).
4. Both need to agree on the amount before the match proceeds with real stakes.

Explicitly not yet settled, even by you — the escrow/payment mechanism was left as "we'll find a way to do this." Not pressing for an answer on that now; it's real, open work, not a gap in my understanding of what you said.

This is the same feature already sitting as `X-02` in `new-feature-ideas.md` ("peer-to-peer wager mode, configurable payout structures") — that entry's open questions (escrow mechanism, what happens if a wager doesn't get accepted) are still open, now with a clearer picture of the negotiation UX specifically.

### Sequencing decided 2026-08-27
Wager Mode itself stays on hold — not built — until the escrow/payment mechanic exists and can actually be tested. Building the negotiation UI ahead of a real settlement layer was considered and rejected: it would ship something that looks like a real-money feature with no money actually moving behind it. The mechanic gets built first; Wager (the mode) gets discussed again once you can test it.

### Architectural requirement, confirmed 2026-08-27: the mechanic is cross-mode, not Wager-exclusive
The escrow/payment mechanic being built is **not scoped to Mode 3 alone**. It needs to exist as a standalone "stakes" primitive (deposit → hold → resolve → payout, however it ends up implemented) that other modes can plug into, rather than logic wired one-off into a single Wager page. Concretely, this same primitive is what:
- **Single Match** attaches to, once matched, as the actual "start a normal match, or wager" choice described above.
- **Tournament money-mode** (`G-05`) needs too — a creator depositing a real prize pool is the same deposit/hold/payout shape as a peer wager, just with different funding-side rules (one creator vs. two negotiating peers) and a different payout split (winner-take-all / top-3 XP-weighted vs. simple winner-take-all). Building one mechanic that both consume, rather than two independent money-handling implementations, is the point.
- **Multiplayer/Lobby** is a plausible third consumer (a group all staking into one real pot) but wasn't explicitly discussed — noted here as a likely future plug-in point, not a confirmed requirement.
- **Scrimmage is deliberately excluded, permanently** — it's structurally no-stakes by design (`G-01`), and staying that way is the entire point of the mode existing.

Practical effect on how the mechanic should be designed: build the deposit/hold/payout logic as its own module with a mode-agnostic interface (something like "create a stake for N parties with payout rule X," independent of whether the caller is a 1v1 wager negotiation or a tournament's prize pool), so wiring it into Single Match, then later Tournament, is a plug-in, not a rebuild.

## Mode 4 — Multiplayer Mode

Maps onto the existing Lobby feature. Same rule as Single Match and Wager: requires real users, no bots.

## Tournaments

Sits on top of Multiplayer Mode. Relates to the existing `X-01` (sponsor-funded tournaments) idea in `new-feature-ideas.md`, now with real shape.

### Discovery & access — three kinds
- **Public** — anyone can create one; others can browse and join. Same pattern as today's open-lobby browsing, at tournament scale.
- **Private** — costs money to create; access is invite-only, so only invited people can join/experience it. ("Calgary Parade" was a pure transcription error — confirmed there's no separate concept there, just plain private/invite-only.)
- **Sponsor** — a company creates and funds a tournament it wants to sponsor.

### Funding model, chosen at tournament creation — confirmed
- **Free-to-play** — XP and leaderboard only, no money involved.
- **Money mode** — the creator can deposit money at creation time that becomes the prize pool participants compete to win. (Confirmed — this resolves the "put money down / make money for this tournament" phrasing from the dictation into one clear mechanic: creator-funded prize.)

One nuance this doesn't fully settle, not blocking, just noting: whether entrants can *also* ever pay their own entry fee into a peer-funded pool (as opposed to only the creator funding it) — that's the wager-mode-style pattern rather than the sponsor-style pattern. Can pick this up later if it matters.

### Payout structure (paid tournaments)
Two structures floated: **winner-takes-all**, or a **top-3 split**. Whether XP factors into how that split is weighted wasn't fully clear from the dictation — see Q8.

### Tie-breaking — explicitly still unresolved (your words, not a gap in my parsing)
Floated but not decided: a finer-grained tiebreak using individual coin performance rather than just total score, or whether booster usage should decide a tie (leaning toward: a tied player who used a booster wins the tiebreak, since they earned it through research/Gauntlet engagement). You said yourself this needs more discussion — recording it as open, not asking you to resolve it here.

### Multi-stage / bracket structure
A tournament can be split into sub-tournaments, whose winners advance into a single final tournament — a qualifier-into-championship structure. The example numbers used (four sub-tournaments; eight feeding into one final) were illustrative, not a fixed spec.

Two things you flagged as still needing to be worked out, not questions for me to ask back:
- Min/max participants per (sub-)tournament — minimum floated around four-ish, maximum deliberately left open (needs to stay small enough not to overwhelm the system).
- The threshold for advancing from one stage to the next — candidates floated were XP earned, being the outright winner, or a top-5 cutoff, depending on final design.

### Sector-restricted tournaments
A tournament could restrict the draftable pool to a single sector — an "L1-only" or "DeFi-only" tournament, rather than the standard all-five-sectors draft. This is a genuinely new mechanic; nothing in the current app narrows the pool this way. Tournament duration also sounded creator-configurable, which would tie into the existing `X-03` (time-based draft modes) idea.

---

## Drafting Experience — AI Agent & Token Info

This mostly fills in real detail on `X-06` (the floating, Clippy-style AI draft advisor with an XP handicap), already sitting in `new-feature-ideas.md`. One piece here — the token hover-info overlay — is a genuinely separate, new sub-feature, related but distinct from the agent itself.

### Sector-restricted draft pool, confirmed at the Draft screen level
Reinforces what's already captured under Tournaments above: the Draft screen's available token pool is driven by what the tournament/contest requires — an L1-only tournament shows only L1 tokens to draft from, rather than the standard all-five-sectors pool.

### Token hover-info overlay — new
Hovering over a token brings up an overlay with a quick transition, showing live information about that specific token — sourced from SoSoValue (and possibly other sources later). Described as having tabs — a **news** tab was clear; the rest of the tab set didn't transcribe cleanly (see Q9). Purpose is explicit: **inform the pick decision in real time** while browsing, before committing.

My read, stated plainly so it can be corrected rather than assumed silently: this overlay is passive/informational and available to everyone, separate from the AI agent and its XP penalty — it's closer to what the Mentor page already does (grounding a decision in live data) than to the agent making a pick for you. Flag if that's wrong.

### The AI agent itself — confirmed details, filling in X-06's open questions
- Visual form: a small floating icon/character that follows the cursor around the screen, Clippy-from-Microsoft-Word as the explicit reference point. Fun/playful tone, not a serious UI element.
- **Confirms a real capability beyond "gives a suggestion":** the agent can **automatically draft an entire lineup** for the user, not just nudge one pick at a time. This directly answers one of X-06's own open questions ("does using it mean opening it, or acting on a suggestion") — it's stronger than either: full auto-draft is an explicit, confirmed capability. Whether a lighter "just help with one slot" interaction also exists alongside full auto-draft, and whether the two cost different amounts of XP, is still open — see Q10 (this is the same open question X-06 already had about penalty scaling, not a new one).
- **Required UX, confirmed:** before a user commits to using it, the app should clearly tell them (a) it is not guaranteed to be right — "no matter the choices made, it's not 100%" — and (b) using it will reduce their XP. The user needs to be able to decide whether to use it with both of those known upfront, not discover the penalty after the fact.
- **Confirms the connection to perks:** this is the same mechanic as the already-documented `X-11` "Free Hit" perk — earning a Free Hit lets a player use the AI agent once without the XP penalty. Nothing new here, just confirmed as the same idea, not a separate one.
- The normal, unassisted draft flow stays exactly as it is today — the agent is additive, not a replacement for the existing `/draft` screen.

---

## Live Race View — confirms an existing idea, no new detail

A dedicated page once a contest starts, showing the drafted coins racing against each other on a graph in real time, driven by relative price movement. **This is the same idea as `X-05`** ("Visual race mode") already sitting in `new-feature-ideas.md` — this dump restates it without resolving any of that entry's existing open questions (exact duration threshold, whether the racers are specifically the 5 sector picks, whether it replaces or leads into the existing win/loss reveal, or the interval-price-capture infrastructure it would need). Logging the confirmation here; not inventing answers to those.

**This closes out the game-modes portion of the dump, per your own signal** — noted as done, ready for whatever's next on the intertwined parts of the app.

---

## Gauntlet, Research & Knowledge Base

Mostly confirms and connects existing ideas rather than introducing new ones.

- **Research Hub becomes a knowledge base** — covering what's happening in the crypto world and how it affects things, sourced from SoSoValue (as today) and possibly other sources later.
- **That knowledge base also grounds the AI Mentor**, so answers draw on it directly rather than (or in addition to) Mentor's current approach of fetching live sector/token/news data fresh on each request. Whether this means a real, separate persistent knowledge-base store, versus just describing the existing SoSoValue-backed data as "the knowledge base" conceptually, is genuinely unclear to me — see Q11, since it has real architecture implications either way.
- **Word/Term of the Day, confirmed** — this is the same idea as the already-documented `X-12` in `new-feature-ideas.md`, now with example terms: TVL (dictated as "CVL," almost certainly the same term already used in the existing Gauntlet seed questions), blockchain, and trading. One example term didn't transcribe usably ("let approved") — low stakes, just a content example, not a design question.
- **Immediate mini-quiz after learning something** — matches `X-12`'s existing "paired with a lightweight trivia check" description. Confirmed, not new.
- **A daily learning/visiting streak, distinct from the existing contest win-streak** (`users.streak` today tracks wins only). This reads as the "research streak" already referenced in `new-feature-ideas.md` §7.2's streak-gated-perks discussion — confirmed as a real, separate thing to track, not merged with win-streak.
- **Consistent daily engagement earns boosts/perks that give a real competitive edge** — same mechanic already defined in `new-feature-ideas.md` §7, explicitly framed here as a retention lever for days a user isn't playing a contest at all.

## Leaderboards

**New, clear ask:** in addition to the existing single global (all-time) leaderboard, add **daily, weekly, and monthly** time-scoped leaderboards. Straightforward extension of `/leaderboard` — see Q12 for the one thing worth confirming (scope).

---

## Q5 — 0G Agentic ID for the Practice/Bot Mode bots

Researched fresh from `docs.0g.ai` (Integration Guide + Overview pages) and the installed `0g-*` skills, 2026-08-26.

### The important distinction to not blur
**Agentic ID tokenizes ownership/authorization of an identity — it does not make a bot draft better.** Whether a token gets picked for a sector is entirely separate logic from whether the account holding the lineup is a plain database row or an ERC-7857 token. Confirmed real by re-checking the actual bots-service code on the `bots-service` branch: today's drafting is `[...tokens].sort(() => Math.random() - 0.5).slice(0, 5)` — pure randomness, no reasoning of any kind. Tokenizing the bot's identity leaves that exactly as random as it is now. If "smarter bots" is the actual goal, that's a **0G Compute** question (an LLM call reasoning over live sector data) — a completely different piece of the stack, addable independently of Agentic ID, and not blocked by it either way.

What Agentic ID *does* genuinely enable, matching what's actually being asked (tokenize the bot personas): each bot becomes a real, ownable, potentially tradeable NFT — the flagship 0G use case is literally "buy and sell trained trading bots with guaranteed functionality transfer" (`0g-integration-plan.md`). That's a real product feature (Phase 4 in that doc, `X-18` in the story register) if the 8 bot personas are meant to eventually be things players can own or trade, not just always-on NPCs.

### What's confirmed, concretely
- **No installed skill covers this directly** — checked all 16 `0g-*` skills installed earlier; none mention ERC-7857/Agentic ID. The closest usable ones are `0g-chain-deploy-contract` and `0g-chain-interact-contract`, since Agentic ID is ultimately a Solidity contract (ERC-721 extended) deployed like any other 0G Chain contract.
- **Minting** — `contract.mint(recipient, encryptedURI, metadataHash)`, straightforward once the contract's deployed.
- **The persona data itself gets encrypted and stored via 0G Storage**, not on-chain directly: prepare the persona's data (for a bot, this would be whatever "personality"/drafting-tendency data it has), generate a random encryption key, encrypt, upload the encrypted blob to 0G Storage (returns a URI), seal the encryption key for the owner, hash the metadata for on-chain integrity checking. This is the same 0G Storage integration already covered by the installed `0g-storage-upload-file` skill — genuinely reusable there.
- **`authorizeUsage(tokenId, executor, permissions)`** is exactly the mechanism that would let CoinDraft's backend (or `bots-service`) *operate* a bot account without needing to *own* the token — real code pattern confirmed, matches the relationship `bots-service` already has to the 8 seeded accounts today (it drives them without "owning" them in any tokenized sense currently, since they're just plain rows).
- **Reference implementation exists**: `github.com/0gfoundation/0g-agent-nft` (branch `eip-7857-draft`) — sample code, not a polished starter kit.

### What's a bigger lift than it sounds
- No pre-built starter kit — this is "here's the interface and one reference branch," not a scaffolded project the way 0G Compute's Router integration was.
- Needs a **Verifier + TeeVerifier** deployed and operating — the oracle infrastructure that handles encrypted re-encryption on transfer. Real infrastructure, not just a contract call.
- If bots are ever meant to be *traded* (not just tokenized-but-static), the `AgentMarket` contract piece is a further, separate build.
- One inconsistency worth flagging, not resolving: the Integration Guide page listed different testnet endpoint names (`storage-testnet.0g.ai`, `compute-testnet.0g.ai`) than the ones already verified live by curl in `0g-compute-integration-findings.md` and `0g-ai-context-reference.md`. Trusting the already-verified ones; this page's network section looks stale or generic — re-check directly against the source before relying on it.

### Recommendation, not a decision
Given Practice Mode's actual near-term need is just "bots exist and draft a lineup" (which `bots-service` already does, today, unmodified — see the H-02 findings from earlier), I'd sequence this as: **ship Practice Mode on the existing plain bot accounts first, tokenize them as a deliberate follow-on** once the mode itself is live and it's clear the "ownable bot" product angle is worth the Verifier/oracle infrastructure investment. Not blocking — your call, and easy to revisit once the rest of this redesign is settled.

~~Q1 — Practice Mode XP counting toward rank~~ **Answered: Option A.** `paperXpTotal` stays a fully separate pool, made nonzero. Practice contests earn visible practice XP; real `xpTotal`/rank stays 100% earned from real opponents only.

~~Q2 — no-opponent fallback~~ **Answered.** A button appears suggesting Practice Mode when no one's available to play against in Single Match. Simple, single behavior — not a wait screen, not an estimated time, just the suggestion button.

~~Q3 — matching mechanism~~ **Answered.** Single Match: if users are currently available, match them directly — no queue, no 30s timer. Tournament: join an open public one, or accept an invite to a private one while it's still open.

~~Q4 — Wager negotiation~~ **Confirmed core flow** (propose/accept/counter/decline). Timeout default: going with **whatever amount is currently on the table** (the last active proposal gets accepted) rather than always the higher figure — simpler to implement and to explain, and doesn't penalize whoever proposed the lower number. You said this is easy to flip later if it doesn't feel right in practice.

~~Q5 — 0G Agentic ID for the bots~~ **Researched, recommendation given — see the dedicated section above.** Not a blocking decision: recommendation is to ship Practice Mode on the existing plain bot accounts first, tokenize as a deliberate follow-on.

~~Q6 — private-tournament phrase~~ **Answered:** transcription error, no separate concept — private tournaments are simply pay-to-create + invite-only.

~~Q7 — funding model distinction~~ **Answered:** at creation, a tournament can have money deposited by the creator that becomes the prize pool participants compete to win. One nuance left open (not blocking): whether entrants can also fund a pool themselves (peer-funded), separate from creator-funded.

~~Q8 — XP in payout split~~ **Answered:** yes, XP factors in — example pattern given, decreasing by placement (30 → 25 → 23). Exact unit (percentage of pool, weighting multiplier, points) still to be nailed down when this gets designed, not blocking.

~~Q9 — hover overlay tab set~~ **Deferred to design time**, your call — "we'll determine what can be shown to give users enough info."

~~Q10 — AI agent penalty scaling~~ **Answered:** scales with usage — more help, more XP reduction.

~~Q11 — knowledge base, new store or existing data~~ **Answered:** same data already in use — "knowledge base" is a rebrand of the existing concept, not a new store.

~~Q12 — leaderboard scope~~ **Answered:** quiz/research and gameplay leaderboards are confirmed separate (matches `X-04`'s original framing), and daily/weekly/monthly time-scoping applies to both.

---

_Next step, per your instruction: hold here until Q1–Q12 (and the two unparsed fragments) are answered, then compare this against the current implementation and use that to update `user-stories-by-surface.md`. Midnight/0G/budget architecture discussion deliberately parked until this is done._
