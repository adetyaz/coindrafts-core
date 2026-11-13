# CoinDraft — NEAR Hackathon Roadmap (suggested)

> Suggested plan for the ~48 hours of work left. Built from everything agreed in our sessions,
> the [Track 09 prompt](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/09-games.md)
> and [HACKATHON.md](https://nearhackathon.com/HACKATHON.md). `ROADMAP.md` stays the long-term source
> of truth; this file is the hackathon cut.

**Entry:** NEAR HACKATHON · Track `games` (Games With Real Economies), also tick `nfts`
**Pitch:** A racing game where the crypto market drives your car. Draft 5 coins, race bots and
players live; bots are NPCs with personalities, wallets and garages, and run a car economy on
NEAR that moves without us touching it. Players never see the chain.

---

## Where things stand (12 Nov)

- **No commits since 13 Oct.** Everything since then (0G removal, racing docs, RPS, league fixes,
  your own edits) is uncommitted. Judges only see work in the window (from 19 Oct), so it has to be
  committed.
- Built and working: drafting, live prices (Binance + SoSoValue), Versus, Scrimmage with 8 seeded
  bots, Draft Agent, tournaments, leagues, badges, RPS tiebreak (table not pushed yet), boosts.
- Not built: anything NEAR, the race view (only the 2D chart exists), Gears, Car Market, bot
  personalities, email/social login, simulate mode.

---

## Must have (the entry qualifies and the game loop is judgeable) · ~30h

| # | Task | Est. | Notes |
|---|---|---|---|
| M0 | **Commit and tag** | 1h | Commit current work in small commits. Tag `ec6fc95` as `pre-hackathon` (last commit before 19 Oct). `npm run db:push`. Save and remove the 0G wallet keys |
| M1 | **NEP-245 contract on testnet** (`contracts/near/`, Rust) | 6h | One contract holds **cars** (one token each) and **Gears** (in-game currency). Methods: mint, transfer, stake car into a race (escrow), settle (winner gets both). Deploy → `NEAR_CONTRACT_ID` |
| M2 | **Car ledger switch** (`src/lib/server/cars/`) | 3h | One interface, two backends: `db` and `near`, picked by `CAR_LEDGER`. Missing NEAR config falls back to `db` |
| M3 | **Server-managed NEAR accounts** | 3h | Players: implicit accounts, created on first sign-in. Bots: named accounts (`nina.coindraft.testnet`). Server pays gas. `near_account_id` on `users` |
| M4 | **Email / Google login** | 2h | Turn on Reown AppKit email + social login. No seed phrases, popups or gas prompts in the game loop. Wallet login stays for crypto players |
| M5 | **Race view with the accelerator** | 8h | Isometric Three.js track, 5 low-poly cars. Per-second prices (Binance live stream). Each second's move speeds the car up or down by that % (the accelerator); **the order is always the total move so far** (fair). Overtakes, nitro flame, finish line |
| M6 | **Short races + bots fill the grid** | 3h | Race lengths: 1 / 5 / 15 / 60 min + 24h. Empty slots fill with bots. Vercel Hobby crons run once a day, so races start when a player joins (bots join instantly), not on a server timer |
| M7 | **README for judges** + `LICENSE` | 2h | "Do X → see Y" steps; what's NEAR and built in the window vs baseline (Q-002/Q-003), link to the `pre-hackathon...hackathon-submission` diff; libraries used (Q-005) |
| M8 | **Video, X post, submission** | 2h | You record and post (tags: @NEARProtocol #NEARHackathon, optional @NearLegion @NearBuilders). I prepare the submission payload; you confirm before it's sent. Create your **mainnet** payout account |

## Should have (what wins the track) · ~14h

| # | Task | Est. | Notes |
|---|---|---|---|
| S1 | **Gears + Car Market** | 5h | Earn Gears by racing. Car Market: bots and players list cars; prices follow supply and demand (how many for sale, how fast they sell). Bots always buy something, so the market never feels empty |
| S2 | **Rules in one file + "why" tooltips** | 2h | `src/lib/economy/rules.ts`: car pricing, when bots sell or stake, how mood changes racing. Every bot decision stores a one-line reason shown as a tooltip |
| S3 | **Bot personalities + taunts** | 4h | Each bot: name, racing style, personality. Remembers every player in Postgres (stranger, cocky, afraid, grudge, respect). Written line bank per mood, filled with real details (your name, the coin); lines on the grid, on overtakes and on the result screen. Bot chat On / Quiet / Off |
| S4 | **Car-for-car race** | 2h | Stake a car (same tier), contract escrows both, winner takes both. Losing bot gets a grudge and may offer to buy its car back |
| S5 | **Simulate a week** button | 3h | Demo mode: bots race each other on recorded prices at high speed; cars change hands, prices move, broke bots fire-sell, rivalries form, in about a minute |

## Defaults decided (change any time)

- Cars are **cosmetic**: worth having for looks, rarity and access (you need a car of the right tier
  to enter that tier's car races). Never a speed advantage.
- Gears buy cars, paint, decals and garage space. **Nitro stays earned only** (trivia, challenges).
- Bot lines: written bank first; AI-written lines (Groq) later for the result screen.
- Testnet for the hackathon; NEAR Intents left out (it has no testnet).

## Game loop (the shape judges asked for)

- **Every 30 seconds:** your car reacts to the market each second; overtakes and taunts; fire nitro.
- **Every 5 minutes:** a race ends; Gears and maybe a car change hands; check the Car Market; join the next race.
- **Every session:** garage and rivals, offers from bots, tournaments, daily trivia, your record.

---

## Cut list (if time runs short, drop from the bottom up)

S5 → S4 → S2 tooltips (keep the rules file) → S3 AI-free lines only (already the plan) → race lengths
down to 1 and 5 min → Three.js polish (keep cars moving, overtakes, finish).

Never cut: M0, M1, M3, M7, M8. They decide whether the entry counts.

---

## After the hackathon (everything else we agreed, kept in `ROADMAP.md`)

- **Race:** weather (real local, cosmetic), multiple cameras, crashes and sparks, tap-a-car, live
  commentary, spectating any live race, Binance 1-minute backfill
- **Cars & garage:** shop in USDC (Base + Solana), paint and decals, rarity tiers, free starter car
  flow, NEAR mainnet (switchable to database)
- **Modes:** Binary race mode, 8-question daily trivia (pass 4/8), retire the Gauntlet
- **Re-theme:** boosts → nitro, perks → pit-stop items, XP → garage levels
- **Matchmaking:** preferences (mode, sector, duration, stake), RPS wired in
- **Tournaments:** groups of 5 seeded from pots, sponsored tournaments, track billboards and ad slots
- **Social:** race chat (quick lines, emotes, memory-suggested taunts), Me → Rivals, credibility per
  sector and best-callers ranking, race engineer that remembers you
- **Platform:** PWA + push notifications, README/ARCHITECTURE cleanup (0G mentions left)
- **Separate project:** createthings is the Tatum × Walrus entry; its plan lives in
  `create-things/Project Breakdown.md`
