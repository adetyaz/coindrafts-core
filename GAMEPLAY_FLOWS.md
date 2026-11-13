# CoinDraft — Gameplay Flows & Mechanics

> Design-agnostic: this document fixes **what happens, in what order, and why** — stages, rules,
> content and states. It says nothing about colours, type or layout; the visual design system is
> being redone separately and plugs into these flows.
>
> Status per flow: ✅ agreed · 🧪 agreed to try, revisit after playtesting · ⏳ to discuss.
> Built-today notes refer to branch `hackathon/near`.

---

## Principles

1. **It plays like a racing game.** Players move through stages (garage, track, grid, lights out,
   podium) — never dropped straight into a race or a results table.
2. **The market is the engine.** Five drafted coins decide the car's pace; cars and tracks are
   cosmetic and never change results.
3. **The chain is invisible.** Ownership is real (NEAR) but nobody signs, pays gas or sees a wallet.
4. **Every stage has all its states.** Loading, empty, error, offline and "you're early/late" are
   part of the flow, not afterthoughts.

---

## F1 — Landing → first sign-in ✅

### Landing (signed out)

Three sections, in this order. Inspired by the PrizePicks homepage structure.

| Section             | What it contains                                                                                                                                                                                                                                                        | Notes                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Hero**            | A live 3D race playing behind the headline: bots racing on real prices, on a real circuit. Headline and **Sign in to race**. Anyone can watch without signing in.                                                                                                       | Keeps the animation. Replaces the old "Draft coins. Beat people." pitch |
| **Run your game**   | A swipeable grid of live cards: **races happening now** (drivers, time left, leader) and **hot coins** (most drafted right now, with a "1.2k drafting" count and their move). Filter tabs by sector (L1, L2, DeFi, Meme, Wildcard). A "Live · updated just now" marker. | From PrizePicks' "Run Your Game" card grid + live pick cards            |
| **Back your takes** | How it works, as tabs per mode — **Scrimmage · Versus · Tournaments** — each with three short steps. Ends on **Sign in to race**.                                                                                                                                       | From PrizePicks' "Back your takes" section                              |

States: live data unavailable → the hero falls back to a recorded race; cards show a quiet
"Live races will appear here".

### First sign-in

1. **Sign in to race** → email or Google / X / Discord / Apple. No wallets.
2. One confirmation step (the sign-in signature). If it fails or is closed: **Try again**, nothing
   automatic.
3. **Your first car** — a reveal moment: the starter car appears, **+500 Gears**, and one line:
   _"It's yours. Recorded on NEAR. You'll never need a wallet."_
4. **Your racing name** — enter a display name (bots and opponents use it), or **Skip** (keeps an
   automatic name, changeable later in Me → Profile).
5. Straight into **your first race**: a 1-minute Scrimmage against a bot, set up for you, entering
   the race flow below at the car step.

Returning players skip 3–5 and land on the dashboard.

Built today: sign-in (email/social only), the starter car + 500 Gears + NEAR account (silent), the
signature step. Not built: new landing sections, the reveal, the name step, the auto first race.

---

## F2 — The race flow (Scrimmage and Versus)

Every race goes through the same stages.

```
Mode ─► Car ─► Track ─► Draft (your 5 coins) ─► Opponent / grid ─► Pre-race ─► Lights out
     ─► Race ─► Chequered flag ─► Podium ─► Rewards ─► Next race
```

### 1. Mode ✅

Scrimmage (vs bots, practice) · Versus (1v1) · Tournament · **Car race** (stake a car, see F3). Then
race length: 1 min, 5 min, 10 min, 20 min, 45 min, 3 h, 24 h, 7 days.

### 2. Car 🧪

Choose one of your cars. **Your last-used car is pre-selected**, so it's one tap. Shows each car's
model, rarity, races and wins. Cosmetic only — the screen says so. If the car is staked or listed
for sale it can't be picked (with the reason).

_Order note: car → track → draft is the one being tried. The alternative (draft first, then car and
track) stays on the table after playtesting._

### 3. Track ✅

