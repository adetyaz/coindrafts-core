# CoinDraft — Design PRD (v1)

**For:** whoever designs the UI (a designer or an AI design tool).
**Goal:** everything needed to design every v1 screen — what the product is, who it's
for, the design system, the screen map, each flow step by step, and each screen's
content, states and interactions.
**Status of the product:** live as a web app, being reshaped for a public launch. Some
screens exist and need a redesign; others are new. Each screen below is tagged
**[exists]**, **[redesign]** or **[new]**.
**Source of truth for scope:** `ROADMAP.md` (launch tracker). If this doc and the
roadmap disagree, the roadmap wins.

---

## 1. The product in one minute

CoinDraft is a **racing game driven by the crypto market** (direction set
2026-10-13). You draft 5 coins; that lineup becomes your car's engine, and live
prices decide where your car is on the track. If your lineup is up 5% and your
rival's is up 2%, you're ahead. If yours drops, they overtake you.

- **Draft** 5 coins (one per sector) → race your car against other players.
- **Binary race:** call 5 coins up or down; each call is a checkpoint on the lap.
  Get 3 right to win.
- **One car per player.** Versus is 2 cars; tournaments run in groups of 5.
- **Cars are cosmetic** (models, rarity, paint, decals). Speed comes only from
  the market, plus earned **nitro** (boosts) and **pit-stop upgrades** (perks).
- When two players want different race settings, a quick **rock-paper-scissors**
  round decides whose settings apply.
- A **daily trivia** set earns XP; XP levels up your garage and buys nitro and
  pit-stop items.
- **Money:** cars, limited editions and customization (USDC), nitro and pit-stop
  items, sponsored tournaments, and paid billboards and banners on the tracks.

**Working pitch (not final):** _"Draft 5 coins. The market drives your car."_

### The core loop

```
Daily trivia ──► XP ──► Garage levels, nitro, pit-stop items
      ▲                            │
      │                            ▼
 Come back tomorrow ◄── Race (Versus / Binary / Tournament) ──► Win XP, cars, rank
                                   │
                                   └──► Customize & collect cars (shop)
```

### Who it's for

1. **Crypto-native traders** — know the coins, want to prove their calls against
   other people. Want speed, stakes, bragging rights.
2. **Fantasy-sports players** (DraftKings/FanDuel crowd) — know the draft-and-compete
   format, newer to crypto. Need the market made legible.
3. Newcomers are welcome but not the design target.

Everyone signs in with a **crypto wallet** (EVM or Solana) — there is no email or
password anywhere.

---

## 2. Design principles

1. **It's a racing game first.** The race is the screen. Prices explain _why_ a
   car is where it is; they never replace the race. No candlestick charts.
2. **One decision per screen.** Every screen has one obvious next action.
3. **Always show where you stand.** Your XP, your active match, your streak — visible
   from anywhere.
4. **Fast to play.** From opening the app to a locked lineup should take under a
   minute for a returning player.
5. **Honest numbers.** Never fake a score or a price. If data is missing, say so
   ("price unavailable") rather than showing 0.
6. **Mobile-first, installable.** It's a PWA — design for a phone held in one hand
   first, then scale up to desktop.
7. **Respect reduced motion.** Every animation has a calm fallback.

---

## 3. Design system (existing — extend, don't replace)

All colors are tokens defined once in `src/routes/layout.css`. Components never
hardcode hex values.

### Color — app (light theme only; dark mode was removed)

| Token                       | Hex                                   | Use                                        |
| --------------------------- | ------------------------------------- | ------------------------------------------ |
| ink                         | `#1A2421`                             | primary text, dark buttons                 |
| page                        | `#F5FAFA`                             | page background                            |
| surface                     | `#FFFFFF`                             | cards                                      |
| surface-alt                 | `#EDF3F2`                             | subtle fills, empty states, inactive pills |
| border / border-strong      | `#E1E8E6` / `#CFDCD8`                 | dividers, card borders, dashed empty slots |
| text-muted / text-body      | `#5C6B66` / `#3B4A45`                 | secondary text                             |
| **coral (brand / primary)** | `#F78E79` (ink `#B04A32`)             | primary buttons, brand moments, wins       |
| mint (positive)             | `#68C2A8` (ink `#1F7A63`)             | price up, success                          |
| red (negative)              | `#E87070` (ink `#B23A3A`)             | price down, errors                         |
| amber (warning)             | `#F7C978` (ink `#8A5B12`)             | boosts, warnings                           |
| blue / sky                  | `#5FA8D8` / `#81BBE3` (ink `#2A6E96`) | info, L2, Wildcard                         |

### Sector colors (the 5 draft slots)

| Sector   | Color | Note                                 |
| -------- | ----- | ------------------------------------ |
| L1       | mint  |                                      |
| L2       | blue  |                                      |
| DeFi     | amber |                                      |
| Meme     | coral | intentionally shares the brand color |
| Wildcard | sky   | accepts any coin                     |

