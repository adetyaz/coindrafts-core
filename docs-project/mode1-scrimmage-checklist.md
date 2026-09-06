# Mode 1 — Scrimmage — Build & Test Checklist

_Created 2026-08-27. This is the tracker: every discrete thing that needs to happen for Scrimmage, checked off as it's actually done and verified — not as it's merely started. For the **why** behind each item, see `G-01` in `user-stories-by-surface.md` (the full spec, acceptance criteria, and the two facts verified directly in code before scoping this) and Mode 1 in `game-modes-redesign.md` (the original captured intent). This doc is the **what**, kept current; those two are the record of **why**._

**Rule for this doc:** a box only gets checked once it's actually built (or decided, for the decision items) **and verified working** — matching this whole doc-set's standing rule that "built" and "working" aren't the same thing. If something's coded but untested, leave it unchecked and say so in a note, don't check it early.

---

## Decisions (locked in 2026-08-27 — nothing left open here)

- [x] Name confirmed: **Scrimmage**
- [x] Subtitle confirmed direction: explains what it's for, e.g. *"draft against bots and earn XP, without touching your real rank"* — exact copy TBD at build time, but the requirement (must have one) is settled
- [x] 0G scoping confirmed: **no role in this build** — neither Agentic ID nor Compute-powered drafting. Agentic ID tokenization is a deliberate later follow-on, not a dependency
- [x] H-03 (practice wins leaking into real badges/win-rate) confirmed bundled into this same pass, not left for later
- [x] Full three-way mode mini-menu confirmed **deferred** — Scrimmage gets its own entry point now; shared menu chrome waits until Single Match and Tournament exist too

---

## 1. Naming & copy

- [x] "Practice" renamed to "Scrimmage" everywhere it currently appears (dashboard hero CTA + "My contests" pill + contest-list badge, draft header, contest-result badge/XP label, guide path card + FAQ, docs feature list)
- [x] Subtitle text added, explaining what it's for — shown under the hero CTA for new (zero-contest) users: *"Scrimmage — draft against bots and earn XP, without touching your real rank."*
- [x] **Test:** grepped every `.svelte` file for "Practice" — zero matches. `npm run check` — 0 errors, 0 warnings.

## 2. Entry point

- [x] Scrimmage has a clear, dedicated entry point for its actual audience (new/zero-contest players) — the hero CTA is a full-width, explained button, not a bare label. The secondary "+Scrimmage" pill for returning users stays alongside +Daily/+Weekly by design — parity with the other contest types there is reasonable, it's a quick-action row, not the primary discovery path.
- [x] **Test:** a zero-contest user sees "Try Scrimmage" with its subtitle directly in the hero card — no explanation needed beyond what's on screen.

## 3. Bot opponent — the real new wiring (not a redeploy)

Context already verified in code: `bots-service`'s queue-join logic never touches Scrimmage contests, because Scrimmage contests are created directly (`userBId: null`) and never enter `matchmaking_queue`. Its *drafting* logic is reusable; its *queueing* logic is not the mechanism that gets a bot into a Scrimmage contest.

- [x] At Scrimmage-contest creation, a real seeded bot account is assigned directly as `userBId` (not via `matchmaking_queue`) — implemented in `src/lib/server/botDraft.ts` + wired into `api/contest/[id]/lineup/+server.ts`, at the exact point the contest goes live
- [x] That bot drafts a real lineup right then — live tokens (`getTokensWithPrices`), live entry prices (`getSnapshot`/`extractPrice`, same pipeline a human's picks use)
- [x] **Fixed the sector-mismatch bug**: bot picks are now assigned via `classifySector()` (the same classifier Research Hub already relies on), not positionally — code-reviewed, not just typechecked
- [x] **Test: live-verified 2026-08-27.** Ran the full flow twice through the actual dev server (`localhost:5173`, real HTTP calls, two different real users): created a fresh Scrimmage contest, submitted a 5-pick human lineup, confirmed a real bot got assigned (`userBId` set, contest `status: 'live'`) with a real 5-pick lineup and real entry prices from `getSnapshot`.
- [x] **Bug found by this live test, not by review:** the live 30-token snapshot had zero L2-sector tokens in it both runs. The fallback path (grabs any unused token when a sector's bucket is empty) was still labeling the result with the *empty slot's* name instead of the token's real sector — the exact class of bug this function exists to fix, reappearing in its own fallback branch. First run stored `DOT` as `sector: "l2"` (DOT is L1). Fixed in `botDraft.ts`: the fallback now calls `classifySector()` on the chosen token instead of reusing the loop's slot name. Re-ran live after the fix — second run's fallback pick (`DOGE`) came back correctly labeled `meme`, not `l2`. `npm run check` clean after the fix.

## 4. Practice XP visibility

- [x] Practice XP surfaced: added as a 5th stat ("Scrimmage XP") on the profile page's stat grid (`grid-cols-5`, was 4), with a `title` tooltip clarifying it never touches real rank. `Me` type updated to include `paperXpTotal` (was silently missing it, even though `/api/me` always returned it).
- [x] Confirmed it never touches real `xpTotal`/rank — unchanged, verified by reading `contest-resolution.ts` again: paper contests still only ever write to `paperXpTotal`, never `xpTotal`.
- [ ] **Test:** blocked on the same DB connectivity issue as section 3 — `npm run check` passes, live confirmation pending.

## 5. Score/result correctness (H-02, scoped to Scrimmage)

- [x] **Resolved as a direct consequence of section 3, no separate code needed** — confirmed by re-reading `contest-resolution.ts`: once a Scrimmage contest has a real `userBId` (which section 3 now assigns), resolution flows through `if (contest.userBId) {...}`, the exact same real-scoring branch human-vs-human contests use — `scoreB` is computed from the bot's actual lineup and stored, and the result page reads that same stored value back. The synthetic-random branch (the H-02 bug) is only ever reached now if bot-assignment itself failed (the documented try/catch fallback in section 3).
- [ ] **Test:** blocked on the same DB connectivity issue — play a Scrimmage contest to a win and a loss, confirm the displayed score never contradicts the result.

## 6. H-03 fix (bundled into this pass)

- [x] `badges.ts`'s win-count query excludes `isPaper` contests — added `eq(contests.isPaper, false)` to the win-count filter.
- [x] Win-rate calculation excludes `isPaper` contests — fixed on **both** dashboard and profile. Profile had the identical leak, not previously scoped in H-03's original write-up — found while implementing section 4, since profile was already being touched for the new Scrimmage XP stat.
- [ ] **Test:** blocked on the same DB connectivity issue — win several Scrimmage-only contests, confirm no real badge unlocks and both win-rate displays stay unaffected.

---

## Definition of done for Mode 1

All boxes above checked **and** each test actually run, not just implied by the code existing — this doc exists specifically so "I wrote the code" and "I confirmed it works" don't get conflated, which is the single most repeated gap across every other doc in this folder.

_Living doc — update checkmarks as work lands and gets verified, don't mark something done because it's merely written._
