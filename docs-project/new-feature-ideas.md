# New Feature Ideas — Working Notes

_Captured 2026-08-23. Discussion-phase only — nothing built, nothing committed. Pick this back up before deciding what to actually build._

---

## 1. Sponsor-funded tournaments + sponsor admin mode

Companies sponsor/fund a tournament and pay real winners (not XP). Needs:
- A tournament creation mode, separate from today's matchmaking/lobby flow.
- An admin interface for sponsors — control over tournament config, payment, and details.

**Why this is a bigger lift than it sounds:** `users` today has no role/permission tier at all — auth is flat, wallet-based, one access level. Sponsor admin access is a new actor type in the system, not just a new page.

**Open questions:**
- Self-serve sponsor signup, or manually onboarded by the CoinDraft team?
- Does the tournament reuse the existing lobby ranked-pool engine (N players, ranked by return), or is it a different format (bracket-style elimination)?
- Does the sponsor fund a pool upfront (crypto, which token/chain?) held in escrow until resolution?

## 2. Wager mode (peer-to-peer)

Players create a tournament and invite others to wager real money against each other. Configurable payout structures ("win modes"): winner-takes-all, or split across 1st/2nd/3rd etc.

**Why this is a bigger lift than it sounds:** same root problem as #1 — nothing in the product touches real money today, only XP. Someone/something has to hold wagered funds between creation and resolution.

**Connects to already-parked roadmap items:**
- Midnight notes (`midnight-integration-notes.md`) flagged, as Wave 3 material: "prove entry-fee solvency without revealing wallet balance" and "private payout claims" — both assume real-money pools exist. This feature is that precondition arriving.
- 0G plan (`0g-integration-plan.md`) flagged "0G Pay — agent payment rails, ties to future real-money prize pools" the same way, also parked as "gated on the feature existing first."
- Worth revisiting both docs once this feature has real shape — they were written assuming this didn't exist yet.

**Open questions:**
- Escrow mechanism — smart contract, or custodial?
- What happens if a wager tournament doesn't fill, or a participant backs out before it starts?
- Win-mode configurability — how many payout structures, and are they fixed presets or fully custom per tournament?

## 3. Time-based draft modes

Expand beyond today's `daily` (24h) / `weekly` (7d) contest types into a fuller set of durations: 3-day, 1-week (exists), a longer "long game" mode, weekend, and "hot hour" (short/fast, arcade-style).

**Fits existing patterns** — `contests`/`lobbies` already carry `startAt`/`endAt` and a duration-driven resolution model (see the `windowDays`-style logic in lobby resolution). This extends an existing axis rather than requiring new infrastructure.

**Open questions:**
- Is "hot hour" a scheduled recurring slot, or user-initiated on demand?
- Does the new duration set apply to both 1v1 contests and lobbies, or only one format?
- What's the actual duration for "long game mode" — a month? A full season?

## 4. Quiz mode (Gauntlet) gets its own leaderboard + badges

Today Gauntlet earns XP but has no dedicated leaderboard, and all badges are win-based (`awardWinBadges` only counts `contests.winnerId` / `lobbies.winnerId`). This adds a parallel progression track scoped to quiz performance.

**Fits existing patterns** — reuses the leaderboard and badge table shapes, just scoped to `gauntlet_attempts` instead of contest wins.

**Open questions:**
- New badge category, or folded into the existing 6-badge dashboard strip?
- Season-scoped like the main leaderboard, or all-time?

## 5. Visual race mode

Drafted tokens rendered as a live, color-coded race — each racer's movement driven by real price growth over the contest window. 5 minutes is the floor duration; anything shorter resolves too fast to read as a race ("no dramatic effect"). Needs a start/stop launch animation for the moment the race begins.

**Why this is a bigger lift than it sounds:** current scoring (`scoreLineupPicks`) appears to compare start-price vs end-price only — a real *moving* race (not a faked interpolation between two points) needs price captured at intervals *during* the window, which the system doesn't do today.

**Connects to #3 (time-based drafts):** the 5-minute floor strongly suggests this is the flagship live-view experience specifically for the short end of that duration range (5-min tier, maybe "hot hour"), not something meant to apply to a 24h or weekly contest — nobody's watching 7 days of price action animate.

