# CoinDraft — Roadmap

Single source of truth for what's done, what's left, and why. Start with the
**Launch tracker** — it's the checklist. Everything below it is reference detail.

Last updated: 2026-10-25 (hackathon entry added).

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
- [x] Removed 0G everywhere (2026-10-30): AI is Groq-only; 0G Storage, the
      on-chain achievement contract + claim flow, and the 0G wallet chains are gone

### ⬜ Left for v1 — in suggested build order

> **Direction changed 2026-10-13: CoinDraft is now a racing game.** You still draft
> 5 coins; the market drives your car around the track. See "Racing direction"
> under Background. Steps 3–11 below are the new plan.

**1. Fix what's broken**

- [x] League invite-code leak — private leagues now 404 for non-members; invite
      code only returned to members (2026-09-27)
- [x] League invite-code collisions — crypto-random codes, retry on a clash
      instead of a raw 500 (2026-09-27)
- [x] Leave / delete a league — members leave, the creator deletes (with a
      confirm step; one transaction) (2026-09-27)
- [x] ~~Result card shows a bot win as a loss~~ — not real in current code: bots
      are real seeded accounts now, so `winnerId` is set correctly
- [x] Pre-rebrand purple in `Toast.svelte` → design tokens (2026-09-27)
- [x] `/api/breakdown` was an open AI proxy — now takes only `contestId` and is
      generated once per result (2026-09-27)
- [x] ~~`nodemailer` not installed~~ — optional by design
- [ ] 🟠 Versus ties always go to player A (`scoreA >= scoreB`) — settle exact
      ties with RPS instead
- [ ] Browser-test the tournament sector fix _(needs you — wallet sign-in)_

**2. Reshape the modes**

- [x] Removed the standalone Multiplayer mode (2026-09-27); tournaments keep the
      lobby plumbing
- [x] Renamed "Single Match" → "Versus" (2026-09-27)
- [ ] Scrimmage supports both draft types — waits on the Binary race mode (step 5)

**3. Race engine — the heart of the game**

- [ ] **One car per player.** Its position = the lineup's combined % move. The 5
      picks are the car's engine — show which pick is pushing or dragging it
- [ ] Overtakes as the market moves: if your lineup is +5% and theirs +2% you're
      ahead; when yours drops, they pass you
- [ ] **Real 3D, low-poly.** Proposed renderer: `@splinetool/runtime` (from your
      isometric track notes); Three.js as the fallback. Prove phone performance
      with one track and 5 cars before committing
- [ ] **Camera views:** isometric is the default; at least one more (chase cam or
      top-down) switchable mid-race
- [ ] Continuous track built from matching segments (Catmull-Rom curves, chunk
      method from your notes)
- [ ] Drama: bumps and sparks on overtakes, cars hitting each other, spin-out on a
      sharp dump, speed burst on a pump, nitro flame for boosts, photo finish
- [ ] **Real-time weather:** the track shows the viewer's local weather and time
      of day (rain, storm, snow, fog, wind, night with headlights). Cosmetic
      only — never affects the race. Coarse location from IP (no popup), weather
      API cached per area, clear-weather fallback; setting for Real / Always
      clear / Pick. Detail in `isometric_track_roadmap.md` §5
- [ ] Tap a car → driver card + which picks are moving it
- [ ] Live commentary ticker ("ETH pulls you into the lead!")
- [ ] Data: `price_samples` for live points + Binance 1-minute klines to fill gaps
      (today a race nobody watches has no history)
- [ ] The current 2D chart on `/game/[id]` stays as the fallback for reduced
      motion and weak devices

**4. Cars & garage**

- [ ] Cars stored in the database first (model, rarity tier, paint, decals,
      owner); ownership can also live on NEAR as NEP-245 tokens, switchable by
      env flag (see step 14)
- [ ] Free starter car for every new player
- [ ] Garage: your cars, choose the one you race, customize paint and decals
- [ ] **Cars are cosmetic.** Speed comes only from the market, plus earned boosts
      and perks — a bought car never makes you faster
