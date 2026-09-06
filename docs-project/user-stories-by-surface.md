# CoinDraft — User Stories by Surface (Pages, Features, Proposed)

_Created 2026-08-26. **This file is the canonical source.** A designed, read-only review copy is published as an Artifact (link at the bottom) — regenerate it from this file after edits rather than editing it separately._

## What this is, and why it's separate from `master-user-stories.md`

`master-user-stories.md` is organised by **build wave** — it answers "what did we ship, and when." This file is organised by **surface** — one story per page, per feature, and per proposed feature. It answers a different question: *"if I sit down to test this thing, what am I testing against, and where are the gaps?"*

The two are complements, not duplicates. Wave stories go stale the moment a wave closes; surface stories stay live for as long as the surface exists.

## The pattern (read this once, then the rest scans)

Every story below has exactly the same five parts, in the same order. That consistency is the point — holes show up as *thin or empty sections*, not as prose you have to hunt through.

| Part | What it's for |
| --- | --- |
| **Story** | One sentence, user's voice. If it can't be written in the user's voice, it's a task, not a story — and that's itself a finding. |
| **Where** | Route + the files that implement it. Makes every story directly testable and traceable. |
| **Acceptance criteria** | Numbered, independently checkable. This is the test script. |
| **Status** | One of six values below. |
| **Holes** | Explicit, named gaps. **An empty Holes section means "verified clean," not "not looked at."** |

### Status values — and why there are six, not three

The single biggest reporting problem across the existing docs is that **"built" and "working" are used interchangeably.** They aren't the same thing, and nearly every doc in `docs-project/` says somewhere that *nothing has been visually verified in a real browser*. So:

| Status | Meaning |
| --- | --- |
| `VERIFIED` | Built **and** confirmed working by an actual test. Rare right now. |
| `UNTESTED` | Code exists and typechecks. Nobody has confirmed it works. **This is the default state of most of this product.** |
| `PARTIAL` | Built, with known incompleteness. |
| `BROKEN` | Confirmed defect, evidence recorded. |
| `NOT BUILT` | No code exists. |
| `PROPOSED` | Idea only — see `new-feature-ideas.md`. |

---

# Part 0 — Findings from this pass (read before the stories)

Four defects found by reading the code on 2026-08-26, none of which appear in any existing doc. Two were serious. Each was **empirically verified**, not inferred. **All four are now fixed** (H-01 on 2026-08-29; H-02, H-03, H-04 during the Scrimmage/Single-Match build).

### ✅ H-01 — Session tokens forgeable — FIXED 2026-08-29 (was CRITICAL)

`createSessionToken` in [src/lib/server/auth.ts](../src/lib/server/auth.ts) signs like this:

```js
const sig = Buffer.from(`${payloadStr}${SESSION_SECRET}`).toString('base64').slice(0, 16);
```

Base64 encodes **sequentially** — 3 input bytes produce 4 output chars. `.slice(0, 16)` therefore keeps only the first **12 input bytes**. `payloadStr` is ~92 bytes. **The secret is appended after byte 92, so it never reaches the output at all.** The signature is a pure function of the payload; `SESSION_SECRET` contributes nothing.

Verified by running the real function with three different secrets:

```
signature w/ REAL secret   : ZXlKMWMyVnlTV1Fp
signature w/ WRONG secret  : ZXlKMWMyVnlTV1Fp
signature w/ EMPTY secret  : ZXlKMWMyVnlTV1Fp
```

And the full forge → parse round trip against the real server secret:

```
Forged token (attacker, no secret): eyJ1c2VySWQiOiJhYWFhYWFhYS1iYmJiLWNjY2Mt...
Server parse result: { userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ts: ... }
>>> SERVER ACCEPTED FORGED TOKEN AS VICTIM? true
```

**Impact:** anyone who knows (or guesses) a user id can mint a valid session cookie for that account. Every authenticated route trusts `parseSessionToken`. Leaderboard, XP, leagues, and contest integrity are all unenforceable while this stands. No real money is at risk today, which is the only reason this isn't an emergency — but it must be fixed before anything with stakes ships.

**Fix, applied:** [src/lib/server/auth.ts](../src/lib/server/auth.ts) now signs with real HMAC-SHA256, compared using `crypto.timingSafeEqual`. Verified live: a token forged the old way now returns **401** on every authenticated route, where it previously granted full account access. Also fixed: session expiry is now enforced (`ts` was written into every token and never read, so a leaked cookie was valid forever — sessions now expire after 7 days, matching the cookie), and a malformed/non-UUID `userId` in an otherwise-valid token is now rejected as a bad session (401) instead of crashing the route (500) when it hits the database.

### ✅ H-02 — Bot score contradicted the result, ~45% of the time — FIXED (Scrimmage build)

Two different formulas compute the bot's score, and they disagree.

[contest-resolution.ts](../src/lib/server/contest-resolution.ts) decides the winner with a **random** score that is never stored:
```js
scoreB = Math.max(0, scoreA - 120 + Math.random() * 220);
didAWin = scoreA >= scoreB;
```
[/api/contest/[id]/result](../src/routes/api/contest/[id]/result/+server.ts) displays a **fixed** one:
```js
opponentScore = Number(Math.max(0, total - 120 + 110).toFixed(0));  // always yourScore - 10
```

So the screen always shows the bot 10 points below you, while the actual outcome was decided by a dice roll. Simulated over 10,000 resolutions at a player score of 500:

```
Your score 500, displayed opponent score always 490
Runs where user LOST but screen shows them scoring HIGHER: 4529/10000 (45.3%)
```

**Impact:** nearly every other bot/practice loss displays as "YOU LOST — 500 / 490." The player sees themselves winning on points and being told they lost. Bot matches are the *default* first experience (30s matchmaking fallback, and all of Practice Mode), so this is most likely to hit brand-new users.

**Fix, applied:** Scrimmage bots now draft a real lineup at the same moment the human's entry prices are captured, so both sides run through the same real-scoring path — one score, computed once, read back on the result page. The synthetic-random branch shown above is now only reachable if bot assignment itself fails.

### ✅ H-03 — Practice-mode wins leaked into badges and win rate — FIXED (Scrimmage build)

Story 3.3 states Paper Mode is "explicitly excluded from XP/streak/badge/league impact." Two places break that:

1. [badges.ts](../src/lib/server/badges.ts) counts wins with **no `isPaper` filter**: `.where(eq(contests.winnerId, userId))`. The badge check is correctly *skipped* on a paper win, but when a later real win triggers it, the count includes every paper win. Win 9 practice + 1 real → "Veteran (10 wins)" unlocks.
2. [dashboard/+page.svelte](../src/routes/dashboard/+page.svelte) computes win rate over all resolved contests including paper — practice inflates the headline number on your own dashboard.

**Fix, applied:** `isPaper` excluded from `badges.ts`'s win count and from the win-rate calculation — in **three** places, not two: dashboard, and the profile page, which had the identical leak and was never in the original write-up.

### ✅ H-04 — Matchmaking could drop you into an old practice contest — MOSTLY FIXED

[/api/matchmaking/join](../src/routes/api/matchmaking/join/+server.ts) correctly filters for a live contest of the same `type`. [/api/matchmaking/status](../src/routes/api/matchmaking/status/+server.ts) filters by **neither `type` nor `isPaper`** — it returns any `live`/`open` contest. A player with an abandoned open practice contest who clicks "Find Match" gets `status: matched` on the first poll and is redirected into that stale paper contest instead of a ranked one.

**Fix, applied:** `isPaper` filters added to both `/status` and `/join` — the latter had the identical gap, undocumented until found while building Single Match. **The `type` half is not fixed:** `/status` still ignores contest type, so a live weekly contest can still satisfy a daily search. Lesser than the original bug, but real and open — see hole #33 in Part 4's ranked table.

**Fix applied 2026-08-27:** added `eq(contests.isPaper, false)` to the `status` endpoint's query. `type` was left unfiltered deliberately — the only live call site ([matchmaking/+page.svelte](../src/routes/matchmaking/+page.svelte)) always joins with `type: 'daily'` and never sends a type to `status`, so a type filter there has nothing to key off yet and would need new plumbing, not a bug fix. `npm run check` passes clean. **Not yet live-verified** — needs an actual abandoned-Scrimmage-contest-then-Find-Match run once DB connectivity is stable.

---

# Part 1 — Pages

One story per route. 18 routes.

---

### P-01 · Landing `/`
**Story:** As a visitor who has never heard of CoinDraft, I want to understand the game and start playing without reading documentation.
**Where:** [src/routes/+page.svelte](../src/routes/+page.svelte)
**Acceptance criteria:**
1. The format (5 sectors / one token each / 24h) is stated above the fold.
2. A visitor can connect a wallet without leaving the page.
3. A signed-in visitor sees "Go to dashboard" instead of a connect button.
4. Arriving with `?auth=required` shows a sign-in explanation.
5. The sector explorer switches content for all five sectors on click.
**Status:** `UNTESTED`
**Holes:**
- **Every statistic on this page is fabricated and presented as fact** — "30,811 players", "1,204 contests live", "12D 04H remaining", six named testimonials from users who don't exist, and hardcoded token prices (SOL $182.40, TAO $412.00). There is no story anywhere for "landing page shows real numbers," so this was never scoped as temporary. Fake social proof is a credibility risk and, depending on jurisdiction, a regulatory one.
- Footer links (Product / Season / Company columns) are plain `<span>` elements — they look like links and do nothing.

---

