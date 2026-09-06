# Game Flow Redesign — Terms → Match → Draft → Race → Result

_Captured 2026-08-28, revised same day. Spec recorded as given; the code conflicts below were found by reading the current implementation, not inferred._

---

## The confirmed flow

**Revision note:** the first pass put duration and wager on a "game start" screen *after* drafting. That's been superseded — **both are now chosen before matching**, and matching happens against them. What follows is the current spec.

### Single Match

```
1. Choose terms    duration (e.g. 20min, 45min) + wager / no wager
2. Match           matched against players who chose the same terms
3. Draft coins     pick the lineup
4. Game runs       coins racing in real time
5. Result          final standing
```

### Tournament

Terms are set **once, by the organiser, at tournament creation** — not per game, and not negotiated:

- Duration, chosen at creation.
- **Prize, not wager** — either no prize, or a funded pot.
- Prize structure: **winner-takes-all**, or **top three split by XP**.

Players joining a tournament are accepting terms that already exist, so there's nothing to agree at match time.

### Timing

Duration is a plain wall-clock window. A 10-minute game starting 11:15 ends 11:25. **Minimum for all games is 10 minutes.**

### XP

Unchanged. The final result is the thing that matters; the XP model stays as it is and is deliberately left open to revisit as new ideas land. **Not a blocker on this build.**

---

## What the revision resolves

Moving terms ahead of matching is a materially better design than the first pass, and it removes real problems rather than relocating them:

- **Nobody has to agree on anything mid-flow.** Both players chose identical terms to be matched at all, so there's no propose/accept/counter round for duration, and no deadlock.
- **Abandonment before the clock starts largely stops mattering** — terms are settled before anyone invests effort in a draft, rather than after.
- **The wager stops being a negotiation and becomes a filter.** `G-03`'s propose/counter/decline machinery may now be unnecessary for Single Match: if you match on "20 min, 5 USDC", the amount is already mutual. That's a significant simplification of the wager build — worth confirming, since it contradicts the earlier propose/accept/counter spec.
- **Tournament prize structure is already built.** `winner_take_all` and `top3_weighted` exist in the schema and in `applyPayoutStructure()`, matching "winner takes all, or first three based on XP" exactly. No new work there.

---

## What this collides with — verified in code

### 1. Duration is derived from contest type, not chosen

[`api/contest/[id]/lineup/+server.ts:83`](../src/routes/api/contest/[id]/lineup/+server.ts):

```js
const windowDays = existingContest.type === 'weekly' ? 7 : 1;
const endAt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000);
```

Duration is 1 or 7 **days**, hardcoded from `contests.type`. There's no field for a chosen duration and no path to minutes. Needs a real column (e.g. `durationMinutes`), and the matching queue needs to carry it too — `matchmaking_queue` currently stores only `contestType`, so it cannot express "20 minutes, no wager".

### 2. Resolution cannot serve a short game

Contests resolve two ways today, neither of which works at this timescale:

- **Lazily**, when someone loads the result page.
- **By cron**, `5 0 * * *` in `vercel.json` — **once a day**.

A game ending at 11:25 would sit unresolved until someone opened it, or until 00:05 the next morning. Short games need resolution driven by their own `endAt`. Note Vercel's Hobby plan caps cron at once daily, so this may be a plan decision as well as a code one.

The existing settle-on-demand defect compounds here: lazy resolution ignores `endAt`, so a contest can be settled early on request. On a 10-minute wagered game that's a much shorter path to abuse than on a 24-hour one.

### 3. The race view needs price data that is never captured

Scoring compares exactly two points — entry and exit. **Nothing samples prices during a window**, so there's no series to animate.

This is the hardest part of the build, and the market-data layer is the app's most fragile piece: `getTokensWithPrices` fires 30 parallel snapshot requests, has been observed rate-limiting, and caches in memory so it dies on every cold start. Sampling 5 tokens per player across concurrent short games is a capacity question before it's a rendering one.

---

## Open questions

**Q1 — What are the duration options?** "20 min, 45 min" were examples. Is it a fixed preset list, or free entry above the 10-minute floor? Fixed presets matter a lot for matching: every distinct duration splits the pool.

**Q2 — Do daily and weekly survive?** They're the only durations that exist today, and weekly is the only thing paying 2× XP. Do they become two more presets, or go away?

**Q3 — Does matching still fragment too far?** This is the one I'd flag hardest. Matching on duration **×** wager amount multiplies the pool into small buckets — with few players online, "20 min + 5 USDC" may never fill. The Single Match "no one's available → Try Scrimmage" fallback already exists and helps, but it's worth deciding whether close terms should match (e.g. bucket wagers into tiers) rather than requiring exact equality.

**Q4 — Is the wager still negotiated at all?** If matching is on exact terms, `G-03`'s propose/accept/counter/decline and its 30-second timeout may be dead weight for Single Match. Confirming this would meaningfully shrink that build.

**Q5 — Scrimmage and Multiplayer durations?** Single Match picks terms; Tournament sets them at creation. Scrimmage has no opponent to agree with — does it prompt, or default? Multiplayer would need a whole room aligned, which the lobby has no mechanism for.

**Q6 — How often does the race sample prices?** Drives both how alive the race looks and the load on a source that already rate-limits.

---

## Register impact

- **`X-05` / `G-12` (race view) is promoted from optional to core** — it's the game screen now, not a flourish.
- **`X-03` (time-based draft modes) is confirmed and broader than scoped** — a per-game choice with a 10-minute floor, and a matching criterion rather than a contest property.
- **`G-03` (Wager) may shrink substantially** — see Q4.
- **`G-05` (Tournament) prize structures need no new work** — already built and matching the spec.
- **Settle-on-demand rises in severity again** — short wagered games shorten the gap between "can settle early" and "profits by settling early".

_Nothing here is built. The questions above are design blockers, not gaps in understanding the request._
