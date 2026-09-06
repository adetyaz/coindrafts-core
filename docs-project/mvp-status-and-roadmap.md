# CoinDraft — MVP Status & Roadmap

_Working doc — this is the point-of-truth for "what's next." Update it as work lands. Refreshed 2026-08-24 after a full re-verification pass against the actual code — several things below had drifted from what was previously written here._

---

## 1. Wave 1 — Core Loop

**Status: ✅ Complete.**

- [x] Wallet-only auth (Reown AppKit — EVM via SIWE, Solana via ed25519/tweetnacl), session cookie, protected-route redirect
- [x] Live market context on the dashboard (sector performance, ETF whale-flow alerts) via SoSoValue, server-cached
- [x] 5-token draft (L1/L2/DeFi/Meme/Wildcard) with entry prices captured at lock time
- [x] Contest resolution against real price movement
- [x] AI-generated result explanation (Groq) — verified live this session after a key rotation

---

## 2. Wave 2 — Real Multiplayer

**Status: ✅ Complete.** Every story is built and verified — no gaps left.

- [x] Real-opponent matchmaking with 30s bot fallback
- [x] **Matchmaking queue reliability fix** — was an in-memory `Map`, wiped on every serverless cold start/redeploy. Now a `matchmaking_queue` Postgres table, verified against the live DB.
- [x] Private leagues with invite codes and auto-updating standings
- [x] Daily Gauntlet quiz (XP + 24h sector boost)
- [x] **Gauntlet auto-seeding + cron** — had been silently dead since 2026-06-04 (confirmed by querying the live DB). Now self-heals on first request each day and also runs via a daily Vercel cron.
- [x] **Contest resolution automated** — previously only resolved when a user happened to load the results page. Extracted a shared `resolveContest()` + hourly Vercel cron sweep.
- [x] Global XP leaderboard
- [x] **AI Mentor chat** (Story 2.7) — `/mentor` + `/api/mentor`, streaming Groq responses grounded in live sector/token/news data, recognized token tickers link to the draft screen. Verified live with a real streamed response.
- [x] **Weekly contest UI** (Story 2.6) — Daily/Weekly toggle on contest creation, real 7-day resolution window, real 2× XP payout, draft-page badge. Fixed two real bugs found while building this: `endAt` was hardcoded to 24h regardless of type, and both `/api/contests` and matchmaking's "reuse existing contest" logic ignored contest type entirely.
- [x] **SoDEX price feed** — was calling two dead guessed endpoints (one DNS-unresolvable, one 404s). Confirmed via SoDEX's real API docs that their Market Data API points at the same SoSoValue backend already wired up; fixed to call the real, working endpoint. Verified live against a real BTC price. (SoDEX's separate on-chain Trading API is a genuinely different, more complex integration — needs its own EIP712-signed API key setup that doesn't exist yet; documented as a TODO for later, not blocking.)

**Also fixed along the way (cleanup, not new features):**
- [x] Dead code removed — `/login`, `/signup`, their stubbed API routes, a shadowed duplicate `src/lib/server/db/` folder (old email/password schema from before the wallet-only pivot)
- [x] `/manager` and `/dashboard` merged into one canonical page — `/manager` is now a bare redirect to `/dashboard`, kept only so old links don't 404
- [x] `users.streak` wired up — existed in the schema and was displayed on the leaderboard, but was never actually incremented or reset anywhere (always 0). Now increments on a win, resets on a loss, inside `resolveContest()`.
- [x] `/api/news` fixed — SoSoValue's `/news/featured` endpoint started requiring a `pageNum` param at some point; was silently 400ing and returning nothing. Fixed and enriched (now includes per-article sector classification, used by Research Hub).

---

## 3. Ranked Lobbies (3+ players)

**Status: ✅ Built.** This entire system was missing from this doc — built after the last update and never recorded here.