### P-02 · Dashboard `/dashboard`
**Story:** As a signed-in player, I want one screen that shows me the market right now and everything I can play, so I can decide what to do in under a minute.
**Where:** [src/routes/dashboard/+page.svelte](../src/routes/dashboard/+page.svelte)
**Acceptance criteria:**
1. Stats row reflects my real record (win rate, resolved count).
2. Sector performance and whale-flow alerts render from live data, with a stated fallback when the feed fails.
3. Today's Gauntlet is playable inline.
4. Badge strip shows earned vs. locked.
5. Hot tokens and news render from live feeds.
6. My contests list shows correct status and the right CTA per state (Continue draft / View result).
**Status:** `UNTESTED`
**Holes:**
- Win rate includes practice contests — see **H-03**.
- `/api/contests` returns **every** contest the user has ever played, unbounded and unpaginated, on every dashboard load. Fine at 5 contests, a problem at 500.
- Densest screen in the product and flagged in `design-prd.md` as needing a hierarchy pass — not yet done.

---

### P-03 · Draft `/draft`
**Story:** As a player, I want to fill five sector slots from a live token pool and lock my lineup, so I can enter a contest.
**Where:** [src/routes/draft/+page.svelte](../src/routes/draft/+page.svelte)
**Acceptance criteria:**
1. Exactly five slots, one per sector; a sector can hold only one token.
2. The same token cannot be used twice in one lineup.
3. Search and sector filters narrow the pool.
4. Removing a pick re-opens that slot.
5. "Lock lineup" is disabled until all five are filled.
6. Locking submits and redirects to the right result page for a contest **or** a lobby.
7. An active boost is visibly marked on the matching sector.
**Status:** `UNTESTED`
**Holes:**
- **The "45:00 to lock" countdown is decorative.** It starts from a hardcoded `45 * 60` on mount, is never derived from the contest's real `endAt`, and nothing happens when it reaches zero. It communicates a deadline that does not exist.
- **Projected score promises maths the engine doesn't do.** The projection applies `× 1.25` for a boosted sector, but `scoring.ts` never reads `activeBoosts` at all (**F-07**). The number shown is not the number that will be scored.
- No confirmation step before lock, despite lock being irreversible (`design-prd.md` §5 asks for one).

---

### P-04 · Matchmaking `/matchmaking`
**Story:** As a player, I want to be matched against a real opponent quickly, and never left waiting indefinitely.
**Where:** [src/routes/matchmaking/+page.svelte](../src/routes/matchmaking/+page.svelte)
**Acceptance criteria:**
1. The page opens on a duration picker — it does **not** auto-join a queue.
2. Choosing a duration and searching enqueues on that duration; only players who picked the same length are matched.
3. An elapsed timer is visible while searching.
4. Being matched redirects to the draft for that contest.
5. **No bot fallback, ever** — after 20s a "Try Scrimmage instead" panel appears while the real search continues.
6. Cancel leaves the queue and returns to the dashboard.
7. A 401 at any step redirects to sign-in rather than hanging.
**Status:** `PARTIAL` — rebuilt 2026-08-28 to match `G-02`. Duration selection and duration-matched queueing are built and verified against the database; the on-screen pass is still outstanding.
**Holes:**
- **A short game has no way to resolve on time.** Duration is now honoured (a 10-minute game really does end 10 minutes later, verified), but resolution still runs either lazily on result-page view or via a **once-daily** cron at `5 0 * * *`. A game finishing at 12:41 sits unresolved until someone opens it or until the next morning. **This is the biggest gap created by the duration work** and it lands hardest on exactly the short games the change was for.
- Every duration option splits the matching pool. Six options against a small player base means most buckets are empty — the Scrimmage suggestion covers it, but it is a mitigation, not a fix.
- Still hardcoded to `type: 'daily'` for the contest type it queues into; the 7-day option carries `type: 'weekly'` through the duration list, but that path is unexercised.
- `/api/matchmaking/status` still ignores contest `type` — the residual half of **H-04**. A live weekly contest can satisfy a daily search.

---

