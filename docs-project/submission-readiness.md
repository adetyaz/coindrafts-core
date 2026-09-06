# CoinDraft — 0G Wave Submission Readiness

Compiled 2026-08-31, updated same day after 0G Storage + 0G Chain both went live and verified. Every status below is checked against the actual code/DB/repo — not assumed.

---

## 1. Project Information — ✅ done

**Name:** CoinDraft
**One-liner (≤30 words):** A fantasy-sports-style crypto drafting game — pick 5 tokens across L1/L2/DeFi/Meme/Wildcard, compete head-to-head or in tournaments, score on real price movement, powered by 0G Compute, Storage, and Chain.
**0G components used:** Compute, Storage, and Chain — all three, all verified live on testnet (see Section 3).

---

## 2. Code Repository — ✅ done

- **Repo:** [github.com/adetyaz/coindrafts](https://github.com/adetyaz/coindrafts) — public, pushed and up to date on `main`.
- **README:** updated — accurate tech stack (Postgres/Supabase, 0G Compute primary), required `.env` vars documented, links to `ARCHITECTURE.md`.
- **ARCHITECTURE.md:** written for judges — 0G integration section, core loop, known limitations, all backed by what's actually in the code.

Nothing open here.

---

## 3. 0G Integration Proof — ✅ real, verified, all three layers

**0G Compute** — live, testnet (`qwen2.5-omni`). Four features: AI Mentor, post-match breakdown, AI Draft Agent, Gauntlet/Word-of-Day generation. Verified via direct curl against the router, not just app logs. Every Draft Agent use logs a receipt (provider, request id, billing).

**0G Storage** — live, testnet. `@0gfoundation/0g-storage-ts-sdk` installed and verified with a real upload:
- Root hash: `0x268ee7dde6db4b1f630e0d0abafb72c8163465cb0a4fb0b57b8dd007af042a4f`
- Tx: `0x115e0f6ab4862d5eefac1d0781634f01564c25551488f1e262219903bebddaa2` (sequence 148898)

The AI-generated crypto vocabulary pool (feeds the Gauntlet's vocab questions and Word of the Day) writes here permanently.

**0G Chain** — live, testnet. `CoinDraftAchievements`, a soulbound, claim-based ERC-721 achievement contract:
- Contract: [`0xf1aff3eaaf85d61ba6ba61b8f5f9a7c5f7164a8d`](https://chainscan-galileo.0g.ai/address/0xf1aff3eaaf85d61ba6ba61b8f5f9a7c5f7164a8d)
- Signer authorized, 4 achievement types seeded — both confirmed on-chain, not just deployed.
- Design point worth highlighting to judges: badges are claimed by the player from their own wallet (a real transaction they approve and pay gas for), not pushed to them — every claim is independent, player-initiated on-chain activity.

**Still open:** everything above is testnet. Mainnet is the same setup, different endpoints and a funded deployer — not yet done.

---

## 4. Demo Video — ✅ done

Two versions recorded and live:
- [Coindraft Overview Demo](https://youtu.be/DVWOqzw5of8)
- [CoinDraft Full Demo](https://youtu.be/0E16bxQnfPw)

## 5. Documentation — ✅ done

`README.md`, `ARCHITECTURE.md`, and the in-app `/docs` page (rewritten this session — plain language, no jargon, dedicated "0G Integration" section, a step-by-step "How It Works" flow) all point at the same accurate picture. Nothing left to write here.

---

## 6. Public X Post (Mandatory) — ✅ posted

[x.com/cupoftreats/status/2095517444487954774](https://x.com/cupoftreats/status/2095517444487954774)

---

## 7. Optional Bonus Materials

**Explicitly optional — not required for submission.** Worth doing only if it improves your odds/presentation, not because the checklist demands it:
- **Pitch deck** — not started. Say the word and I'll draft one (problem → solution → 0G integration → what's next), but confirm you actually want it before I spend the time — it's genuinely optional per the checklist.
- **Testing notes** — real material exists: the wager mechanic and private-tournament access control were both verified live, 7/7 checks.
- **Frontend demo link** — no live deployed URL found anywhere in the repo (checked). If you have a real Vercel domain, send it and I'll add it everywhere a URL is expected.

---

## Bottom line

All sections (1-6) are done and verified. Pitch deck: requested, see `pitch-deck.md` / published artifact.

---

## Wave update text (as submitted to the form)

**Note 2026-08-31:** once the demo video checklist has been walked through and confirmed working, some of what's listed under "4th Wave" below (the mainnet migration specifically) starts **this** wave, not strictly next — the testnet work is done and verified, mainnet is a redeploy with real endpoints, not new engineering. Update the "Updates in this Wave" text with real mainnet addresses once that migration actually happens, rather than pre-claiming it here.

### Updates in this Wave
See the drafted copy already in this conversation (user-facing story of what a player can do, then the 0G Compute/Storage/Chain breakdown, then the non-0G fixes). Not duplicated here to avoid two copies drifting apart — pull it from the chat history when filling the form.

### 4th Wave
Mainnet migration (now starting this wave per the note above) + real-money wager settlement via a 0G Chain escrow.

### 5th Wave
Perks/boosts progression system (Captain, Shield, Free Hit — tied to badges), achievement catalog growth, tournament tie-breaking, spending limits, non-EVM badge claiming.
