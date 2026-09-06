# AI Draft Agent (G-06) — Build & Test Checklist

_Created 2026-08-27. Same rule as every checklist in this folder: a box only gets checked once it's actually built **and verified working**, not merely written. For the **why**, see `G-06` in `user-stories-by-surface.md` and the "Drafting Experience" section of `game-modes-redesign.md`._

## Scope decisions made while scoping this

**Backend is 0G Compute, per the spec's own "Where" line** — reuses `getAiClient()` from `aiCompute.ts`, the exact same Groq/0G client Mentor and the result-breakdown already use. No new AI plumbing needed.

**No-hallucination guardrail, an implementation decision, not a spec gap:** the agent never lets the LLM name a token freely. For each sector it's asked to fill, it hands the model the *real* live candidates for that sector (via the same `classifySector` bucketing `botDraft.ts` already uses) and asks it to choose among them; the response is validated against that real list, and a procedural fallback (best 24h performer in-sector) covers an invalid or unparseable answer — same discipline Gauntlet's live-question generator already uses.

**XP cost model — a concrete number had to be chosen, not left abstract:** Q10 confirmed "scales with usage, more help, more XP reduction" but not a formula. Picked **15 XP per sector slot the agent fills**, charged immediately at time of use (a known, upfront toll — matches AC 3's "before committing, tell them it reduces XP," not a discount applied later at resolution). A full 5-slot auto-draft costs 75 XP; helping with one slot costs 15. Clamped at 0, never goes negative. Documented here as the default; trivial to retune later since it's one constant.

**Free Hit (X-11) — waiver mechanic built, earn-path deliberately not.** `X-11` itself says the earn-path ("N research reads, or a streak-gated random chance") is still open and unresolved by `G-06`. Building `users.freeHitsAvailable` and the consumption logic (waives the very next use's cost) now, since `G-06`'s spec confirms the waiver mechanic itself — but nothing yet grants a free hit. That's real follow-on work, not silently skipped.

**Two help tiers, confirmed by the spec:** fill one (the next empty) slot, or auto-draft every remaining empty slot. Same underlying endpoint, just a different `sectors` list.

---

## 1. Schema

- [x] `users.freeHitsAvailable` (int, default 0)
- [x] Migration applied 2026-08-27 via `drizzle-kit push --force` — additive only.
- [x] `npm run check` — 0 errors.
- [x] **Test:** migration ran against the real DB and succeeded.

## 2. Backend

- [x] `src/lib/server/draftAgent.ts`: `pickForSectors(sectors: string[])` — buckets live tokens by real sector, asks the LLM to choose among the real candidates per sector, validates the answer against the candidate list, falls back to best-24h-performer on an invalid/unparseable response
- [x] `POST /api/draft/agent-pick` — auth required, computes XP cost (`15 × sectors.length`, or `0` and consumes a free hit if `freeHitsAvailable > 0`), deducts from `xpTotal` (clamped at 0), returns the picks + what was actually charged
- [x] Caught before testing: `draftAgent.ts` initially set `max_tokens: 200` for the LLM call. `/api/breakdown` already documents that `gpt-oss` is a reasoning model that burns part of its token budget on an internal trace before real content — 200 risked the exact truncation bug already found and fixed there. Bumped to 400 to match the proven value.
- [x] `npm run check` — 0 errors.
- [x] **Bug found by live-testing, not review:** a full 5-slot auto-draft came back with 4 of 5 slots as the *same* token (XMR) — nothing enforced cross-slot uniqueness, unlike `botDraft.ts`'s bot lineup which tracks a `used` set. Happens whenever a sector's own bucket is empty in the live snapshot and multiple slots fall back to the same whole-pool candidate list; the model (and the old fallback) had no reason not to pick the same "best" token for each. Fixed: resolution now runs sequentially through a shared `used` set (LLM's choice → best unused in-sector → best unused overall), and the prompt explicitly instructs no symbol reuse across slots as defense in depth.
- [x] **Test: live-verified 2026-08-27** through the real dev server, real 0G Compute/Groq calls: single-slot pick returned a real, valid L1 token and charged exactly 15 XP (confirmed in the DB, 1329 → 1314). Full 5-slot auto-draft, re-run after the uniqueness fix, returned 5 genuinely distinct tokens and charged exactly 75 XP.

## 3. Frontend

- [x] `DraftAgent.svelte` — small floating icon that follows the cursor on `/draft`, Clippy-inspired and playful, not a serious control
- [x] Click opens a compact menu: help with the next empty slot, or auto-draft everything remaining — each showing its exact XP cost (or "Free Hit available" / "Free — Scrimmage mode") before confirming
- [x] Required disclosure shown before every use: not guaranteed to be right, and the exact cost, requiring explicit confirmation
- [x] Confirmed picks flow into the same `lineup` state a manual click would (`applyAgentPicks`, added to `+page.svelte` alongside the existing `addToken`) — normal draft flow completely unchanged, agent is additive only
- [x] **Gap caught before shipping, not by review:** the agent charged real `xpTotal` unconditionally, with no awareness of Scrimmage — directly contradicting the "no real stakes" principle Scrimmage (`G-01`/H-03) was built around earlier this session. Fixed: `/api/draft/agent-pick` and `DraftAgent.svelte` both take an `isPaper` flag; Scrimmage drafts get full agent help at zero XP cost, no free hit consumed.
- [x] `npm run check` — 0 errors. `eslint` — 0 errors on every touched file, none pre-existing either.
- [x] **Test: live-verified 2026-08-27** — confirmed `isPaper: true` charges exactly 0 XP and leaves `xpTotal` untouched (1164 → 1164), separately from the real-mode tests above.
- [ ] **Visual/interaction check still needs a browser:** the cursor-follow behavior, the popover menu, and the actual quiz/pick flow on screen.

---

## Definition of done

All boxes checked and live-verified. Code-complete isn't the same as working — same standing rule as every checklist before this one.

_Living doc — update checkmarks as work lands and gets verified, don't mark something done because it's merely written._