### P-05 · Lobby hub `/lobby`
**Story:** As a player who wants more than a duel, I want to join or create a multi-player room and be taken into the draft when it fills.
**Where:** [src/routes/lobby/+page.svelte](../src/routes/lobby/+page.svelte)
**Acceptance criteria:**
1. **Menu:** choose a quick-match size (4/6/8) or browse open lobbies.
2. **Quick-searching:** shows elapsed time; auto-matches when enough players queue; cancel works.
3. **Browse:** lists open lobbies with live headcount; joining works; full lobbies are not joinable.
4. **Waiting room:** headcount updates; creator can start early; leaving works.
5. When the lobby starts, every participant lands on the draft.
**Status:** `PARTIAL`
**Repositioning confirmed — see `G-04` (Multiplayer Mode).** Becomes one of three top-level mode choices; no functional change identified in the redesign beyond that.
**Holes:**
- **Cannot be tested by one person** (`testing-findings.md` #1, still open): no bot fallback for lobbies, quick-match has no start-early, and open-lobby start is disabled below 2 players. A solo tester can never reach the draft through this page.
- A lobby created from the UI never sets `maxSize`, so `size` is `null` — the waiting room renders a guessed seat count and the headcount shows "1" with no denominator.
- `pollWaitingRoom` infers "the lobby started" from *its absence from the waiting list*. A deleted, errored, or expired lobby is indistinguishable from a started one, and the player is redirected into a draft for a lobby that may not be live.
- Not in the `PROTECTED` route list, so it relies entirely on per-fetch 401 handling.

---

### P-06 · Lobby result `/lobby/[id]/result`
**Story:** As a lobby player, I want to see where I placed among everyone, not just whether I won.
**Where:** [src/routes/lobby/[id]/result/+page.svelte](../src/routes/lobby/[id]/result/+page.svelte)
**Acceptance criteria:**
1. Shows my placement as "N of M".
2. Full ranked standings with medals for the top three and my row highlighted.
3. XP earned per placement is shown.
4. My own pick breakdown is shown.
5. Badge unlocks toast on arrival.
6. Loading and error states are distinct and readable.
**Status:** `UNTESTED` — blocked from testing by **P-05**.
**Holes:**
- Reveal is instant, with no moment for placement (`design-prd.md` §5 calls this out specifically as needing its own treatment distinct from win/loss).
- Lobby results deliberately don't feed league standings — correct per plan, but there's no UI anywhere saying so, so a league player may expect them to count.

---

### P-07 · Contest result `/contest/result`
**Story:** As a player, I want to see whether I won, by how much, and why.
**Where:** [src/routes/contest/result/+page.svelte](../src/routes/contest/result/+page.svelte)
**Acceptance criteria:**
1. Win/loss state is unmistakable.
2. My score and my opponent's are both shown.
3. Per-pick breakdown with return % and points.
4. An AI explanation of the result appears, with a graceful fallback if unavailable.
5. Practice contests are clearly labelled and their XP marked as not counting.
6. Share is offered for real contests only.
**Status:** `BROKEN`
**Holes:**
- **Displayed opponent score contradicts the stated result in ~45% of bot contests — see H-02.** This is the emotional peak of the whole product and it currently lies to the player.
- **The page ships with realistic fake data as its initial state** (SOL +8.4%, PEPE +15.2%, "YOU WON 1482/1215"). Load `/contest/result` with no `contestId`, or with a fetch failure, and a fabricated result renders as though real.
- Reveal is a static render — no moment, despite being flagged as the top emotional priority in `design-prd.md`.

---

### P-08 · Leaderboard `/leaderboard`
**Story:** As a competitive player, I want to see where I rank globally and what it would take to move up.
**Where:** [src/routes/leaderboard/+page.svelte](../src/routes/leaderboard/+page.svelte)
**Acceptance criteria:**
1. Players ranked by XP, top three on a podium.
2. My row is highlighted wherever it falls.
3. Streaks are shown.
4. Empty state when there are no players.
**Status:** `UNTESTED`
**Holes:**
- Hard-capped at 50 players with no pagination. **If you are rank 51+, you cannot see yourself at all** — the page silently omits you with no indication.
- No rank-change indicator (`design-prd.md` flags this as a possible net-new feature, undecided).
- Listed in `mvp-status-and-roadmap.md` as still missing its visual-polish pass.

---

### P-09 · Leagues `/leagues`
**Story:** As a player with friends, I want to create a private league or join one by code.
**Where:** [src/routes/leagues/+page.svelte](../src/routes/leagues/+page.svelte)
**Acceptance criteria:**
1. Tabs for my leagues and public leagues.
2. Create flow with name + public/private choice.
3. Join flow accepting a 6-character invite code.
4. Founder badge toasts on first league creation.
5. Empty states for both tabs.
**Status:** `UNTESTED`
**Holes:**
- Invite codes are generated from `Math.random()` with **no collision check**, against a `unique` DB column — a collision throws a raw 500 rather than retrying.
- No way to leave a league, and no way to delete one you created.
- Missing its visual-polish pass.

---

### P-10 · League detail `/leagues/[id]`
**Story:** As a league member, I want to see the standings and share the invite code.
**Where:** [src/routes/leagues/[id]/+page.svelte](../src/routes/leagues/[id]/+page.svelte)
**Acceptance criteria:**
1. Standings ordered by points, with W/L.
2. Invite code shown to members of a private league, with copy-to-clipboard.
3. Season end date shown.
**Status:** `UNTESTED`
**Holes:**
- `/api/leagues/[id]` returns full league detail **including the invite code** to *any* signed-in user, member or not — there is no membership check on read. Anyone who can guess or obtain a league id can join a private league.
- Seasons have `seasonEnd` set 30 days out but **nothing resolves a season** — no champion, no reset, no archive. `master-user-stories.md` notes League Championship badges can't exist for this reason.

---

### P-11 · AI Mentor `/mentor`
**Story:** As a player unsure about a pick, I want to ask an AI grounded in live market data and get an answer I can act on immediately.
**Where:** [src/routes/mentor/+page.svelte](../src/routes/mentor/+page.svelte), [api/mentor](../src/routes/api/mentor/+server.ts)
**Acceptance criteria:**
1. Question streams back a response token by token.
2. Responses are grounded in live sector/token/news data.
3. Recognised tickers become chips that deep-link into the draft.
4. Suggested prompts are offered on an empty chat.
5. Failure surfaces a readable error, not a hang.
**Status:** `UNTESTED` (Groq path verified live per `mvp-status-and-roadmap.md`; 0G path verified by curl, not through the app)
**Holes:**
- Ticker detection matches any 2–10 char uppercase word (`\b[A-Z]{2,10}\b`), so ordinary words that collide with a symbol become draft links.
- Chat history is component state only — a refresh loses the conversation with no warning.
- Not in `PROTECTED`; renders fully for signed-out users and fails on send.

---

### P-12 · Research Hub `/research`
**Story:** As a player who'd rather read than draft today, I want to read a market briefing and earn something for it.
**Where:** [src/routes/research/+page.svelte](../src/routes/research/+page.svelte)
**Acceptance criteria:**
1. Sector-tagged article feed with working filters.
2. Expanding an article reveals its content.
3. The first expansion of the day awards XP + a 24h sector boost.
4. Active boosts and their remaining time are listed.
5. Repeat claims in the same day are refused clearly.
**Status:** `PARTIAL`
**Holes:**
- The boost is claimed by **expanding** an article, not by reading it — open and instantly collapse and you're paid. The mechanic rewards a click, not research, which undercuts "research is the cheat code" as a design principle.
- The sidebar advertises "×1.25" but boosts do nothing — see **F-07**.
- `boostClaimedToday` is client-only, so a refresh re-enables the claim UI; the server correctly refuses, but the UI invites a dead action.
- Missing its visual-polish pass.

---

### P-13 · Profile `/profile`
**Story:** As a player, I want one place showing my record, badges, leagues, and history.
**Where:** [src/routes/profile/+page.svelte](../src/routes/profile/+page.svelte)
**Acceptance criteria:**
1. Username, rank, streak, XP.
2. Badge cabinet with earned/locked states.
3. Recent contests with links to results.
4. My leagues.
**Status:** `UNTESTED`
**Holes:**
- Not in `PROTECTED` — a signed-out visitor gets a permanently blank page (the `{#if me}` never resolves) rather than a redirect.
- Username is auto-generated (`player_xxxxxx`) and **there is no way to change it**, despite the schema comment saying "user can update."
- Rank is derived from the top-50 leaderboard payload, so any player outside the top 50 shows no rank at all.

---

### P-14 · How to Use `/guide`
**Story:** As a new player, I want a walkthrough in the order I'll actually hit the screens.
**Where:** [src/routes/guide/+page.svelte](../src/routes/guide/+page.svelte)
**Acceptance criteria:** 1. Covers connect → draft → format choice → result → standings. 2. FAQ answers common questions. 3. Links out to `/docs` and `/dashboard`.
**Status:** `UNTESTED`
**Holes:**
- Documents mechanics that **don't work as described** — it says a Gauntlet boost applies to a draft slot, but boosts are inert (**F-07**). The guide is currently a promise the engine doesn't keep.
- States "the contest stays open until both sides submit" — worth confirming against the cron sweep, which resolves on `endAt` regardless.

---

### P-15 · Documentation `/docs`
**Story:** As someone evaluating CoinDraft, I want a single technical reference covering what exists and what doesn't.
**Where:** [src/routes/docs/+page.svelte](../src/routes/docs/+page.svelte)
**Acceptance criteria:** 1. Overview, sectors, waves, architecture, stack, limitations. 2. In-page nav. 3. Honest about deferred scope.
**Status:** `UNTESTED`
**Holes:**
- **Stale:** the stack table still says "Groq (Llama 3.3 70B)". The model is `openai/gpt-oss-120b`, and a 0G Compute path now exists behind a flag.
- Describes the product as "Solana-native," which contradicts wallet-first EVM+Solana support.
- Claims mobile is "responsive down to 375px, code-audited" — true, but never verified in a browser.

---

### P-16 · Share card `/share/[id]`
**Story:** As a player who just won, I want to post a card that looks good in a social feed and brings people back.
**Where:** [src/routes/share/[id]/+server.ts](../src/routes/share/[id]/+server.ts), [api/contest/[id]/card](../src/routes/api/contest/[id]/card/+server.ts)
**Acceptance criteria:**
1. Public, no session required (crawlers have no cookies).
2. Real `og:`/`twitter:` tags with a generated image.
3. Card shows picks, score, and win/loss.
4. Only resolved contests are shareable.
**Status:** `UNTESTED`
**Holes:**
- Pre-rebrand purple hardcoded in the pick chips (`#f0eff8`/`#534ab7`) — known, still open.
- The SVG duplicates sector hexes that live in `layout.css`; the file says to keep them in sync manually, which is a drift waiting to happen.
- Card renders `didWin` from `winnerId`, which is `null` for bot contests — so a bot **win** renders as a loss on the shared card.

---

### P-17 · Draft mechanic gallery `/design/pickers`
**Story:** As the builder, I want the five draft-interaction concepts side by side so I can commit to one.
**Where:** [src/routes/design/pickers/+page.svelte](../src/routes/design/pickers/+page.svelte)
**Status:** `UNTESTED` — internal decision record, deliberately unlinked from nav.
**Holes:** Reachable by anyone who guesses the URL, with no `noindex`. No decision has been recorded — the page poses a question that was never answered, and `/draft` shipped the slot-board without a written rationale.

---

### P-18 · `/manager` → `/dashboard`
**Story:** As a returning player with an old bookmark, I want it to land somewhere useful.
**Where:** [src/routes/manager/+page.server.ts](../src/routes/manager/+page.server.ts)
**Acceptance criteria:** 1. 308-redirects to `/dashboard`.
**Status:** `UNTESTED` — trivial, but never confirmed to fire.
**Holes:** None known.

---

# Part 2 — Features

Cross-cutting behaviour that isn't owned by a single page.

---

### F-01 · Wallet auth & session
**Story:** As a crypto-native user, I want to sign in by proving I own my wallet — no email, no password.
**Where:** [auth.ts](../src/lib/server/auth.ts), [api/auth/*](../src/routes/api/auth/), [Nav.svelte](../src/lib/components/Nav.svelte), [appkit.ts](../src/lib/appkit.ts)
**Acceptance criteria:**
1. EVM signs a SIWE message; Solana signs an ed25519 nonce.
2. A verified signature creates or finds the user and sets an httpOnly session cookie.
3. Protected routes redirect signed-out users.
4. Sign-out clears the session.
5. A failed signature is recoverable without a page reload.
**Status:** `UNTESTED` — the defect that made this `BROKEN` (H-01) is fixed; nothing below has been confirmed working in a browser.
**Holes:**
- `PROTECTED` covers only `/contest`, `/draft`, `/matchmaking`. `/lobby`, `/profile`, `/mentor`, `/research`, `/leagues`, `/leaderboard` are unprotected and degrade inconsistently.
- Nav auto-retries signing up to 3× on a 3s poll, which can re-prompt a user's wallet repeatedly after a deliberate rejection.
- An 0G Chain escrow (see **G-03**) would be EVM-only, structurally excluding Solana-authenticated users from any money mode.
- *Resolved 2026-08-29:* **H-01** (forgery), session expiry, and a database failure during sign-in now reports a real reason instead of a bare 500.

---

### F-02 · Navigation
**Story:** As a player, I want to reach any part of the app from anywhere, on any device.
**Where:** [Nav.svelte](../src/lib/components/Nav.svelte)
**Acceptance criteria:** 1. Grouped dropdowns (Play/Compete/Learn/Help). 2. Active route is indicated. 3. Below `md`, collapses to a hamburger drawer. 4. Shows wallet/XP state. 5. Click-outside closes menus.
**Status:** `UNTESTED`
**Holes:** Never verified in a real browser at any width — the single most-seen component in the product. Nav exposes `/contest/result` as a destination with no contest id, which lands on the fabricated placeholder result described in **P-07**.

---

### F-03 · Toasts
**Story:** As a player, I want brief confirmation that something happened.
**Where:** [Toast.svelte](../src/lib/components/Toast.svelte), [toast.ts](../src/lib/toast.ts)
**Acceptance criteria:** 1. Info/error/success variants. 2. Auto-dismiss. 3. Stacks without overlap.
**Status:** `PARTIAL`
**Holes:** Still on the **pre-rebrand purple palette**, hardcoded, for every toast in the app. Badge unlocks use the same generic style as errors, despite `design-prd.md` asking for a distinct celebratory treatment. Not dismissible by hand, and not announced to screen readers.

---

### F-04 · Price ticker
**Story:** As a player, I want ambient awareness that the market is live.
**Where:** [Ticker.svelte](../src/lib/components/ui/Ticker.svelte), [+layout.svelte](../src/routes/+layout.svelte)
**Acceptance criteria:** 1. Shows live 24h moves. 2. Scrolls continuously. 3. Absent, not broken, if the feed fails.
**Status:** `UNTESTED`
**Holes:** Fetched once on mount and never refreshed — on a long session it silently shows stale prices with no timestamp.

---

### F-05 · Daily Gauntlet
**Story:** As a player, I want one quick market question a day that teaches me something and pays out.
**Where:** [Gauntlet.svelte](../src/lib/components/Gauntlet.svelte), [gauntlet.ts](../src/lib/server/gauntlet.ts), [api/gauntlet/*](../src/routes/api/gauntlet/)
**Acceptance criteria:** 1. One question per day, generated from live data. 2. Self-seeds if the cron hasn't run. 3. Correct answer awards XP + a sector boost. 4. One attempt per user per day. 5. Result state persists on reload.
**Status:** `UNTESTED`
**Holes:**
- Questions are generated from *current* market data but graded against the answer stored at **seed time** — a "which token performed best today" question seeded at midnight can be factually wrong by evening, and the player is marked wrong for being right.
- The boost it awards does nothing (**F-07**).
- Day boundaries use server-local `toISOString()` (UTC) with no timezone handling, so "today" flips mid-evening for some users.

---

### F-06 · Badges
**Story:** As a player, I want lasting recognition for milestones.
**Where:** [badges.ts](../src/lib/server/badges.ts), [$lib/badges.ts](../src/lib/badges.ts)
**Acceptance criteria:** 1. Six badges, awarded idempotently. 2. Toast on unlock. 3. Earned/locked visible on dashboard and profile.
**Status:** `PARTIAL`
**Holes:** Practice wins inflate the counts — see **H-03**. Streak badges read the *current* streak, so a player who hits 5 and then loses can never earn "Unstoppable" retroactively even though they achieved it. League Championship badges are undeliverable until seasons resolve (**P-10**).

---

### F-07 · Boosts
**Story:** As a player who did the research, I want a measurable edge in my next contest.
**Where:** `users.activeBoosts`, [research/read](../src/routes/api/research/read/+server.ts), [gauntlet/answer](../src/routes/api/gauntlet/answer/+server.ts)
**Acceptance criteria:** 1. Earned from Research and Gauntlet. 2. Expire after 24h. 3. Visible on the draft slot. 4. **Change the score of the boosted sector.**
**Status:** `UNTESTED` — AC 4 is now built; nothing below has been confirmed working in a browser.
**Holes:**
- Expired boosts are never cleaned from the jsonb array; it grows forever.
- A boost you don't end up using (researched DeFi, drafted something else) is invisibly wasted — arguably correct, but the player is never told why nothing happened.
- *Resolved 2026-08-29:* `scoring.ts` now reads `activeBoosts`. `BOOST_MULTIPLIER` (1.25) lives in one place in `scoring.ts` so the advertised number and the engine can't drift apart again. The boost multiplies **movement, not score** (so it amplifies a loss too — multiplying the score would let a boosted losing pick beat an unboosted one), and it's judged at the contest's **scheduled end**, not "now", so a result can't depend on when someone opened the page.

---

### F-08 · XP, streaks & levelling
**Story:** As a player, I want a number that goes up and reflects how I'm doing.
**Where:** [contest-resolution.ts](../src/lib/server/contest-resolution.ts), [lobby-resolution.ts](../src/lib/server/lobby-resolution.ts)
**Acceptance criteria:** 1. Win 250 XP, loss 60 XP, ×2 weekly. 2. Lobbies pay on a placement curve. 3. Streak increments on a win, resets on a loss. 4. Paper XP tracked separately.
**Status:** `UNTESTED`
**Holes:** One shared `streak` counter is incremented by both 1v1 and lobby resolution, so "win streak" mixes two different competitions. There are no levels or tiers — XP is an unbounded number with no milestones, which limits how much progression it can carry.

---

### F-09 · Practice (paper) mode
**Story:** As a cautious new player, I want to learn the scoring system without it counting.
**Where:** `contests.isPaper`
**Acceptance criteria:** 1. Clearly labelled everywhere. 2. Bot opponent only. 3. **No effect on XP, streak, badges, leagues, or leaderboard.**
**Status:** `PARTIAL`
**⚠ Being redesigned — see `G-01` (Practice Mode).** The XP model itself is changing: from "zero real XP, fully separate pool" to "visible, nonzero practice XP, still a separate pool that never touches real rank" — a real behavior change, not just a rename. What's below is current, live behavior.
**Holes:** AC 3 is violated twice — badges and dashboard win rate (**H-03**). Also inherits the broken bot result display (**H-02**), which lands hardest here because practice is where new players start.

---

### F-10 · Daily vs. weekly contests
**Story:** As a player, I want to choose between a fast daily contest and a longer weekly one.
**Where:** [api/contests](../src/routes/api/contests/+server.ts), [lineup](../src/routes/api/contest/[id]/lineup/+server.ts)
**Acceptance criteria:** 1. Selectable at creation. 2. Real 1-day vs 7-day window. 3. Weekly pays ×2 XP. 4. Draft page shows which you're in.
**Status:** `UNTESTED`
**Holes:** Weekly can only be started from the dashboard — matchmaking is hardcoded to daily (**P-04**), so there is no way to be matched against a *real opponent* in a weekly contest.

---

### F-11 · Bot opponents
**Story:** As a player with nobody online, I want a credible opponent so I can still play.
**Where:** [contest-resolution.ts](../src/lib/server/contest-resolution.ts)
**Acceptance criteria:** 1. Created after 30s of failed matchmaking. 2. Produces a plausible score. 3. Result reads like a real match.
**Status:** `BROKEN`
**⚠ Superseded — see `G-02` (Single Match Mode).** The confirmed redesign removes bots from ranked play entirely; a real opponent is now a hard requirement there. Bots move exclusively to Practice Mode (`G-01`), where — per the H-02 investigation — the real fix was already sitting unused on the `bots-service` branch the whole time. What's below describes today's actual, broken, live behavior.
**Holes:**
- Score contradicts the outcome — **H-02**.
- The bot has **no lineup at all**. It never drafts; its score is a random number anchored to yours. The result page's per-pick "Opponent" column is therefore empty or fabricated for every bot match.
- A bot win sets `winnerId = null`, which is indistinguishable from "no winner" and renders as a loss on share cards (**P-16**).

---

### F-12 · Contest resolution
**Story:** As a player, I want my contest to settle on its own and be correct.
**Where:** [contest-resolution.ts](../src/lib/server/contest-resolution.ts), [cron/resolve-all](../src/routes/api/cron/resolve-all/+server.ts)
**Acceptance criteria:** 1. Resolves lazily when a result page loads. 2. A daily cron sweeps anything missed. 3. Idempotent. 4. Scores from fresh prices. 5. Updates XP, streak, badges, standings.
**Status:** `UNTESTED` — three real fixes landed since this was last confirmed; none re-verified in a browser.
**Holes:**
- Resolution is a long sequence of separate awaits with no transaction — a mid-way failure leaves a contest scored but XP unawarded, with no repair path.
- Vercel Hobby caps cron at once per day (documented, unconfirmed which plan is live) — no longer the only backstop, see below.
- *Resolved 2026-08-29, three separate fixes:*
  1. **Settle-on-demand closed.** Resolution now refuses to run before `endAt` — verified live: locking a lineup then immediately requesting the result returns `409 Contest is still running` instead of settling.
  2. **A missing price no longer scores as "didn't move."** `extractPrice` returning 0 on failure used to be read by scoring as entry===exit, so an API outage produced a real-looking result — with a wager attached, a payout decided by a dropped request. Resolution now refuses to score at all when any exit price is missing and retries later.
  3. **Short games nobody watches now finish.** A new `hooks.server.ts` runs a throttled, capped sweep on *any* request (not just the daily cron), so as long as somebody is using the site, everyone's due games resolve within about a minute rather than waiting up to 24h.

---

### F-13 · Lobby resolution
**Story:** As a lobby player, I want fair placement-based results.
**Where:** [lobby-resolution.ts](../src/lib/server/lobby-resolution.ts)
**Acceptance criteria:** 1. Every participant scored. 2. Ranked by score. 3. XP on a curve, 250 → 60. 4. Winner recorded. 5. Idempotent.
**Status:** `UNTESTED`
**Holes:** A participant who never drafted scores 0 and still receives last-place XP — no penalty for no-showing. Ties are broken by array order, silently. Same non-transactional risk as **F-12**.

---

### F-14 · Scoring engine
**Story:** As a player, I want to know exactly how my picks become points.
**Where:** [scoring.ts](../src/lib/server/scoring.ts)
**Acceptance criteria:** 1. Score derives from entry→exit % change. 2. Five slots weighted equally. 3. Clamped against extreme moves. 4. Documented and matches the UI.
**Status:** `UNTESTED`
**Holes:**
- Ignores boosts entirely (**F-07**), so the engine and the UI disagree.
- If a price fetch fails, `extractPrice` returns `0` and the pick is scored as `entry → entry` — **a data outage silently becomes "no movement" rather than an error**, and the contest resolves on incomplete data with no flag.
- The `+50 baseline` means a lineup that loses money still scores positive points; nothing in the UI explains this.

---

### F-15 · Leagues & standings
**Story:** As a group of friends, we want our own ladder.
**Where:** [api/leagues](../src/routes/api/leagues/), [contest-resolution.ts](../src/lib/server/contest-resolution.ts)
**Acceptance criteria:** 1. Create public/private. 2. Join by code. 3. W/L/points update automatically on resolution. 4. Founder badge.
**Status:** `UNTESTED`
**Holes:** Standings update **only for contests between two real users** — bot contests are skipped entirely, so a league member who plays mostly bots never moves. Lobby results don't count (by design, undocumented in-app). Private league detail is readable by any signed-in user (**P-10**). Seasons never end.

---

### F-16 · Share cards
**Story:** As a player, I want a good-looking card of my result for social.
**Where:** [resultCard.ts](../src/lib/server/resultCard.ts)
**Acceptance criteria:** 1. 1200×630 OG image. 2. Real link previews. 3. Public without auth. 4. Correct win/loss and picks.
**Status:** `UNTESTED`
**Holes:** Bot wins render as losses (**P-16**). Purple leftovers. Duplicated palette. Cached for an hour, so a card fetched before resolution could persist stale.

---

### F-17 · AI Mentor (service)
**Story:** As a player, I want live-data-grounded answers while I'm deciding.
**Where:** [api/mentor](../src/routes/api/mentor/+server.ts), [aiCompute.ts](../src/lib/server/aiCompute.ts)
**Acceptance criteria:** 1. Streams. 2. Grounded in live sector/token/news. 3. Trims history to 8 messages. 4. Fails to a readable error.
**Status:** `UNTESTED` in-app
**Holes:** Three upstream fetches run on every message with no caching of the assembled prompt. A stream that dies mid-response closes silently, leaving a truncated answer that looks complete. No rate limiting — an authenticated user can bill the account arbitrarily (now real money on 0G mainnet, see **F-21**).

---

### F-18 · AI result breakdown (service)
**Story:** As a player, I want a plain-English explanation of what moved my result.
**Where:** [api/breakdown](../src/routes/api/breakdown/+server.ts)
**Acceptance criteria:** 1. 2–3 sentences referencing my actual picks. 2. Uses news context when available. 3. Degrades to static copy on failure.
**Status:** `UNTESTED` in-app
**Holes:** Regenerated on every result-page view — never cached, despite the input being immutable once resolved. Same unmetered-cost exposure as **F-17**. For bot contests it explains a result derived from a fabricated opponent score (**H-02**).

---

### F-19 · Research reads
**Story:** As a player, I want reading real market news to be worth doing.
**Where:** [api/research/read](../src/routes/api/research/read/+server.ts)
**Acceptance criteria:** 1. One boost-earning read per day. 2. Awards XP + sector boost. 3. Sector inferred from the article.
**Status:** `PARTIAL`
**Holes:** Rewards expansion, not reading (**P-12**). Sector classification is a hardcoded symbol list in [sectors.ts](../src/lib/sectors.ts) that misses anything unlisted and buckets it as Wildcard — so Wildcard boosts are over-awarded. The reward is inert (**F-07**).

---

### F-20 · Market data (SoSoValue / SoDEX)
**Story:** As a player, I want to trust that prices and scores are real.
**Where:** [sosovalue.ts](../src/lib/server/sosovalue.ts), [sodex.ts](../src/lib/server/sodex.ts)
**Acceptance criteria:** 1. Server-side only. 2. Cached with sane TTLs. 3. Retries on 429 with a bounded wait. 4. Degrades gracefully.
**Status:** `UNTESTED` — rebuilt on a batch price source; not yet re-verified in a browser.
**Where (updated):** [prices.ts](../src/lib/server/prices.ts) (new) · [sosovalue.ts](../src/lib/server/sosovalue.ts) · [sodex.ts](../src/lib/server/sodex.ts)
**Holes:**
- `getSodexPrice` is a pass-through to the same SoSoValue endpoint, so the documented "fallback price source" is **not an independent source at all** — if SoSoValue is down, both are down.
- Tokens the batch source can't price (a handful of long-tail stablecoins/wrappers) are excluded from the pool entirely rather than shown — correct, since an unpriceable token can't be scored, but it narrows the board slightly.
- *Resolved 2026-08-29:* the whole fan-out problem. One Binance `/ticker/24hr` call now returns price, 24h change and volume for the entire market (measured: weight 80 of a 6,000/min budget) in place of 30 parallel SoSoValue snapshot requests. That removed the pool-size cap — 30 → 173 tokens, Solana-ecosystem tokens (JUP, BONK, WIF, RAY...) now draftable for the first time. It also let every stablecoin and wrapped-duplicate (USDT, USDC, WBTC, stETH...) be excluded outright: the game scores on price movement, so a stablecoin was a guaranteed-near-zero pick, and the AI draft agent had actually been choosing one.

---

### F-21 · 0G Compute inference backend
**Story:** As the operator, I want to run the app's AI on decentralised, TEE-verifiable compute without rewriting the app.
**Where:** [aiCompute.ts](../src/lib/server/aiCompute.ts), `.env`
**Acceptance criteria:**
1. Feature-flagged; Groq remains the default and the fallback.
2. Falls back safely if the flag is on but config is incomplete.
3. Both mentor (streaming) and breakdown (non-streaming) work through it.
4. Testnet and mainnet are separately configurable.
**Status:** `PARTIAL` — API verified by curl (200, correct completion, billing recorded, SSE confirmed); **never exercised through the app**, flag still off.
**Holes:**
- Testnet's only chat model is `qwen2.5-omni` — materially smaller than Groq's `openai/gpt-oss-120b`. **The quality/latency comparison that the original plan called for has still never been run.**
- No handling for `402 insufficient_balance` — a genuinely new failure mode. On mainnet that's real money, and it currently surfaces as a generic 502.
- No balance monitoring (needs a separate `mk-` management key).
- Mainnet model availability unverified.
- Submission deadline **2026-08-30** — 4 days out.

---

### F-22 · Design token system
**Story:** As a builder, I want one place to change a colour and have it propagate.
**Where:** [layout.css](../src/routes/layout.css)
**Acceptance criteria:** 1. All colour defined once as CSS custom properties. 2. Light-only, deliberately. 3. Archivo + JetBrains Mono. 4. Reduced-motion respected.
**Status:** `VERIFIED` (by inspection of compiled CSS)
**Holes:** The "never hardcode a hex outside this file" rule is violated in at least three places — `Toast.svelte`, `share/[id]`, and `resultCard.ts`. Five pages remain token-correct but unstyled.

---

### F-23 · Responsive / mobile
**Story:** As a phone user, I want the whole product to work at 375px.
**Acceptance criteria:** 1. No horizontal scroll on any page. 2. Nav collapses. 3. Tables scroll within their container. 4. Tap targets adequate.
**Status:** `UNTESTED`
**Holes:** **Never opened in a real browser or on a real device** — the single most-repeated gap across every doc in this folder. Every "responsive" claim in the product is a code-reading claim.

---

### F-24 · Scheduled automation
**Story:** As the operator, I want the game to keep running with nobody watching.
**Where:** [vercel.json](../vercel.json), [api/cron/*](../src/routes/api/cron/)
**Acceptance criteria:** 1. Daily Gauntlet seed. 2. Daily resolution sweep. 3. `CRON_SECRET`-protected. 4. Manual POST trigger retained.
**Status:** `UNTESTED`
**Holes:** **Never confirmed to fire in production** — needs `CRON_SECRET` set in Vercel and a Hobby-vs-Pro plan check. Two orphaned endpoints (`resolve-contests`, `resolve-lobbies`) are still deployed but unscheduled. If `CRON_SECRET` is unset the guard passes silently, leaving the endpoints publicly triggerable.

---

# Part 3 — Proposed features

From `new-feature-ideas.md` and the 0G/Midnight tracks. All `PROPOSED` — written as stories so gaps are visible *before* build, which is the cheapest place to find them.

---

~~X-01 · Sponsor-funded tournaments~~ **Fully absorbed into `G-05` (Tournament Mode)** — that entry now covers sponsor tournaments plus public/private access, funding models, payout structures, brackets, and sector restriction. Removed here to avoid two entries for the same feature; see `G-05` for the current spec and its actual open questions.

~~X-02 · Peer-to-peer wager mode~~ **Fully absorbed into `G-03` (Wager Mode)** — that entry now covers the full confirmed negotiation flow (18+ gate, propose/accept/counter/decline, timeout default). Removed here; see `G-03`. Still gates **X-07**.

### X-03 · Time-based draft modes
**Story:** As a player, I want to pick a contest length that fits my day — from an hour to a season.
**Fits existing architecture:** yes — `startAt`/`endAt`/`windowDays` already drive resolution.
**Blocking unknowns:** is "hot hour" scheduled or on-demand; does it apply to lobbies too; how long is "long game."
**Note:** cheapest real feature on this list, and a precondition for **X-05**.

### X-04 · Quiz leaderboard & badges
**Story:** As a player who's better at trivia than trading, I want a progression track of my own.
**Fits existing architecture:** yes — reuses leaderboard and badge shapes over `gauntlet_attempts`.
**Blocking unknowns:** separate badge category or folded into the existing six; season-scoped or all-time.
**Note:** blocked in spirit by **F-05**'s correctness bug — a leaderboard over questions that can be graded wrong would harden a defect into a ranking.

### X-05 · Visual race mode — now `G-12`, built 2026-08-29
**Story:** As a player in a short contest, I want to watch my five tokens race in real time.
**Where:** [/game/[id]](../src/routes/game/[id]/+page.svelte), [api/contest/[id]/live](../src/routes/api/contest/[id]/live/+server.ts), `price_samples` table.
**Status:** `UNTESTED` — built, API-verified, not yet seen on screen.
**What shipped:** the blocking unknown was interval price capture, which genuinely didn't exist — scoring still only compares two points (entry/exit), and that hasn't changed. Rather than change scoring, the app now **self-captures** a price series into `price_samples` while a game is being watched: the live endpoint samples on each poll (throttled to one write per 6s regardless of viewer count) and returns the accumulated history, which a uPlot chart (`RaceChart.svelte`) renders as smoothed, spring-animated lines — solid for your own picks, dashed for the opponent's, with a glowing leading-edge dot. A start screen (both lineups + locked entry prices) precedes it; the reveal doesn't replace the result page, it leads into it. Both players' five tokens race, not the whole room (no room concept applies at 1v1).
**Holes:** no history exists for periods nobody was watching — a game nobody opens has no graph, since capture is viewer-driven. Sampling every 6s is a deliberate compromise between a smooth line and load on the price layer.

~~X-06 · AI draft advisor with XP handicap~~ **Fully absorbed into `G-06` (AI Draft Agent)** — every open question this entry had is now answered: it can fully auto-draft (not just "open it or act on a suggestion"), the penalty confirmed to scale with usage, and the backend confirmed as 0G Compute (same model as Mentor). Removed here; see `G-06`.

### X-07 · Helper tokens
**Story:** As a player, I want to buy a consumable that waives the AI handicap.
**Depends on:** **X-06** plus a purchase flow — the product has **no purchase flow of any kind**.

### X-08 · Perk — Captain
**Story:** As a player with conviction, I want to nominate one pick to count for more.
**Blocking unknowns:** name (per notes, "Captain" doesn't fit the setting); multiplier value; how it interacts with boosts. Nothing in scoring today weights picks unequally.

### X-09 · Perk — Shield
**Story:** As a player, I want to protect one pick from counting against me.
**Blocking unknowns:** floors contribution at zero — needs the same per-pick weighting foundation as **X-08**.

### X-10 · Perk — Late Swap
**Story:** As a player, I want to change one locked pick before the window closes.
**Blocking unknowns:** directly contradicts the current "locking is instant and final" rule and the entry-price capture model — a swapped pick needs a new entry price mid-contest. Meaningful scoring-integrity question, not just UI.

### X-11 · Perk — Free Hit
**Story:** As a player, I want one penalty-free use of the AI advisor.
**Depends on:** the AI advisor, **G-06**, now built and live.
**Status:** `PARTIAL` — the waiver mechanic works (`users.freeHitsAvailable`, checked and decremented by `G-06`); **nothing in the app grants one**, so it's permanently zero in practice.
**Holes:** the earn-path question this entry was left open for is still unanswered — N research reads, or a streak-gated chance, per the original notes. See `docs-project/progression-design.md` (deferred to the next wave, 2026-08-30) for a fuller argument: badges currently grant nothing, and the cheapest fix for both problems at once is having a badge grant a Free Hit.

~~X-12 · Term of the Day~~ **Fully absorbed into `G-10` (Term of the Day)** — confirmed with real example terms and a confirmed-distinct research streak. Its one still-open question (where the term list comes from, and whether it shares or separates the Gauntlet's daily slot) has been carried into `G-10`'s own holes. Removed here to avoid duplication.

### X-13 · XP-multiplier boosts
**Story:** As a player, I want some rewards to multiply XP rather than score.
**Depends on:** **F-07** being fixed first — there's no point adding a second boost flavour while the first does nothing.

### X-14 · Streak-gated perk unlocks
**Story:** As a consistent player, I want streaks to earn me a perk of my choice.
**Blocking unknowns:** which streak (contest streak and research streak are different things; only the former is stored, and it's already conflated across 1v1 and lobbies — **F-08**).

### X-15 · Perk — Scouting
**Story:** As a player, I want a hint about an opponent's hidden picks.
**Depends on:** Midnight commit-reveal privacy work — **there is nothing to scout while all lineups are already private-by-absence.** Correctly parked.

### X-16 · 0G Phase 2 — Agentic ID for bots
**Story:** As a player, I want to own and trade a bot that plays on my behalf.
**Blocking unknowns:** requires Solidity work + testnet deployment, plus a Verifier/TeeVerifier oracle — real infrastructure, no pre-built starter kit.
**Correction to an earlier claim in this doc:** previously said `bots-service/` "does not exist in this repo" and blocked scoping on that basis. That was wrong in the way that mattered — it exists on a separate `bots-service` git branch in the sibling `coindraft` (singular) checkout, and it's a complete, working implementation: 8 real seeded accounts that queue and draft real lineups through the app's own unmodified public API. See the H-02 investigation and `G-01`. What's genuinely still true: tokenizing those personas as Agentic ID is a real, separate, deferred piece of work — see the Q5 research in `game-modes-redesign.md` for the full breakdown (mint pattern, `authorizeUsage()`, and the honest distinction that tokenizing identity doesn't make a bot draft better — that's a separate 0G Compute question).

### X-17 · 0G Phase 3 — Immutable result records
**Story:** As a player, I want my results permanently verifiable, independent of CoinDraft.
**Fits:** genuinely — resolved contests are immutable by definition.
**Blocking unknowns:** storage cost per record unpublished.

### X-18 · 0G Phase 4 — User-owned bots
**Story:** As a player, I want to mint my own bot, let it play, and sell it.
**Depends on:** **X-16**. Most product-design work of the four phases.

### X-19 · Midnight — private contests
**Story:** As a competitive player, I want my lineup hidden until lock so nobody can copy it.
**Blocking unknowns:** requires Compact contract work, a Docker proof server, and Lace wallet integration — a separate wallet ecosystem from everything in **F-01**. Wave 1 starts **2026-08-26** (today).

---

# Part 4 — Holes register, ranked

Consolidated and ordered by what I'd fix first, given the 0G deadline on **2026-08-30**.

**Updated 2026-08-29 — 15 of the original 25 are closed.** Table kept append-only: closed rows are struck through and marked `✅ Closed`, not deleted, so the record of what was found and when survives. New holes discovered while building are added at the bottom of the still-open list.

| # | Hole | Where | Severity |
| --- | --- | --- | --- |
| 1 | ~~Session tokens forgeable — account takeover~~ | **H-01**, F-01 | ✅ Closed 8/29 |
| 2 | ~~Bot result contradicts displayed score (~45%)~~ | **H-02**, P-07, F-11 | ✅ Closed |
| 3 | Nothing has ever been opened in a browser | F-23, and every `UNTESTED` above | 🔴 Critical |
| 4 | ~~Boosts are advertised everywhere and do nothing~~ | F-07 | ✅ Closed 8/29 |
| 5 | ~~Landing page presents fabricated stats as fact~~ | P-01 | ✅ Closed |
| 6 | ~~Result page ships fake data as its initial state~~ | P-07 | ✅ Closed |
| 7 | ~~Practice wins leak into badges and win rate~~ | **H-03**, F-06, F-09 | ✅ Closed |
| 8 | ~~Lazy resolution ignores `endAt` — self-settle any contest~~ | F-12 | ✅ Closed 8/29 |
| 9 | ~~Price-fetch failure silently scores as "no movement"~~ | F-14, F-12 | ✅ Closed 8/29 |
| 10 | **Private league/tournament invite codes readable by any user** | P-10 | 🟠 High — now the top open item |
| 11 | ~~Matchmaking can resume a stale practice contest~~ | **H-04**, P-04 | ✅ Closed |
| 12 | Draft countdown is fictional | P-03 | 🟡 Medium |
| 13 | ~~Cache is in-memory; dies on every cold start~~ | F-20 | ✅ Closed 8/29 |
| 14 | SoDEX "fallback" is the same source as primary | F-20 | 🟡 Medium |
| 15 | ~~Bot has no lineup; opponent column fabricated~~ | F-11 | ✅ Closed |
| 16 | Leaderboard invisible past rank 50 | P-08 | 🟡 Medium |
| 17 | AI endpoints unmetered — real cost now 0G is live | F-17, F-18, F-21 | 🟠 High |
| 18 | Crons never confirmed to fire in production | F-24 | 🟡 Medium |
| 19 | Gauntlet answers can be stale by evening | F-05 | 🟡 Medium |
| 20 | Pre-rebrand purple in Toast, share page, card | F-03, F-22, P-16 | 🔵 Low |
| 21 | No username change, despite schema claiming it | P-13 | 🔵 Low |
| 22 | `PROTECTED` covers 3 of ~10 routes needing it | F-01 | 🔵 Low |
| 23 | `/docs` stack table stale — now wrong about 0G too | P-15 | 🔵 Low |
| 24 | League invite codes can collide → 500 | P-09 | 🔵 Low |
| 25 | Seasons never resolve; no champion possible | P-10, F-15 | 🔵 Low |
| 26 | ~~Draft pool capped at 30 by the rate limit~~ | F-20 | ✅ Closed 8/29 |
| 27 | ~~Stablecoins draftable — guaranteed-near-zero picks~~ | F-20, G-06 | ✅ Closed 8/29 |
| 28 | Tournament ties broken silently by array order | F-13, G-05 | 🟡 Medium — sharper now: decides bracket advancement |
| 29 | Race has no history for periods nobody watched | X-05/G-12 | 🟡 Medium |
| 30 | Every duration × stake tier splits the matching pool further | G-02, G-03 | 🟡 Medium |
| 31 | Per-token news rarely matches (feed is general, filtered by symbol) | G-07 | 🔵 Low |
| 32 | Nothing grants a Free Hit, so its waiver is unreachable | X-11, G-06 | 🔵 Low |
| 33 | `/status` still ignores contest type — a live weekly can satisfy a daily search | H-04, P-04 | 🔵 Low — residual half of H-04, `isPaper` half fixed |

## Recommended order of work

**Rewritten 2026-08-29 — the top three from the original list are done.**

1. **A real browser pass.** Nothing on this list has changed: this is still not optional, and with the wager mechanic, tournament invites, the race screen and the hover overlay all newly built and none of them ever seen on screen, it now has the most surface it's ever had to find.
2. **Private league/tournament invite code exposure (#10).** The highest-severity thing left standing. `/api/leagues/[id]` returns the invite code to any signed-in user, member or not — the exact class of leak the tournament invite system (built this cycle, verified 7/7) was specifically built to avoid. That fix already exists as a pattern to copy.
3. **Rate-limit the AI endpoints (#17).** Was theoretical while everything ran on Groq/testnet; real spend the moment 0G mainnet is used, and the result breakdown re-runs on every result-page view with no caching.
4. **Tie-breaking (#28).** Was cosmetic in a lobby ranking; now decides who advances out of a tournament qualifier.
5. **Escrow decision** for **G-03**/**G-05** money mode — the wager mechanic itself is built and tested on XP; only real settlement is blocked, and it's blocked on a product/legal call (custodial vs. on-chain), not on more code.

---

# Part 5 — Game Modes Redesign (confirmed spec, 2026-08-26)

Captured from a live requirements dump, fully clarified through a Q&A pass — see `game-modes-redesign.md` for the full back-and-forth and rationale behind each answer. Every story below is genuinely `NOT BUILT` — none of this exists in code yet.

**Reconciled with Part 1–3, not just appended alongside it** — a first pass at this section left the old and new stories sitting side by side unedited, which read as two competing plans rather than one aligned picture. Fixed:
- `P-04`, `P-05`, `F-09`, `F-11` describe **currently live app behavior** — a genuinely different category from a proposal, so they stay, but each now carries an explicit **"⚠ Redesign pending"** note pointing at its replacement (`G-02`, `G-04`, `G-01`, `G-02` respectively). They're accurate records of today, not competing plans.
- `X-01`, `X-02`, `X-06`, `X-12` were **thin, never-built proposals fully superseded** by their richer `G-` counterparts (`G-05`, `G-03`, `G-06`, `G-10`) — these were removed outright rather than kept as redundant stubs, with a one-line pointer left in their place.
- `X-05` and `X-11` still carry genuinely unique, unresolved content the `G-` entries don't repeat — kept, with a cross-reference note added rather than duplicated.
- `G-12` was a pure restatement of `X-05` with no new information — removed, since `X-05` already is the authoritative entry.

---

### G-01 · Scrimmage (formerly Practice Mode)
**Story:** As a new player, I want a low-friction, bot-only mode to learn the game and earn some XP without risking my real rank.
**Name confirmed 2026-08-27: "Scrimmage."** Subtitle, e.g. *"draft against bots and earn XP, without touching your real rank."*
**Where:** Redesigns `contests.isPaper` (**F-09**) — dashboard/menu entry point, draft flow, `contest-resolution.ts` XP awarding, `badges.ts`'s win count (bundling **H-03**'s fix into this same pass, confirmed).

**Two things verified directly in code before scoping this, both narrower than assumed:**
1. **`paperXpTotal` is already correctly, nonzero-tracked** — `contest-resolution.ts` already adds 250/60×multiplier on every practice win/loss, and `/api/me` already returns it. Grepped every `.svelte` file: **zero** references it. The actual gap isn't an XP-model change, it's that an already-earned number is never shown anywhere in the UI.
2. **`bots-service` cannot reach Practice contests as either is currently built.** Practice contests are created directly via `POST /api/contests` (`userBId: null`, never touches `matchmaking_queue`) — the only thing `bots-service` participates in. Its *drafting* logic (fetch tokens, pick 5, submit) is reusable; its *queue-join* logic is not the mechanism that gets a bot into a Scrimmage contest. Real wiring needed: assign a seeded bot account as `userBId` directly at Scrimmage-contest creation, then run the (reused) drafting logic right then — not a redeploy-and-done.

**Acceptance criteria:**
1. Reachable from a dedicated entry point (own entry now; full three-way mode menu deferred until Single Match / Tournament also exist — building menu chrome for two modes that don't exist yet is premature).
2. Opponent is always a real bot account with a real, freshly-drafted lineup — wired via the mechanism above, not the existing `matchmaking_queue` path.
3. Bot's draft picks are assigned to their *actual* sector, not positionally — fixes a real bug found in `bots-service`'s current logic (`sectors[i]` assignment with no check the token is that sector) while this code is already being touched.
4. Practice XP (`paperXpTotal`) is surfaced visibly somewhere in the UI (dashboard and/or profile) — never touches real `xpTotal`/rank.
5. The H-02 score-contradiction fix applies here specifically — win/loss decision and displayed score must agree.
6. **H-03 fixed as part of this pass:** practice wins excluded from `badges.ts`'s win count and the dashboard win-rate calculation.
**0G, explicitly scoped out of this build (2026-08-27):** neither Agentic ID nor Compute-powered drafting is part of Scrimmage. The sector-mismatch fix (AC 3) is a plain code fix, no AI involved. Agentic ID tokenization of the bot personas stays a deliberate, later follow-on — see the Q5 research above — not a dependency of getting this working.
**Status:** `NOT BUILT`

---

### G-02 · Single Match Mode
**Story:** As a player who wants a real opponent, I want to be matched directly with another available real player — never a bot.
**Where:** Replaces the current `/matchmaking` + `matchmaking_queue` system (**P-04**), and removes the bot-fallback path entirely (**F-11**).
**Flow, confirmed 2026-08-28** — see `game-flow-redesign.md`:
`Choose terms (duration + wager) → Match on those terms → Draft → Start screen → Race → Result`

**Acceptance criteria:**
1. ✅ **Built** — Matches only real, currently-available players; no bot fallback under any circumstance.
2. ✅ **Built** — If nobody's available after 20s, a button suggests Scrimmage while the search continues.
3. ✅ **Built** — Duration is chosen *before* matching, from a fixed preset list with a **10-minute floor**, and players are matched on it. A game starting 12:31 ends 12:41 (verified in the database).
4. ⬜ **Not built** — Wager tier chosen alongside duration, and matched on. Parked deliberately: see `wager-spec-notes.md`.
5. ⬜ **Not built** — Start screen between draft and game, where the exact wager amount is settled before lock-in.
6. ⬜ **Not built** — The game screen itself is the live race (`G-12`), not a static wait.
7. ⬜ *(Later phase, not blocking)* XP-banded matching once the player base supports it.

**Status:** `PARTIAL` — AC 1–3 built and verified; 4–6 are the remainder of the confirmed flow.

**Status (updated 2026-08-29):** AC 6 (race, G-12) is now also built — see below. AC 4-5 (wager tier + start-screen commit) are built too, under a different mechanism than originally specced — see **G-03**.
**Holes:**
- **Terms multiply the matching pool.** Duration × wager tier is a lot of buckets for a small player base. Whether *close* terms should match (bucketing rather than exact equality) is open.
- The "linear" direct-matching idea from the original dump was not pursued — the existing Postgres queue was already real-user-only by construction, so it was extended with duration rather than replaced. Flag if a queueless model is still wanted.
- *Resolved 2026-08-29:* both items previously listed as critical here are fixed. Resolution now refuses to run before `endAt` and a request-driven sweep finishes short games nobody watches (full detail under **F-12**). The race screen (`/game/[id]`, `G-12`) is built on a self-captured `price_samples` table, since scoring's two-point (entry/exit) model still doesn't produce a real series on its own.

---

### G-03 · Wager Mode
**Story:** As a confident player, I want to match with a real opponent and negotiate a real-money wager before playing.
**Where:** New mode, real-opponent-only like Single Match. Formalizes **X-02**.
**Acceptance criteria:**
1. Both players confirm 18+ before any amount can be set.
2. Each player proposes an amount; the other sees it live, not blind/sealed.
3. Full negotiation: propose, accept, counter, decline.
4. A 30s no-response timeout defaults to whatever amount is currently on the table (not the higher figure).
**Status:** `PARTIAL` — built 2026-08-29, on XP settlement. **The mechanism actually built is not AC 1-4 above** — see the divergence note below.
**⚠ Superseded acceptance criteria.** AC 2-3 described a live propose/accept/counter/decline negotiation with a 30s timeout. That was superseded by your later, simpler direction: **tier-matched + blind commit.** Terms (duration + stake tier) are chosen before matching, so being matched on a tier already IS the agreement — nothing to negotiate afterwards. Either player may then privately raise on the start screen; it settles at the **lower** of the two commits, so raising can never cost more than your own number. This removes every hard problem a live negotiation has (no timer, no counter-offer, no deadlock) at the cost of being a different mechanic than originally specced. AC 1 (18+ gate) is unchanged and built as specified.
**What's built:**
1. ✅ 18+ confirmed before any amount can be set (as AC 1).
2. ✅ Tier chosen before matching (0/25/50/100/250 XP), matched only with the same tier.
3. ✅ Blind commit on the start screen; settles at the lower of the two. Verified live: A raised to 80, B clamped to 50, settled at 50 — `+50/-50`, and the API never revealed the opponent's figure before locking.
4. ✅ Settlement behind a `SettlementProvider` interface (`src/lib/server/settlement.ts`) — XP today, so the whole mechanic is real and testable with no money involved.
5. ✅ Rematch loop — same opponent, same terms, one click, with a head-to-head record and an hourly rematch cap (loss-chasing is exactly what a "win your money back" loop encourages, so the cap is deliberate, not deferred).
6. ⬜ Real escrow — not built. See holes.
**Holes:** Escrow/payment mechanism is still genuinely open. **`0G Pay` is ruled out** — doesn't exist as a product (checked three independent ways). **Researched 2026-08-29: 0G Compute's own Router solves this exact problem with a hybrid** — deposit once on-chain into a shared Payment Layer (both testnet `0x0AD9690e...` and mainnet `0xA3b15Bd2...` verified live on-chain), debit off-chain per use, settle to providers periodically. That's the pattern worth copying: it removes per-game gas, which was the main problem with pure on-chain escrow. Two things it does *not* solve: withdrawals/refunds are undocumented in 0G's own flow (the critical path for us), and **ERC-4337 (EntryPoint) is deployed on 0G mainnet and testnet but completely undocumented by 0G** — gasless deposits are technically provable but need our own bundler, which is real infrastructure, not a flag. Whether entrants can also peer-fund a pool (vs. only one side funding it) is a related open question carried over from `G-05`.
**Architectural requirement, confirmed 2026-08-27, honoured in the build:** the mechanic is cross-mode, not exclusive to this entry — `stakes`/`stake_participants` are sidecar tables (contestId | lobbyId | tournamentId, exactly one set), so attaching a wager to Single Match, a Lobby, or a Tournament is setting a different FK, not a different implementation.

---

### G-04 · Multiplayer Mode (rename)
**Story:** Same as the existing Lobby feature — no functional change identified in the redesign beyond being repositioned as one of three top-level mode choices.
**Where:** `/lobby` and its API routes (**P-05**), real-users-only, same as today.
**Status:** `UNTESTED` — the rename/repositioning is built; the underlying feature mirrors **P-05**'s status.
**Holes:** Inherits every one of P-05's holes unchanged (cannot be tested solo, missing seat-count on created lobbies, "started" inferred by absence). The rename fixed discovery, not the feature.
**Built 2026-08-29:** surfaced as "Multiplayer" in nav (Play group), a dashboard hero button, and the page's own top badge. In-page room vocabulary ("lobby", "Create lobby") deliberately kept — normal gaming vocabulary, not a name needing to be purged. No functional change to the lobby feature itself, as originally scoped.

---

### G-05 · Tournament Mode
**Story:** As a player or a sponsoring company, I want to create or join a tournament with configurable access, funding, and payout rules.
**Where:** New feature sitting on top of Multiplayer Mode. Formalizes **X-01**.
**Acceptance criteria:**
1. Three access types: **public** (create, browse, join), **private** (pay to create, invite-only), **sponsor** (a company creates and funds it).
2. Two funding models at creation: **free-to-play** (XP/leaderboard only) or **money mode** (creator deposits a real prize pool).
3. Payout structures: **winner-takes-all**, or a **top-3 split weighted by XP** (example pattern given: 30 → 25 → 23; exact unit — percentage, multiplier, points — still to be nailed down at design time).
4. Multi-stage bracket support: sub-tournaments feed their winners into a single final tournament.
5. Sector-restricted variant: a tournament can limit the draftable pool to a single sector (see **G-08**).
**Status:** `PARTIAL` — public + free-to-play + brackets + private/invite built 2026-08-29; sponsor access and money mode remain blocked on the same escrow decision as **G-03**.
**Holes:**
- Tie-breaking mechanism undecided — resolveLobby's score-sort keeps insertion order on a tie, and this is now more consequential than when it was first noted: a tie decides who advances out of a qualifier.
- Min/max participants: shipped with a placeholder default (`minPlayers: 2`) rather than the "four-ish" floated — a real product call, not a technical block, and trivially changed per-tournament.
- The threshold for advancing from one bracket stage to the next: shipped as "outright winner of each qualifier group advances" — the simplest of the candidates floated, not confirmed as final.
- Whether entrants can peer-fund a pool themselves is still open, tied to the same escrow decision as **G-03**.
- **AC 2's money mode still shares its dependency with `G-03`** — same unbuilt escrow primitive, same reason it's blocked.
**Built 2026-08-29:**
- **Two genuinely different closes, not one.** At `registrationClosesAt`, the tournament either **starts** (enough players) or **cancels permanently** (`status: 'cancelled'`, a new terminal state distinct from `resolved` — a dead tournament previously had nowhere to go). Same timestamp, opposite outcome; once funding exists this is also a start-locks vs cancel-refunds fork.
- **Public list** (`GET /api/tournament`) with live headcount, "needs N more", and a countdown. Private tournaments are deliberately absent from it.
- **Private access + invites**, via a new `tournament_invites` table. The invite token is the actual credential — single-use, claimed only after a successful join (so a failed join can't strand someone with a dead link) — and works as a shareable link whether or not email is configured. Verified live, 7/7 access-control checks: uninvited stranger blocked, valid invite joins, reused invite blocked, forged token blocked, non-organiser can't send invites, private tournament absent from the public list.
- Bracket orchestration (qualifier groups → final, `winner_take_all`/`top3_weighted` payout redistributing the same XP pool `resolveLobby` already paid rather than double-paying) and sector-restricted draft pools (`G-08`) were built in an earlier pass and remain as previously documented.

---

### G-06 · AI Draft Agent
**Story:** As an unsure player, I want a floating AI assistant that can help me draft, or fully auto-draft my lineup, at a known XP cost.
**Where:** New feature on `/draft`. Formalizes **X-06**; ties into the **X-11** Free Hit perk. Backend confirmed as **0G Compute** (same call shape already proven for Mentor — see the 0G usage map in `game-modes-redesign.md`).
**Acceptance criteria:**
1. Small floating icon/character, follows the cursor, Clippy-inspired, deliberately playful rather than a serious UI element.
2. Can fully auto-draft an entire lineup, not just nudge one pick — confirmed capability, not just a suggestion feature.
3. Before use, clearly tells the player: not guaranteed to be right, and using it reduces XP.
4. XP penalty scales with how much help was actually used (confirmed — not a flat deduction).
5. Earning a Free Hit (**X-11**) waives the penalty for one use.
6. The normal, unassisted draft flow is completely unchanged — this is additive.
**Status:** `PARTIAL` — all six AC built 2026-08-29; not yet re-verified in a browser (only API-level).
**Holes:**
- Pick quality is visibly weaker on 0G's testnet model (`qwen2.5-omni`, 2 models total) than on Groq — before the stablecoin fix, the agent had actually picked USDT for a wildcard slot. Stablecoins are now excluded from the whole draft pool (see **F-20**), which removes that specific failure mode; general quality on testnet remains the weaker option. Mainnet has 31 models, many TEE-attested, but needs a funded key.
- Nothing yet grants a Free Hit (**X-11**'s earn-path is still open), so AC 5's waiver is unreachable in practice.
- *Built 2026-08-29, backend confirmed as 0G Compute per the original spec:* floating cursor-follow icon that stops chasing within 110px and holds still while its menu is open (it was unclickable by construction before this — pinned at a fixed cursor offset on every mousemove); can fill one slot or auto-draft all five; states the XP cost and "not guaranteed" caveat before use; cost scales with slots filled (15 XP/slot); the normal draft flow is untouched. Additionally, every use now stores a receipt of the 0G inference (`ai_assists` table — provider address, request id, billing) and the panel shows "✓ Assist verified on 0G" — worded that way deliberately, since 0G's Router exposes no attestation endpoint, so this is a tamper-evident receipt, not a self-verifiable proof.

---

### G-07 · Token Hover-Info Overlay
**Story:** As a player browsing tokens, I want quick live information on hover so I can decide without leaving the draft screen.
**Where:** New feature on `/draft`'s token pool. [TokenHover.svelte](../src/lib/components/TokenHover.svelte), [api/token/[id]](../src/routes/api/token/[id]/+server.ts).
**Acceptance criteria:**
1. Hovering a token brings up an overlay with a quick transition.
2. Tabbed content sourced from SoSoValue; a **news** tab confirmed, remaining tabs to be determined at design time.
3. Passive/informational — no XP cost, explicitly distinct from the AI agent (**G-06**).
**Status:** `UNTESTED` — built 2026-08-29, API-verified, not yet seen on screen.
**Holes:**
- Per-token news rarely matches — the feed is general market news filtered by symbol, so most tokens show none. A bonus when it hits, not something to rely on.
- *Built:* stats tab (price, 24h change/volume/high/low, market cap, distance from ATH, rank) plus a news tab. Fetch delays 220ms until the pointer settles and the endpoint caches hard (measured 1.89s cold → 0.011s warm), which is what makes it safe on every hover across a 173-token pool. Spring-animated position (`svelte/motion`) so it glides between cards rather than jumping, flips at the viewport edge with matching entry direction, and `pointer-events:none` so it can never intercept a click meant for the Add button underneath.

---

### G-08 · Sector-Restricted Draft Pool
**Story:** As a player in a sector-restricted tournament, I want the draft screen to only show tokens from the allowed sector(s).
**Where:** `/draft`'s token-pool filtering, driven by the hosting tournament/contest's configuration.
**Status:** `NOT BUILT`. Depends on **G-05** existing.

---

### G-09 · Knowledge Base (Research Hub rebrand)
**Story:** Same as the existing Research Hub — a rebrand of the framing, not a new store.
**Where:** `/research` (**P-12**). Confirmed (Q11) to be the same underlying SoSoValue-backed data both Research Hub and Mentor already use — not a new persistent data layer.
**Status:** Mirrors **P-12**'s current status (`PARTIAL`) — see that entry for its actual open holes (boost claimed on expand rather than read, etc.).

---

### G-10 · Term of the Day
**Story:** As a player, I want a new crypto vocabulary term daily, with a quick check to confirm I actually learned it.
**Where:** New sub-feature of Research Hub / Knowledge Base (**G-09**). Formalizes **X-12**.
**Acceptance criteria:**
1. One new term surfaced per day (examples given: TVL, blockchain, trading).
2. Paired with an immediate mini-quiz, Gauntlet-style, to confirm retention.
3. Contributes to a research/learning streak, **confirmed distinct** from the existing contest win-streak (`users.streak` today only tracks wins — see **F-08**).
**Status:** `NOT BUILT`
**Holes:** Carried over from **X-12** (now merged into this entry): where the term list comes from, and whether it shares or has a separate daily slot from the Gauntlet, are both still genuinely undecided.

---

### G-11 · Daily / Weekly / Monthly Leaderboards
**Story:** As a competitive player, I want to see rankings scoped to different time windows, not just all-time.
**Where:** Extends `/leaderboard` (**P-08**).
**Acceptance criteria:**
1. Daily, weekly, and monthly views, alongside the existing global/all-time one.
2. Quiz/research leaderboard and gameplay leaderboard are **confirmed separate** (relates to **X-04**).
3. Time-scoping (daily/weekly/monthly) **confirmed to apply to both** leaderboards.
**Status:** `NOT BUILT`

---

~~G-12 · Live Race View~~ **Removed as a duplicate.** This was a pure restatement of **X-05** with zero new resolving detail — keeping both would be exactly the kind of split-personality entry this update is fixing. **X-05 is the one authoritative entry**, now annotated with the confirmation that it's genuinely wanted.

---

_Living doc. Update `Status` as things get verified, and move holes out of Part 4 as they close rather than deleting them._
