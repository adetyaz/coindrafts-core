# Price Availability & Rate-Limiting Plan

_Created 2026-08-28. Every limit below was measured against the live APIs, not taken from docs. Goal: prices are always available, and when they aren't, the app knows it rather than silently pretending nothing moved._

---

## Why today's setup fails

Three faults, all verified in code or by request:

**1. Fan-out.** `getTokensWithPrices` issues **one request per token** — 30 in parallel per refresh — because SoSoValue has no batch endpoint. This is the direct cause of the `402901 Too many requests` responses that degrade the draft screen, and it now also sits on the bot-drafting path and the live race.

**2. The cache dies constantly.** It's an in-memory `Map` in a serverless runtime, so **every cold start starts from zero**. The TTLs suggest protection that mostly isn't there.

**3. A failure is indistinguishable from a flat market — the serious one.**

```js
export function extractPrice(snapshot: unknown): number {
  if (!snapshot || typeof snapshot !== 'object') return 0;   // ← outage → 0
```

`0` flows into scoring as `entry → entry`, i.e. **"this token didn't move."** A data outage silently becomes a legitimate-looking result. On a wagered game that's a payout decided by an API failure. This is hole #7 and it is the single most important thing on this page.

---

## The budget, measured

| Source | Limit (measured) | Cost of a full price refresh | Refreshes/min available |
| --- | --- | --- | --- |
| **Binance** | **6000 weight/min** | `/ticker/price` = **weight 4** (all 3,688 symbols) | **~1,500** |
| **CoinGecko** free | ~10–30/min (no headers returned) | 1 call for a batch of ids | Use sparingly |
| **SoSoValue** | Rate-limits at ~30 parallel | **30 calls** (1/token) | Already failing |

The comparison is stark: **one Binance call replaces thirty SoSoValue calls and costs 0.07% of the minute's budget.** Polling the whole market every 10 seconds spends 24 of 6000 weight — 0.4%.

**This is what makes the plan work.** With a batch source that cheap, most of the caching complexity stops being necessary — a cold start just re-fetches everything for weight 4.

---

## Design

### 1. One batch fetch behind everything

A single `getPrices()` serving draft, bots, race, and resolution:

```
Binance /ticker/price  →  Map<symbol, price>   (1 call, ~3s, weight 4)
```

Cached ~10s. Every consumer reads the map. **30 requests → 1.**

### 2. A source chain, not a single source

```
1. Binance      batch, 1m klines           26/30 of the pool
2. CoinGecko    batch, 5-min history       covers USDT · STETH · LEO · OKB
3. SoSoValue    per-token                  last resort for anything else
4. Last-known-good from the database       when everything is down
```

Each token resolves down the chain until something answers. A source that fails repeatedly is skipped for a cooldown rather than retried into its own rate limit.

### 3. Last-known-good store

A small table: `symbol · price · fetchedAt · source`. Written on every successful batch.

Two jobs: it survives cold starts (unlike the `Map`), and during a total outage it gives the app a real, *dated* price instead of a zero. Critically, **stale is labelled stale** — a caller can see the price is four minutes old and decide, rather than being handed a silent lie.

### 4. Never return 0 for a failure

The behaviour change that matters most:

```ts
// Now: number, where 0 means both "worthless" and "we don't know"
extractPrice(snap): number

// Proposed: absence is explicit
getPrice(symbol): { price: number; at: Date; source: string } | null
```

Then each caller decides deliberately:
- **Draft** — hide the token rather than show a false price.
- **Race** — hold the last point; don't draw a fake move to zero.
- **Resolution** — **refuse to resolve.** Better a contest settles late than settles wrong. This is the change that stops an API outage deciding a wagered game.

### 5. Rate budget per source

A token bucket per source, sized under the measured limits — Binance well inside 6000/min, CoinGecko deliberately throttled to a few calls/min since it only fills four tokens and returns no headers to guide us. Requests over budget wait rather than fire and get a 429.

---

## Sequence

**Phase 1 — batch fetch (biggest win, lowest risk).** Add Binance as the price source behind the existing interface, keep SoSoValue as fallback. Removes the fan-out immediately and fixes the rate-limiting on draft, bots and race in one change. Nothing else has to change to benefit.

**Phase 2 — never-zero.** Change the price accessor to return `null` on failure and handle it at each call site, resolution first. Correctness fix; must land before any real money.

**Phase 3 — last-known-good table + circuit breaker.** Resilience for cold starts and outages.

**Phase 4 — klines backfill.** Use Binance 1m klines to reconstruct the race for periods nobody watched, demoting `price_samples` to a fallback.

---

## Open questions

**Q1 — Symbol mapping.** Binance is `ETHUSDT`, CoinGecko is `ethereum`, SoSoValue is a numeric `currency_id`. Something has to hold that mapping. Hand-maintained is simple but drifts as the pool changes; deriving it costs a startup call per source. **This is the main new maintenance burden and worth a decision, not a default.**

**Q2 — Is a price mismatch across sources acceptable?** Binance USDT-pair and CoinGecko USD can differ slightly. If a lineup's entry price comes from one source and its exit from another, that difference lands in someone's score. Options: pin a contest to the source it started on, or accept the noise. **Matters much more once money is attached.**

**Q3 — Does Binance's coverage constrain the draft pool?** 26/30 today, but the pool is SoSoValue's top-N by market cap and will drift. If a token has no good price source, is it excluded from drafting?

**Q4 — Whitelisted SoSoValue key?** Still worth requesting in parallel. It wouldn't remove the need for a batch source — SoSoValue has no batch endpoint at any tier we've seen — but it would give 1m history from a source already integrated.

---

_Nothing here is built. Phase 1 is self-contained and would fix the rate-limiting you're already hitting; say the word and I'll start there._