**Open questions:**
- Does this need new backend infrastructure for interval-based price capture during a live contest window?
- Own contest format, or a live-view layer on top of the short-duration tier from #3?
- Who/what are the racers — the 5 sector tokens within one lineup, or other players'/the room's overall scores?
- Does it replace the existing win/loss or ranked-lobby reveal, or lead into it once the race finishes?

## 6. AI draft advisor (floating, Clippy-style) with an XP handicap

An AI agent on the Draft page that proactively offers advice — not the existing Mentor chat page, but a floating character presence during drafting itself, explicitly described as "like Clippy from Microsoft Word." **This is the same idea from the earlier Rive/Lottie floating-assistant discussion** (Rive state machine proposed: Idle / Thinking / Tip / Hype / Consoling / Alert, tied to real trigger points like Mentor streaming and contest results) — now with an actual game-balance mechanic attached that wasn't part of that original discussion.

**The mechanic:** if a user takes the agent's advice and wins, their XP payout is reduced — a deliberate handicap so AI-assisted wins are worth less than an unaided read. Requires tracking, per lineup, whether AI assistance was used during drafting (nothing like this exists on `lineups` today), with the penalty applied only at resolution time, only on a win.

**Open questions:**
- Is this the same underlying AI as the existing Mentor feature (`/api/mentor`, currently Groq-backed), just surfaced as a proactive floating widget on Draft instead of a chat page — or a genuinely separate capability?
- Penalty scale — fixed deduction, or does it scale with how much/how often the agent was consulted during that draft?
- Does "using it" mean opening the agent at all, or specifically acting on a suggestion it made?

## 6a. Helper tokens (separate feature — monetization)

A purchasable item that removes the XP penalty from #6, letting a user consult the AI advisor with no deduction. Explicitly called out as its own feature, not bundled into #6's core mechanic. Also lands in the same real-money/purchase gap flagged for #1 and #2 — the product has no purchase flow of any kind today.

**Open questions:**
- Purchased with real money, or earned some other way?
- Per-use, or a session/time-bound unlock?

## 7. Define perks & boosts (formal system needed)

Flagged as needing real definition, not a new idea with its own mechanic yet — checked the code to ground this accurately:

**What exists today:** boosts are earned two ways — reading a Research Hub article (`research_reads`) or answering the daily Gauntlet correctly (`gauntlet_questions.boostSector`) — stored on the user as `activeBoosts: [{ sector, expiresAt }]`. **No multiplier value is stored anywhere, and `scoring.ts` never reads `activeBoosts` at all** — boosts are earned, tracked, and shown in the UI with an expiry timer, but currently do nothing to contest outcomes.

**"Perks" isn't a separate concept from "boosts" in the codebase today** — the two terms have only been used interchangeably so far, in the Midnight privacy notes ("hide which boosts/perks were active on a lineup"). Defining this means deciding whether they're the same mechanic or two distinct systems (e.g., boosts = passive sector multipliers from Research/Gauntlet; perks = something else — active-use abilities, one-time items, cosmetic unlocks).

**Open questions:**
- Are perks and boosts one system or two?
- What should a boost actually do numerically once wired into scoring (multiplier value, flat bonus, something else)?
- Full taxonomy — how many distinct boost/perk types should exist, and what earns each one?

### 7.1 First real definitions (2026-08-24)

Two-tier split, confirmed: **boosts** = small/frequent/passive, **perks** = rare/powerful/strategic. Not FPL-specific — genre-general tiering, applied to CoinDraft's own mechanics.

**Boosts** — formally defined as **point/score multipliers**. (Closes the open question above: not a flat bonus, a multiplier.) Existing earn paths stay: Research Hub reads, daily Gauntlet. New earn path: the Term-of-the-Day trivia (below) also awards boost points on a correct answer.

