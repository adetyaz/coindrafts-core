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

CoinDraft is **fantasy sports for crypto**. You make calls on real crypto prices and
compete against real people.

- **Draft** 5 coins (one per sector) and race the market against an opponent, or
- **Call** 5 coins up or down (Binary Options) and try to get at least 3 right.
- When two players want different match settings, a quick **rock-paper-scissors**
  round decides whose settings apply.
- A **daily trivia** set earns XP; XP buys **boosts and perks**; boosts and perks can
  also be bought for ~$1 in USDC.

**Working pitch (not final):** _"Fantasy sports for crypto: draft 5 coins or call 5
moves, go head-to-head, and let rock-paper-scissors settle the rest."_

### The core loop

```
Daily trivia ──► XP ──► Boosts & perks
      ▲                       │
      │                       ▼
 Come back tomorrow ◄── Play (Versus / Binary / Tournament) ──► Win XP, climb ranks
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

1. **Feels like a game, not a trading terminal.** Races, clashes, finish lines —
   not candlestick charts. Numbers support the drama; they aren't the drama.
2. **One decision per screen.** Every screen has one obvious next action.
3. **Always show where you stand.** Your XP, your active match, your streak — visible
   from anywhere.
4. **Fast to play.** From the home screen to a locked lineup should take under a
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
/dashboard            Home (signed in)
/trivia               Daily trivia                      [new]
/matchmaking          Versus setup + queue               [redesign]
/rps/:id              Rock-paper-scissors tiebreaker     [new]
/scrimmage            Practice vs bot                    [exists]
/binary               Binary Options setup + calls       [new]
/draft                Draft 5 coins                      [redesign]
/game/:id             Live race (cars)                   [redesign]
/contest/result       Versus / Scrimmage / Binary result [redesign]
/tournament           Tournaments: list, create, detail  [redesign]
/lobby/:id/result     Tournament group result            [exists]
/shop                 Boosts & perks shop + inventory    [new]
/profile              Profile, badges, streaks, settings [redesign]
/leaderboard          Global XP ranking                  [exists]
/leagues, /leagues/:id  Friend leagues                   [exists]
/guide                How to play                        [exists]
/share/:id            Public result page (for links)     [exists]
```

Removed — do not design: AI Mentor, Knowledge Base / Research Hub, Documentation
page, standalone Multiplayer lobbies.

### Navigation

- **Phone (primary):** bottom tab bar with 5 tabs — **Home · Play · Trivia · Shop ·
  Profile**. "Play" opens a mode picker (Versus, Binary Options, Tournaments,
  Scrimmage).
- **Desktop:** top bar with the same destinations; current pattern is grouped
  dropdowns (Play · Compete · Help).