- [x] Fixed-size quick-match queue (3/6/12 players) — `lobby_queue` table, auto-matches once enough players are queued
- [x] Open/browsable lobbies — create, browse by headcount, join, creator-controlled early start — `lobbies` + `lobby_participants` tables
- [x] Ranked-by-return results, distinct from 1v1's binary win/loss — placement-based XP payout, not win/loss XP
- [x] Shares the same draft UI, scoring (`scoreLineupPicks`), and badge-counting logic as 1v1 contests — additive system, doesn't touch `contests`/`matchmaking_queue`
- [x] Own cron sweep (`resolve-lobbies`) alongside the 1v1 sweep
- [ ] League-standings integration for lobby results — deliberately out of scope (win/loss records don't map cleanly to "finished 3rd of 6")
- [ ] Bot-fallback for lobbies — deliberately out of scope; an unfilled queue/lobby just sits, no synthetic opponents

---

## 4. Wave 3 — Platform Polish

**Status: 6/8 built** (engagement scope complete; two deliberately deferred).

- [x] **3.1 Research Hub** — sector-tagged news feed (real sector classification via token-symbol heuristic), reading one article/day earns XP + a 24h sector boost. Fixed the underlying `/api/news` bug as a prerequisite. **Boosts are earned and displayed but not yet applied in scoring** — `scoring.ts` never reads `activeBoosts`. See `new-feature-ideas.md` §7 for the formal perks/boosts definition now in progress.
- [x] **3.2 Achievement Badges** — First Blood, On Fire / Unstoppable (win streaks), Veteran / Champion (win milestones), League Founder. Toast on unlock, badge strip on dashboard. (League Championship badges not included — no season-resolution mechanic exists yet to determine a champion.)
- [x] **3.3 Paper Mode** — no-stakes practice contests with separate XP tracking, "+Practice" button on dashboard.
- [x] **3.6 Shareable Result Cards** — `/api/contest/[id]/card` (SVG image) + `/share/[id]` (raw-HTML wrapper with real `og:`/Twitter meta tags for link-preview crawlers, since the app runs `ssr: false` everywhere else). **Known bug**: the wrapper's pick-chip styling still has leftover pre-rebrand purple (`#f0eff8`/`#534ab7`) hardcoded in — never updated when the brand color changed. Small, but real.
- [x] **3.7 Self-Generating Gauntlet** — midnight cron now generates genuinely new daily questions from live market/sector data instead of just re-seeding a static 5-question bank.
- [x] **3.8 Mobile QA Pass** — code-level audit at 375px across every page; nav overflow found and fixed (superseded by the full nav rebuild in §5 below). Not visually verified in an actual browser.
- [ ] **3.4 Real-Money Prize Pools** — deliberately deferred. Needs real payment/escrow infra, which doesn't exist yet. Now has concrete feature ideas attached (sponsor tournaments, wager mode) — see `new-feature-ideas.md` §1–2.
- [ ] **3.5 Responsible-Play Controls** — deliberately deferred alongside 3.4 (daily caps / loss-streak cooldowns / risk disclaimers matter most once real money is involved).

---

## 5. UI Revamp (design handoff)

**Status: ✅ Core implementation complete, visual-polish pass uneven.** This section previously described an earlier, simpler token pass (`#FF6B35` orange, dark-default with a toggle) — that has since been **fully superseded** by a real design handoff (`CoinDraft.dc.html` + its README), verified against the actual current code, not memory:

- [x] **Design token system, rebuilt** — brand color is now coral `#F78E79` (not the earlier `#FF6B35`), with a proper ink pairing (`#B04A32`) for text-on-coral contrast. Sector palette: L1 mint, L2 blue, DeFi amber, Meme shares the brand coral intentionally, Wildcard sky. Fonts: Archivo (UI/headings) + JetBrains Mono (all numbers/tickers/timers), both self-hosted via Google Fonts in `app.html`.
- [x] **Dark mode removed entirely** — no `data-theme` toggle exists anywhere in the code anymore. The product is light-only now; this is a deliberate reversal of the earlier "dark-default" decision, not a regression to flag.
- [x] **Nav extracted into its own component** — `src/lib/components/Nav.svelte` holds the full desktop pill nav + dropdown groups (play/compete/learn/help) and the wallet-connect/sign-in status logic, previously inline in `+layout.svelte`.
- [x] **Mobile nav fixed** — was completely non-responsive (no wrap, no collapse, would overflow under ~768px). Now a hamburger toggle collapses the pill row into a stacked drawer below `md`; desktop layout, hrefs, and link set unchanged.
- [x] **Landing page rebuilt** to match the design handoff's actual Landing screen content (hero, floating draft-preview card, proof-feed marquee, format steps, sector explorer, stats, testimonials, footer) — not just token-converted, genuinely rebuilt.

**Visual treatment coverage is uneven** — checked which pages actually received the handoff's signature look (frosted-glass panels, dot-grid hero backgrounds) versus just using the correct color tokens generically without the extra polish:
- **Full visual treatment**: landing, dashboard, draft, matchmaking, lobby (+ its result page), contest/result, leagues/[id], mentor, profile
- **Token-correct, plainer**: leaderboard, leagues (index page), research, guide, docs — no stale/hardcoded colors, just missing the frosted-panel/dot-grid polish pass. Guide/docs being plainer matches the design PRD's own stated priority (visual-consistency only, not the microinteraction treatment core screens get) — but leaderboard and research were flagged in that same PRD as needing real design passes, and haven't gotten one yet.

**Known gap, unchanged from before:** none of this has been visually verified in an actual browser this session — every check so far has been typecheck + build + compiled-CSS/token inspection + HTTP-200 smoke tests, not eyeballing the rendered UI.

---

## 6. What Is Left (mechanical / needs you)

- [ ] **Visual browser pass** — still the single highest-priority remaining item. Nothing in the UI Revamp (old or new) has been eyeballed in a real browser.
- [ ] **Visual-polish pass on 5 pages** — leaderboard, leagues (index), research, guide, docs — currently token-correct but missing the frosted-panel/dot-grid treatment the rest of the app has.
- [ ] **Fix the leftover pre-rebrand purple — two spots, not one.** `/share/[id]`'s pick-chip colors were already known; a full codebase read (2026-08-25) found `Toast.svelte` has the identical hardcoded palette (`#eeedfe`/`#534ab7` info, `#faece7`/`#993c1d` error, `#0f6e56` success) across every toast in the app, never updated when the brand changed.
- [ ] **Dead-code cleanup, found in the same pass** — `src/lib/tokenRegistry.ts` (empty-`currency_id` Wave-1 draft pool, fully superseded by live `/api/tokens`) and `stitch_exports/*.html` (4 early static mockups, unwired into the app) can both be deleted.
- [ ] **Confirm the Vercel crons fire post-deploy** (`gauntlet/seed`, `cron/resolve-all` — now consolidated to one daily sweep covering both contests and lobbies) — needs `CRON_SECRET` set in Vercel project settings, and confirmation of Hobby vs. Pro plan (Hobby caps crons at once/day).
- [ ] Set up real browser-testing infra (Playwright or similar) as a project-level tool, so future UI changes can be verified without ad-hoc installs.

---

## 7. The Full MVP Goal

**Product:** CoinDraft — a fantasy-sports-style game where users draft a 5-token lineup across market sectors, compete against real price movement either head-to-head or in ranked multiplayer lobbies, and climb XP/league rankings. Wallet-only identity, no email/password, ever.

**The MVP is the union of Wave 1 + Wave 2 + Ranked Lobbies, functioning reliably end-to-end:**

1. [x] Connect a wallet, land on a dashboard with live market context.
2. [x] Draft a 5-token lineup (L1/L2/DeFi/Meme/Wildcard) against a live token pool.
3. [x] Get matched against a real opponent (1v1, with bot fallback) **or** join a ranked lobby (3/6/12 players) — contests/lobbies resolve automatically against real price movement, AI explains the result.
4. [x] Earn XP, keep a daily Gauntlet streak, climb a global leaderboard, compete inside private leagues with friends.
5. [x] Get AI help *during* the draft, not just after ("should I pick ETH or SOL?").
6. [x] Play either a daily or a weekly contest cadence.
7. [x] All of the above keeps working continuously, without needing a human to manually trigger anything.

**Every point above is done.** Wave 3's engagement layer (research, badges, paper mode, share cards, self-generating challenges) is also done on top of it, and the design handoff's core implementation (tokens, fonts, nav, landing) is in — the remaining gap is visual-verification and polish-pass work (§6), not missing product. Real-money prize pools and responsible-play controls remain deliberately deferred, now with real feature shape attached (`new-feature-ideas.md`).

---

## 8. Where To Go Next

1. **Visual browser verification** — the one real unknown left; everything else has been functionally verified but not seen.
2. **The 5-page visual-polish pass** and the share-card color fix — smaller, well-scoped.
3. **Vercel deploy + cron confirmation** — needs you (plan check, `CRON_SECRET`).
4. User stories derived from current state (in progress — see chat).
5. Then: 0G + Midnight integration decisions, new features from `new-feature-ideas.md`, and where each lands — pending the rubric.
