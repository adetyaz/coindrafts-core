# CoinDraft — Master User Stories & Build Status

## Purpose

This is the single reference for "what's done vs. what's left," spanning Wave 1, Wave 2, Ranked Lobbies, Wave 3, and the UI Revamp. Every story below is tagged with its real, code-verified status (not the plan's intended status). Use this doc as the backlog going forward — new work should either close a ✅/🚧 story here or add a new one.

**Full rewrite 2026-08-24** — the previous version of this doc was badly stale (dated itself against "today = July 12, 2026," described Wave 3 as 0/8 built and the UI Revamp as not started — both now substantially complete). Every story below was re-verified against the actual current code, not carried forward from memory.

**Legend**

| Tag | Meaning |
| --- | --- |
| ✅ Done | Built, working, verified in code |
| 🚧 Partial | Built but incomplete, fragile, uneven, or stubbed |
| ⬜ Not started | No code exists for this |

**Persona:** Alex — a crypto-native user who likes fantasy sports and wants a competitive, social way to apply market research instead of just watching charts.

---

## Wave 1 — Core Loop

### Story 1.1 — Connect a wallet and get in ✅

Alex connects Phantom (or MetaMask) → signs a nonce message → session cookie is created → lands on the dashboard, no email/password anywhere.

*Built: Reown AppKit (EVM via SIWE, Solana via ed25519/tweetnacl), `/api/auth/nonce`, `/api/auth/verify`, httpOnly session cookie, protected-route redirect to `/?auth=required`.*

### Story 1.2 — See live market context before playing ✅

Dashboard shows sector performance and ETF whale-flow alerts pulled from SoSoValue, cached server-side.

*Built: `/api/sectors`, `/api/etf`, SoSoValue client with per-endpoint TTL cache + 429 retry.*

### Story 1.3 — Draft a 5-token lineup ✅

Alex picks one token each for L1 / L2 / DeFi / Meme / Wildcard from a live token pool, then locks the lineup.

*Built: `/draft` page, `/api/tokens`, `/api/contest/[id]/lineup`. Entry prices captured at lock time.*

### Story 1.4 — Contest resolves against real price movement ✅

After the contest window, picks are rescored from fresh snapshots and a winner is determined — automatically, not just when someone happens to load the result page.

*Built: `/api/contest/[id]/result`, shared `resolveContest()`, resolved lazily on result-page view **or** via the daily `cron/resolve-all` Vercel cron sweep. (Earlier versions of this doc flagged "no scheduler exists" — that's since been fixed.)*

### Story 1.5 — Get an AI explanation of the result ✅

Result page shows win/loss, score, per-pick breakdown, and a Groq-generated explanation using SoSoValue news context.

*Built: `/api/breakdown` (Groq `llama-3.3-70b-versatile`), degrades gracefully if Groq or news fetch fails.*

**Wave 1 status: complete.**

---

## Wave 2 — Real Multiplayer

### Story 2.1 — Find a real opponent, not a bot ✅

Alex clicks "Find Match," gets queued, and is matched against another live player — or a bot after a short window if no one's around.

*Built: `/matchmaking`, `/api/matchmaking/{join,status,leave}`. The old reliability bug is fixed: the queue used to be an in-memory `Map`, wiped on every serverless cold start — it's now a `matchmaking_queue` Postgres table, verified against the live DB.*

### Story 2.2 — Compete in a league with friends ✅

Alex creates a private league, gets an invite code, shares it, a friend joins, they play, and standings update automatically.

*Built: `/leagues`, `/leagues/[id]`, `/api/leagues*`. Standings update on contest resolution.*

### Story 2.3 — Earn XP and a draft boost from a daily challenge ✅

Alex answers a daily multiple-choice question on the dashboard; correct answers grant XP and a 24h sector boost visible on the matching draft slot.

*Built: `Gauntlet.svelte`, `/api/gauntlet/{today,answer,seed}`, `activeBoosts` jsonb on `users`. Self-heals on first request each day plus a daily cron (closes the old "someone has to manually seed it" gap). **Caveat carried into Wave 3:** the boost is earned and shown with an expiry, but `scoring.ts` never actually reads `activeBoosts` — it doesn't affect contest outcomes yet. See `new-feature-ideas.md` §7 for the formal perks/boosts definition now in progress.*

### Story 2.4 — Check global XP ranking ✅

Alex opens the leaderboard, sees a ranked list with medals for top 3, own row highlighted.

*Built: `/leaderboard`, `/api/leaderboard`.*

### Story 2.5 — Price feed via SoDEX ✅

Contest scoring has a working fallback price source beyond SoSoValue.

*Built: `getSodexPrice()`, confirmed against SoDEX's real Market Data API (which itself points at the same SoSoValue backend) and verified live against a real BTC price. SoDEX's separate on-chain Trading API (EIP712-signed) is a different, more complex integration and remains a TODO, not blocking.*

### Story 2.6 — Play a 7-day weekly contest ✅

Alex chooses "weekly" instead of "daily" when creating a contest, sees a 7-day window and 2× XP payout instead of the daily default.

*Built: Daily/Weekly toggle, real `windowDays`-driven resolution, draft-page badge. Two real bugs fixed while building this: `endAt` was hardcoded to 24h regardless of type, and both `/api/contests` and matchmaking's "reuse existing contest" logic ignored contest type entirely.*

### Story 2.7 — Ask an AI Mentor a live market question ✅

Alex opens a chat, asks a live-market question, gets a streamed answer grounded in live SoSoValue data, and recognized token tickers link to the draft screen.

*Built: `/mentor`, `/api/mentor`, streaming Groq responses. Verified live with a real streamed response.*

**Wave 2 status: complete — all 7 stories done.** (Previously 3 of 7 were stubbed/missing; all have since landed.)

---

## Wave 2.5 — Ranked Lobbies (3+ players)

**New wave — did not exist in the previous version of this doc.** Built as a parallel system alongside 1v1 contests, reusing the draft UI and scoring logic without touching `contests`/`matchmaking_queue`.

### Story L.1 — Quick-match into a ranked lobby ✅

Alex picks a lobby size (3/6/12) and gets auto-matched once enough players queue.

*Built: `lobby_queue` table, `/api/lobby/queue/{join,leave,status}`, `/lobby` page's quick-match view.*

### Story L.2 — Create or browse an open lobby ✅

Alex creates an open lobby, others browse and join by headcount, and the creator can start early.

*Built: `lobbies` + `lobby_participants` tables, `/api/lobby`, `/api/lobby/[id]/{join,start}`.*

### Story L.3 — Get ranked by placement, not binary win/loss ✅

A lobby of N players resolves into a full ranked table (1st through Nth) with placement-scaled XP, not a simple win/loss.

*Built: `/lobby/[id]/result`, `/api/lobby/[id]/result`, shares `scoreLineupPicks` with 1v1 contests.*

### Story L.4 — Lobbies resolve automatically ✅

*Built: `cron/resolve-lobbies`, same lazy-resolve-on-view + cron-sweep pattern as 1v1 contests.*

**Deliberately not built:**
- League-standings integration for lobby results — win/loss records don't map cleanly to "finished 3rd of 6."
- Bot-fallback for lobbies — an unfilled queue/lobby just sits; no synthetic opponents.

**Wave 2.5 status: complete for the built scope.**

---

## Wave 3 — Platform Polish

**Status: 6/8 built.** (Previously described as "0/8, nothing exists" — that was true when originally written; it isn't anymore.)

### Story 3.1 — Read research and earn a boost ✅

Alex browses sector-tagged articles pulled from SoSoValue news, reads one per day, earns XP + a boost.

*Built: `/research`, `research_reads` table, `/api/research/read`. Same "boost isn't wired into scoring yet" caveat as Story 2.3.*

### Story 3.2 — Unlock badges for milestones ✅

Alex wins their first contest and sees a badge toast. Badges for streaks and win milestones exist.

*Built: `user_badges`, `/api/badges`, `awardWinBadges()` — First Blood, On Fire/Unstoppable (streaks), Veteran/Champion (win counts), League Founder. League Championship badges not included — no season-resolution mechanic exists yet to determine a champion.*

### Story 3.3 — Try paper mode before risking anything ✅

Alex plays a no-stakes practice contest with separate XP tracking.

*Built: `contests.isPaper` flag, explicitly excluded from XP/streak/badge/league impact, "+Practice" entry point on dashboard.*

### Story 3.4 — Stake into a real-money prize pool ⬜

*Deliberately deferred — needs real payment/escrow infra, which doesn't exist. Now has concrete shape as two separate feature ideas (sponsor-funded tournaments, peer-to-peer wager mode) — see `new-feature-ideas.md` §1–2, still discussion-phase.*

### Story 3.5 — Responsible-play controls ⬜

*Deliberately deferred alongside 3.4 — matters most once real money is involved.*

### Story 3.6 — Share a result card ✅

After a match, Alex generates a result card and shares it, with a real link preview on X/Discord/etc.

*Built: `/api/contest/[id]/card` (SVG image generator) + `/share/[id]` (raw-HTML wrapper with real `og:`/Twitter meta tags for crawlers — a plain `+server.ts` endpoint specifically because the app runs `ssr: false` everywhere else and a normal `+page.svelte` would inherit the layout's wallet-SDK crash). **Known bug:** the wrapper's pick-chip styling still has leftover pre-rebrand purple (`#f0eff8`/`#534ab7`) hardcoded in — never updated when the brand color changed twice since.*

### Story 3.7 — Gauntlet questions generate themselves ✅

*Built: a cron pulls live sector/ETF/token data and writes each day's questions — no manual seeding needed.*

### Story 3.8 — Everything works on a 375px phone 🚧

*Partial. A code-level nav-overflow bug was found and fixed (superseded by the full nav rebuild in the UI Revamp section below — see Story U.5). But this has still never been visually verified in an actual real browser — every check so far has been typecheck + build + smoke-test, not eyeballing the rendered UI.*

---

## UI Revamp (design handoff)

**Status: core implementation done, visual-polish pass uneven.** The previous version of this doc described this as "0/4 stories built, direction locked but not started," targeting a `#FF6B35` orange with dark-as-default. **That plan has since been fully superseded** by a real design handoff (`CoinDraft.dc.html` + README) — different palette, different theme decision. Rewritten to match current reality:

_Note: the `CoinDraft.dc.html` source file itself is not present in this repo — only its output is, confirmed landed in `layout.css` and the rebuilt pages below. If the handoff is needed again (e.g. to extend the token system), it'll have to be re-sourced from wherever it was originally shared._

### Story U.1 — A real design token system exists ✅

*Built: `layout.css` has a full Tailwind v4 `@theme` block. Brand color is coral `#F78E79` (not the earlier `#FF6B35`), with a proper ink pairing (`#B04A32`) for text-on-coral contrast. Sector palette: L1 mint, L2 blue, DeFi amber, Meme shares the brand coral intentionally, Wildcard sky. Fonts: Archivo (UI/headings) + JetBrains Mono (all numbers/tickers/timers), self-hosted via Google Fonts in `app.html`.*

### Story U.2 — The app feels like a game, not a dashboard 🚧

*Partial — see Story U.4's page-by-page breakdown. Where it landed (dashboard, draft, matchmaking, lobby, results, mentor, profile), it's a real transformation: frosted-glass panels, dot-grid hero backgrounds, celebratory result reveals. Five pages haven't received it yet.*

### Story U.3 — Dark mode is the default experience ⬜ Superseded

*This decision was reversed, not left unbuilt. Dark mode has been **removed entirely** — no `data-theme` toggle exists anywhere in the code. The product is light-only now, per the design handoff. Don't treat this as a gap to close; it's an intentional direction change.*

### Story U.4 — Every page is rebuilt on the new system 🚧

*Checked which pages actually received the handoff's signature visual treatment (frosted panels, dot-grid heroes) versus just using the correct color tokens generically:*
- *Full treatment: landing, dashboard, draft, matchmaking, lobby (+ its result page), contest/result, leagues/[id], mentor, profile.*
- *Token-correct, plainer (no stale/hardcoded colors, just missing the extra polish): leaderboard, leagues (index page), research, guide, docs. Guide/docs being plainer matches the design PRD's own stated priority (visual-consistency only) — but leaderboard and research were flagged in that same PRD as needing a real pass and haven't gotten one.*

### Story U.5 — Nav is responsive and componentized ✅

*New story, not in the original 4. Nav was fully inline in `+layout.svelte` with zero mobile handling — would overflow under ~768px. Now extracted into `src/lib/components/Nav.svelte` (desktop pill nav + dropdown groups + wallet-connect/sign-in status), with a hamburger toggle collapsing into a stacked drawer below `md`. Desktop layout, hrefs, and link set unchanged from before.*

**UI Revamp status: 3 of 5 stories done, 1 done-but-partial (U.2/U.4 visual coverage), 1 superseded (U.3).**

---

## Known bugs / cleanup riding along with the above

- `/share/[id]`'s pick-chip colors are pre-rebrand purple (`#f0eff8`/`#534ab7`), never updated.
- **New, found in a full codebase read (2026-08-25):** `Toast.svelte` has the same bug, more broadly — every toast in the app (info/error/success) is still hardcoded to the pre-rebrand purple palette (`#eeedfe`/`#534ab7` info, `#faece7`/`#993c1d` error, `#0f6e56` success) instead of `layout.css` tokens. Wasn't on any prior list; this one hits every toast, not one share page.
- **New, same pass:** `src/lib/tokenRegistry.ts` is dead code — a hardcoded Wave-1 draft pool with every `currency_id` left as an empty string, fully superseded by the live `/api/tokens` SoSoValue integration. Nothing imports it; safe to delete.
- **New, same pass:** `stitch_exports/*.html` (4 files, ~1,770 lines: draft-screen, home-dashboard, live-contest, post-match-result) are early static design mockups, not wired into the app anywhere — legacy reference only.
- Boosts (`activeBoosts`) are earned and displayed but never read by `scoring.ts` — cosmetically real, functionally inert until the perks/boosts system in `new-feature-ideas.md` §7 gets built.
- 5 pages (leaderboard, leagues index, research, guide, docs) are token-correct but missing the design handoff's visual-polish pass.
- No automated tests exist anywhere in the project (per `AGENTS.md`) — manual QA only. No evidence this has changed.

**Resolved since the last version of this doc** (kept here as a record, not a live item): `manager`/`dashboard` duplication (now `manager` just redirects), hardcoded placeholder stats on that page, old email/password dead code (`/login`, `/signup`, the shadowed `db/` folder) — all removed.

---

## Suggested build order from here

1. **Visual browser verification** — the one real unknown left across both the UI Revamp and Story 3.8; everything else has been functionally verified but never actually seen rendered.
2. **The 5-page visual-polish pass** (leaderboard, leagues index, research, guide, docs) + the share-card color fix — smaller, well-scoped work.
3. **Vercel cron confirmation** — `CRON_SECRET` set, Hobby-vs-Pro plan check (Hobby caps crons at once/day).
4. **Perks & boosts** (`new-feature-ideas.md` §7) — closes the "boosts don't do anything" gap that's been carried since Wave 2.
5. From there: the rest of `new-feature-ideas.md` (sponsor tournaments, wager mode, time-based drafts, quiz leaderboard, AI draft advisor, visual race mode), and the 0G/Midnight integration decisions — pending the rubric.

_Living doc — update story status as work lands, add new stories rather than editing history out of old ones._