- [ ] Rarity tiers (e.g. Common · Rare · Epic · Legendary), used for car staking
- [ ] Car shop: models, limited drops, paint, decals — paid in USDC; some
      commons and paints unlockable with XP

**5. Binary Options as a race mode**

- [ ] Pick any 5 coins, call each up or down; each call is a checkpoint on the
      lap, lighting green or red when it resolves
- [ ] 3 of 5 correct wins; windows 1h / 24h (proposed); flat = wrong (proposed)
- [ ] XP rewards; Scrimmage gets this mode too

**6. Daily Trivia — the XP fuel**

- [ ] 8 questions/day, ~1 minute total; pass at 4/8 → XP; streak only on a pass
- [ ] Question supply for 8/day (live-data templates + vocab pool + static bank)
- [ ] Retire the Gauntlet's single question and its free sector boost

**7. XP, boosts and perks — re-themed for racing**

- [ ] Boosts become **nitro** (the existing ×1.25 on movement, shown as a flame)
- [ ] Perks become **pit-stop upgrades** (Free Hit, Captain and later Shield,
      renamed to fit racing — names open)
- [ ] XP becomes **garage progression**: levels that unlock common cars and paints
- [ ] Inventory; limits — 1 per race or tournament, max 3 per week (set per mode)
- [ ] Performance items are earned with XP or bought for small amounts — never a
      permanent advantage (cars stay cosmetic)

**8. USDC purchases**

- [ ] Wallet sends USDC, server verifies on-chain, item credited (no held balances)
- [ ] Sells: cars, limited editions, paint/decals, nitro and pit-stop items
- [ ] Chains: Base + Solana (proposed) _(needs you)_
- [ ] Purchase history / receipts

**9. Matchmaking + RPS**

- [ ] Queue with preferences: mode, sector, duration, stake; hard match on mode
      and stake; sector/duration may differ; "Any" option
- [x] RPS rules, server and UI built (2026-09-27) — preview `/design/rps`
- [ ] Create the `rps_matches` table (`npm run db:push`) _(needs you)_
- [ ] Replace placeholder hand icons with the design's SVGs _(needs you)_
- [ ] Wire RPS into matchmaking; check the weekly/duration path

**10. Race tournaments, sponsors and track advertising**