Choose a circuit. **Tracks are real circuit shapes**, built from measured centerline data
([TUMFTM racetrack-database](https://github.com/TUMFTM/racetrack-database), 25 circuits, LGPL-3.0 —
credit required). Each has its own layout, corners and length; the 3D track is generated from the
data, not drawn by hand. Cosmetic only — results never depend on the track.

- Launch set ✅: **Monza** (long straights, very fast), **Suzuka** (figure-of-eight crossover),
  **Spa** (big flowing sweeps), **Interlagos** (compact and twisty) — picked to look as different
  from each other as possible. More from the 25 later.
- Names: shown by city/region (e.g. "Spa", "Monza") — the circuit names are places; no series or
  event branding.
- Versus: each player picks a track; if they differ, the **rock-paper-scissors tiebreak** decides and
  the winner's track (and other terms) apply ✅.

### 4. Draft ✅ (built)

One coin per sector, five sectors — the car's engine. AI Draft Agent available (costs XP in real
races, free in Scrimmage).

### 5. Opponent / grid ✅

- Scrimmage: a bot joins instantly, chosen from the eight personalities.
- Versus: matchmaking queue → match found → (RPS if terms differ) → both lock lineups.
- Tournament: the grid fills with the group (groups of 5).

### 6. Pre-race screen 🧪

The "loading" stage — builds anticipation before lights out.

- The track flying by behind, with its name and conditions.
- **A card per driver:** name, BOT tag and personality, car (model, rarity), their **5 coins** with
  live price and 24h move, their **mood towards you** and your record against them, and **their
  taunt**.
- "Loading track…" with a racing tip.
- **Start lights:** 🔴🔴🔴 → 🟢 at the exact race start.
- Length: about 8 seconds, timed to end at the start so it never eats race time. **Skip** for
  returning players. Revisit after playtesting.

### 7. Race ✅ (built)

3D track; each car's place follows its lineup's total % move, and every second the change in that
move works as the car's accelerator. Overtakes (sparks + commentary), nitro flame on a speed burst,
bot taunts (at most one every 20 s; Bot chat On/Quiet/Off), Overview and Chase cameras, Race/Chart
switch.

### 8. Chequered flag → Podium → Rewards ✅

Cars roll to a stop (built), then a **podium** (not built): positions, each driver's final move. Then
**rewards**: Gears (150 / 40; 50 / 10 in Scrimmage), XP, the bot's reaction, any car won or lost.
**Next race · Rematch · Garage.**

---

## F3 — Garage, Showroom, Car Market and car races ✅

Cars are cosmetic, owned assets. Gears are the currency. This flow decides where cars come from,
where they go, and what Gears are for.

### Where cars come from and go

| Source             | What happens                                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Starter car**    | Free, on first sign-in (F1). Can never be staked in a car race                                                                                                                                            |
| **Showroom** (new) | Buy a brand-new car from the game for Gears at the base price (Common 300, Rare 900, Epic 2,500, Legendary 7,000). Rare, Epic and Legendary have **limited weekly stock**. Gears spent here are destroyed |
| **Car Market**     | Buy from or sell to players and bots (built)                                                                                                                                                              |
| **Car race**       | Win your opponent's staked car, or lose yours                                                                                                                                                             |

### What Gears are for

Earned from races (F2) · spent in the **Showroom**, on **customising** (paint, decals, number plate)
and in the **Car Market**. Showroom and customising spend **destroys** the Gears, so they don't pile
up (the simulation showed bots reaching 3,000–6,000 with nothing to spend on).

### Garage

1. Your Gears and your cars (built), with **your last-used car marked** — it's the one the race flow
   pre-selects.
2. Each car: model, rarity, races, wins, status (available · staked · for sale at X) (built).
3. **Car history** (new): every owner and how it moved — "bought from the Showroom", "bought from
   ChartWizard for 450", "won from Rusty Rex in a car race".
4. **Customise** (new): paint, decals, number plate, priced in Gears, with a preview. Cosmetic only.
5. **Sell:** list at your own price, pre-filled with the going rate (built) — **or Sell now**: an
   instant sale to a bot at about 80% of the going rate (new).
6. Your NEAR account and the garage contract, linked (built).

### Car Market (built)

Going rate per tier with trend and reason · listings from players and bots, BOT tags, "Why:" lines,
Buy · recent sales with buyers' reasons · **Simulate a week**.

### Car race (new for players)

