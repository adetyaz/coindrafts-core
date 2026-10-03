# CoinDraft — Roadmap

Single source of truth for what's done, what's left, and why. Start with the
**Launch tracker** — it's the checklist. Everything below it is reference detail.

Last updated: 2026-09-27.

---

## Launch tracker

`[x]` done · `[ ]` left · _(needs you)_ = blocked on your input or testing

### ✅ Done

**Cleanup & direction (2026-09-21 → 09-27)**

- [x] Audited every `docs-project/` doc against the actual code; consolidated into
      this file; deleted the redundant status docs and Midnight docs
- [x] Removed AI Mentor, Research Hub / Knowledge Base, and the Docs page (routes,
      APIs, nav, landing and guide links)
- [x] Removed Midnight (KYC contract, wallet, age gate) by force push — backup tag
      `backup/pre-force-push-2026-09-26`
- [x] Fixed tournament sector restriction: enforced server-side, restricted drafts
      now completable (type-checked; browser test still pending — see below)
- [x] Product direction, modes, matchmaking, economy, payments, PWA and v1 scope
      decided (see "Product direction" below)

**Already built before this pass** (verified in code)

- [x] Versus — 1v1 vs a real opponent, no bot fallback (currently called "Single
      Match" in the UI)
- [x] Scrimmage — practice vs a bot that drafts a real lineup (coin draft only)
- [x] Tournaments — public/private, invites, brackets, auto-start/cancel at close
- [x] Wager Mode on XP — tier matching, blind raise settles at the lower figure
- [x] AI Draft Agent, Live Race View, Token Hover Overlay (all 🟡 not browser-verified)
- [x] Pricing rebuild (Binance + CoinGecko), refuse-to-settle on missing prices
- [x] Real HMAC session signing (the forgeable-session bug is fixed)
- [x] Gauntlet — 1 daily question + 24h sector boost (to be replaced by Trivia)
- [x] Boost scoring — ×1.25 on movement, judged at scheduled end
- [x] Term of the Day backend (no UI; to be folded into Trivia)

### ⬜ Left for v1 — in suggested build order

**1. Fix what's broken**

- [x] League invite-code leak — private leagues now 404 for non-members; invite
      code only returned to members (2026-09-27)
- [x] League invite-code collisions — crypto-random codes, retry on a clash
      instead of a raw 500 (2026-09-27)
- [x] Leave / delete a league — members leave, the creator deletes (with a
      confirm step; one transaction) (2026-09-27)
- [x] ~~Result card shows a bot win as a loss~~ — not real in current code: bots
      are real seeded accounts now, so `winnerId` is set correctly
- [x] Pre-rebrand purple in `Toast.svelte` → design tokens (the share page was
      already on the current palette) (2026-09-27)
- [x] `/api/breakdown` was an open AI proxy (accepted picks/status from the
      browser, regenerated every view). Now takes only `contestId`, reads the
      real picks, and stores the text on the lineup — generated once per result
      (2026-09-27)
- [x] ~~`nodemailer` not installed~~ — optional by design (lazy import; invites
      still work as links without email)
- [ ] 🟠 Versus ties always go to player A (`scoreA >= scoreB`) — settle exact
      ties with RPS instead
- [ ] Browser-test the tournament sector fix _(needs you — wallet sign-in)_

**2. Reshape the modes**

- [x] Removed the standalone Multiplayer mode (2026-09-27) — `/lobby` page,
      lobby browse/create/join/start, the lobby queue and `lobby-matchmaking.ts`.
      Kept what tournaments run on: lobby info, lineup, result, "mine", and the
      `/lobby/[id]/result` page (its "queue another lobby" button now goes to
      tournaments). `lobby_queue` table left in place.
- [x] Renamed "Single Match" → "Versus" in nav, matchmaking page, guide and the
      user-flow diagram (2026-09-27)
- [ ] Scrimmage supports both draft types — waits on Binary Options (step 3)

**3. Binary Options (solo, vs the market)**

- [ ] Pick any 5 coins, call up/down per coin, resolve at window end
- [ ] Win = 3 of 5 correct; fixed window lengths (e.g. 1h / 24h)
- [ ] Results, XP rewards, and history alongside other modes

**4. Daily Trivia (replaces Gauntlet + Term of the Day)**

- [ ] 8 questions/day, ~1 minute total timer
- [ ] Pass at 4/8 → XP, scaling per correct answer above that
- [ ] Streak extends only on a pass
- [ ] Question supply for 8/day (live-data templates + vocab pool + static bank)
- [ ] Retire the Gauntlet's single question and its free sector boost

**5. XP economy — boosts & perks**

- [ ] Inventory: what each player owns
- [ ] XP shop with the 4 launch items: Sector Boost, XP Boost, Free Hit, Captain
- [ ] Captain needs a per-pick weighting change in scoring
- [ ] Limits: 1 per game/tournament, max 3 per week
- [ ] Boosts/perks only apply in XP games (never in real-money games)

**6. USDC purchases**

- [ ] Player sends USDC from their wallet; server verifies the transfer on-chain
      and credits the item (no processor, no held balances)
- [ ] Decide chains: USDC on Base (EVM) + USDC on Solana _(needs you)_
- [ ] Purchase history / receipts

**7. New matchmaking + RPS**

- [ ] Queue with preferences: mode, sector, duration, wager-or-not, stake tier
- [ ] Hard match on mode, wager-or-not, stake tier; sector/duration may differ
- [ ] "Any" option (defers to the opponent)
- [x] RPS rules + server (2026-09-27) — `$lib/rps.ts`, `$lib/server/rps.ts`,
      `/api/rps/[id]` (GET, polled) and `/api/rps/[id]/throw`. Best of 3, 10s per
      throw, random throw on timeout, ties replay, opponent's throw hidden until
      both are in. Classic and Lizard-Spock variants (Lizard-Spock is the default —
      fewer ties).
- [x] RPS interface from your design (2026-09-27) — `RpsGame.svelte` (practice vs
      house + live match mode), rules modal, responsive. Preview at `/design/rps`.
- [ ] Create the `rps_matches` table in the database (`npm run db:push`) _(needs
      you — touches the shared database)_
- [ ] Replace the placeholder hand icons with the design's SVG assets _(needs you
      — send the files)_