### Color — rock-paper-scissors screen (dark exception)

RPS is a dark, full-screen moment with its own palette (from the supplied design):
navy radial background `#1F3756 → #141539`, outline `#606E85`, discs `#E1E4ED`, and
one color per shape — scissors amber `#ECA922`, paper blue `#5671F5`, rock red
`#DD405D`, lizard purple `#8C5DE5`, spock cyan `#52BED1` (each with a darker shade for
the disc's 3D edge).

### Typography

- **Archivo** — all UI text (400–900). Headlines are heavy (800–900) with tight
  negative tracking (≈ −0.04em).
- **JetBrains Mono** — numbers that change: prices, %, scores, timers, XP.
- **Barlow Semi Condensed** — RPS screen only (600/700, uppercase).
- Scale: display 40px (hero numbers, win/loss) · title 24px · body 14px ·
  caption 12px · micro 11px uppercase eyebrow labels with wide tracking (0.12em).

### Shape & surface language (already in the app)

- Cards: large radius (~20px), white, 1px border, soft shadow.
- Buttons: fully rounded pills. Primary = coral fill + ink text. Secondary = outline.
- Draft slot cards are slightly **tilted** (±1–2°) like trading cards on a table.
- Textures: `dot-grid` (dotted background), `hero-coral` (coral panel with glow),
  `frost-panel` (frosted glass).
- Existing motion classes: blink, bounce, float, marquee, pulse, rise.

### Motion principles

- Spring-like, quick (150–300ms) for UI; longer, celebratory motion only for
  wins, finishes and unlocks.
- Motion explains state change (a card flies into a slot; a car overtakes).
- `prefers-reduced-motion` → swap movement for fades or instant changes.

---

## 4. Information architecture

### Sitemap (v1)

```
/                     Landing (signed out)
/dashboard            Dashboard hub (signed in) — sections:
                        Overview · My Games · Market · Compete   [redesign]
/trivia               Daily trivia                      [new]
/matchmaking          Versus setup + queue               [redesign]
/rps/:id              Rock-paper-scissors tiebreaker     [new]
/scrimmage            Practice vs bot                    [exists]
/binary               Binary Options setup + calls       [new]
/draft                Draft 5 coins                      [redesign]
/game/:id             Live 3D race (isometric default)   [redesign — key screen]
/contest/result       Versus / Scrimmage / Binary result [redesign]
/tournament           Tournaments: list, create, detail  [redesign]
/lobby/:id/result     Tournament group result            [exists]
/garage               Your cars: pick, customize, levels [new]
/shop                 Cars, cosmetics, nitro & pit-stop items + inventory [new]
/sponsor              Sponsor a tournament / book track ads   [new]
/profile              Me: your profile, customization, settings [redesign]
/profile/:id          Public player card (anyone's profile)     [new]
/leaderboard          Global XP ranking                  [exists]
/leagues, /leagues/:id  Friend leagues                   [exists]
/guide                How to play                        [exists]
/share/:id            Public result page (for links)     [exists]
```

Removed — do not design: AI Mentor, Knowledge Base / Research Hub, Documentation
page, standalone Multiplayer lobbies.

### Navigation

- **Phone (primary):** bottom tab bar with 5 tabs — **Dashboard · Play · Trivia ·
  Shop · Me**. "Play" opens a mode picker (Versus, Binary Options, Tournaments,
  Scrimmage).
- **Desktop:** top bar with the same destinations.
- **Always visible:** XP balance chip; **active match pill** ("Your match is live —
  2:14 left" → taps through to the game); trivia streak flame when today's set is
  still open.
- **Second-level navigation inside the Dashboard:** a segmented control (phone,
  swipeable) or tabs/left sidebar (desktop) for its four sections — see §8.2.
- Leaderboard and Leagues live in **Dashboard → Compete**.

### Where things live — one home per piece of information

| Question the user has                         | Lives in                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| What needs me right now?                      | Dashboard → Overview                                                     |
| What games am I in / did I play?              | Dashboard → My Games (the only game list in the app)                     |
| What's the market doing before I draft?       | Dashboard → Market                                                       |
| How am I ranking? My leagues and tournaments? | Dashboard → Compete                                                      |
| Who am I as a player (stats, badges)?         | Me (and the public player card others see)                               |
| How do I want the app to behave?              | Me → Settings                                                            |
| What cars do I own? Which one am I racing?    | Garage (reachable from Me and from the pre-race screen)                  |
| What can I buy / what items do I own?         | Shop (Store · Inventory)                                                 |
| How do I sponsor a race or advertise?         | Sponsor portal (`/sponsor`), linked from the footer and tournament pages |

Nothing is duplicated: Me shows a summary like "142 games · 58% wins" that links
into Dashboard → My Games rather than repeating the list.

---

## 5. Global components

| Component                          | Notes                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wallet connect button**          | Signed out: "Connect wallet". Opens the wallet picker (EVM + Solana), then a "Sign to verify" step (no gas, no funds moved — say so). Signed in: avatar + short address.   |
| **XP chip**                        | Live XP balance; ticks up with a small count-up animation when XP is earned.                                                                                               |
| **Active match pill**              | Appears whenever you're in a queue, RPS round, draft or live game. Shows mode + time left. One tap back in.                                                                |
| **Token card**                     | Coin logo, symbol, name, price (mono), 24h change pill (mint/red), volume. Tapping or hovering opens Token Stats (stats + news tabs).                                      |
| **Sector badge / slot card**       | Sector color band, "L1 sector" label, empty state = dashed border + "+". Filled = coin logo in a glowing sector-colored circle.                                            |
| **Countdown timer**                | Mono digits, blinking dot. Turns red under 10s.                                                                                                                            |
| **Toasts**                         | Bottom-right (desktop) / top (phone). Info, success, error.                                                                                                                |
| **Modal / bottom sheet**           | Desktop modal; phone bottom sheet.                                                                                                                                         |
| **Empty / loading / error states** | Skeleton shimmer for loading; friendly one-line empty states with one action; errors say what failed and offer Retry.                                                      |
| **Install prompt**                 | See §8.13.                                                                                                                                                                 |
| **Notification permission prompt** | Asked in context (after first queue), never on first load.                                                                                                                 |
| **Car card**                       | 3D/rendered car thumbnail, model name, rarity badge (Common · Rare · Epic · Legendary), paint swatch. States: owned, equipped, locked (level/price), limited (count left). |
| **Driver chip**                    | Player avatar + name + small car icon in their car's paint color — used on the track, leaderboards, groups and results so a car always maps to a person.                   |

---

## 6. Game rules the UI must express

- **Coin draft:** 5 picks, one per sector (L1, L2, DeFi, Meme, Wildcard). Score =
  each coin's % move over the window, added up. A boosted sector multiplies that
  coin's movement by **×1.25** (it amplifies losses too).
- **Race position:** one car per player. The car's place on the track is the
  lineup's combined % move — higher score = further ahead. Positions update live
  as prices move; the order at the window's end is the result.
- **Cars are cosmetic:** a car's model, rarity, paint or price never changes its
  speed. Only the market, nitro (boost) and pit-stop items (perks) do.
- **Car staking (rules still open):** stake a car against one of the same rarity
  tier; the winner takes the loser's car. Design the flow, but mark it "rules TBC".
- **Tournaments:** groups of 5, seeded from pots (by rank/XP) like a Champions
  League draw; top finishers advance to the final.
- **Durations (Versus):** 10 min · 20 min · 45 min · 3 hours · 24 hours (default) ·
  7 days.
- **Stake tiers (XP wagers):** 0 (no stake) · 25 · 50 · 100 · 250 XP. Tiers you can't
  afford are greyed out. Both players privately pick how much to raise; the match
  settles at the **lower** of the two, and neither sees the other's number first.
- **Binary Options (proposed values, pending confirmation):** pick any 5 coins, call
  each UP or DOWN, windows of 1h or 24h. 3+ correct = win. A coin that ends exactly
  flat counts as wrong. XP: 100 for 3/5, +25 per extra correct; 20 for playing.
- **Rock-paper-scissors:** best of 3, 10 seconds per throw, a random throw if you run
  out of time, ties replay. Default variant adds Lizard & Spock (5 shapes, fewer
  ties); classic 3-shape also supported.
- **Nitro (boosts) & pit-stop items (perks):** one per race or tournament, max 3 per
  week. Earned with XP or bought for small amounts. Final names open — design with
  racing names (e.g. Nitro, Spare Tyre = Free Hit, Turbo = Captain).
- **Garage levels:** XP raises your garage level, which unlocks common cars and
  paints.
- **Trivia:** 8 questions per day, about one minute total. 4/8 to pass and earn XP;
  only a pass extends your streak.
- **XP rewards (existing):** Versus win 250, loss 60.

---

## 7. Flows

Each flow lists screens in order. Decision points are marked ◆.

### F1 — First visit → signed in

1. **Landing** — hero, live ticker, "how it works" in three steps, sector showcase,
   CTA "Connect wallet to play".
2. Wallet picker → choose wallet → **Sign to verify** (explain: free, no gas).
3. ◆ Signature rejected → inline error, "Try again".
4. **Dashboard → Overview** — first-run state: "Start with today's trivia" or "Play
   a practice match" (Scrimmage), a prompt to pick a display name and avatar (can
   skip), plus install prompt nudge after the first game.

### F2 — Daily trivia

1. Dashboard → Overview card (or the Trivia tab) "Today's trivia — 8 questions,
   1 minute" (shows streak 🔥 count).
2. **Trivia intro** — rules in one line, "Start" (timer starts on tap).
3. **Question screen** ×8 — question, 4 answers, overall timer bar, progress dots.
   Tap = locked instantly, quick right/wrong flash, auto-advance.
4. ◆ Timer runs out → remaining questions count as wrong.
5. **Trivia result** — score X/8, pass/fail, XP earned (count-up), streak updated
   (flame grows or resets), "Spend XP in the shop" / "Play a match".
6. ◆ Already played today → card shows result + countdown to the next set.

### F3 — Versus (1v1) with preferences and RPS

1. Play → **Versus setup**: choose **mode** (Coin draft / Binary), **sector** (or
   Any), **duration** (or Any), **wager** (No stake / stake tier). Pre-filled from
   your play defaults (Me → Customization), so a returning player can just tap
   "Find match". Summary line: "You'll be matched with someone who wants the same
   mode and stake."
2. **Queue** — searching animation, your settings shown, elapsed time, "Cancel".
   After 20s with nobody: "Try Scrimmage instead" (search keeps running).
   Ask for notification permission here: "Get notified when a match is found?"
3. **Match found** (push notification if the app is in the background) — opponent
   name/avatar, side-by-side settings; differences highlighted.
4. ◆ Settings identical (or "Any" resolves them) → skip to step 6.
5. **RPS tiebreaker** — best of 3 (see §8.4). Winner's settings apply. Result screen
   says "Your terms apply" / "Their terms apply" → Continue.
6. **Draft** (or Binary calls) with a lock timer.
7. ◆ Stake match → **blind raise** step before lock: optional raise, "Settles at the
   lower figure — they won't see yours."
8. **Live race** until the window ends (can leave and come back via the active match
   pill; push notification "Result is in").
9. **Result** → Share result · Rematch · Play again.

### F4 — Scrimmage (practice)

1. Play → Scrimmage → choose coin draft or binary, duration.
2. Draft against a bot (bot drafts a real lineup) — "Practice — doesn't affect your
   rank" label everywhere.
3. Race → result (practice XP only). AI Draft Agent is free here.

### F5 — Binary Options (solo vs the market)

1. Play → Binary Options → choose window (1h / 24h).
2. **Pick 5 coins** from the pool (search, sector filters, token stats on tap).
3. **Call each** UP or DOWN — big thumb-friendly toggles per coin, current price
   shown as the line to beat.
4. Review → Lock (entry prices captured at lock).
5. **Live race** — your car runs a lap with 5 checkpoints, one per call. Each
   checkpoint shows green or red live as the price sits above or below entry, and
   locks at resolution. HUD: "3 right to win" tracker.
6. **Result** — each call ✓/✗ with entry → exit price, X/5, win/lose, XP.

### F6 — Tournaments

**Create:**

1. Tournaments → "Create" → name, public/private, race type (coin draft or binary),
   sector restriction (none / one sector), registration closing time (this is also
   the start time), payout (winner takes all / top 3). Groups are always 5 cars.
2. Review → Create → share link / invite.

**Group draw (at registration close):**

1. Players are sorted into **pots** by rank/XP (Pot 1 = strongest).
2. An animated **draw** places one player from each pot into each group of 5 —
   the Champions League draw moment. Designed to be watchable and shareable.
3. Group table per group: position, driver chip, points, races run.
4. Top finishers in each group advance to the final race.

**Join:**

1. Browse public list (cards: name, players, restriction, closes in…) or open a
   private invite link.
2. Join → waiting state: "Starts when registration closes — 1h 12m".
3. ◆ At close: enough players → groups start (push: "Your tournament is starting");
   not enough → cancelled (push + card says cancelled).
4. Draft (restricted tournaments use 5 open slots from that sector).
5. Qualifier group result → ◆ advanced → final → final result.

**Detail screen** shows the pots, the groups of 5, then the final, with your car
highlighted. A sponsored tournament shows the sponsor's name and livery throughout.

### F7 — Shop: buy with XP or USDC

1. Shop → tabs **Cars · Customize · Nitro & Pit-stop**.
   - _Cars:_ models by rarity; **limited editions** show "37 of 100 left" and a
     drop countdown.
   - _Customize:_ paint, decals, number plates, preview on your car.
   - _Nitro & Pit-stop:_ the launch items (Nitro = Sector Boost, XP Boost, Spare
     Tyre = Free Hit, Turbo = Captain — names TBC).
2. Item sheet → 3D preview you can rotate (cars and cosmetics) or what it does
   (items), how many you own, weekly limit used (e.g. "2/3 used this week"), price
   in XP and/or USDC. "Cosmetic — doesn't change speed" on every car.
3. ◆ **Pay with XP** → confirm → owned count +1.
4. ◆ **Pay with USDC** → choose chain (Base or Solana) → wallet opens to approve the
   transfer → "Confirming on-chain…" (spinner + tx link) → success → item added.
   Failure states: rejected in wallet, insufficient USDC, confirmation timeout.
5. Inventory tab — owned items, active boosts with time left.

### F8 — Pre-race: car, nitro and pit-stop

1. After the draft locks, a **pre-race screen**: your car on the grid, "Change
   car" (opens the Garage picker), and a **pit-stop tray** of owned nitro and
   pit-stop items (disabled once the weekly limit is used).
2. Pick one → apply it (Turbo → choose a pick; Nitro → choose a sector).
3. Only one per race — the tray locks after use; it shows on the track (nitro
   flame) and on the result.
4. "Start race" → the live race.

### F13 — Garage

1. Me → Garage (or "Change car" pre-race) → grid of your cars (car cards) with
   the equipped one marked.
2. Tap a car → 3D showroom view (rotate, zoom) → **Equip** / **Customize**.
3. Customize → paint, decals, plate → live preview → Save. Unowned items show a
   price and link to the shop.
4. Garage level bar (XP progress) with what the next level unlocks.

### F14 — Car staking (rules TBC)

1. Versus setup → Stake: **Car** → choose one of your cars; only opponents with a
   car of the **same rarity tier** are matched.
2. Match found → both cars shown side by side, "Winner takes the car".
3. Race → result: the winner's garage gains the car with a "won" animation; the
   loser sees it leave their garage. Confirm-before-staking step with a clear
   warning.

### F15 — Sponsor a tournament / book track ads

1. Sponsor portal (`/sponsor`) → choose **Sponsor a tournament** or **Book a
   billboard / banner**.
2. _Tournament:_ name, dates, prize, branding (logo, colors, car livery) → preview
   the track dressed in their branding → pay → review/approval → live.
3. _Ads:_ pick a track and slot (billboard, trackside banner, start/finish arch)
   on a visual track map, pick dates (booked dates greyed), upload artwork with
   size guidance → preview in 3D → pay → approval → live.
4. Sponsor dashboard: active and upcoming bookings, impressions/views, invoices.

### F9 — Install & notifications

1. After the first finished game: "Add CoinDraft to your home screen" card.
2. iPhone: show the steps (Share → Add to Home Screen) — push only works after this.
3. Notification settings in **Me → Settings**: match found · result in · trivia
   live / streak at risk · tournament closing / starting — each a toggle.

### F10 — Leagues

1. Dashboard → Compete → Leagues → create (public / private with invite code) or
   join by code.
2. League page: standings table (W / L / Pts), invite code (members only), Leave
   (members) / Delete with confirm (creator).

### F11 — Viewing another player

1. Tap any player name — opponent on the match-found card or result, a leaderboard
   row, a league standing, a tournament bracket.
2. **Public player card** opens (§8.12): their name, avatar, rank, badge showcase,
   record, and your head-to-head against them.
3. Actions: "Challenge" (after launch — needs the online-players list), back.

### F12 — Customizing your profile and defaults

1. Me → Edit profile → display name, avatar, pick up to 3 badges to showcase →
   Save. Preview shows the public card as others will see it.
2. Me → Play defaults → preferred mode, sector, duration, stake → used to pre-fill
   Versus setup.
3. Me → Settings → notifications, sound & vibration, reduced motion, wallet & USDC
   chain, sign out.

---

## 8. Screen specs

### 8.1 Landing [redesign]

- **Purpose:** explain in 5 seconds, get a wallet connected.
- **Content:** hero headline + pitch, primary CTA "Connect wallet", live price
  ticker, 3-step "how it works", sector showcase (swipeable sectors with live
  movers), a short racing-cars teaser animation, footer.
- **States:** wallet SDK failed to load → message + retry.

### 8.2 Dashboard [redesign]

- **Purpose:** the hub for your _activity_ — what needs you now, what you've
  played, the market, and how you're ranking. Split into four sections so nothing
  is forced into one long scroll (same idea as DraftKings separating the lobby from
  "My Contests", or Sleeper's tabbed league spaces).
- **Section switcher:** segmented control under the header on phone (swipe left and
  right between sections); tabs or a left sidebar on desktop. Remembers the last
  section you used. Overview is the default on app open.

**Overview** (default)

- Only what needs you now, in priority order: active match card (live / drafting /
  waiting, with time left and one-tap re-entry) · today's trivia card with streak ·
  quick play buttons (Versus, Binary Options, Tournament) · "new for you" (badge
  unlocked, tournament starting soon, result in).
- States: first run (welcome + "Start with trivia" / "Play a practice match"),
  nothing active ("Nothing live — start a match"), loading skeletons.

**My Games**

- The single list of every game you're in or played, all modes (Versus, Binary,
  Scrimmage, Tournaments).
- Filter chips: **Live · Upcoming · Completed**; secondary filter by mode.
- Row: mode icon, opponent (or "vs market"), stake, time left / finished date,
  score or W/L. Tap → live race or result.
- States: empty per filter ("No live games"), loading, paginated or infinite
  scroll for Completed.

**Market**

- Pre-draft research: Sector Wars (24h performance by sector, sector-colored bars),
  Whale Watch (ETF inflow/outflow streak alerts), hot movers (top gainers/losers
  as token cards — tap for stats, "Draft this" shortcut).
- States: data unavailable → message + retry; never show fake numbers.

**Compete**

- Your tournaments (status + next action), your leagues (your position in each),
  leaderboard snapshot (top 5 + your rank) with "See full leaderboard".
- States: not in any league/tournament → "Join a tournament" / "Create a league".

### 8.3 Versus setup & queue [redesign]

- **Setup:** four choice groups as segmented pills — Mode, Sector (+Any), Duration
  (+Any), Wager (No stake / tiers, unaffordable greyed with "need 100 XP"). Sticky
  "Find match" button.
- **Queue:** pulsing radar/searching visual, elapsed timer, chosen settings, Cancel.
  At 20s: "Try Scrimmage instead". Notification permission ask.
- **Match found:** opponent card + settings comparison; differing rows highlighted
  → "Settle with rock-paper-scissors".

### 8.4 Rock-paper-scissors [new — design supplied]

- Follows the supplied design (dark navy, colored discs, Barlow Semi Condensed).
- **Header:** game title + score box. In a live match the score box reads
  "BEST OF 3" with "1 – 0".
- **Pick:** triangle (classic) or pentagon (with Lizard & Spock) of discs. Status
  line: "Round 2 · 7s · waiting for them / they're in".
- **Reveal:** "YOU PICKED" vs "[OPPONENT] PICKED" (practice: "THE HOUSE PICKED");
  empty dark circle until their throw is revealed; winner's disc gets glowing rings.
- **Round result:** "ROUND TO YOU" / "ROUND TO THEM" / "TIE — GO AGAIN"; auto-advances
  after ~2.5s. Timeout note: "You ran out of time — random throw".
- **Final:** "YOU WIN" / "YOU LOSE", "Your terms apply" / "Their terms apply",
  "CONTINUE".
- **Rules:** modal on desktop, full screen on phone; arrows show what beats what.
- **Phone layout:** labels under discs, Rules button bottom-center.

### 8.5 Draft [redesign]

- **Header:** mode label (Versus / Scrimmage / Tournament · L1-only), "Build your
  lineup", lock timer.
- **5 slot cards** (tilted, sector-colored). Restricted tournament: 5 open slots
  "L1 #1–#5".
- **Coin pool:** search, sector tabs, token cards with "Drop into L1" button; coins
  already picked show "In your lineup".
- **Sidebar:** projected score (live estimate, mono, big), progress bar, active
  boosts, "Lock lineup" (nitro and pit-stop items are chosen on the pre-race screen, F8).
- **AI Draft Agent:** floating helper — auto-fill or suggest; costs XP per slot
  (free in Scrimmage); must show the cost before use.
- **States:** coin unavailable (price missing → hidden/greyed), timer expiring
  (warning), lock failed (error toast + retry).
- **Interactions:** add/replace a pick, remove (×), tap a coin for stats, keyboard
  accessible.

### 8.6 Binary Options — pick & call [new]

- **Step 1 (pick 5):** same coin pool as the draft, multi-select up to 5, selected
  tray at the bottom.
- **Step 2 (call):** a row per coin — logo, symbol, current price ("price to beat"),
  big UP (mint) / DOWN (red) toggle. Window selector. "Lock calls".
- **Review:** 5 calls summary, window, potential XP.

### 8.7 Live race [redesign — key screen]

- **Purpose:** this _is_ the game. Where players spend the most time and what they
  share.
- **View:** real 3D, low-poly art, **isometric camera by default**. Camera switcher
  (isometric · chase cam · top-down — at least two at launch), remembered per player.
- **Cars:** one per player, in their own model and paint, with a driver chip
  floating above. Versus = 2 cars; tournament group = 5 cars.
- **Position = the market:** each car's place on the track is its lineup's combined
  % move. Leader in front; gaps open and close as prices move.
- **Drama:** overtakes animate with a bump and sparks; cars hit each other when
  positions swap at close range; a sharp drop makes a car spin out or wobble; a
  sharp rise gives a speed burst; a nitro-boosted car trails a flame.
- **Track dressing:** sponsor billboards, trackside banners and a start/finish arch
  (ad slots — see §8.19); a sponsored tournament's track is fully branded.
- **Weather & time of day:** the scene mirrors the viewer's real local weather
  and time — sun, cloud, rain (wet road, spray), storm (lightning), snow, fog
  (headlights on), wind (flapping banners), night (lit billboards). Purely visual;
  each viewer sees their own. A small weather chip in the HUD ("🌧 Lagos, 24°")
  opens the weather setting. Changes fade in, never snap.
- **HUD:** time left, position (P1/P2…), your score vs the leader, **engine panel**
  showing your 5 picks and which are pushing (+) or dragging (−) the car, live
  commentary ticker ("ETH pulls you into P1!"), tap any car → driver card + their
  picks.
- **Finish:** photo finish → checkered flag → podium (top 3 in tournaments) →
  confetti on a win → result.
- **Binary variant:** one lap with 5 checkpoints, one per call; each lights green
  or red live and locks at resolution.
- **States:** before start ("warming up the engines" — cars on the grid), price
  feed gap (car holds position with a "no data" tag — never jumps backwards to
  zero), reconnecting, reduced motion or a weak device → 2D fallback (the existing
  chart).
- **Performance:** must run smoothly on a mid-range phone; design with few
  polygons and limited particles.

### 8.8 Result [redesign]

- Finishing position (P1 / P2…) or X/5 for binary, the podium, your score vs the
  field, per-pick breakdown (coin, sector, % move, points, nitro/pit-stop used), XP
  earned (count-up), garage level progress, badges unlocked, short AI-written race
  recap (2–3 sentences).
- **Car stake races:** the car changing hands, shown clearly (won / lost).
- **Actions:** Share result (card image for X), Rematch, Play again, Back to dashboard.
- **Practice result:** clearly labelled, practice XP only.

### 8.9 Tournaments [redesign]

- **List:** tabs Public / Mine / Sponsored; cards with name, players, race type,
  restriction badge, "closes in", sponsor logo if sponsored. Create button.
- **Create:** form per F6; inline explanation that the close time is the start.
- **Detail:** status (open / drawing / live / finished / cancelled), countdown,
  **pots → animated group draw → groups of 5 → final**, your car highlighted,
  invite (private), Draft / Watch race / View result buttons by state.
- **Group table:** Champions-League style — position, driver chip, points, form.

### 8.10 Shop & inventory [new]

- Tabs: **Cars · Customize · Nitro & Pit-stop · Inventory**.
- Car cards with rarity, price (USDC, some XP), limited-edition counter and drop
  countdown; "Cosmetic — doesn't change speed" label.
- Item sheet with 3D preview (cars/cosmetics) + purchase flows per F7, including
  on-chain pending/success/failure.
- Inventory: owned items, active nitro (with countdown), used this week (x/3).

### 8.18 Garage [new]

- Showroom feel: equipped car on a turntable (rotate, zoom), car grid below with
  rarity filters, "Equip" and "Customize".
- Customize: paint, decals, plate, live 3D preview, unowned items priced with a
  shop link.
- Garage level + XP progress, next unlock preview.
- States: only the starter car (nudge to the shop / levels), car locked in an
  active stake ("racing for this car").

### 8.19 Sponsor portal & track ads [new]

- For companies, not players — can be a simpler, more businesslike layout.
- Landing: what you can buy (tournament sponsorship, billboards, banners, arch),
  reach stats, example screenshots of a branded track.
- Booking: track map with selectable slots, calendar availability, artwork upload
  with size specs, 3D preview of the ad in place, price, pay, submitted-for-review
  state.
- Dashboard: bookings (pending / live / ended), impressions/views, invoices.
- Player-facing rule: ads appear only as track dressing — never over the HUD or
  covering cars.

### 8.11 Me — profile, customization & settings [redesign]

- **Purpose:** your _identity_ as a player, and how you've set the app up. Not a
  second dashboard: no game lists, no market data.
- **Header:** avatar, display name, rank / level, XP total, "Edit profile",
  "View public card" (shows exactly what others see), gear icon → Settings.
- **Stats summary:** games played, win rate (real games only), current and best win
  streak, trivia streak — the games figure links to Dashboard → My Games.
- **Badges:** grid of earned vs locked; the 3 showcased badges marked; tap a badge
  for how it was earned.
- **Customization**
  - _Identity:_ display name, avatar (preset set to start; upload later), up to 3
    showcased badges, with a live preview of your public card.
  - _Play defaults:_ preferred mode, sector, duration, stake, default camera view —
    pre-fills Versus setup.
  - _Garage:_ shortcut to your cars (§8.18).
- **Settings** (behind the gear)
  - Notifications: per-type toggles (match found, result in, trivia live / streak at
    risk, tournament closing / starting).
  - Sound & vibration on/off; reduced motion (follows the device by default, with an
    override).
  - Race weather: Real weather (default) · Always clear · Pick a weather; optional
    "use precise location" toggle.
  - Wallet: connected address, network, preferred USDC chain (Base / Solana),
    disconnect / sign out.
  - Install app (if not installed); help & how to play; terms & privacy.
- **States:** new player (empty badges with "earn your first badge" hints), save
  success/failure on edits, name already taken.

### 8.12 Public player card [new]

- **Purpose:** what anyone sees when they tap your name — makes opponents feel like
  real people and gives badges a reason to exist.
- **Content:** avatar, display name, rank, showcased badges (up to 3), record (W/L,
  win rate), current streak, favourite sector, and **your head-to-head** against
  them ("You lead 3–1").
- **Never shown:** wallet balance, inventory, settings, private league codes.
- **Entry points:** match-found card, result screen, leaderboard, league
  standings, tournament bracket.
- **Opens as:** a bottom sheet on phone, a modal or side panel on desktop.

### 8.13 Install prompt & notifications [new]

- Card/sheet: "Play faster from your home screen and get match alerts." Android/
  desktop: native install button. iPhone: illustrated 2-step instructions.
- Notification permission asked in context (queue, tournament join), with a
  short reason.

### 8.14 Leaderboard [exists]

- Top 50 by XP, your rank pinned at the bottom if outside the top 50.

### 8.15 Leagues [exists]

- List (public + mine), create, join by code; detail per F10.

### 8.16 Guide [exists]

- Step-by-step how to play; update for Versus, Binary, Trivia, Shop, RPS.

### 8.17 Public share page [exists]

- Server-rendered page for link previews: result card image, headline ("I won a
  24h contest on CoinDraft — 312 pts"), CTA "Play CoinDraft".

---

## 9. Micro-interactions inventory

| Moment               | Interaction                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| Coin added to a slot | Card flies from the pool into the slot; slot glows in the sector color |
| Lineup locked        | Slots flip/stamp "LOCKED"; timer stops                                 |
| XP earned            | XP chip counts up; small coin burst                                    |
| Trivia answer        | Instant green/red flash, auto-advance                                  |
| Streak extended      | Flame grows; streak number bumps                                       |
| Match found          | Haptic (phone), sound (optional), opponent card slides in              |
| RPS reveal           | Opponent disc pops in; winner disc gets pulsing rings                  |
| Overtake             | Car swaps lanes with a bump + spark; ticker line                       |
| Finish               | Checkered flag sweep, confetti on win                                  |
| Badge unlocked       | Toast + badge flip animation                                           |
| Purchase confirmed   | Item drops into inventory                                              |
| Error                | Gentle shake on the failed control + message                           |

---

## 10. Content & copy

- Short, confident, playful. "You take the lead" not "Your aggregate score exceeds
  your opponent's".
- Numbers always signed and colored: `+3.42%` mint, `−1.10%` red.
- Never jargon without help: first time a term appears (e.g. "L2"), offer a tooltip.
- Be explicit about money: XP vs USDC is always labelled; wallet steps say "free,
  no gas" when true.

---

## 11. Responsive & PWA

- Breakpoints: phone (<640px) first, tablet, desktop (≥1024px).
- Phone: bottom tab bar, bottom sheets, thumb-reachable primary buttons, safe-area
  padding (notch / home indicator).
- Installed PWA: no browser chrome — screens need their own back affordance.
- App icon and splash screen needed (logo assets exist in `src/lib/assets/images`).

---

## 12. Accessibility

- Text contrast WCAG AA on all surfaces (watch white text on coral/amber).
- Color is never the only signal: price up/down also uses +/− and arrows; win/loss
  uses words.
- All controls keyboard-reachable with visible focus; RPS discs and slots are
  buttons with labels.
- Timers announce politely to screen readers; don't auto-advance faster than people
  can read.
- Reduced-motion versions for the race, RPS reveal, confetti and count-ups.

---

## 13. Not in v1 (don't design yet)

Real-money wagers & KYC screens · paid tournament entry · cars on NEAR mainnet
(NEP-245) · more tracks · multiplayer binary race (AI picks 5 coins,
3 rerolls) · head-to-head trivia · online-players / challenge list · extra pit-stop
items · seasons · race replays and shareable race clips · sound & haptics settings
beyond defaults.

## 14. Open decisions

| Decision                                                 | Status                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ |
| Product name & domain                                    | Open — "CoinDraft" is the working name                 |
| Final pitch line                                         | Open until launch                                      |
| Binary Options rules (flat = wrong, 1h/24h, XP values)   | Proposed, awaiting confirmation                        |
| RPS default variant (Lizard-Spock vs classic)            | Lizard-Spock proposed                                  |
| USDC chains                                              | Base + Solana proposed                                 |
| Shop prices (XP and USDC per item)                       | Not set — design with placeholders                     |
| Phone bottom tabs: Dashboard · Play · Trivia · Shop · Me | Proposed in this doc                                   |
| Car staking rules (paid cars stakeable? boosts allowed?) | Open — design the flow, mark "TBC"                     |
| Nitro / pit-stop item names                              | Open — racing names proposed                           |
| Rarity tier names                                        | Common · Rare · Epic · Legendary proposed              |
| 3D renderer                                              | Spline runtime proposed; Three.js fallback             |
| Camera views beyond isometric                            | Chase cam + top-down proposed                          |
| Weather data provider                                    | Not chosen — must allow commercial use                 |
| Sponsored weather ("Storm presented by…")                | Idea only                                              |
| Ad slot types and pricing                                | Billboard · banner · start/finish arch; prices not set |
