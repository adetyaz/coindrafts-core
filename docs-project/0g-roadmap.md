# 0G — What's Real Today, and What Each Option Is Worth

_Created 2026-08-28. Written after a direct audit of the codebase and live probes of the 0G Router. Every claim about what the API returns was tested, not read from documentation._

---

## Where we actually are

**0G is used in exactly one way: AI inference.** Three call sites, all behind `aiCompute.ts`:

| Call site | Purpose |
| --- | --- |
| `/api/mentor` | Streaming chat, grounded in live market data |
| `/api/breakdown` | Post-match result explanation |
| `draftAgent.ts` | AI draft agent's pick selection |

`USE_0G_COMPUTE=true`, pointed at **testnet**, model `qwen2.5-omni`. Verified working through the app.

0G chains are now selectable in the wallet, but **nothing uses them** — no contract, no transaction.

### The honest assessment

It's a **drop-in swap**. Flip the flag and Groq serves identically. **Nothing about the product would be different if 0G did not exist** — and on the current testnet model it is measurably worse: the draft agent picked USDT for a wildcard slot, a near-guaranteed zero, where Groq picked sensibly.

Today 0G is a config value, not a capability. Everything below is about changing that.

---

## What the Router actually gives us — probed, not assumed

A completion returns an `x_0g_trace` block:

```json
{
  "billing": { "input_cost": "10710000000000",
               "output_cost": "76320000000000",
               "total_cost": "87030000000000" },
  "provider": "0xa48f01287233509FD694a22Bf840225062E67836",
  "request_id": "23ff4dbb-9bc4-4186-9ec7-0ad720433a3a"
}
```

And the model catalogue advertises `"verifiability": "TeeTLS"`, `"tee_attested": true`, `"tee_type": "TDX"`, `"tee_verifier": "dstack"`.

**Important caveat, found by probing:** there is **no attestation endpoint on the Router** — `/attestation`, `/verify`, `/attestations`, `/tee/attestation` all return 404. So what we can capture per inference is a **provider address, a request id, and a signed billing record**, not a TDX quote we can verify ourselves. That is weaker than "cryptographic proof", and any claim built on it must be worded accordingly.

*(Also worth noting: 0G enforces `max_tokens` in `[10, 2048]`. Our call sites use 400, so they're fine — but it's a real constraint if any prompt ever needs more.)*

---

## Option A — Verified AI-assist receipts — ✅ BUILT 2026-08-29 (unverified)

**The problem it solves.** The draft agent charges **15 XP per slot**. That's a claim — *"we penalise AI-assisted drafting"* — that the app cannot currently back up. A player trusts the server; the server trusts itself. In a mode with a leaderboard, and later with money, "did you get AI help?" is exactly the kind of question that needs an answer better than *we say so*.

**What gets built.**
1. Store `provider`, `request_id` and billing from `x_0g_trace` against the lineup whenever the agent is used.
2. Mark the lineup as AI-assisted, with the slot count and XP charged.
3. Surface it on the result page and share card — *"3 slots drafted with AI · verified on 0G"* — with the request ids as the receipt.
4. Expose the receipt so an opponent can see it, not just the player.

**Value:** high, and unique to 0G. This is the only option that changes what the game *is* rather than what it runs on. It turns an unverifiable house rule into a public record, and it directly strengthens the leaderboard's integrity — the thing everything else is scored against.

**Cost:** small. One table, one write on the agent path, display work. No contracts, no new SDK.

**Be honest in the wording.** Without a verifiable attestation endpoint, this is a *tamper-evident receipt from a TEE-attested provider*, not a self-verifiable proof. Call it "verified on 0G" and not "cryptographically proven", or the claim outruns what we can show.

**Built state (2026-08-29):** trace capture in `aiCompute.ts`, an `ai_assists` table, a
receipt write on the agent path, and "✓ Assist verified on 0G" with the request id in
the draft panel. Two deliberate rules: **no trace, no receipt** — a procedural fallback
records nothing, since recording it as AI-assisted would be a lie against the player;
and the receipt write can never fail the request, because the picks are already made
and the XP already charged. **Not yet verified** — the `ai_assists` migration needs a
database. Points 3 and 4 above (result page, share card, opponent-visible) are still
outstanding.

---

## Option B — Agentic ID for bot personas (ERC-7857) — ❌ DECLINED 2026-08-29