**Perks defined so far:**
- **Captain-equivalent** (name TBD — "Captain" doesn't fit CoinDraft's context) — designate one of the 5 sector picks to count more heavily toward final score. First real instance of a "which pick matters most" mechanic — nothing like this exists in scoring today.
- **Free Hit** — repurposed from the FPL name. Means: one free use of the AI draft advisor (#6) with the XP penalty waived for that use. Two earn paths:
  1. Research Hub — 1 Free Hit granted after N article reads (threshold/counter, not per-read; N not yet decided).
  2. Term-of-the-Day trivia (see below) — a *random chance* at a Free Hit for users with an active research streak who answer correctly.

**New Research Hub sub-feature — Term of the Day:** a new Web3/crypto vocabulary term surfaced daily, separate from the existing sector-news-article-read mechanic. Paired with a lightweight trivia check ("what does this term mean?"), Gauntlet-style. Correct answer → boost points for everyone; streaky research users also get a random shot at a Free Hit.

**Build constraint (from the person driving this, not a suggestion):** the whole system needs to be built as an extensible perk/boost *type* registry, not hardcoded one-off fields per perk — new perk/boost types should be addable later without a schema rebuild.

### 7.2 Accepted (2026-08-24)

- **Shield** — a defensive counterpart to Captain: floors one sector pick's contribution at zero instead of letting a bad pick count negatively. Same "which pick matters" family, opposite direction (protect vs. amplify).
- **Late Swap** — a limited ability to swap one already-locked pick before the window closes. Different from Free Hit (which is about the AI agent specifically) — this is about the pick itself, addressing "locking is instant and final" as it stands today.
- **XP-multiplier boost as a second boost flavor** — since boosts are now defined as multipliers, consider letting some boosts multiply *XP earned* rather than *contest score* — gives Research/Gauntlet two different reward flavors to hand out instead of one.
- **Streak-gated perk unlocks, generalized** — the research-streak → random-Free-Hit idea is good; consider extending "hit a streak milestone, earn a perk of your choice" as a broader pattern beyond just Free Hit, so streaks reward perks generally, not one specific perk.
- **Scouting** (forward-looking, ties to Midnight) — once lineups can be hidden via the Midnight commit-reveal work, a perk that reveals a partial hint about an opponent's hidden picks (e.g. "their strongest-conviction sector," not the actual token) would be a natural, well-motivated addition *because* hiding exists. Not buildable until that privacy work lands — noting the connection now so it isn't lost.

---

## Complexity read, at a glance

| Feature | Fits existing architecture? | New foundation required |
| --- | --- | --- |
| #3 Time-based drafts | Yes | None — extends existing duration model |
| #4 Quiz leaderboard/badges | Yes | None — reuses leaderboard/badge patterns |
| #6 AI draft advisor | Mostly | New per-lineup "assisted" flag + resolution-time penalty logic |
| #1 Sponsor tournaments | No | Role/permission system + payment/escrow |
| #2 Wager mode | No | Payment/escrow (peer-to-peer), same root gap as #1 |
| #5 Visual race mode | No | Interval-based live price capture during a contest window |
| #6a Helper tokens | No | Purchase flow — same real-money gap as #1/#2 |

---

## 8. WebGL / Three.js race visualisation — noted 2026-08-28

**Your intent, recorded for later:** the race view should eventually move to WebGL
with Three.js, to do something more dramatic than a 2D line chart can.

**Where it stands today.** The race is a uPlot canvas chart
(`src/lib/components/RaceChart.svelte`) — smoothed spline lines, gradient fills,
glowing leading-edge dots, a scrub cursor and a click-to-isolate legend. That's
the ceiling for a conventional chart, and it's deliberately a component with a
narrow prop contract (`racers`, `timestamps`, `values`) so the renderer can be
swapped without touching the page, the API or the sampling.

**What already exists that a WebGL version would inherit, and what it wouldn't:**

- **Inherits:** server-side price sampling (`price_samples`), the `/live`
  endpoint, per-token sector colours, entry-price-anchored percentages. The data
  layer is renderer-agnostic.
- **Doesn't inherit:** sampling density. At 4s ticks a 10-minute game yields ~150
  points, which is plenty for a line chart but sparse for anything animating at
  60fps — real motion would want interpolation between samples, or finer capture.
  Binance 1m klines could backfill, but 1m is *coarser* than the current 4s, so
  smooth motion means interpolating regardless.

**Worth deciding before building it:** what the third dimension is actually
*for*. A 3D line chart is usually harder to read than a 2D one, so the win has to
come from something a flat chart can't do — literal lanes racing toward a finish
line, depth encoding volatility, tokens as physical objects with weight. If it's
the same lines with a camera angle, it costs a lot and reads worse.

**Cost note:** Three.js is ~170KB gzipped against uPlot's 21KB, and it's a real
performance surface on low-end phones — where the current chart is essentially
free. Probably belongs behind a toggle or reserved for a dedicated "watch" view
rather than replacing the in-game chart outright.

**Status:** noted, not scoped. No work started.
