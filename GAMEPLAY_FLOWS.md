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

Scrimmage (vs bots, practice) · Versus (1v1) · Tournament. Then race length: 1 min, 5 min, 10 min,
20 min, 45 min, 3 h, 24 h, 7 days.

### 2. Car 🧪

Choose one of your cars. Shows each car's model, rarity, races and wins. Cosmetic only — the screen
says so. If the car is staked or listed for sale it can't be picked (with the reason).

_Order note: car → track → draft is the one being tried. The alternative (draft first, then car and
track) stays on the table after playtesting._

### 3. Track ✅

Choose a circuit. **Tracks are real circuit shapes**, built from measured centerline data
([TUMFTM racetrack-database](https://github.com/TUMFTM/racetrack-database), 25 circuits, LGPL-3.0 —
credit required). Each has its own layout, corners and length; the 3D track is generated from the
data, not drawn by hand. Cosmetic only — results never depend on the track.

- Launch set: to be picked from the 25 (candidates: Spa, Monza, Silverstone, Suzuka, Interlagos,
  Zandvoort, Austin). ⏳
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

## Still to discuss ⏳

Car Market & car staking · Garage (equip, customise) · Simulate a week · Tournaments (pots, groups
of 5) · Leagues · Profile & settings · Daily trivia · Binary race mode · Shop · Nitro & pit-stop ·
PWA & notifications · Sponsors & track ads.