**Dropped by your call.** The blocking question was *why would a player want to own
a bot?* — and the answer is that there isn't one. Bots exist to give beginners an
opponent in Scrimmage; ownership only means something if bots earn, compete or
improve, and none of that is on the roadmap.

Recorded rather than deleted so it doesn't get re-proposed: this was the most
*0G-native* option available and it maps to their flagship "buy and sell trained
trading bots" framing — but a feature that fits a partner's narrative and not the
product is the wrong reason to build. Would need a deployed ERC-7857 contract,
Storage for persona metadata, and a wallet flow, all in service of a capability
nobody asked for.

**Revisit only if** bots gain a reason to be owned — persistent records, earnings,
or player-trainable behaviour.

## Option C — Storage for settled results

**What it is.** Permanent, independently verifiable records of resolved contests in 0G Storage.

**Value:** conditional. The original plan proposed storing *free* contest results, which nobody would ever verify — that framing was weak and should be dropped. It earns its place only when a result is **disputable**: a paid tournament payout or a settled wager. Then "the record exists outside CoinDraft's database" is a real guarantee.

**Cost:** low–medium, and the SDK path is already covered by the installed `0g-storage-upload-file` skill.

**Blocked on:** money modes existing, which is blocked on the escrow decision. **Not blocked on 0G.**

---

## Option D — 0G Chain escrow

**What it is.** A Solidity escrow contract holding wager and tournament stakes.

**Value:** high *if* the on-chain route is chosen — it removes the custody question entirely rather than deferring it. Currently the only 0G-native option for holding money, since **0G Pay does not exist** (verified three ways).

**Cost:** medium. EVM-standard tooling; `viem` already ships the 0G chain definitions and the wallet now offers the networks, so the plumbing is in place.

**Blocked on a product decision, not engineering:** custodial vs on-chain. And a real consequence — an EVM escrow **excludes Solana-authenticated users**, who the app now supports.

---

## Option E — Testnet → mainnet

Everything today runs on **testnet**. Mainnet means real spend and a quality question: the testnet model (`qwen2.5-omni`) is visibly weaker than Groq's `gpt-oss-120b`.

**Value:** necessary before any 0G claim is more than a demo. **Cost:** low technically — different endpoint and key.

**Done 2026-08-29:** `402 insufficient_balance` is handled on all three call sites (503
with a clear message; the draft agent states no XP was charged). Also: `getAiClient()`
now **throws instead of silently falling back to Groq** when `USE_0G_COMPUTE=true` with
incomplete config — the old behaviour logged a warning nobody reads and served Groq
anyway, which would make a "verified on 0G" receipt meaningless.

**Mainnet catalogue, probed 2026-08-29:** 31 models vs testnet's 2, many TEE-attested.
Cheapest TEE-attested chatbots at a realistic agent call (~800 in / 400 out):
`qwen3-vl-30b` ~$0.00017, `deepseek-v4-flash` ~$0.00022, `qwen3.8-flash` ~$0.00024.
The Router's own pricing implies **1 0G ≈ $0.162**, so a 0.3 0G balance funds roughly
**200–280 agent calls**. Enough to test; not enough to leave running unattended.
**Still needs a human:** connect at `pc.0g.ai`, deposit, generate an `sk-` key.

---

## Ranked

| | Option | Value | Cost | Blocked on |
| --- | --- | --- | --- | --- |
| **1** | **A — Verified AI-assist receipts** | **High, unique** | **Small** | Nothing |
| 2 | E — Mainnet + `402` handling | Necessary | Low | Budget decision |
| 3 | C — Storage for settled results | Real, conditional | Low–med | Money modes |
| 4 | D — Chain escrow | High if chosen | Medium | Custodial vs on-chain |
| — | ~~B — Agentic ID~~ | **Declined** | — | Dropped 2026-08-29 — no reason to own a bot |

**Recommendation: A first.** It's the smallest build, needs no contract, isn't blocked on anything, and is the only item that makes 0G load-bearing in the product rather than a swappable backend. It also compounds — a verified-assist record is exactly the kind of thing Storage (C) would later anchor permanently.

**Then E**, because every claim made about 0G is a testnet claim until that happens.

_A and E's error-handling are built (A unverified, pending a database). B is declined. C and D remain blocked on decisions outside 0G._