1. **Mode → Car race** → choose a car to stake. The starter car can't be picked.
2. Matched only against a car of the **same rarity**: a player if one is waiting, otherwise a bot.
3. **Confirm with a clear warning:** "Winner takes both cars. If you lose, this car leaves your
   garage."
4. Then the normal race flow from Track onwards; both cars are held by the contract during the race.
5. Result: the winner's garage gains the car (with a "won" moment); the loser sees it leave. The car's
   history records it.

Built today: contract escrow and the server side; bots already race for cars in Simulate a week.

---

## F4 — Tournaments ✅

Built today: create (name, public/private, length, payout, sector restriction, closing time), join
into groups in join order (groups of 4), groups race at close, group winners race a final. XP prizes
only.

### Create

Name · public or private (invite link) · race length · **group-stage track** · sector restriction
(optional) · closing time (= start) · prizes: **Gears from the game** (e.g. 1st 1,000 / 2nd 400 /
3rd 200), and optionally an **entry fee in Gears**, where the pot goes to the top 3. Gears are in-game
only.

### Registration → the draw

1. Players join until the closing time.
2. At close, players are ranked by XP into **pots** (Pot 1 = strongest).
3. **The draw:** an animated, shareable moment that places one player from each pot into each
   **group of 5**.
4. **Empty seats are filled by bots** (BOT tag, personalities, taunts), so every group races full.

### Groups → final

1. Each group runs the normal race flow (F2) on the group-stage track.
2. **Group winners advance.** With only 1–2 groups, the **top 2** advance, so the final always has at
   least 4 cars.
3. **The final runs on a different, marquee track** (e.g. groups at Interlagos, final at Monza).
4. Bots can win their group and the final, but **prizes skip bots** and go to the best-placed humans.

### Always-on cups

The game creates **scheduled cups** on its own, so there's always something to join: e.g. a **Daily
Monza Cup** (15-minute races, opens every morning) and a **Weekend Spa Classic** (the winner gets a
car).

States: humans short at close → still runs, bots fill (cancelled only if no human joined) · a player
who doesn't draft in time races with an auto-drafted lineup · the final waits for the last group to
finish.

---

## F5 — Leagues ✅

Built today: create (public, or private with an invite code), join by code, standings W / L / points
(3 per win), leave, delete. Today a member's win counts against **anyone**, so the table is really
members' overall records — this changes.

### How a league competes

1. **League night, weekly:** all members race on one grid (groups of 5 if the league is big) on the
   league's **home track**, chosen when the league is created.
2. **Standings** come from league-night results **plus any Versus race between two members**.
   Races against non-members don't count.
3. **Monthly seasons:** the season winner gets a **trophy badge and a Gears prize**, then the
   standings reset.

States: fewer than 2 members at league night → skipped that week, with a note · a member who doesn't
draft races with an auto-drafted lineup.

---

## F6 — Profile (Me), player cards and bot cards ✅

Built today: name, XP, rank, races resolved, badge cabinet, your leagues. No editing, settings,
rivals or public view.

### Me

- **Display name** (editable) and a **showcased car**
- **Stats:** races, wins, podiums, best sector
- **Badges:** pick up to 3 to show
- **Rivals:** each bot's mood towards you and your record, plus humans you race often
- Links to the **Garage** and your **NEAR account**
- **Settings:** name, bot chat (On / Quiet / Off), notifications, reduced motion, sign out

### Another player's card

Opened by tapping any name — leaderboard, race card, pre-race screen, result, league table. Shows
their name, showcased car, record, badges and **your head-to-head with them**. **Challenge** sends
them a Versus invite with your terms.

### A bot's card

Opened by tapping a bot anywhere. Shows its personality and racing style, its garage and Gears, **its
mood towards you** and your record, and its recent Car Market moves with their reasons.

---

## F7 — Daily trivia ✅

Built today: the Gauntlet — one question a day; a right answer gives XP and an automatic 24-hour
sector boost. Retired by this flow.

1. **Today's trivia:** 8 questions, about 1 minute in total, on the dashboard with your streak.
2. Start → questions one after another; a tap locks the answer, a quick right/wrong, then the next.
3. Time runs out → the remaining questions count as wrong.
4. **Result:** score X/8. **Pass at 4/8** → XP, and your **streak grows only on a pass**.
5. **Rewards:** a perfect **8/8 earns a Nitro canister**; a **7-day streak earns a pit-stop item**.
6. Already played today → your result and a countdown to the next set.