- [ ] Browser-check `/design/rps` on desktop and phone _(needs you)_
- [ ] Wire RPS into the new matchmaking (create a match when terms differ, apply
      the winner's terms)
- [ ] Check the weekly/duration path (was hardcoded to `daily`)

**8. PWA + push notifications**

- [ ] Manifest, icons, service worker, install prompt (iOS needs "Add to Home
      Screen" for push)
- [ ] Store push subscriptions; per-type on/off in profile
- [ ] Notifications: match found · result in · trivia live / streak at risk ·
      tournament closing / starting

**9. Playful, interactive game screens** — turn the live race view (`/game/[id]`,
today a uPlot line chart) into something you _watch_ like a race. Ships in v1 as
the base track; the extras below can slip to after launch.

- [ ] **Race track**: each pick is a car on a track; its position is the coin's
      live % move. Overtakes animate; Versus shows your 5 cars against theirs (or
      one car per player = lineup total), with the gap between you
- [ ] **Clashes**: cars bump and spark when they swap places; a coin dumping
      sharply spins out or crashes; a coin pumping hard gets a speed burst
- [ ] **Boost = nitro**: a boosted sector's car shows a flame trail, so a boost
      is visible, not just a ×1.25 label
- [ ] **Finish line**: photo finish at the window end, checkered flag, confetti on
      a win, then straight into the result screen
- [ ] **Tap a car** → token stats (reuse the Token Hover overlay)
- [ ] **Live commentary ticker**: "SOL overtakes ETH!", "PEPE crashes −6%",
      "You take the lead"
- [ ] Data: `price_samples` for live points, with Binance 1-minute klines to
      backfill stretches nobody was watching (today a contest nobody opens has no
      graph)
- [ ] Respect reduced-motion (fall back to the plain chart), keep it light on
      phones — Canvas/SVG first; WebGL only if a flat track can't do the effect
      (Three.js is ~170KB vs uPlot's ~21KB)

**10. Before launch**

- [ ] End-to-end test of the full v1 flow — confirms or adjusts v1 scope _(needs you)_
- [ ] Domain + name decision _(needs you)_
- [ ] Pitch / landing-page copy _(open until then)_
- [ ] Rewrite `AGENTS.md` (badly stale — describes the pre-rework app; also
      wrong that the DB client is neon-http — it's node-postgres, so real
      transactions are available)
- [ ] Update `README.md` (still framed as a buildathon PRD)

### ⏭️ After launch

- [ ] Real-money wagers + escrow + in-house KYC (planned $25 cap)
- [ ] Paid tournament entry
- [ ] Binary-options tournaments
- [ ] Multiplayer binary options — AI agent picks 5 coins from cached news, 3 rerolls
- [ ] Head-to-head timed trivia
- [ ] Visible online-players / challenge list
- [ ] Rest of the perk catalogue (Shield, Second Look, Flip, Double Down…)
- [ ] Seasons (FPL-style perk allowances, league seasons that actually resolve)
- [ ] Chain-agnostic rework (wallet, settlement, AI backend — 0G becomes one option)
- [ ] More playful screens: binary-options calls as ramps/gates the car jumps
      (green or red light at resolution) · tournaments as a multi-lane grid with
      race positions as the leaderboard · emoji reactions to your opponent
      mid-race · replay a finished race · shareable race clip for X · optional
      sound and phone haptics on overtakes and the finish
- [ ] Backlog ideas in section 3 below

---

## Background

**Midnight** was removed 2026-09-26 by force push (it had a Compact KYC contract,
an on-chain wager age gate, wallet integration, `/profile/kyc`, schema changes).
Recoverable from `backup/pre-force-push-2026-09-26`, which also holds two dropped
non-Midnight fixes (a Vercel build fix and an esbuild/vite 8 pin fix) — the
current base builds without them, but look there first if a Vercel build fails.
Linera never had code here.

**Removed features (2026-09-26)**: AI Mentor, Research Hub / Knowledge Base, Docs
page. `/api/breakdown` and the AI Draft Agent still use `aiCompute.ts`.

**Product direction (decided 2026-09-26)** — indie business, revenue-driven, no
investors. Players: crypto-native traders and the fantasy-sports crowd first.
Success = active users + revenue. Launch ASAP.

- **Modes**: Scrimmage (practice vs bot, both draft types) · Binary Options (pick
  any 5 coins, call up/down at window end, scored against the market, best 3 of 5)
  · Versus (1v1 real opponent) · Tournaments (public/private, user-created; coin
  draft _or_ binary-options draft). Multiplayer lobbies as a standalone mode are
  **cut** (tournaments still use the lobby tables internally). Later: a
  multiplayer binary-options variant with 5 set coins (one per sector), chosen by
  an AI agent from cached crypto news; players can regenerate the set up to 3
  times.
- **Matchmaking**: blind queue — players set mode, sector, duration, wager.
  Mode, wager-or-not and stake tier must match exactly; sector and duration can
  differ ("Any" allowed, which defers to the opponent). Remaining differences are
  settled by one best-of-3 rock-paper-scissors round (10s per throw, random throw
  on timeout) that decides all differing terms at once. A visible
  online-players/challenge list comes later, once there's a crowd.
- **Learning pillar replaced by Trivia**: 8 timed questions/day (~1 minute), pass
  at 4/8 to earn XP, XP scales above that, only a pass extends the streak.
  Head-to-head timed trivia is a later mode.
- **Economy**: trivia + play → XP → boosts/perks. Boosts/perks also sold for ~$1
  or less. One perk per game/tournament, max 3 per week. Launch catalogue: Sector
  Boost (exists), XP Boost, Free Hit, Captain — more later.
- **Money**: launch free/XP-only, with paid boosts/perks as the only real-money
  flow. Real-money wagers and paid tournament entry come later (planned $25 cap),
  once escrow is chosen — see Wager Mode for the researched options.
- **Revenue**: boost/perk sales now; wager rake and tournament cut later.
- **Payments for boosts/perks**: direct USDC transfer from the player's wallet to
  ours, verified on-chain server-side, then the item is credited. No processor, no
  held balances.
- **v1 scope (provisional — to be confirmed after an end-to-end test)**: Versus +
  Scrimmage, solo Binary Options, daily trivia, XP → boosts/perks (4 launch
  items), USDC purchases, new matchmaking with RPS, Tournaments, and the known-issue
  fixes. Right after launch: multiplayer binary options, head-to-head trivia,
  online-players list, real-money wagers + in-house KYC, the rest of the perk
  catalogue.
- **PWA + push notifications (v1)**: installable app, no store download. Launch
  notifications: match found, result in, trivia live / streak about to break,
  tournament closing or starting — each toggleable per type in the profile. iOS
  only delivers web push after "Add to Home Screen" (16.4+), so the install
  prompt is part of the feature. Vercel Hobby crons run once a day, so
  notifications fire from events; only the trivia reminder rides the daily cron.
- **Pitch**: deliberately left open until launch. Working candidate: "Fantasy
  sports for crypto: draft 5 coins or call 5 moves, go head-to-head, and let
  rock-paper-scissors settle the rest."

Status legend: ✅ built & verified · 🟡 built, gaps or unverified in a real browser ·
⬜ not built · ⛔ deferred/blocked

---

## 1. Known issues — fix-worthy, ranked

1. **🔴 League invite-code leak (unfixed, confirmed live in code, 2026-09-21).**
   `src/routes/api/leagues/[id]/+server.ts` GET returns the full `league` row —
   including the invite code — to _any_ signed-in user, with no membership or
   private/public check. Anyone who obtains or guesses a league id can read its
   invite code and join a private league. Highest-severity open item found in this
   audit. Fix: select only public-safe league fields, or gate the invite code
   behind an actual membership check.
2. Invite codes are generated via `Math.random()` with no DB uniqueness constraint
   — a collision throws a raw 500 instead of retrying.
3. No way to leave or delete a league once joined/created.
4. League seasons never resolve (`seasonEnd` is set but nothing acts on it) —
   "League Championship" badges are consequently undeliverable.
5. Gauntlet questions are graded against the answer captured at seed time, but
   generated from live data — a "which token performed best today" question seeded
   at midnight can be factually stale by evening, marking a correct answer wrong.
   Compounding: day boundaries use server-local UTC `toISOString()`, so "today"
   flips mid-evening for some users.
6. Result card renders `didWin` from `winnerId`, which is `null` for bot contests
   — a bot win renders as a loss on the public shared card.
7. Pre-rebrand purple (`#f0eff8` / `#534ab7`) is still hardcoded in the pick-chip
   styling on `/share/[id]` **and** in every `Toast.svelte` toast (info/error/
   success) — missed across two brand-color changes since.
8. No rate limiting on `/api/breakdown` — an authenticated user can trigger it
   arbitrarily (real cost on 0G mainnet if that path is ever flagged on), and it
   regenerates on every result-page view despite its input being immutable once a
   contest resolves — never cached.
9. Result card SVG (`resultCard.ts`) duplicates sector hex values from
   `layout.css` by necessity (documented, deliberate) — but that means every
   future palette change needs a manual second edit; nothing enforces the sync.
10. Card is cached 1h, so a card fetched just before resolution can serve stale
    data for that window.

---

## 2. Feature areas

### Single Match Mode (was: 1v1 contests / matchmaking)

🟡 Rebuilt. Bots removed from ranked play entirely — a real opponent is required;
after 20s with no match, the UI offers "Try Scrimmage instead" rather than falling
back to a bot. Match terms (duration + wager tier) are chosen _before_ matching,
not negotiated after — this removes deadlock/abandonment risk rather than
relocating it (worth keeping as a general design principle beyond this feature).
Race screen and wager-tier commit are built under the Wager Mode mechanism (see
below). Open question, never resolved: do daily/weekly contest presets survive
this model, or should they become two more duration presets? `matchmaking_queue`
is reportedly still hardcoded to `type: 'daily'` — the weekly path may be
functionally dead without ever being formally removed. Verify before relying on
the 2x-weekly-XP claim.

### Scrimmage (was: bot-opponent fallback)

✅ Built. Renamed/reframed rather than removed — bots still exist here, specifically
for solo practice, with the H-02 bug (bot's displayed score vs. the score used to
decide the outcome could disagree, ~45% of the time) fixed by having the bot draft
a real lineup instead of a synthetic random score. Practice/paper wins no longer
leak into real win-count stats (was leaking in three places: badges, dashboard,
profile — all three fixed).

### Multiplayer Lobbies

🟡 Functionally untouched by the wider rework (deliberate rename/entry-point pass
only). Cannot be tested solo — no bot fallback, no start-early on quick-match,
open-lobby start disabled below 2 players. A lobby created via the UI never sets
`maxSize`, so headcount renders with no denominator. "Lobby started" is inferred
by the lobby's absence from a list — indistinguishable from one that errored,
expired, or was deleted. Deliberately excludes league standings and bot fallback
(unchanged from original scope).

### Tournaments

🟡 Public + free-to-play + brackets + private/invite built. **Sector restriction
fixed 2026-09-26**: it was saved but never enforced server-side (pick sectors were
trusted from the request), and restricted tournaments were uncompletable (the 5
one-per-sector slots couldn't be filled from a single-sector pool). Now the server
classifies each pick and rejects off-sector/duplicate coins, and restricted drafts
use 5 open slots from that sector's pool (AI Draft Agent hidden there). Type-checked,
not yet browser-tested. Sponsor access and
money-funded tournaments are blocked on the same escrow decision as Wager Mode.
Registration close is both the join deadline and the scheduled auto-start trigger
(`registrationClosesAt`) — two distinct outcomes on the same timestamp: **close-to-
start** (enough players) vs. **close-to-cancel** (not enough → `cancelled` status,
refunds owed once real money exists). Worth keeping that framing verbatim in any
future spec. Open: tie-breaking on a score tie (currently keeps insertion order,
now consequential since it decides qualifier advancement); min/max bracket size is
a placeholder (`minPlayers: 2`); too-few-at-close behavior (cancel vs. extend vs.
bot-fill) undecided; whether entrants can peer-fund a pool vs. only creator-funding
is tied to the wager/escrow decision. Growth idea worth keeping: auto-create public
tournaments so the list is never empty — most silently cancel-close unjoined, which
is expected, not a failure.

### Wager Mode (real-money mode — currently on XP, not real money)

🟡 Built on XP settlement, not real money yet. 18+ gate, tier-matched queueing
(0/25/50/100/250 XP), blind-commit-settles-at-lower mechanic (both sides privately
raise, settle at the lower figure, never revealed pre-lock — live-verified), a
`SettlementProvider` interface already abstracts settlement so it's swappable
later, rematch loop with head-to-head record + hourly cap. **Real escrow is the
one genuinely unbuilt piece.**

Escrow research to date assumed CoinDraft would build its own settlement (on-chain
non-custodial vs. custodial DB-backed, with 0G's own hybrid deposit/off-chain-debit
Payment Layer pattern as a reference to copy). **This is now superseded by the
actual decision: a third-party escrow provider**, chosen specifically so CoinDraft
never custodies funds. That changes what needs deciding — evaluate providers
against the same open risks the internal research already surfaced:

- Solana-authenticated users are structurally excluded from any EVM-only escrow
  path — confirm whether the chosen provider supports Solana, or this gap persists.
- Withdrawals/refunds and dispute handling need to be the provider's problem, not
  re-invented.
- A third-party provider likely shares rather than removes compliance burden (age
  verification, geofencing, the underlying game-legality question) — see the
  compliance research workstream, not duplicated here.

Rejected idea, well-reasoned, worth remembering so it isn't proposed again:
staking against the Scrimmage bot for real money. Rejected because CoinDraft's own
code picks the bot's moves (a loss "looks suspicious" with no way to prove
otherwise), the bot has no house edge so the house would bleed money, and it
targets the least-experienced users the mode exists to protect. A substitute that
survived: a **pooled benchmark mode** — many players stake into a shared pool,
everyone drafts against the same published bot lineup as a common yardstick,
everyone who beats it splits the pool (rake to CoinDraft). Economically
peer-to-peer, auditable, no house position. Not built, not yet ticketed.

Gasless transactions: ERC-4337 EntryPoint contracts are confirmed deployed on both
0G mainnet and testnet, so gasless is technically possible but needs a
self-run bundler + paymaster — real infra work, not a config flag. Deliberately
staged: XP first (done), then real gas-paid-by-player escrow, then a paymaster
only if UX friction actually demands it. One sharp point worth keeping: making
_achievement claims_ gasless would undercut their own point — the player paying
their own gas is what proves the on-chain activity is real, not backend-faked.
Decide gasless scope deliberately (wager entry vs. achievement claims) rather than
defaulting to gasless everywhere.

Hard dependency, non-negotiable before any real value touches this feature: the
session-forgery bug (see below) and "settle can be triggered before `endAt`"
must both be closed. **The session-forgery bug is already fixed** (see Auth,
below) — re-verify the settle-before-`endAt` item before shipping real money.

### AI Draft Agent

🟡 Built and live-verified (0G Compute backend, same call shape as `/api/breakdown`). Full
auto-draft confirmed real (not just single-pick nudging), XP cost 15/slot charged
upfront, disclosure required before use, cross-slot duplicate-token bug fixed with
a shared `used` set, incorrectly charging XP even in Scrimmage mode fixed via an
`isPaper` flag. Never visually/interaction-verified in an actual browser (cursor-
follow, popover menu). "Free Hit" waiver mechanic is wired but nothing currently
grants a Free Hit, so it's unreachable in practice — cheapest fix is having a
badge grant one directly (see Progression, below). Guardrail worth stating as a
house pattern: the LLM only ever chooses among real live candidate tokens, its
answer is validated against that list, and an invalid answer falls back
procedurally to the best 24h performer — same discipline as Gauntlet's question
generator.

### Gauntlet

🟡 Self-seeding cron confirmed working. Boost-to-scoring fix applied: boosts now
multiply _movement_, not _score_ (so a boosted losing pick can still lose — it
amplifies the loss too), and are judged at the contest's scheduled end rather than
whenever the page happens to be viewed. Both are precise, reusable design rules,
not just implementation notes. See known issues above for the seed-time-vs-
live-data grading bug and the UTC day-boundary bug.

### AI Mentor

⛔ **Removed 2026-09-26** — route, page, and nav links deleted. Was built,
streaming, Groq-backed with 0G Compute as an optional flag.

### Breakdown

✅ Built, Groq-backed with 0G Compute as an optional flag (confirmed live via
direct API test — real completion, real billing — but `USE_0G_COMPUTE` defaults
off and is never exercised through the app itself). Testnet's only available chat
model is materially weaker than Groq's default; the quality/latency comparison the
original plan called for has never been run. See known issues above for the
missing rate-limiting and caching gaps.

### Research Hub / Knowledge Base

⛔ **Removed 2026-09-26** — route, API, and nav/landing/guide-page links deleted.
Was a sector-tagged news feed with a daily read-for-boost mechanic. Its known bugs
(boost claimed by expanding rather than reading an article; Wildcard-classification
over-award) are moot now that the feature is gone.

### Term of the Day

🟡 Backend built and live-verified (seeded 10-term bank with distractors,
`/api/term/today`, `/api/term/answer`, `bumpResearchStreak()` — a "research streak"
distinct from win streak). Only the UI component and its dashboard surfacing
remain unbuilt — and its planned host page (Knowledge Base) is now gone, so it
needs a new placement decision before the UI work even starts. Kept deliberately
separate from Gauntlet as two independent daily rituals — an earlier version
accidentally merged the two and had to be pulled back apart; don't repeat that.

### Live Race View

🟡 Built (`/game/[id]`, `/api/contest/[id]/live`, `price_samples` table,
uPlot-based `RaceChart.svelte`). Deliberate compromise: rather than reworking the
two-point scoring model, the app self-captures a price series only while someone
is actively watching, throttled to one write per 6s regardless of viewer count —
a contest nobody opens has no graph, and there's no way to backfill history for
periods nobody watched. `pricing/price-availability-plan.md`'s proposed Binance
1-minute klines would let `price_samples` become a fallback instead of the only
source — these two efforts solve complementary halves of the same gap and should
be connected when either is next touched. Never seen on screen (API-verified only).
Backlog idea, well-reasoned but unscoped: a WebGL/Three.js version, justified only
if it does something a flat chart genuinely can't (racing lanes, depth-encoded
volatility) — explicitly flagged as a real mobile-performance cost (~170KB vs
~21KB gzipped), gate behind a toggle if pursued.

### Token Hover Overlay

🟡 Built (stats + news tabs, 220ms hover-settle, aggressive caching — 1.89s cold
to 0.011s warm across a 173-token pool). Never seen on screen (API-verified only).
Per-token news rarely matches since the underlying feed is general market news
filtered by symbol.

### Leagues

🟡 See known issues #1–4 above (invite-code leak is the standout). Otherwise
solid and low-controversy.

### Badges / Achievements / Progression

🟡 Boosts now work correctly (post-fix). Badges are currently a dead end —
earning one does nothing else. Perks (`freeHitsAvailable`) exist in schema and are
read by the AI Draft Agent, but nothing in the app currently grants one.

**The richest unbuilt design thinking in the whole project lives here** — worth
preserving near-verbatim rather than re-deriving later: a three-layer model with
strict role separation — **Boosts = momentum** (temporary, frequent, earned by
learning), **Perks = power** (consumable, tactical, spent on a specific game),
**Badges = status** (permanent, non-transferable, grant no power of their own).
Load-bearing rule: _badges must never make you stronger_ — the moment a badge
grants a permanent advantage, veterans become mechanically better than new players
for reasons unrelated to skill, and the game gets worse every month it runs. Fix:
badges should _grant_ perks (one-time, consumable) rather than being powerful
themselves — veterans get a moment of advantage, then it's gone, not a permanent
stack. Current badge set is skewed: 5 of 6 require winning, so a player who loses
their first ten games earns nothing — proposed non-win-gated categories:
Participation, Learning (surfacing the already-tracked-but-never-displayed
`researchStreak`), Variety, Rivalry. A perk catalogue was sketched (Free Hit,
Captain ×2-a-pick, Shield floors-a-pick-at-zero, Second Look/swap-in-first-minute),
each mapped to what scoring change it needs — Free Hit needs none and is the
obvious first perk; per-pick weighting is a real change to `calcPickScore`'s
contract, not a new field.

Also proposed: badges as **soulbound** (non-transferable) tokens once any
on-chain badge minting happens — "they're earned, permanent, and
non-transferable, which is exactly what a soulbound token is; if badges were
transferable they'd stop being achievements and become inventory." Pairs cleanly
with the perk model: the badge is permanent and on-chain, the perk it granted is
consumable and off-chain. Proposed build order: (1) grant Free Hit from a badge,
(2) non-win badges, (3) clean up expired/unused boost display, (4) per-pick
weighting in scoring, (5) soulbound minting.

Related backlog ideas, not yet built: a second boost flavor multiplying XP earned
rather than contest score (now unblocked since the boost-scoring fix landed);
generalizing streak-gated perk unlocks beyond just Free Hit.

### Pricing / market data

✅ Migrated off SoSoValue for _price_ data specifically (SoSoValue is retained for
sector-spotlight/news/ETF-flow — nothing else provides those). SoSoValue has no
batch price endpoint at any tier and its finest intraday granularity needs a
whitelisted key, making it unworkable for a 10-minute game. Now: one Binance
`/ticker/24hr` call returns price/24h-change/volume for the whole market in place
of ~30 parallel SoSoValue snapshot calls — this removed the pool-size cap (30 →
173 tokens; Solana-ecosystem tokens like JUP/BONK/WIF/RAY are now draftable).
CoinGecko fills Binance's 4 structural gaps (USDT, STETH, LEO, OKB). Stablecoins
and wrapped-duplicates are now excluded from the draftable pool entirely (the game
scores on price movement — a stablecoin is a guaranteed near-zero pick, and the AI
Draft Agent had actually been choosing one).

A load-bearing correctness fix worth stating as a house principle:
`extractPrice()` returning `0` on any fetch failure used to be silently read by
scoring as "no movement" — a data outage became a legitimate-looking result, which
on a wagered game means a payout decided by an API failure. Fixed: price lookups
now return `{price, at, source} | null`, and **each caller decides deliberately**
— Draft hides the unpriceable token, Race holds the last point rather than drawing
a fake move to zero, and Resolution refuses to score at all when any exit price is
missing, retrying later. Better a contest settles late than settles wrong.

Open, unresolved: a symbol-mapping layer across three id schemes (Binance ticker
symbols, CoinGecko slugs, SoSoValue numeric `currency_id`s) is now genuine ongoing
maintenance burden with no settled design; and a lineup's entry/exit prices can
come from different sources if one degrades mid-contest, which matters
considerably more once real money is attached.

### Auth / session security

✅ **Fixed.** The session-signing scheme was not merely weak but non-functional —
`base64(payload + secret).slice(0,16)` truncates before the secret ever enters the
output, so any secret (real, wrong, or empty) produced an identical signature,
and a full forge-and-accept round trip against the live server was demonstrated.
Now a real HMAC-SHA256 keyed by the secret, compared with `timingSafeEqual`,
verified directly in `src/lib/server/auth.ts` (2026-09-21). Session expiry is now
actually enforced (previously written but never read). A malformed user id now
401s instead of 500ing.

### UI / design system

The current shipped palette (coral `#F78E79` brand, light-only — dark mode fully
removed) is correct per `layout.css`/AGENTS.md. Two now-deleted design docs
(`design-prd.md`, `project-doc.md`) described an earlier orange/dark-mode/5-color
palette that no longer exists — kept on disk as design-process reference (their
structural content — microinteraction inventory, screen-by-screen scope, phasing
priority — isn't palette-dependent) but their color specifics should be treated as
historical, not current.

### Shared-pick exclusion

⬜ Not built, design-only. Two players in the same contest currently can draft the
identical coin. Key architectural insight: today's draft is fully client-local
until a single atomic submit, so enforcing exclusion requires the server to know
about a pick the moment it's made, not five minutes later — a real architecture
change (reserve/release endpoints, a DB unique constraint for concurrency safety
rather than app-level locking, live opponent-takenness polling), not a small
feature. Recommended sequencing: prove the race-condition handling works before
touching the draft page's UI. Unresolved: 1v1 only, or lobbies/tournaments too;
UI treatment for "taken" (greyed-out vs. clickable-with-error).

### Sector Wars / Whale Watch

No material beyond AGENTS.md's existing description — not touched by the redesign
thread, nothing new to report.

---

## 3. Backlog (post-launch-readiness, not blocking the current focus)

- **Binary options mode** (5 coins, yes/no, best 3 of 5) — new idea, not yet in
  any design doc. Flagged during planning as a heavier regulatory category than
  lineup wagering (event-contract/derivatives-adjacent, per the Kalshi/Polymarket
  pattern) — treat as its own compliance track when it comes up, not bundled into
  the Wager Mode escrow work above.
- **Rock-paper-scissors mini-game** for tie-breaking wager/tournament conflicts —
  new idea, not yet in any design doc.
- **Pooled benchmark stake mode** — see Wager Mode above.
- **WebGL/Three.js race view** — superseded by the racing-cars plan in the
  launch tracker (step 9); WebGL stays an option only if the flat track falls short.
- **XP-multiplier boosts** (second boost flavor, multiplies XP earned rather than
  contest score) — unblocked now that the boost-scoring fix has landed.
- **Generalized streak-gated perk unlocks** beyond Free Hit.
- **Helper tokens / purchase flow** — legitimate but consistently deprioritized;
  blocked on there being no purchase flow of any kind yet.
- **Gauntlet anti-cheat via AI** — immature brainstorm, explicitly self-aware it
  doesn't solve the real problem (nothing stops a player using a second device).
  Carry forward as an open question only, not a scoped feature.
- **Scouting perk** (reveal a hint about an opponent's hidden picks) — was
  blocked on Midnight's commit-reveal privacy work. Midnight is dead, so this is
  now blocked indefinitely unless a different privacy mechanism is chosen.

---

## 4. What's intentionally not in this document

- Everything under `docs-project/0g/` and `docs-project/infra/` — 0G-specific
  integration detail and the old multi-repo migration plan. Relevant to the
  planned chain-agnostic rework, not to this consolidation pass.
- Compliance/jurisdiction and KYC/gasless-infrastructure research — tracked as
  their own separate workstreams, not feature status.
- The product pitch/positioning — deliberately deferred to its own session, using
  this document as the accurate feature picture to work from.
