# Testing Findings — Live QA Pass

_Started 2026-08-24, testing against the production deployment. Log real issues found while going through every feature — not all of these need fixing immediately, some are just noted for later. Update status as items get resolved._

---

## Open

### 1. Lobby flow can't be tested solo

**Found:** created/joined an open lobby, sat in the waiting room for 48 minutes with nothing happening.

**Root cause (confirmed, not a bug):** neither lobby flow has a bot fallback.
- Quick-match (4/6/8 auto-match) has no start-early option at all — only progresses when enough real players queue.
- Open/browse lobbies have a "Start drafting" button, but it's disabled until `waitingHeadcount >= 2` — a solo tester sitting alone in their own created lobby can never enable it.
- `bots-service` only ever queues for 1v1 `matchmaking_queue` — confirmed it never touches lobbies at all (deliberately out of scope per its own design).

**Options on the table, not yet decided:**
1. Second account/browser session — zero code changes, tests the real multiplayer experience as a user would see it.
2. Temporary dev-only force-start override — faster to test the draft→resolution pipeline solo, but doesn't test the real N-player experience, and is a change to production code.
3. Extend `bots-service` to also queue for lobbies — real product value (lobbies would always have a fallback like 1v1 does), but bigger scope than just unblocking this test pass.

### 2. SoSoValue rate-limiting — mitigated, real fix deferred

**Status:** TTLs extended as an immediate mitigation (`getSnapshot` 60s→300s, `getTokensWithPrices` merged cache 120s→300s in `sosovalue.ts`) — directly reduces how often the 30-parallel-snapshot burst fires. **The real fix — a persistent cache that survives serverless cold starts (the current `cache` is a plain in-memory `Map`, same bug class as the old matchmaking-queue issue) — is deferred to the codebase-tightening pass**, not done here. Also: the rate limit was confirmed *actively in effect* at diagnosis time, so retesting immediately after this fix may still hit it until it resets externally.

---

## Fixed this session

### Matchmaking flow was auth-blind

**Found:** `/matchmaking` froze permanently at the 0:30 bot-fallback mark, no error shown.

**Root cause:** none of the three fetch calls in the matchmaking flow (`/api/matchmaking/join`, the status poll, the bot-fallback `/api/contests` call) checked for an error/unauthorized response — they only matched on a specific `status: 'matched'` shape. `/matchmaking` also wasn't in the `PROTECTED` routes list, so an unauthenticated session could reach the full "searching" UI and silently fail at every step. (Never got explicit confirmation on whether the session was actually invalid that time — fixed regardless, since the missing error handling was a real gap either way.)

**Fix:** added `/matchmaking` to `PROTECTED` in `+layout.server.ts` (redirects before the page loads if not signed in). Added defense-in-depth at the page level too, matching the pattern `/lobby` already used: all three fetch calls now check for 401 (redirect to sign-in) and other non-ok responses (surface a new `error` status with a "Try again" button, instead of silently hanging). Verified with `svelte-check`.

### `/api/breakdown` AND `/api/mentor` both 502'd — dead Groq model

**Found:** both endpoints 502'd — each endpoint's own `catch` block deliberately returns 502 when the Groq call throws, so neither was a platform crash.

**Root cause — confirmed directly against Groq's real API, not guessed:** `llama-3.3-70b-versatile` is gone from Groq entirely — `404 model_not_found` on a direct test, confirmed absent from Groq's live `/v1/models` list.

**Fix:** swapped both to `openai/gpt-oss-120b`. This surfaced a second, non-obvious issue while verifying: `gpt-oss` is a *reasoning* model — it spends part of its token budget on an internal reasoning trace (streamed separately as `delta.reasoning`, non-streaming as a `reasoning` field) before emitting real `content`. At `breakdown`'s old `max_tokens: 150`, a longer reasoning trace could exhaust the budget before any content came through (verified this actually happening at `max_tokens: 20` in a direct test — empty content, `finish_reason: "length"`). Bumped to `max_tokens: 400` (verified clean at that budget: 49 reasoning tokens + full content, `finish_reason: "stop"`). Mentor's extraction logic (`delta?.content ?? ''`) already ignores non-content deltas correctly, so the streaming path needed no code change — just the model swap. One UX note, not a bug: Mentor's "thinking" pause before visible text starts will be longer now, since reasoning chunks stream by silently discarded.

### SoSoValue retry-wait causing multi-minute draft-page hangs

**Found:** "Build your lineup" took about 4 minutes to load.

**Root cause:** `ssv()`'s 429-retry logic waited `(retry_after ?? 60) * 1000` ms per attempt, up to 3 attempts — up to 3 minutes of blind waiting per call. `getTokensWithPrices(30)` fires 30 of these in parallel (one snapshot request per token, since `/currencies` doesn't include price data), so a rate-limited batch could stack toward the observed ~4 minutes.

**Fix:** capped the wait at `Math.min((retry_after ?? 2) * 1000, 5000)` — worst case per call is now ~15s (3 × 5s) instead of ~180s. `src/lib/server/sosovalue.ts`, verified with `svelte-check`.
