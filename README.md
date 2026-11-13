# CoinDraft

A racing game where the crypto market drives your car. Draft five coins, then race bots and other
players on a 3D track: every second, your lineup's price move speeds your car up or slows it down.
Winning pays **Gears**, the in-game currency. Cars and Gears live in one **NEP-245** contract on
**NEAR**, where bots with their own NEAR accounts buy, sell and race for cars — an economy that moves
without anyone editing a price. Players sign in with email or Google and never see a wallet, a seed
phrase or a gas prompt.

Built at **NEAR HACKATHON** · Track **Games With Real Economies** (`games`), also `nfts`.

- Live app: https://coindrafts.vercel.app
- Garage contract (testnet): [`garage.coindraft.testnet`](https://testnet.nearblocks.io/address/garage.coindraft.testnet)
- Game operator account: [`coindraft.testnet`](https://testnet.nearblocks.io/address/coindraft.testnet)

---

## The problem

Crypto games usually put the token first: players have to buy something, connect a wallet and pay
gas before they can play, and the "economy" is a price chart the developers control. CoinDraft puts
the game loop first. The market moves your car; the race result moves the economy; the chain records
who owns what, out of sight.

## How to try it

The quickest path is a 1-minute Scrimmage against a bot.

1. **Sign in** with email or Google (top right, _Sign in_).
   → You land signed in. Behind the scenes you get a NEAR account, a free car and 500 Gears.
2. Open **Garage → My garage** (`/garage`).
   → Your car, your Gears, your NEAR account and the garage contract, each linked to the explorer.
3. Open **Play → Scrimmage**, pick **1 min**, start, and draft one coin per sector.
   → The bot drafts too, in its own style, and you get its card: its personality, its mood towards
   you and a line it says on the grid.
4. Click **Watch the race**.
   → The 3D track. Your car (coral, with the marker) and the bot's move every second with the market.
   The order always follows each lineup's total move. Overtakes show sparks and a commentary line,
   and the bot answers in its own voice. Switch between _Overview_ and _Chase_ cameras.
5. When the clock hits zero the cars roll to a stop, then the **result** loads.
   → Your score, Gears earned (50 for a Scrimmage win, 10 for a loss) and the bot's reaction.
6. Open **Garage → Car Market** (`/car-market`).
   → The going rate for each car tier, with its trend and the reason it moved. Listings from bots,
   each with a _Why:_ line. Recent sales with the buyer's reason. Buy a car with your Gears.
7. On the same page, click **Simulate a week**.
   → The last 7 days of real market moves, replayed one day at a time: bots race each other (half
   of the races car-for-car, winner takes the loser's car), get paid, then trade. Each day shows who
   won, which cars changed hands and how prices moved; at the end, every bot's garage and Gears.
8. Open the garage contract on the explorer.
   → Your account's car and Gears, bot trades (`trade_car`), car-for-car races
   (`open_car_race` / `settle_car_race`) and race payouts (`mint_gears`), all as
   standard NEP-245 events.

Running locally instead: see [Run it locally](#run-it-locally).

---

## What's built on NEAR (in the hackathon window)

Everything below was written after the hackathon announcement (19 Oct 2026).

### The garage contract — [`contracts/near`](contracts/near)

One NEP-245 multi-token contract (Rust, `near-sdk` 5.30) holding every car and the Gears currency.

| Token      | What it is                                            |
| ---------- | ----------------------------------------------------- |
| `car:<id>` | One car, supply 1, with model, rarity, races and wins |
| `gears`    | Gears, minted for race results, moved by trades       |

The game server is the contract's **operator**. It mints cars and Gears and runs Car Market sales as
one atomic `trade_car` (Gears buyer → seller and car seller → buyer, all or nothing). The contract
also escrows cars for car-for-car races (`open_car_race` / `settle_car_race` / `cancel_car_race`, same
rarity only, winner takes every car); bots race for cars in **Simulate a week**, and a player-facing
screen for it isn't built yet.
Holders keep the standard NEP-245 transfers, `mt_transfer_call`, views and events.
8 unit tests; deployed and initialised on testnet. Details: [contracts/near/README.md](contracts/near/README.md).

### Accounts nobody has to manage

- **Players** get an _implicit_ NEAR account on first sign-in: no creation transaction, nothing to
  approve. Its key is stored encrypted, so a player can take full custody later.
- **Bots** get named accounts under the operator, e.g. `chartwizard.coindraft.testnet`.
- The server pays all gas. Sign-in is email, Google, X, Discord or Apple through Reown AppKit; crypto
  wallets still work.

### The economy

- **Race payouts:** every race result pays Gears (150 win / 40 loss; 50 / 10 in Scrimmage), recorded
  on the contract.
- **Car Market:** players and bots list and buy cars for Gears. A sale is claimed first, so two
  buyers can't both get a car, then settled with one `trade_car`.
- **Prices nobody sets:** [`src/lib/economy/rules.ts`](src/lib/economy/rules.ts) is one readable
  file with every pricing rule and every bot market decision. A tier's going rate drops 6% for each
  car for sale beyond three and rises 5% for each sale today. Every decision returns its reason in
  plain words, and those reasons are what the market shows.
- **Bots as NPCs with wallets:** after every race, bots list spares, fire-sell when broke, re-price
  listings the market has moved past, buy bargains and fill their garages — each according to its
  personality. Verified on testnet: bot-to-bot sales replayed as `trade_car`, with owners and balances
  matching the database and total Gears supply unchanged.
- **Bots with personalities:** eight bots, each with a draft style (momentum, buy-the-dip, steady,
  volatile, chaos), a trading temper and its own voice
  ([`src/lib/bots/personalities.ts`](src/lib/bots/personalities.ts)). Each remembers every player
  through their head-to-head, which sets its mood (stranger, cocky, afraid, grudge, respect) and what
  it says.

### How the chain stays out of the way

The game writes to Postgres first and never waits on the chain. Every on-chain change is queued in
`near_outbox` and replayed in order — up to 10 contract calls per transaction, one flusher at a time
(a Postgres advisory lock prevents double payouts) — from sign-in, the race result and a daily job. A
slow or failing RPC leaves rows queued, not a broken game. `CAR_LEDGER=db` turns NEAR off entirely
and the game keeps working.

Code: [`src/lib/server/cars/`](src/lib/server/cars) (ledger, NEAR client, outbox),
[`src/lib/server/market.ts`](src/lib/server/market.ts).

### The race

- [`src/lib/components/race/RaceTrack3D.svelte`](src/lib/components/race/RaceTrack3D.svelte): Three.js
  isometric track, low-poly cars, overtake sparks, nitro flame on a speed burst, Overview and Chase
  cameras.
- Per-second prices from Binance's public market-data stream in the browser
  ([`src/lib/race/priceStream.ts`](src/lib/race/priceStream.ts)); scoring always uses the server's
  locked entry and exit prices.
- Race lengths from 1 minute to 7 days.

---

## Baseline vs hackathon work (rules Q-002 to Q-004)

CoinDraft existed before the hackathon as a crypto fantasy draft game (wallet sign-in, drafting,
1v1 matches, tournaments, leagues, an AI draft agent). That is the baseline.

- Baseline: tag [`pre-hackathon`](https://github.com/adetyaz/coindrafts-core/tree/pre-hackathon)
  (last commit before 19 Oct 2026).
- Hackathon work: [`pre-hackathon...hackathon-submission`](https://github.com/adetyaz/coindrafts-core/compare/pre-hackathon...hackathon-submission)
  on branch `hackathon/near`.

New in the window: the NEAR contract, NEAR accounts, the car and Gears ledger, the Car Market, bot
personalities and memory, email/social sign-in, the 3D race, 1- and 5-minute races, Gears payouts.
Also in the window: removal of an earlier 0G integration.

---

## Run it locally

Needs Node 22, a Postgres database and (for the contract) Rust with `cargo-near`.

```sh
npm install
cp .env.example .env      # fill in the values; see below
npm run db:push           # create tables
npm run dev               # http://localhost:5173
```

Key settings in `.env`:

| Variable                                                            | What it's for                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`                                                      | Postgres                                                             |
| `PUBLIC_REOWN_PROJECT_ID`                                           | Sign-in (Reown AppKit)                                               |
| `SESSION_SECRET`                                                    | Session cookies; also encrypts player NEAR keys                      |
| `GROQ_API_KEY`                                                      | AI draft agent and post-race breakdown                               |
| `SOSOVALUE_API_KEY`                                                 | Market data (sectors, news, ETF flows)                               |
| `CAR_LEDGER`                                                        | `near` to record cars and Gears on NEAR, `db` to keep them off-chain |
| `NEAR_NETWORK`, `NEAR_RPC_URL`                                      | `testnet`, `https://rpc.testnet.fastnear.com`                        |
| `NEAR_CONTRACT_ID`, `NEAR_OPERATOR_ID`, `NEAR_OPERATOR_PRIVATE_KEY` | The garage contract and the account that operates it                 |
| `CRON_SECRET`                                                       | Protects the scheduled jobs                                          |

Seed the bots' NEAR accounts, garages and first market round:

```sh
curl -X POST http://localhost:5173/api/cron/near-sync -H "Authorization: Bearer $CRON_SECRET"
```

Contract: `cd contracts/near && cargo test && cargo near build non-reproducible-wasm --no-abi`.

## Stack and libraries

SvelteKit 2 + Svelte 5 · TypeScript · Tailwind CSS 4 · Drizzle ORM + Postgres · Three.js ·
near-api-js · Reown AppKit (wagmi, Solana adapter) · Groq · Binance public market data · SoSoValue API ·
Rust + near-sdk + cargo-near. Deployed on Vercel.

## More

- [Contract README](contracts/near/README.md)
- [Roadmap](ROADMAP.md) and [NEAR hackathon plan](NEAR_HACKATHON_ROADMAP.md)
- [Original product PRD](docs-project/PRD.md)

## License

[MIT](LICENSE)
