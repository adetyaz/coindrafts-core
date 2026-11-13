# What I need from you (NEAR hackathon)

Everything here is something only you can do: your accounts, your money, your name on the submission.
Tick them off as you go. **Never paste a private key or seed phrase into chat** — put keys straight
into `.env` yourself. I only ever need account names, links and yes/no answers.

---

## 1. Needed to submit (the entry doesn't count without these)

### 1.1 A mainnet NEAR account for the prize payout — ✅ `adetayo4422.near` (checked: exists on mainnet)
The rules say you create it yourself and give the organisers its name. Testnet won't do for this.

1. Install a NEAR wallet: [Meteor](https://meteorwallet.app), [HOT](https://hot-labs.org) or
   [Intear](https://wallet.intear.tech) (all free).
2. Create an account. Either:
   - a **named account** like `adetayo.near` (the wallet asks for a small amount of NEAR to create it), or
   - the free **implicit account** the wallet makes for you (a 64-character id).
3. Write down the seed phrase somewhere safe, offline.
4. **Send me only the account name** (e.g. `adetayo.near`).

### 1.2 Make the repository public — ✅ pushed (`hackathon/near` + `pre-hackathon` tag); ⬜ still private
Judges and their AI screening can't open a private repo.
2. GitHub → `adetyaz/coindrafts-core` → Settings → General → Danger Zone → **Change visibility → Public**.

### 1.3 Record the demo and post it on X
1. Record 1–3 minutes showing one full moment: sign in with email → draft 5 coins → the race →
   result → a car or Gears changing hands → the same move visible on the NEAR explorer.
2. I'll draft the post text. It must say it was built at **NEAR HACKATHON** and tag
   **@NEARProtocol** and **#NEARHackathon** (optional: @NearLegion @NearBuilders).
3. Post it from your account and **send me the link**.

### 1.4 Submission details (I'll fill the form; you confirm every field)
- Project name (I suggest **CoinDraft**)
- Team lead's name (as you want it shown)
- Contact email
- Team size (`1` if solo)
- Tracks: I suggest `games` and `nfts`
- Your **"yes"** to this, word for word: *"I agree that the organizers may use these details to
  review our submission and contact us about this hackathon."*

I print the full payload first and only send it after your yes. **There's one attempt** — mistakes
are fixed through their change-request page, not by submitting again.

---

## 2. Needed to finish and test the build

### 2.1 Reown dashboard: email + social login — ✅ socials already on
1. [cloud.reown.com](https://cloud.reown.com) → the project whose ID is `PUBLIC_REOWN_PROJECT_ID`.
2. Make sure **Email** and **Socials** (Google, X, Discord, Apple) are switched **on** — dashboard
   settings can override the code.
3. Under allowed domains, add `localhost` and your Vercel domain (`coindrafts.vercel.app`).

### 2.2 Test sign-in once
1. `npm run dev` → open the site → **Sign in** → choose **Email**.
2. Open `/api/garage`. You should see 1 car, 500 Gears and a NEAR account id.
3. Tell me what you see (or paste any error).

### 2.3 Vercel environment variables
The live site needs the same NEAR settings as your `.env`.
1. Vercel → coindrafts project → Settings → **Environment Variables**.
2. Add these, copying the values from your local `.env`:
   `CAR_LEDGER`, `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_CONTRACT_ID`, `NEAR_OPERATOR_ID`,
   `NEAR_OPERATOR_PRIVATE_KEY`.
3. Tell me when done.

### 2.4 Which branch goes live
The work is on `hackathon/near`. Decide whether Vercel should deploy it (merge into `main`, or set
the branch as production in Vercel). I'll do the git side once you say which.

---

## 3. NEAR mainnet: what it would take (not needed for the hackathon)

The rules allow **testnet for every track** (Q-010), and our contract is live on testnet. Mainnet
only matters for (1.1) the payout account now, and for launch later. If and when you want the game
on mainnet:

| Item | Mainnet value |
| --- | --- |
| Network | `mainnet` |
| RPC (free, public) | `https://free.rpc.fastnear.com` (listed in NEAR's docs). Others: `https://near.drpc.org`, `https://rpc.intea.rs`. Avoid `rpc.mainnet.near.org` — measured 4s+ and the testnet twin already rate-limits us |
| Explorer | `https://nearblocks.io` |
| Operator account (yours to create) | e.g. `coindraft.near`, made in a wallet like in 1.1 |
| Contract account | `garage.coindraft.near` (a sub-account of the operator) |
| Bot accounts | `<botname>.coindraft.near`, 0.1 NEAR each × 8 = 0.8 NEAR |

**Cost:** storage on NEAR is **1 NEAR per 100 KB** of data held by the contract
([NEAR docs](https://docs.near.org/protocol/storage/storage-staking)). The contract is 240 KB, so
about **2.4 NEAR** to deploy, plus a little per car and balance. **Budget ~5 NEAR** for the contract,
bots and gas to start.

**Steps (I do these only after your explicit go-ahead, since they spend real money):**
1. You create `coindraft.near` in a wallet and fund it with ~5 NEAR.
2. You add its key to `.env` (never in chat), or import it into the NEAR CLI on your machine.
3. I create `garage.coindraft.near`, deploy the same contract, and initialise it.
4. Switch `.env` and Vercel to: `NEAR_NETWORK=mainnet`, `NEAR_RPC_URL=https://free.rpc.fastnear.com`,
   `NEAR_CONTRACT_ID=garage.coindraft.near`, `NEAR_OPERATOR_ID=coindraft.near`,
   `NEAR_OPERATOR_PRIVATE_KEY=<the mainnet key>`.
5. Run `/api/cron/near-sync` to create the bots and their garages on mainnet.

---

## Already done (no action needed)

- Testnet operator `coindraft.testnet`, contract `garage.coindraft.testnet`, 8 bot accounts
- Testnet keys are in `C:\Users\PC\.near-credentials\testnet\` and the operator key is in `.env`
- Database tables for cars, Gears and the NEAR queue