- [ ] **Groups of 5**, Champions-League style: players seeded into pots by
      rank/XP, drawn into groups of 5, top finishers advance to a knockout/final
      (today's default group size is 4 → change to 5)
- [ ] **Sponsored tournaments:** a company pays to host one — name, branding,
      prize pool, their livery on the track
- [ ] **Track advertising:** banner and billboard slots on tracks sold to
      advertisers; sponsor branding on their own tournament's track
- [ ] Ad-slot management: book a slot for a period, upload the creative, approve
      before it goes live, report impressions

**11. Car wagering (design left open)**

- [ ] Stake a car; matched against a car of the same rarity tier; the winner
      takes the loser's car. Open: whether bought cars can be staked, and whether
      boosts apply in car-stake races

**12. PWA + push notifications**

- [ ] Manifest, icons, service worker, install prompt (iOS needs "Add to Home
      Screen" for push)
- [ ] Notifications: match found · result in · trivia live / streak at risk ·
      tournament closing / starting — toggles in Me → Settings

**13. Tatum x Walrus "Total Recall": moved to createthings (2026-10-30)**

The Walrus entry is now createthings in Track 02 (Smart Agents for Real Life); its plan lives in `create-things/Project Breakdown.md`. The Walrus keys moved to that project's `.env`. CoinDraft's memory features below (race engineer, credibility, bots that remember you, race chat) stay planned and store their data in Postgres for now; Walrus can come later.

_Original CoinDraft plan, kept for reference:_
_Deadline: 10 Nov 2026, 17:00 UTC. Window opened 20 Oct; only work done since then counts_

Decided 2026-10-29:

- **The demo is the race.** Draft 5 coins, watch your car race on the 3D track
  against bots or players. Memory is what makes the race smarter each time
- **Memory = credibility + race engineer.** Every race logs your picks before the
  start; the result is remembered; your per-sector track record updates ("sharp
  in DeFi, shaky in Meme"); the Draft Agent recalls it before your next draft and
  changes its advice. That is the learning loop the judges reward
- **Bots learn too.** Bot drivers draft from remembered player behaviour, so they
  get harder and more human over time (like other games track how you play)
- **Race for 10 Nov (3D only):** one looping track, isometric camera (+1 more if
  time allows), up to 5 low-poly cars placed by each lineup's live % move,
  overtakes, nitro flame, finish line. Weather, billboards, garage and crash
  effects come after. Three.js for the engine; Spline (and any other tool) for
  car and track models
- **Multiple race lengths** (e.g. 5 / 15 / 60 min on 1-minute prices, plus 24h)
  and **spectating**: anyone can jump into a race in progress and watch it live
- **Players see their memory:** "What the game knows about you" on the profile,
  with a delete button
- **Credibility is public:** "Sharp in DeFi · 71%" on the player card, plus a
  best-callers ranking per sector
- **A real feature**, kept after the hackathon
- **Order:** memory + Tatum 29 Oct–1 Nov → race 2–8 Nov → blog + video 9–10 Nov
- **One app memory account, one namespace per player.** Saves go through a queue
  (hosted limit ≈ 12 saves/min) and are summarised per race, not per click.
  Game data only: the hosted relayer sees plain text

Build:

- [ ] Create the MemWal account + delegate key at memory.walrus.xyz (mainnet)
      _(needs you)_ → `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID` server-side;
      the public delegate key is the form's `MEMWAL_AGENT_ID`
- [ ] `@mysten-incubation/memwal` SDK (not `@walrus/memory`, which does not exist)
- [ ] `walrus_memories` table: local log + outbox queue (type, user, status, job id)
- [ ] `src/lib/server/walrusMemory.ts`: `remember(type, userId, payload)` queues;
      a flusher sends within the rate limit; `recall(userId, query)`
- [ ] 10+ memory types, on routes that exist today:
  - [ ] `race_entry`: lineup + start prices, written before the race (lineup submit)
  - [ ] `race_result`: finish, score, which picks pushed or dragged (resolution)
  - [ ] `credibility`: per-sector hit rate after each result
  - [ ] `agent_advice`: what the Draft Agent suggested and whether you took it
  - [ ] `nitro_used`: boost sector and whether it paid off
  - [ ] `rps_tiebreak`: throws in a tiebreaker (players' habits)
  - [ ] `trivia_result`: Gauntlet today, Trivia once built
  - [ ] `tournament_result`: group / final placing
  - [ ] `league_standing`: after league updates
  - [ ] `badge_earned`: on badge grant
  - [ ] `bot_profile`: the playing style a bot learned
  - [ ] `bot_relationship`: each bot remembers each player (mood: stranger,
        cocky, afraid, grudge, respect); bots tease, show fear or hold a grudge
        on the grid, during overtakes and after the result, and race you
        differently because of it. Me → Rivals list; bot chat On / Quiet / Off
  - [ ] `player_rivalry`: head-to-head between two humans, for race chat.
        Quick-chat lines + emotes over cars, memory-suggested taunts ("That is
        3 in a row"), optional filtered free text, mute / block / report,
        spectators read-only
- [ ] Memory visibly changes the product: Draft Agent cites your history,
      credibility badges on the player card, bots draft from memory
- [ ] Tatum Data API (`src/lib/server/tatumData.ts`): token prices/metadata for
      the draft pool
- [ ] Tatum Sui RPC, used for real: read the MemWal account object on Sui and show
      "your memory lives on-chain here"; Sui tokens in the pool if time allows
- [ ] Verify 10+ memories on mainnet (dashboard check)
- [ ] (Optional) Tatum AI Builder ($500 bonus)
- [ ] Blog post: what the app does, how it uses Tatum + Walrus, how it learned
      over time. Its link goes in the description (no blog field)
- [ ] 2–3 min demo video; X / LinkedIn post (bonus points)

---

**14. NEAR Hackathon (Track 09: Games With Real Economies; also tick Track 10)**
_Building 1–14 Nov 2026; deadline 14 Nov, 23:59 UTC. Only code written since
1 Nov counts. Judged "on the game loop, not the token"; bonus "if players never
notice the chain". Prizes $10K / $3K / $2K per track + $55K grand prize_

Decided 2026-10-29:

- **NEAR owns the economy.** Game memory (bots, rivalries, credibility) lives in
  Postgres; the Walrus entry moved to createthings (step 13)
- **An always-on game:** races keep running; you can join one, race bots or
  humans, or jump in and watch
- **Bots are NPCs:** each bot has a NEAR account, owns cars, enters races, wins
  and loses cars. Every bot decision is remembered (Postgres), so you can see how
  each bot has been performing: its record, its style, its form
- **Bots have personalities and taunt you:** each bot has a name, a racing style
  and a personality. It remembers every player it has raced (mood: stranger,
  cocky, afraid, grudge, respect), taunts on the grid, on overtakes and after the
  result, and races you differently because of it. Players get quick-chat taunts
  and emotes too, with memory-suggested lines ("That is 3 in a row")
- **Cars are NEP-245 tokens on NEAR** (replaces ZetaChain). Car-for-car races
  (same rarity tier, winner takes the car) settled by the contract
- **Chain is switchable:** car ownership sits behind one interface with two
  backends: database-only or NEAR. An env flag picks which, so cars can run
  off-chain if NEAR isn't wanted (or isn't funded)
- **Players never see the chain:** the server creates NEAR accounts in the
  background; no wallet popup to play
- **Testnet for the hackathon**, mainnet at launch
- Dropped from the old plan: wager settlement via NEAR Intents, Chain
  Signatures, NEAR AI backend, FastAuth, badge mirroring

Build (11–14 Nov; the 3D race from 2–8 Nov counts for this entry too):

- [ ] Car ledger interface (`src/lib/server/cars/`): `db` and `near` backends,
      chosen by env flag
- [ ] `contracts/near/`: NEP-245 car contract (mint, transfer, stake-race
      escrow + settle) → deploy to testnet, `NEAR_CONTRACT_ID`
- [ ] Server-managed NEAR accounts for players and bots (`near_account_id` on
      `users`)
- [ ] Bot NPC loop: bots join races on a schedule, stake cars, win/lose them
- [ ] Bot pages: record, style and form from memory; bot leaderboard
- [ ] Bot personalities + per-player relationship memory + taunts (grid,
      overtakes, results); Me → Rivals; bot chat On / Quiet / Off
- [ ] Player quick chat + emotes over cars, memory-suggested taunts; mute/block
- [ ] Car-for-car race: stake → race → contract moves the car
- [ ] README rewritten to match what is built (their AI check compares them)
- [ ] Demo video + X post saying it was built at NEAR HACKATHON; submit by 14 Nov

---

### Future Hackathon & Grant Opportunities (Post-NEAR, Tier 2/3)

**Tier 2 — Apply Immediately After NEAR (leverage same demo/repo):**

| Opportunity                    | Deadline | Track Fit               | Prep Needed                                                  |
| ------------------------------ | -------- | ----------------------- | ------------------------------------------------------------ |
| **Reown AppKit Grants**        | Rolling  | Wallet UX / Multi-chain | ✅ EVM + Solana + NEAR via AppKit — write case study         |
| **SoSoValue Ecosystem Grants** | Unknown  | Data + Consumer         | ✅ 5 endpoints, cached, rate-limit aware — flagship consumer |
| **Walrus / Sui Grants**        | Rolling  | Memory + Gaming         | ✅ Tatum hackathon work = Walrus Memory integration          |

**Tier 3 — Next Cycle (Q1 2027):**

| Hackathon                                | Timeline  | Track Fit                    | CoinDraft Angle                                                     |
| ---------------------------------------- | --------- | ---------------------------- | ------------------------------------------------------------------- |
| **ETHGlobal** (Bangkok/Next)             | Periodic  | Consumer / Gaming / AI       | Racing game + AI agents + NEAR car economy                          |
| **Solana Hyperdrive / Grizzlython**      | ~Q1 2027  | Gaming / DeFi / Consumer     | Native Solana wallet + USDC shop + multi-chain                      |
| **Base Buildathon / Onchain Summer**     | Seasonal  | Consumer / Gaming / Payments | USDC-native economy, Base wallet, "real economies"                  |
| **Chainlink Buildathon**                 | Periodic  | Gaming / Data                | VRF for fair bot drafts, Functions for prices, CCIP for cross-chain |
| **Polygon / Arbitrum / Optimism Grants** | Rolling   | Gaming / Consumer            | Deploy racing contracts + USDC economy on L2                        |
| **NEAR AI Agent Hackathons**             | Periodic  | AI Agents                    | AI Mentor + Draft Agent as verifiable NEAR AI agents                |
| **Gitcoin Grants / QF Rounds**           | Quarterly | Public Goods / Education     | Gauntlet/Trivia = crypto literacy public good                       |

**Double-Dip Strategy:** Submit same repo/demo to **NEAR Track 09 + Reown Grant + Walrus/Sui Grants**. Narrative: _"Market-driven racing game with a NEAR car economy, Walrus Memory learning loop and multi-chain wallet sign-in."_

**15. Before launch**

- [ ] End-to-end test of the full v1 flow _(needs you)_
- [ ] Domain + name decision _(needs you)_
- [ ] Pitch / landing-page copy — now racing-first _(open until then)_
- [ ] Rewrite `AGENTS.md` (badly stale; also wrong that the DB client is
      neon-http — it's node-postgres)
- [ ] Update `README.md` (still framed as a buildathon PRD)

### ⏭️ After launch

- [ ] Real-money wagers + escrow + in-house KYC (planned $25 cap)
- [ ] Paid tournament entry
- [ ] Cars on NEAR mainnet (testnet during the hackathon)
- [ ] More tracks
- [ ] Multiplayer binary race — AI picks 5 coins (one per sector) from cached
      news, 3 rerolls
- [ ] Head-to-head timed trivia
- [ ] Visible online-players / challenge list
- [ ] More pit-stop upgrades; seasons (FPL-style allowances)
- [ ] Chain-agnostic rework (wallet, settlement, AI backend)
- [ ] Emoji reactions mid-race · race replays · shareable race clips · sound and
      phone haptics
- [ ] Backlog ideas in section 3 below

---

## Background

**Racing direction (decided 2026-10-13)** — supersedes the chart-based game below
wherever they conflict.

- **The game:** draft 5 coins exactly as before; your lineup is a car, and the
  market decides its position on a 3D track. Positions swap as prices move.
- **One car per player.** Versus = 2 cars; tournaments run in groups of 5,
  seeded from pots like the Champions League draw.
- **Cars are cosmetic** (looks, rarity, status). Performance comes only from the
  market and from earned or small-purchase boosts/perks.
- **Car wagering:** stake a car against one of the same rarity tier, winner takes
  it — details left open.
- **Ownership:** database or NEAR (NEP-245), switchable by env flag. ZetaChain
  dropped 2026-10-29.
- **Views:** multiple 3D camera views, isometric as the default.
- **Money:** cars, limited editions and customization (USDC); nitro and pit-stop
  items; sponsored tournaments; paid banner and billboard slots on tracks; later,
  stake rake and paid entry.
- **Kept:** draft, trivia (XP fuel), RPS tiebreaker, Versus, Scrimmage, Binary
  (now a race mode), tournaments, PWA.

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
   arbitrarily, and it
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
non-custodial vs. custodial DB-backed). **This is now superseded by the
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

Gasless transactions: possible via ERC-4337, but needs a
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

🟡 Built and live-verified (Groq, same call shape as `/api/breakdown`). Full
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
streaming, Groq-backed.

### Breakdown

✅ Built, Groq-backed. See known issues above for the
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

- Everything under `docs-project/infra/` — the old multi-repo migration plan.
- Compliance/jurisdiction and KYC/gasless-infrastructure research — tracked as
  their own separate workstreams, not feature status.
- The product pitch/positioning — deliberately deferred to its own session, using
  this document as the accurate feature picture to work from.
