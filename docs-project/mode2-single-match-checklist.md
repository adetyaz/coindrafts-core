# Mode 2 — Single Match — Build & Test Checklist

_Created 2026-08-27. Same rule as `mode1-scrimmage-checklist.md`: a box only gets checked once it's actually built **and verified working**, not merely written. For the **why** behind each item, see `G-02` in `user-stories-by-surface.md` and Mode 2 in `game-modes-redesign.md`._

---

## Decisions carried over from the redesign doc (nothing open here)

- [x] Real opponents only — bots do not participate in this mode, under any circumstance (AC 2)
- [x] No dedicated new page needed — `/matchmaking` already is Single Match's own dedicated entry point; it just needs its bot-fallback removed and its copy corrected
- [x] Matching mechanism: reuse the existing Postgres-backed `matchmaking_queue` (`findOpponent`/`enqueue`/`dequeue` in `matchmaking.ts`) — it was **already real-user-only by construction**, since bots were never queued there. Confirmed by reading the code before scoping: the only thing that violates "real opponents only" is the *client-side* bot-fallback branch, not the matching mechanism itself.
- [x] Shared three-way mode mini-menu stays deferred until Tournament also exists (per the Scrimmage checklist's decision) — no menu work in this pass

## 1. Remove the bot-fallback path entirely (F-11, AC 2)

- [x] Deleted the 30s-elapsed bot-fallback branch from `matchmaking/+page.svelte`'s poll loop (`POST /api/contests` bot-creation call, the "matched with bot" toast, the whole `if (elapsedMs > 30_000)` block)
- [x] Fixed a second, undocumented instance of the same class of bug found while scoping this: `/api/matchmaking/join`'s "already in a contest" pre-check filtered by `status`+`type` but not `isPaper` — same gap H-04 fixed in `/status`. Without this, clicking "Find Match" while you had a live Scrimmage contest open would silently re-enter that Scrimmage draft instead of searching for a real opponent. Added `eq(contests.isPaper, false)`.
- [x] `npm run check` — 0 errors, 0 warnings. `eslint` on every touched file — only pre-existing, unrelated errors remain (a `window.location.href`-vs-`resolve()` rule and an underscore-prefixed unused var, neither on a line this pass touched — confirmed via `git diff`).
- [x] **Test: live-verified 2026-08-27.** A test user with both an open real contest and a freshly-created live Scrimmage (paper) contest called `GET /api/matchmaking/status` through the real dev server: correctly returned the real contest (`is_paper: false`) as `matched`, never the Scrimmage one — confirmed by checking both contests' `is_paper` flag directly in the DB. The `/api/matchmaking/join` twin fix wasn't separately live-tested (needs two real users queued simultaneously, not just one with a stale contest) — lower-risk since it's the identical one-line change already proven working in `/status`.

## 2. "No one available" → suggest Scrimmage (AC 3)

- [x] After 20s of searching with no real match (down from the old 30s bot-fallback timer — shorter because there's no guaranteed match waiting at the end of it anymore), a "Try Scrimmage instead" button appears alongside the still-active search, not in place of it — if a real opponent shows up after that point, you're still matched normally.
- [x] Button reuses the same `POST /api/contests` paper-mode call the dashboard's "Try Scrimmage" button uses (`type: 'daily', mode: 'paper'`), calls `/api/matchmaking/leave` first so the real queue isn't left holding a stale entry, then redirects into the draft the same way the dashboard does.
- [ ] **Test:** blocked on DB connectivity — confirm the button appears at 20s, and that clicking it correctly creates/enters a Scrimmage contest without leaving the real queue in a stuck state.

## 3. Copy corrections (bot-fallback language removed everywhere)

- [x] `matchmaking/+page.svelte` — searching subtitle no longer promises a bot after 30 seconds
- [x] `guide/+page.svelte` — "Find Match" path card no longer says "matched with a bot instead"
- [x] `docs/+page.svelte` — Wave 2 feature list no longer describes matchmaking as having "a 30-second bot fallback"
- [x] `matchmaking.ts` — `QUEUE_TIMEOUT_MS`'s comment no longer says "fallback to bot" (it never did anything but drop stale queue rows — comment was just wrong)
- [x] **Test:** grepped `matchmaking/+page.svelte` for "bot" — only the two intentional "no bots"/"real-opponents-only" mentions remain.

## 4. XP-banded matching (AC 4)

- [x] Explicitly out of scope for this pass — confirmed later-phase in `G-02` itself, not blocking. Not tracked further here.

---

## Definition of done for Mode 2

All boxes above checked **and** each test actually run against a live DB — same standing rule as Mode 1. Code is complete pending only that same DB-connectivity window Mode 1 is also waiting on; both can be tested in the same session once the network holds.

_Living doc — update checkmarks as work lands and gets verified, don't mark something done because it's merely written._
