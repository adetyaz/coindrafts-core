# CoinDraft — Design PRD (v2)

**For:** the UI designer/implementer (Fable), working directly in this codebase.
**Job:** restyle every screen in the owner's new design direction. The gameplay,
data and flows are built and agreed; this doc tells you what each screen must show,
in which states, and what each control does, so you can redesign freely without
breaking the game.
**Updated:** 2026-11-13, after the build of `ROADMAP.md` step 16 (items 1–14).
**Sources of truth:** gameplay rules → `GAMEPLAY_FLOWS.md` (F1–F12). Scope and
status → `ROADMAP.md`. Where this doc and those disagree, they win.

---

## 0. How to work in this codebase (read first)

**You own:** markup, layout, styling, motion, copy tone, icons, empty/loading/error
presentation, responsive behaviour, and the visual design system.

**Don't change (ask first):**

- Anything under `src/lib/server/` and every `+server.ts` file (APIs, scoring,
  economy, NEAR ledger).
- Game rules in `src/lib/race/items.ts`, `src/lib/race/binary.ts`,
  `src/lib/economy/rules.ts`, `src/lib/sponsors.ts`. The UI reads numbers and labels
  from these; don't hardcode copies of them.
- Request/response shapes your screens use (each screen below names its endpoints).
- `src/lib/components/race/RaceTrack3D.svelte` internals (Three.js scene, race
  maths). Restyle it through its CSS tokens (§3.3), its overlay UI and its container.

**Stack rules (enforced):**

- SvelteKit 2 + **Svelte 5 runes only** (`$state`, `$derived`, `$props`, `$effect`).
  No `$:`. SSR is off app-wide.
- **Tailwind v4** via `@tailwindcss/vite`. The only stylesheet entry is
  `src/routes/layout.css`.
- **Never hardcode a colour in a component.** Every colour is a CSS custom property
  defined once in `layout.css` (raw palette in `:root` → semantic tokens in
  `@theme`). Components use the semantic tokens (`bg-surface`, `text-text-muted`,
  `var(--color-sector-l1)`…). Exceptions are listed in §3.4.
- Links use `resolve()` from `$app/paths` (ESLint enforces it). For a path with a
  query string, wrap the link in the existing eslint-disable/enable comment pattern
  you'll see in `src/routes/garage/+page.svelte`.
- Accessible by default: real `<button>`s and `<label>`s, `aria-pressed` on toggles,
  visible focus, reduced-motion fallbacks (§11).