---

## F8 — Nitro & pit-stop ✅

Items you choose to use, not boosts that happen to you. Built today: an automatic ×1.25 sector boost
for 24 hours, and a "Free Hit" that only waives the AI draft agent's cost. Both are replaced.

### The items

| Item                          | What it does in one race                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| **Nitro**                     | Choose a sector; that sector's coin counts **×1.25**. Shows as the flame on your car |
| **Turbo** (was Captain)       | Choose one coin; its move counts **double**                                          |
| **Spare Tyre** (was Free Hit) | **Swap one coin** during the first 10% of the race                                   |
| **Shield**                    | Your **worst coin's loss is halved**                                                 |

### Rules

- **One item per race** (nitro and pit-stop items can't be combined), **max 3 per week**.
- Used in the **pre-race screen** (F2, step 6): a tray of what you own → choose one → choose its
  sector or coin → it's locked in for the race and shown on the result.
- **Getting items:** trivia (8/8 → Nitro), streaks (7 days → a pit-stop item), XP levels, or **buy
  with Gears** in the Showroom — still within the weekly cap, so nobody buys a win. Gears come from
  racing, never from money.

---

## F9 — Binary race mode ✅

Call coins up or down instead of drafting a lineup. Not built yet.

### Where it sits

The same stages as F2 (mode → car → track → … → pre-race → race → podium); only the draft step
changes:

1. **Pick any 5 coins** — no sector rule.
2. **Call each one up or down**, with the current price shown as the line to beat.
3. Lock → entry prices are taken at the race start.

Nitro and pit-stop items don't apply.

### Rules

- **Solo (vs the market):** get **3 of 5 right** and you win.
- **Against others** (Versus, tournaments): **most correct calls wins**; a tie goes to whoever was
  right by more, then rock-paper-scissors.
- **Lengths:** 5 minutes, 1 hour, 24 hours.
- **A flat price counts as wrong.** The result shows each coin's exact entry and exit price.

### On the track

**Five checkpoints spaced around the lap, one per call.** Each glows green or red live, by whether
that coin is on your side right now. The car's pace follows how many calls are right at that moment,
so it speeds up and slows down as calls flip. At the finish the checkpoints lock and the result shows
each call ✓ or ✗ with entry → exit.

---

## F10 — Simulate a week, and the bots' daily life ✅

Built today: a **Simulate a week** button on the Car Market page (signed-in players; one new week
every 3 minutes across everyone). It replays the last 7 real market days: each day the bots race in
pairs (half car-for-car), get paid Gears, then trade; the page fills in day by day.

- **Keep the button** for demos and for anyone curious.
- **New: the daily job plays one bot day on its own**, so the bots race, win and lose cars and trade
  every day even when no players are around. The economy moves without anyone touching it.
- Players' own cars and Gears are never touched by either.

---

## F11 — Install (PWA) and notifications ✅

Not built yet.

### Install

After your first finished race: **"Add CoinDraft to your home screen."** On iPhone it shows the
steps (Share → Add to Home Screen), because push notifications only work after that.

### Notifications

Each one is a toggle in Me → Settings, with **quiet hours** (default 22:00–08:00, local time):

- Match found · result is in
- Trivia is live · streak at risk
- Tournament closing / starting · league night tonight
- **A bot with a grudge has challenged you**
- Your car sold in the Car Market

---

## F12 — Sponsors and track ads ✅

Not built yet. Moved into the build (2026-11-13), not after launch. Payment method is a separate
decision.

1. **Sponsor portal** → **Sponsor a tournament** or **Book trackside ads**.
2. **Tournament:** name, dates, prize, branding (logo, livery on the cars) → preview → pay → your
   approval → live.
3. **Ads:** pick a **real circuit** and a slot (billboard, trackside banner, start/finish arch) on a
   map of the track, pick dates (booked dates unavailable), upload artwork → 3D preview → pay → your
   approval → live.
4. **Sponsor dashboard:** active and upcoming bookings, views, invoices.

---

All flows are agreed. Next: turn them into build tasks in `ROADMAP.md`.
