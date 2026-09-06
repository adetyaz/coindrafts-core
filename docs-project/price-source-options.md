# Price Sources — What's Actually Available

_Tested 2026-08-28 by calling each API directly. Every number below came back from a real request, not from documentation._

The race screen needs intraday prices. SoSoValue can't provide them on the current plan, so this is the survey of what can.

---

## The problem, precisely

Two separate limits, both verified:

**1. No intraday history.** `/currencies/{id}/klines?interval=X` exists, but anything finer than daily is refused:

```
400301 — Access denied: interval '1m' requires a whitelisted API key
        "only '1d' is available for your API key plan"
        "Contact support for full interval access"
```

`1d` works — 90 candles, 24-hour spacing. Fine for context, useless for a 10-minute game.

**2. No batch endpoint.** `/currencies/prices` and `/currencies/market-snapshot` look like batch routes but are parsed as `/currencies/{id}` with an invalid id. **One HTTP call per token is the only option**, which is why `getTokensWithPrices` fires 30 parallel requests and keeps hitting `402901 Too many requests`.

---

## Candidates, measured

| Source | Batch prices | Intraday | Key needed | Verdict |
| --- | --- | --- | --- | --- |
| **Binance** | ✅ **3,688 symbols in 1 call**, 3.0s | ✅ 1-minute klines | ❌ None | **Primary** |
| **CoinGecko** | ✅ Many ids in 1 call, 2.2s | ⚠️ 5-min spacing | ❌ None (free tier) | **Gap-filler** |
| **SoSoValue** | ❌ One call per token | ❌ Daily only | ✅ Yes | Keep for sectors/news |
| **CoinCap** | — | — | — | **Dead** — DNS no longer resolves |

### Binance — `api.binance.com`, no key

- `/api/v3/ticker/price` → **every symbol in one request**. Returned 3,688 in 3.0s.
- `/api/v3/klines?symbol=ETHUSDT&interval=1m` → real 1-minute candles, verified 60s spacing.
- Solves **both** problems at once: the rate-limiting *and* the missing history.

**Coverage against the live draft pool: 26 of 30 (87%).**
Found: BTC, ETH, BNB, USDC, XRP, ADA, DOGE, SOL, LTC, DOT, DAI, SHIB, WBTC, AVAX, UNI, TUSD, LINK, XMR, ATOM, ETC, XLM, GRAM, BCH, ICP, FIL, USDS.
Missing: **USDT, STETH, LEO, OKB**.

The misses are explainable rather than random: USDT is the quote currency (`USDTUSDT` can't exist — it's ≈ $1 by definition), STETH tracks ETH, and LEO and OKB are exchange tokens for competitors, so Binance will never list them.

### CoinGecko — `api.coingecko.com`, no key on free tier

- `/simple/price?ids=…&vs_currencies=usd` → batch, 2.2s.
- **Covers all four Binance misses**, confirmed live: `staked-ether $2472.85`, `leo-token $9.45`, `okb $111.59`.
- `/coins/{id}/market_chart?days=1` → 289 points over 23.9h = **5-minute spacing**.

Good enough for a 10-minute game (two points) but thin; better as a fallback than a primary. Free-tier rate limits are strict, and it needs a symbol→id mapping (`ETH` → `ethereum`), which is a real maintenance cost.

---

## Recommendation

**Binance primary, CoinGecko for the gaps, SoSoValue retained for what only it does.**

1. **Live prices → Binance `/ticker/price`.** One call replaces 30. This alone would fix the rate-limiting that already degrades the draft screen and the bot-drafting path, independent of the race.
2. **Race history → Binance 1m klines.** Real minute-by-minute history, including *before* anyone opened the page — which self-captured samples can never reconstruct.
3. **The four gaps → CoinGecko**, or treat stablecoins as $1 and map STETH→ETH.
4. **Keep SoSoValue** for sector spotlight, news, and ETF flows — no one else provides those, and they're what the app actually uses it for beyond raw prices.

**Still worth asking SoSoValue to whitelist the key.** It's a single support request, and if granted it gives 1m klines from the source already integrated — no new dependency, no symbol mapping. Worth doing in parallel; Binance is the answer if they say no or slow.

### What this would change in code

- `getTokensWithPrices` stops fanning out 30 requests — biggest single reliability win available right now.
- `price_samples` (already built) becomes a **fallback** rather than the only history, since klines can backfill.
- New concern: symbol→pair mapping (`ETH` → `ETHUSDT`) and a source-priority chain. Both are ordinary work, but they are new surface to maintain.

_Nothing here is wired in yet — this is the survey. Say which way to go and I'll build it._