- Before handing back: `npm run check` and `npm run lint` (some files already carry
  a few old lint errors; don't add new ones). `npm run format` formats.

---

## 1. The product in one minute

CoinDraft is a **racing game driven by the crypto market**. You draft 5 coins; that
lineup is your car's engine, and live prices move your car around a **real
circuit** (Monza, Suzuka, Spa, Interlagos, built from measured track data). If your
coins are up 5% and your rival's are up 2%, you're ahead; when yours dip, they
overtake you, second by second.

- **Sign-in is email or Google only** (Reown). No wallet prompts, no seed phrases.
  The game quietly gives every player a NEAR account.
- **Your first car is free** and it's yours: cars are NEP-245 tokens on NEAR,
  recorded by the game. Cars are cosmetic; speed comes only from the market and
  earned items.
- **Gears** ⚙️ are the in-game currency. Earned by racing; spent in the Showroom, on
  customising and in the Car Market. Gears never come from money.
- **Bots** with personalities race, trade and talk. Each bot remembers you and
  has a mood towards you (stranger, cocky, afraid, grudge, respect).
- **Modes:** Scrimmage (practice vs a bot) · Versus (1v1) · Binary (call 5 coins
  up or down) · Car race (stake a car, winner takes both) · Tournaments (groups of
  5, a final) · League nights (weekly).
- **Daily trivia** (8 questions, ~1 minute) keeps a streak and wins items.
- **Sponsors** can sponsor tournaments and book trackside ads on the real circuits.

**Working pitch:** _"Draft coins. Race them."_

### The core loop

```
Daily trivia ──► XP, streak, items (Nitro, Turbo, Spare Tyre, Shield)
      ▲                              │
      │                              ▼
 Come back tomorrow ◄── Race (Scrimmage · Versus · Binary · Car race · Tournament · League)
                                     │
                                     ├──► Gears ──► Showroom · customise · Car Market
                                     └──► XP, badges, rivals, cars won
```

### Who it's for

1. **Crypto-native traders**: know the coins, want to prove their calls against
   people. Want speed and bragging rights.
2. **Fantasy-sports players**: know draft-and-compete, newer to crypto. Need the
   market made legible.
3. **Gamers who like collecting cars** and a living world (the bots).

---

## 2. Design principles

1. **It's a racing game first.** The race is the screen. Prices explain _why_ a car
   is where it is; they never replace the race.
2. **One decision per screen.** Every screen has one obvious next action.
3. **Always show where you stand:** Gears, active race, streak, from anywhere.
4. **Fast to play.** Opening the app to a locked lineup: under a minute for a
   returning player (the last-used car is pre-selected for this reason).
5. **Honest numbers.** Never fake a score, price or count. Missing data shows as
   "—" or "price unavailable", never 0. Every bot decision has a visible **reason**
   ("Why: …"); keep those visible.
6. **Mobile-first and installable** (PWA coming, §10). Design for one hand first.
7. **The world is alive.** Bots, live prices, "updated just now" markers, the
   Car Market moving: let the UI feel live without being noisy.

---

## 3. Design system

The owner is bringing a **new visual direction**; the current look (light, coral
brand, Archivo + JetBrains Mono, rounded pills, large-radius cards) is a scaffold.
Replace it, but keep the **token architecture** below, because non-component code
reads these tokens.

### 3.1 Where it lives

- `src/routes/layout.css`: raw palette (`:root`) → semantic tokens (`@theme`),
  fonts, font sizes, textures (`dot-grid`, `hero-coral`, `frost-panel`), motion
  classes (`anim-blink`, `anim-float`, …), reduced-motion rules.
- Fonts today: `--font-sans` Archivo, `--font-mono` JetBrains Mono, `--font-rps`
  Barlow Semi Condensed (RPS screen only).

### 3.2 Semantic tokens in use (keep the names; change the values)

| Group      | Tokens                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Surfaces   | `bg`, `page`, `surface`, `surface-alt`, `surface-raised`, `hover`, `border`, `border-strong`                                  |
| Text       | `text`, `text-body`, `text-secondary`, `text-muted`                                                                           |
| Brand      | `primary`, `primary-hover`, `primary-ink`, `primary-muted`                                                                    |
| Status     | `positive`, `positive-ink`, `negative`, `negative-ink`, `warning`, `warning-ink`                                              |
| Sectors    | `sector-l1`, `sector-l2`, `sector-defi`, `sector-meme`, `sector-wildcard` (+ `-ink` each), mapped in `src/lib/sectorTheme.ts` |
| Raw colors | `ink`, `coral`, `mint`, `blue`, `amber`, `sky`, `red` (+ some `-ink`)                                                         |

### 3.3 Tokens read by code (renaming breaks things)

- **3D track** (`RaceTrack3D.svelte` reads them at runtime with `getComputedStyle`):
  `--color-race-road`, `-grass`, `-grass-dark`, `-kerb`, `-line`, `-tree`,
  `-trunk`, `-wheel`, `-flame`, plus `--color-positive` / `--color-negative`
  (binary checkpoint gates). Restyle the track by changing these values.
- **Car paints** (`PAINTS` in `src/lib/economy/rules.ts`): coral, mint, blue, amber,
  sky, red, ink, as `var(--color-…)`. Paint shows on the 3D car and in
  `CarPreview.svelte`.
- **Rarity badges** (`src/lib/economy/rarity.ts`): Common `border-strong`, Rare
  `blue`, Epic `rps-lizard`, Legendary `amber`.
- **RPS screen** (`/design/rps`, dark exception): all `--color-rps-*`.

### 3.4 Allowed hardcoded colours

- `src/lib/server/resultCard.ts` renders a standalone SVG (the share image) and
  duplicates hex values. Keep it in sync with the new palette.
- Sponsor uploads: sponsor artwork/logos and a sponsor's chosen **livery** colour
  are user content, shown as-is.

### 3.5 Current shape language (replace freely)

Cards ~20px radius with a 1px border; pill buttons (primary fill / outline
secondary); mono font for numbers, prices and timers; uppercase micro-labels with
wide tracking; slightly tilted draft cards.

---

## 4. Information architecture

### 4.1 Sitemap (every route that exists)

| Area      | Route                                    | Screen                                                 | Section |
| --------- | ---------------------------------------- | ------------------------------------------------------ | ------- |
| Public    | `/`                                      | Landing                                                | 7.1     |
|           | `/share/[id]`                            | Public result page (server-rendered for link previews) | 7.27    |
| Onboard   | `/welcome` (`?first=1` on first sign-in) | First car, racing name, email → first race             | 7.2     |
| Home      | `/dashboard`                             | Dashboard                                              | 7.3     |
| Race      | `/scrimmage`                             | Practice vs a bot                                      | 7.4     |
|           | `/matchmaking`                           | Versus queue                                           | 7.5     |
|           | `/draft`                                 | Race setup (car → track) + draft + item tray           | 7.6     |
|           | `/binary`                                | Binary: mode → car/track → calls                       | 7.7     |
|           | `/game/[id]`                             | Live 1v1 race (incl. binary)                           | 7.8     |
|           | `/contest/result`                        | 1v1 result                                             | 7.9     |
|           | `/race/[id]`                             | Multi-car race (tournament groups, finals, league)     | 7.10    |
|           | `/car-race`                              | Stake a car                                            | 7.11    |
| Compete   | `/tournament`                            | Tournaments list + create                              | 7.12    |
|           | `/tournament/[id]`                       | Registration → draw → groups → final → podium          | 7.13    |
|           | `/leagues`, `/leagues/[id]`              | Leagues, league page + league night                    | 7.14    |
|           | `/leaderboard`                           | Global XP leaderboard                                  | 7.15    |
| Garage    | `/garage`                                | Cars, customise, history, sell, Showroom, items        | 7.16    |
|           | `/car-market`                            | Car Market (+ bot world, Simulate a week)              | 7.17    |
| People    | `/profile`                               | Me                                                     | 7.18    |
|           | `/players/[id]`                          | Player card / bot card                                 | 7.19    |
| Sponsors  | `/sponsor`                               | Portal + dashboard                                     | 7.20    |
|           | `/sponsor/ads`                           | Book trackside ads                                     | 7.21    |
|           | `/sponsor/tournament`                    | Sponsor a tournament                                   | 7.22    |
|           | `/admin/sponsors`                        | Operator review (admins only)                          | 7.23    |
| Help      | `/guide`                                 | How to play                                            | 7.24    |
| Prototype | `/design/rps`, `/design/pickers`         | RPS screen, design sandbox                             | 7.25    |
| Legacy    | `/lobby/[id]/result`                     | Old lobby result (superseded by `/race/[id]`)          | 7.26    |

### 4.2 Navigation today (`src/lib/components/Nav.svelte`)

Logo · groups **play** (scrimmage, versus, tournament, binary), **garage** (my
garage, car market, car race), **compete** (leaderboard), **help** (how to use) ·
an "active match" pill (continue draft / watch) · Gears · sign-in button / profile.
Leagues, Me and Sponsors are reachable but not in the nav groups yet; fold them in.

### 4.3 Proposed phone navigation (yours to decide)

Bottom tabs: **Home · Race · Garage · Compete · Me**. Race opens the mode picker
(Scrimmage, Versus, Binary, Car race). The active-race pill floats above the tabs.

---

## 5. Shared components (restyle these once, everywhere benefits)

| Component                         | File                                           | Notes                                                                                                                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav                               | `lib/components/Nav.svelte`                    | Also runs sign-in (Reown `appkit-button`), redirects to `/welcome` after sign-in. Keep the auth logic.                                                                                                                                                                        |
| Toast                             | `lib/components/Toast.svelte` + `lib/toast.ts` | success / error / info.                                                                                                                                                                                                                                                       |
| PlayerLink                        | `lib/components/ui/PlayerLink.svelte`          | Any name that opens a player/bot card.                                                                                                                                                                                                                                        |
| CarPreview                        | `lib/components/garage/CarPreview.svelte`      | Side-on SVG car: paint, decal (none / stripe / twin / checker / bolt), number plate. Replace the drawing freely; keep the `look` prop.                                                                                                                                        |
| RaceTrack3D                       | `lib/components/race/RaceTrack3D.svelte`       | Props: `cars` (id, name, color, pct, isMe), `circuit`, `holding` (on the grid), `finished`, `onOvertake`, `onUnsupported` (WebGL missing → show a list view), `checkpoints` (binary gates), `ads` (sponsor slots). Built-in iso / chase camera toggle and car labels overlay. |
| RaceSetup                         | `lib/components/race/RaceSetup.svelte`         | Car step (last-used pre-selected; staked / for-sale cars disabled with reason) → track step (4 real circuit outlines as SVG).                                                                                                                                                 |
| ItemTray                          | `lib/components/race/ItemTray.svelte`          | Owned items, pick one, pick its sector or coin; "x/3 this week".                                                                                                                                                                                                              |
| Trivia                            | `lib/components/Trivia.svelte`                 | The whole daily trivia flow in a card (§7.3).                                                                                                                                                                                                                                 |
| LeagueNight                       | `lib/components/LeagueNight.svelte`            | League night + season panels (§7.14).                                                                                                                                                                                                                                         |
| BotDay                            | `lib/components/BotDay.svelte`                 | "Yesterday in the bot world" (§7.17).                                                                                                                                                                                                                                         |
| ItemShop                          | `lib/components/garage/ItemShop.svelte`        | Buy items for Gears.                                                                                                                                                                                                                                                          |
| SponsorContact                    | `lib/components/SponsorContact.svelte`         | Brand + invoice email, first booking only.                                                                                                                                                                                                                                    |
| StakeCommit                       | `lib/components/StakeCommit.svelte`            | Legacy wager commit banner; leave as is.                                                                                                                                                                                                                                      |
| TokenIcon, TokenHover, Ticker     | `lib/components/…`                             | Coin icon, hover card, scrolling price ticker in the root layout.                                                                                                                                                                                                             |
| Bar, Pill, SectorBadge, StatBlock | `lib/components/ui/…`                          | Small primitives.                                                                                                                                                                                                                                                             |
| Gauntlet, TermOfDay, DraftAgent   | `lib/components/…`                             | Old features: Gauntlet is replaced by Trivia; don't design these.                                                                                                                                                                                                             |

---

## 6. Game rules the UI must express

| Topic       | Rule (show it, don't compute it)                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft       | 5 coins, one per sector: L1, L2, DeFi, Meme, Wildcard. Tournaments can restrict to one sector.                                                                                                                                    |
| On track    | Order = lineup's total % move (items applied). Every second the move acts as an accelerator: a flame shows on a car speeding up.                                                                                                  |
| Race stages | Mode → car → track → draft → (item) → lock → pre-race grid (10 s: driver cards, bot taunt, start lights, Skip) → race → podium → result.                                                                                          |
| Items       | Nitro 🔥 (a sector ×1.25) · Turbo ⚡ (a coin ×2, up or down) · Spare Tyre 🛞 (swap one coin in the first 10% of the race) · Shield 🛡️ (worst coin's loss halved). One per race, 3 races a week. Not in binary or multi-car races. |
| Binary      | Any 5 coins, call each up/down vs the current price. Solo: 3/5 wins. Vs a bot: most correct, then right-by-more, then coin flip. Flat = wrong. Lengths 5 min / 1 h / 24 h. One gate per call on the lap, green/red live.          |
| Gears       | Win 150 / lose 40 (Scrimmage 50 / 10); doubled on weekly races. Showroom and customising burn Gears.                                                                                                                              |
| Cars        | Rarities Common / Rare / Epic / Legendary. Showroom base 300 / 900 / 2,500 / 7,000; Rare 6, Epic 3, Legendary 1 new per week. Sell now = instant sale to a bot at 80% of the going rate. Starter car can't be staked.             |
| Car race    | Stake a car; opponent has the same rarity; winner takes both. Cars are held by the contract during the race. Abandoned (not started within an hour) → cars return.                                                                |
| Tournaments | Closing time = the draw. Pots by XP → groups of 5, bots fill seats. 5-minute draft window, then auto-draft. Winners advance (top 4 / top 2 with 1–2 groups). Final on a different track. Prizes skip bots.                        |
| Leagues     | Weekly league night on the home track (grids of up to 5, open an hour before). Finishing ahead of a member = a win (3 pts). Versus between members counts. Monthly season: champion badge + Gears, table resets.                  |
| Trivia      | 8 questions, 60 s, pass 4/8 → XP + streak. 8/8 → Nitro. Every 7th streak day → a pit-stop item.                                                                                                                                   |
| Bots        | 8 personalities, each with a draft style and trading temper. Mood from your head-to-head. Lines change by mood and moment (grid, overtake, win, loss). Bot chat: On / Quiet / Off.                                                |
| Sponsors    | Ads: billboard ($50/day), banner ($30/day), start/finish arch ($120/day) per circuit. Tournament sponsorship $500 flat. Booking → invoice → operator marks paid → approves → live on its dates.                                   |
| RPS         | Rock-paper-scissors(-lizard-Spock) settles circuit choice in Versus when two players differ. Screen exists as a prototype; not wired yet.                                                                                         |

---

## 7. Screen specs

Each screen: **purpose**, **data** (endpoints it calls), **content**, **states**,
**actions**. All are built and need your restyle unless marked otherwise. File =
`src/routes/<route>/+page.svelte`.

### 7.1 Landing `/`

- **Purpose:** show the game is alive and get a sign-in.
- **Data:** `/api/stats` (players, live races), `/api/tokens`, `/api/landing`
  (`liveRaces`, `hotCoins`), Binance price stream (client).
- **Content:**
  1. **Hero:** headline, pitch, sign-in ("Email or Google. No wallet needed."), and
     a **live 3D demo race**: four bots (each drafting in its own style) on a random
     real circuit, positions from their coins' real moves today. WebGL fallback is a
     standings list.
  2. **Run your game** (inspired by PrizePicks' live boards): "Live · updated Xs
     ago"; swipeable **Racing now** cards (circuit, length, drivers, time left,
     Scrimmage / vs bot tag); **Most drafted today** coin cards (price, 24h change,
     "in N lineups") with sector tabs; falls back to **Biggest movers**.
  3. **Back your takes:** tabs Scrimmage / Versus / Tournaments, each a pitch +
     3 steps + CTA.
  4. Footer: Race / Garage / Learn links, "For sponsors", not-investment-advice line.
- **States:** loading skeletons; quiet track ("Be the first out"); signed-in → "Go
  race".

### 7.2 Onboarding `/welcome`

- **Purpose:** first-car moment, identity, contact, straight into a first race.
- **Data:** `/api/garage`, `/api/me`; `PATCH /api/me` `{ username, email }`;
  `POST /api/contests` (1-minute Scrimmage).
- **First sign-in** (`?first=1`): **car reveal** (model, rarity, "+⚙️ 500 Gears",
  "Recorded on NEAR. You'll never need a wallet") → racing name (3–20 letters,
  numbers, underscores) → email (pre-filled from the Google/email login when
  available) → **Start your first race** / Keep my current name.
- **Returning account without an email:** "A couple of details" (name + email) →
  Save → dashboard.
- **States:** car still minting ("It'll be waiting in your garage"); name taken;
  invalid email.
- **Make the reveal a moment** (this is the first impression).

### 7.3 Dashboard `/dashboard`

- **Purpose:** home: what to do next.
- **Data:** `/api/contests`, `/api/lobby/mine`, `/api/me`, `/api/tokens`,
  `/api/sectors`, `/api/etf`, `/api/news`, `/api/trivia`.
- **Content:** start a race (daily / weekly, Scrimmage), active races and
  tournament/league grids ("Continue draft" / "Watch"), **Trivia card**, market
  context (Sector Wars, Whale Watch ETF flows, news), stats.
- **Trivia card states:** not started (rules + Start) → in progress (question n/8,
  60 s bar, tap locks, right/wrong flash ~0.7 s, auto-advance) → result (score,
  passed/failed, XP, streak, items won, countdown to next set). Streak flame shown
  throughout.

### 7.4 Scrimmage `/scrimmage`

Creates a practice race vs a bot and sends you to `/draft`. Design as a short
explainer + length choice + Start.

### 7.5 Versus queue `/matchmaking`

- **Data:** `/api/matchmaking/join|status|leave`.
- **Content:** length choice → searching (elapsed time, cancel) → matched (opponent
  card) → draft. Waits for a real player; stale after 30 s of no heartbeat.

### 7.6 Draft `/draft` (`?contestId=` or `?lobbyId=`; `&carRace=1`; `&mode=paper`)

- **Data:** `/api/tokens`, `/api/sectors`, `/api/garage`, `/api/items`,
  `POST /api/contest/[id]/lineup` or `/api/lobby/[id]/lineup`.
- **Steps:** **RaceSetup** (car → track; track step skipped in tournaments; car step
  skipped in car races) → **draft board**: 5 sector slots, token pool by sector,
  token hover (price, 24h, sector), sector restriction banner for restricted
  tournaments → **ItemTray** (1v1 only) → **Lock lineup**.
- **States:** pool loading; price unavailable; slot full; lineup incomplete;
  item weekly cap reached; draft closed (race started).
- **After lock:** 1v1 → `/game/[id]`; multi-car → `/race/[id]`.

### 7.7 Binary `/binary`

- **Step 1:** against **The market** ("3 of 5 right wins") or **A bot** ("most
  correct wins") · length 5 min / 1 h / 24 h → Next.
- **Step 2:** RaceSetup (car, track).
- **Step 3:** **Make your calls**: searchable coin grid (symbol, price as "the line
  to beat", 24h change) with ▲ / ▼ toggles per coin; chips of your 5 calls; Lock
  (enabled at 5/5).
- **Data:** `POST /api/contests { mode: 'binary', opponent, durationMinutes }`,
  then the lineup endpoint with `call` on each pick.

### 7.8 Live 1v1 race `/game/[id]` — **key screen**

- **Data:** polls `/api/contest/[id]/live` every 4 s; Binance stream per second.
- **Content:**
  - **3D race** (RaceTrack3D) on the race's circuit, with circuit name, place,
    length and character line. Camera toggle (iso / chase). Car labels.
  - **Pre-race overlay** (10 s): "On the grid", circuit, **driver cards** (name or
    You, BOT tag + tagline, car model + rarity, item, picks with prices, bot mood +
    your record, bot's grid line), **start lights** (3 reds), Skip, then "GO".
  - **Commentary feed:** overtakes, bot taunts ("passes you" / "you pass"),
    Spare Tyre pit stops.
  - **Standings / chart view** (fallback and alternative): each pick's live %, totals.
  - **Spare Tyre panel** (when owned, first 10%): "Pit lane open · Ns left", pick a
    coin out, pick a same-sector coin in.
  - **Binary:** 5 checkpoint gates on track (green/red live); chips "SOL ▲ ✓".
  - **Podium** at the finish, then auto-redirect to the result after ~7 s.
  - Bot chat setting (On / Quiet / Off) affects taunts.
- **States:** waiting for opponent to lock; holding on grid; racing; finished;
  WebGL unsupported → chart view; prices delayed.

### 7.9 1v1 result `/contest/result?contestId=`

- **Data:** `/api/contest/[id]/result`, `/api/breakdown` (AI 2–3 sentence analysis).
- **Content:** YOU WON / YOU LOST, scores, XP and Gears, head-to-head record vs
  this opponent, **bot reaction line**, **item used** (e.g. "🔥 Nitro on DEFI",
  "swapped X for Y"), **car race outcome** ("You won their Rare Falcon" / "Your Rare
  Falcon leaves your garage"), **binary calls** (✓/✗ per coin with entry → exit,
  "flat counts as wrong"), pick breakdown by sector vs opponent, AI breakdown,
  **Rematch**, share (→ `/share/[id]`), new badges toast.
- **States:** still racing ("result in Ns"); prices unavailable (retry shortly);
  AI breakdown unavailable.

### 7.10 Multi-car race `/race/[id]`

- **Data:** polls `/api/lobby/[id]/live`.
- **States & content:**
  - **Drafting:** "x of 5 locked in", auto-draft countdown, driver list (BOT tags,
    Locked in / Drafting…), **Draft your lineup** for you.
  - **Grid:** overlay with all drivers (car, item), start lights, Skip.
  - **Racing:** 3D race (5 cars; sponsored tournaments use the sponsor's **livery**
    colour), clock, live standings (rank, name → card, BOT, car, item, picks, %).
  - **Finished:** "Chequered flag", final ranks.
  - Label: "League night" / "Final" / "Group race"; back link to the tournament or
    league.

### 7.11 Car race `/car-race`

- **Data:** `GET/POST /api/car-race`.
- **Content:** "Race for pink slips" → **1 · Car to stake** (cards with CarPreview,
  rarity; disabled with reason: starter car, for sale, already staked) → **2 · Race
  length** (5–60 min) → **Stake my X** → **warning panel**: "Winner takes both
  cars. If you lose, your Rare Falcon leaves your garage for good…" → "I
  understand, race for it" / Back.
- **States:** no stakeable car (link to Showroom / Car Market); no opponent with
  that rarity right now.
- **Make the warning unmissable but not scary-ugly.**

### 7.12 Tournaments `/tournament`

- **Data:** `/api/tournament`, `POST /api/tournaments`, `POST /api/tournament/[id]/join`.
- **Content:** sections **Yours** · **Cups** (Daily Monza Cup, Weekend Spa Classic,
  created by the game) · **Open tournaments**. Card: name, CUP tag, "Draw in 2h 14m",
  group track → final track, race length, prizes "⚙️ 1,000 / 400 / 200", car prize,
  drivers, entry fee or free, sector restriction, Join / View / You're in.
- **Create form:** name, public / invite-link only, race length, group track, final
  track (must differ), sectors, registration closes (= draw), entry fee (pot
  50/30/20 to top 3 humans). Note: game prizes pay with 4+ entrants.
- Invite links land here (`?id=&invite=`) and auto-join.

### 7.13 Tournament `/tournament/[id]` — **the draw is a shareable moment**

- **Data:** polls `/api/tournament/[id]` every 5 s.
- **Header:** status, name, tracks, length, sector rule, prizes, car prize, sponsor
  prize, entry fee and pot, **"Presented by" + sponsor logo** (if sponsored), Share.
- **Your next step banner:** "You're in Group B" · Draft now (with countdown) /
  Locked in / Watch / Standings.
- **Open:** big countdown to the draw, Join, creator actions (Draw now, Invite link),
  registered drivers with XP, explainer of pots.
- **The draw:** groups (A, B, …) each with 5 seats: name → card, BOT tag ("fills a
  seat"), **Pot n**, rank once raced. Seats **animate in pot by pot** the first time
  someone sees a fresh draw (≤10 min old). Summary: "3 pots · 2 groups of 5 · top 2
  advance".
- **Final:** seats on the final track, Watch / Standings.
- **Podium:** 🥇🥈🥉 humans only, Gears won, car prize.
- **Cancelled:** "Nobody joined… entry fees refunded."

### 7.14 Leagues `/leagues`, `/leagues/[id]`

- **List data:** `/api/leagues`; create `POST /api/leagues` (name, public / private
  code, **home track**, **league night** day + lights-out hour in local time);
  join by code.
- **League page data:** `/api/leagues/[id]`.
- **Content:** name, members, home track · **standings** (W / L / Pts; names → cards)
  · **League night panel**: next night + countdown + home track ("grids open an hour
  before") / tonight's grid (Draft now / Watch / Results) / skipped note · grid list
  · **Season panel**: ends in, prize, past champions (🏆 name · points · ⚙️) ·
  invite code (private) · leave / delete.

### 7.15 Leaderboard `/leaderboard`

Top 50 by XP: rank, name (→ card), streak, XP; your row highlighted. Podium layout
for the top 3.

### 7.16 Garage `/garage`

- **Data:** `GET/POST /api/garage`, `/api/garage/history`, `/api/market`,
  `/api/items`.
- **Content:**
  - Header: Gears.
  - **Car grid** (last-used first, "Last used" tag): CarPreview, model, rarity,
    races / wins, status (Available · Staked in a race · For sale · ⚙️ X).
    Actions: **Customise**, **History**, **Sell** (price, pre-filled with the going
    rate), **Sell now · ⚙️ X** (confirm with the reason "80% of the going rate,
    paid right away"), Take off sale.
  - **Customise** panel: paint swatches (⚙️ 120), decals (⚙️ 180), number plate
    (2–7 letters/numbers, ⚙️ 250), live preview, "Apply for ⚙️ X" (charges only
    what changes; "Gears spent here are gone for good").
  - **History** panel: "Given to X as a starter car", "Bought new from the
    Showroom", "X bought it from Y for ⚙️ 450", "won it in a car race", "staked
    it", "Won as a tournament prize" + dates.
  - **Showroom:** 4 tiers: price, "N left this week" / "Always in stock", model
    picker, Buy new / Sold out / Not enough Gears.
  - **Items shop:** Nitro, Turbo, Spare Tyre, Shield: icon, what it does, owned,
    Buy · ⚙️ price; "x/3 used this week".
  - **NEAR panel:** account (explorer link), "You never need to sign or pay gas",
    garage contract link.
- **States:** signed out; empty garage; starter kit pending.

### 7.17 Car Market `/car-market`

- **Data:** `/api/market` (GET; POST buy/list/cancel), `/api/bot-days`,
  `/api/simulate`.
- **Content:** **going rate per tier** with trend and reason ("6 Rares for sale · 2
  sold today") · **listings** (car, seller, BOT tag, price, "Why:" reason, Buy) ·
  **recent sales** with buyers' reasons · **Yesterday in the bot world** (races,
  cars won, Showroom buys, trades; expandable) · **Simulate a week** (day-by-day
  replay with races, trades and prices; cooldown).

### 7.18 Me `/profile`

- **Data:** `/api/me/profile`, `/api/badges`, `PATCH /api/me`,
  `/api/challenges/[id]`, `/api/auth/logout`.
- **Content:** editable racing name · showcased car (CarPreview) · "See your card as
  others do" · stats: races, wins, podiums, best sector (+avg %) · **Challenges**
  (incoming: Accept / Decline; accepted: Draft →) · **Showcased car** picker ·
  **Badges** (pick up to 3 to show) · **Rivals** (each bot: mood + your record;
  humans you race most) · links Garage, NEAR account · **Settings**: email, bot
  chat (On / Quiet / Off), notifications, reduce motion, sign out.

### 7.19 Player card / bot card `/players/[id]`

- **Data:** `/api/players/[id]`, `POST /api/challenges`.
- **Player:** name, XP, showcased car, races / wins / podiums / best sector, shown
  badges, **you vs them** record, **Challenge** (length 5 min–24 h + a line;
  "They have 24 hours to accept").
- **Bot:** + BOT tag, tagline, **mood towards you**, **How it races** (draft style;
  "asks 110% of the going rate, pays up to 120%"), **garage + Gears**, **recent Car
  Market moves** with "Why:" reasons, Race a bot.
- Opened from any name (leaderboard, league table, race standings, tournament seats,
  Me rivals).

### 7.20 Sponsor portal `/sponsor`

Two big doors (**Sponsor a tournament** $500 flat · **Book trackside ads** from
$30/day) · operator link (admins) · **dashboard**: active & upcoming, past; each
booking: what (slot + circuit or tournament title), dates, status ("Invoice sent ·
awaiting payment" / "Paid · awaiting approval" / Approved / Live now / Not
approved), views (ads), invoice amount + paid/unpaid, operator note, View
tournament.

### 7.21 Book trackside ads `/sponsor/ads`

Circuit chips · **circuit map** (real outline) with 3 slot markers + slot cards
(billboard / banner / arch, price per day, blurb) · dates (booked ranges listed,
overlap blocked) · artwork upload (aspect hint per slot; resized in the browser) ·
brand + invoice email (first time) · **live 3D preview** with the artwork on the
track · quote (days × rate) · Request booking.

### 7.22 Sponsor a tournament `/sponsor/tournament`

Name · draw date / end date · prize in words ("on top of the game's Gears prizes;
you deliver it") · logo upload · livery colour · brand + email · **preview**
(tournament header with "Presented by" + a car in the livery) · flat fee · Request
sponsorship.

### 7.23 Operator review `/admin/sponsors`

Admin-only (others see "Not found"). Each booking: sponsor, what, dates, price,
email, prize, livery swatch, status, views, artwork thumbnail, note field, **Mark
paid** → **Approve** / **Reject**. Functional; low design priority.

### 7.24 Guide `/guide`

How to play. Content is outdated (pre-racing); rewrite around §6 when you restyle.

### 7.25 Prototypes `/design/rps`, `/design/pickers`

RPS (rock-paper-scissors-lizard-Spock) screen with its own dark tokens; not wired
into Versus yet. Pickers is a sandbox. Low priority.

### 7.26 Legacy `/lobby/[id]/result`

Superseded by `/race/[id]`. Don't design.

### 7.27 Public result `/share/[id]?u=` and result card `/api/contest/[id]/card`

Server-rendered HTML for link previews and a 1200×630 SVG card
(`src/lib/server/resultCard.ts`, hex colours by necessity). Restyle to match the
new brand.

---

## 8. Micro-interactions

| Moment                | Interaction                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| First car reveal      | The car arrives (drive-in / unveil), rarity colour burst, Gears count up    |
| Coin into a slot      | Card flies from the pool into the slot; slot glows in its sector colour     |
| Item chosen           | Item drops into the car's tray; target (sector/coin) highlights             |
| Lineup locked         | Slots stamp "LOCKED"                                                        |
| Start lights          | Three reds one per second, then out → "GO"                                  |
| Overtake              | Spark burst on track (built) + commentary line                              |
| Binary gate flips     | Gate colour change; chip ✓/✗ flips                                          |
| Pit stop (Spare Tyre) | Quick pit animation on the swapped chip                                     |
| Finish / podium       | Chequered sweep; podium rises; confetti on a win                            |
| The draw              | Seats drop into groups pot by pot (built, CSS); make it feel like a TV draw |
| Trivia answer         | Instant green/red, auto-advance after ~0.7 s                                |
| Streak extended       | Flame grows; number bumps                                                   |
| Car won / lost        | Car slides into / out of the garage                                         |
| Purchase / customise  | Item drops into inventory; paint washes over the car preview                |
| Bot taunt             | Speech bubble from the bot's car/card; respects bot chat setting            |
| Error                 | Gentle shake on the failed control + message                                |

---

## 9. Content & copy

- Short, confident, playful: "You take the lead", not "Your aggregate score exceeds…".
- Numbers signed and coloured: `+3.42%` positive, `−1.10%` negative; never colour
  alone (signs, arrows, words too).
- Currency is always **⚙️ Gears** in-game; sponsor prices are USD. Never mix.
- Bots speak in their own voice (lines live in `src/lib/bots/personalities.ts`).
- Reasons are part of the product: keep "Why: …" lines and rule explanations.
- First use of a term (L2, DeFi, Sell now, pot) gets a short tooltip.
- Not investment advice: keep the footer line.

---

## 10. Responsive & PWA

- Phone (<640px) first, tablet, desktop (≥1024px).
- The 3D race must work on a phone: full-bleed track, overlays as bottom sheets,
  standings collapsible.
- **Installable (built):** manifest, icons in `static/icons` (rendered from the
  app-icon logo by `scripts/make-icons.mjs`; re-run it if the logo changes), service
  worker `src/service-worker.ts`. **Install prompt** (`lib/components/InstallPrompt.svelte`)
  shows on the result screen after a finished race: Chrome's install button, or the
  iPhone steps (Share → Add to Home Screen). Restyle it.
- **Notifications (built):** Me → Settings → `NotificationSettings.svelte`: turn on
  for this device (states: on, off, blocked, unsupported, iPhone needs install
  first), one toggle per kind (match/result, trivia, tournament, league night,
  challenges, car sold), quiet hours (local, default 22:00–08:00). The OS shows the
  notification itself (title, body, app icon); tapping opens the right screen.
- Installed mode has no browser chrome: every screen needs its own back affordance;
  respect safe areas (`viewport-fit=cover` is set).
- App icon and splash: logo assets in `src/lib/assets/images`.

---

## 11. Accessibility

- WCAG AA contrast on every surface (check text on brand and sector colours).
- Colour is never the only signal (win/loss in words; up/down with signs and
  arrows; binary ✓/✗ plus colour).
- Keyboard: every control reachable with visible focus; toggles use `aria-pressed`;
  tabs use `role="tablist"`/`tab`.
- Timers don't auto-advance faster than people can read; the trivia timer is
  visible and also numeric.
- Reduced motion: the OS setting and **Me → Settings → Reduce motion** (sets
  `data-reduced-motion` on `<html>`; `layout.css` neutralises animation). Provide
  calm versions of the race camera, draw, confetti and count-ups.

---

## 12. Not built / out of scope for this pass

- Binary vs other humans and binary tournaments (binary is solo or vs a bot).
- Items in multi-car races (tournaments, leagues).
- Matching car races against waiting humans (car races are vs bots).
- RPS wired into Versus.
- Real payments for sponsors (invoice flow only).
- Names on the 1v1 result and pre-race grid aren't links to cards yet (add when you
  restyle; use `PlayerLink`).

## 13. Open decisions

| Decision                              | Status                                                     |
| ------------------------------------- | ---------------------------------------------------------- |
| Visual direction                      | **Owner's new design system: apply it through the tokens** |
| Product name & domain                 | "CoinDraft" working name                                   |
| Pitch line                            | "Draft coins. Race them." working                          |
| Phone navigation                      | Proposed bottom tabs (§4.3); yours to decide               |
| Sponsor payment provider              | Not chosen; invoice flow for now                           |
| RPS variant (classic vs Lizard-Spock) | Lizard-Spock prototype exists                              |
| Guide content                         | Needs a rewrite around the racing game                     |