- **Always visible:** XP balance chip; **active match pill** ("Your match is live —
  2:14 left" → taps through to the game); trivia streak flame when today's set is
  still open.
- Leaderboard and Leagues live under a "Compete" area (desktop nav, and a section on
  Home / Profile on phone).

---

## 5. Global components

| Component                          | Notes                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Wallet connect button**          | Signed out: "Connect wallet". Opens the wallet picker (EVM + Solana), then a "Sign to verify" step (no gas, no funds moved — say so). Signed in: avatar + short address. |
| **XP chip**                        | Live XP balance; ticks up with a small count-up animation when XP is earned.                                                                                             |
| **Active match pill**              | Appears whenever you're in a queue, RPS round, draft or live game. Shows mode + time left. One tap back in.                                                              |
| **Token card**                     | Coin logo, symbol, name, price (mono), 24h change pill (mint/red), volume. Tapping or hovering opens Token Stats (stats + news tabs).                                    |
| **Sector badge / slot card**       | Sector color band, "L1 sector" label, empty state = dashed border + "+". Filled = coin logo in a glowing sector-colored circle.                                          |
| **Countdown timer**                | Mono digits, blinking dot. Turns red under 10s.                                                                                                                          |
| **Toasts**                         | Bottom-right (desktop) / top (phone). Info, success, error.                                                                                                              |
| **Modal / bottom sheet**           | Desktop modal; phone bottom sheet.                                                                                                                                       |
| **Empty / loading / error states** | Skeleton shimmer for loading; friendly one-line empty states with one action; errors say what failed and offer Retry.                                                    |
| **Install prompt**                 | See §8.12.                                                                                                                                                               |
| **Notification permission prompt** | Asked in context (after first queue), never on first load.                                                                                                               |

---

## 6. Game rules the UI must express

- **Coin draft:** 5 picks, one per sector (L1, L2, DeFi, Meme, Wildcard). Score =
  each coin's % move over the window, added up. A boosted sector multiplies that
  coin's movement by **×1.25** (it amplifies losses too).
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
- **Perks & boosts:** one per game or tournament, max 3 per week. Only work in
  XP games — never in real-money games.
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
4. **Home** — first-run state: "Start with today's trivia" or "Play a practice
   match" (Scrimmage), plus install prompt nudge after the first game.

### F2 — Daily trivia

1. Home card "Today's trivia — 8 questions, 1 minute" (shows streak 🔥 count).
2. **Trivia intro** — rules in one line, "Start" (timer starts on tap).
3. **Question screen** ×8 — question, 4 answers, overall timer bar, progress dots.
   Tap = locked instantly, quick right/wrong flash, auto-advance.
4. ◆ Timer runs out → remaining questions count as wrong.
5. **Trivia result** — score X/8, pass/fail, XP earned (count-up), streak updated
   (flame grows or resets), "Spend XP in the shop" / "Play a match".
6. ◆ Already played today → card shows result + countdown to the next set.

### F3 — Versus (1v1) with preferences and RPS

1. Play → **Versus setup**: choose **mode** (Coin draft / Binary), **sector** (or
   Any), **duration** (or Any), **wager** (No stake / stake tier). Summary line:
   "You'll be matched with someone who wants the same mode and stake."
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
5. **Live view** — each call as a lane; green/red as price is above/below entry;
   "3 right to win" tracker.
6. **Result** — each call ✓/✗ with entry → exit price, X/5, win/lose, XP.

### F6 — Tournaments

**Create:**

1. Tournaments → "Create" → name, public/private, draft type (coin draft or binary —
   binary tournaments are after launch), sector restriction (none / one sector),
   group size, registration closing time (this is also the start time), payout
   (winner takes all / top 3).
2. Review → Create → share link / invite.

**Join:**

1. Browse public list (cards: name, players, restriction, closes in…) or open a
   private invite link.
2. Join → waiting state: "Starts when registration closes — 1h 12m".
3. ◆ At close: enough players → groups start (push: "Your tournament is starting");
   not enough → cancelled (push + card says cancelled).
4. Draft (restricted tournaments use 5 open slots from that sector).
5. Qualifier group result → ◆ advanced → final → final result.

**Detail screen** shows bracket: qualifier groups → final, your position highlighted.

### F7 — Shop: buy with XP or USDC

1. Shop → catalogue (launch items: Sector Boost, XP Boost, Free Hit, Captain).
2. Item sheet → what it does, how many you own, weekly limit used (e.g. "2/3 used
   this week"), price in XP and in USDC.
3. ◆ **Pay with XP** → confirm → owned count +1.
4. ◆ **Pay with USDC** → choose chain (Base or Solana) → wallet opens to approve the
   transfer → "Confirming on-chain…" (spinner + tx link) → success → item added.
   Failure states: rejected in wallet, insufficient USDC, confirmation timeout.
5. Inventory tab — owned items, active boosts with time left.

### F8 — Using a perk or boost in a game

1. On the draft/lock screen, a "Use a perk" tray shows owned items (disabled if the
   weekly limit is used or the game is a real-money game).
2. Pick one → apply to the lineup or a specific pick (Captain → choose a pick;
   Sector Boost → choose a sector).
3. Only one per game — tray locks after use; shown on the race (nitro flame) and on
   the result.

### F9 — Install & notifications

1. After the first finished game: "Add CoinDraft to your home screen" card.
2. iPhone: show the steps (Share → Add to Home Screen) — push only works after this.
3. Notification settings in Profile: match found · result in · trivia live / streak
   at risk · tournament closing / starting — each a toggle.

### F10 — Leagues

1. Compete → Leagues → create (public / private with invite code) or join by code.
2. League page: standings table (W / L / Pts), invite code (members only), Leave
   (members) / Delete with confirm (creator).

---

## 8. Screen specs

### 8.1 Landing [redesign]

- **Purpose:** explain in 5 seconds, get a wallet connected.
- **Content:** hero headline + pitch, primary CTA "Connect wallet", live price
  ticker, 3-step "how it works", sector showcase (swipeable sectors with live
  movers), a short racing-cars teaser animation, footer.
- **States:** wallet SDK failed to load → message + retry.

### 8.2 Home / Dashboard [redesign]

- **Purpose:** what to do right now.
- **Blocks (in priority order):** active match card (if any) · today's trivia card
  (streak) · Play buttons (Versus, Binary, Tournaments) · my tournaments · market
  context (Sector Wars: 24h sector performance; Whale Watch: ETF flow alerts; hot
  coins) · recent results.
- **States:** first run (no games yet), nothing active, loading skeletons.

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
  boosts, perk tray (F8), "Lock lineup".
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

- **Purpose:** make waiting fun. This is where people spend the most time.
- **Track:** each pick is a car in a lane; position = live % move. Versus: your
  cars vs theirs (or one car per player = lineup total) with the gap shown.
- **Moments:** overtakes animate; cars bump and spark when they swap places; a
  sharply dumping coin spins out/crashes; a pumping coin gets a speed burst;
  boosted car has a nitro flame.
- **HUD:** time left, your total vs theirs, live commentary ticker ("SOL overtakes
  ETH!"), tap a car → token stats.
- **Finish:** photo finish → checkered flag → confetti on a win → result.
- **Binary variant:** each call is a lane with the entry price as a line; lane is
  green/red depending on side.
- **States:** no data yet ("warming up the engines"), price feed gap (car freezes
  with a "no data" tag — never drops to zero), reduced motion → plain chart.

### 8.8 Result [redesign]

- Big WIN / LOSS (or X/5 for binary), your score vs theirs, per-pick breakdown
  (coin, sector, % move, points, boost/perk used), XP earned (count-up), badges
  unlocked (toast + inline), short AI-written match breakdown (2–3 sentences).
- **Actions:** Share result (card image for X), Rematch, Play again, Back home.
- **Practice result:** clearly labelled, practice XP only.

### 8.9 Tournaments [redesign]

- **List:** tabs Public / Mine; cards with name, players/size, restriction badge,
  "closes in". Create button.
- **Create:** form per F6; inline explanation that the close time is the start.
- **Detail:** status (open / starting / live / finished / cancelled), countdown,
  participants, bracket view (groups → final) with you highlighted, invite (private),
  Draft / View result buttons by state.

### 8.10 Shop & inventory [new]

- Grid of item cards: icon, name, one-line effect, price chips (XP and USDC), owned
  count. Weekly limit meter.
- Item sheet + purchase flows per F7, including on-chain pending/success/failure.
- Inventory tab: owned, active (with countdown), used this week.

### 8.11 Profile [redesign]

- Username/avatar, wallet, XP total, win rate (real games only), win streak,
  trivia/research streak, badges grid (earned vs locked), match history,
  notification settings (F9), sign out.

### 8.12 Install prompt & notifications [new]

- Card/sheet: "Play faster from your home screen and get match alerts." Android/
  desktop: native install button. iPhone: illustrated 2-step instructions.
- Notification permission asked in context (queue, tournament join), with a
  short reason.

### 8.13 Leaderboard [exists]

- Top 50 by XP, your rank pinned at the bottom if outside the top 50.

### 8.14 Leagues [exists]

- List (public + mine), create, join by code; detail per F10.

### 8.15 Guide [exists]

- Step-by-step how to play; update for Versus, Binary, Trivia, Shop, RPS.

### 8.16 Public share page [exists]

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

Real-money wagers & KYC screens · paid tournament entry · binary-options tournaments
· multiplayer binary options (AI picks 5 coins, 3 rerolls) · head-to-head trivia ·
online-players / challenge list · extra perks (Shield, Second Look, Flip, Double
Down) · seasons · race replays and shareable race clips · sound & haptics settings
beyond defaults.

## 14. Open decisions

| Decision                                               | Status                                 |
| ------------------------------------------------------ | -------------------------------------- |
| Product name & domain                                  | Open — "CoinDraft" is the working name |
| Final pitch line                                       | Open until launch                      |
| Binary Options rules (flat = wrong, 1h/24h, XP values) | Proposed, awaiting confirmation        |
| RPS default variant (Lizard-Spock vs classic)          | Lizard-Spock proposed                  |
| USDC chains                                            | Base + Solana proposed                 |
| Shop prices (XP and USDC per item)                     | Not set — design with placeholders     |
| Bottom tab bar (vs current top nav on phone)           | Proposed in this doc                   |
