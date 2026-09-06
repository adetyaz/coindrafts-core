# Knowledge Base rebrand (G-09) + Term of the Day (G-10) — Build & Test Checklist

_Created 2026-08-27. Same rule as every other checklist in this folder: a box only gets checked once it's actually built **and verified working**, not merely written._

## Scope decisions made while scoping this

**G-09 is a pure rebrand, confirmed by its own doc entry** — "no functional change... Nothing here changes those [P-12's holes]." Renaming display copy only; `/research`'s route, API, and known bugs (boost claimed on expand not read, client-only claim state) are untouched, same discipline as the Multiplayer rename.

**G-10's two open holes, resolved as documented defaults** (not questions to ask back about — same category as Mode 2's matching mechanism, an implementation decision, not a spec gap):
- **Term list source:** a small hardcoded/seeded bank, mirroring `gauntlet.ts`'s `SEED_QUESTIONS` pattern exactly — deterministic per-day pick via the same date-hash function, no live-data or LLM dependency needed for "surface a vocabulary term."
- **Daily slot: separate from Gauntlet, not merged.** They stay two independent daily rituals (Gauntlet = market question, Term of the Day = vocabulary + quiz) — simpler to build, and the doc frames them as related-but-distinct ("same idea as X-12... now with example terms," never described as replacing Gauntlet).
- **Research streak scope:** a new `users.researchStreak` + `users.lastResearchDate`, separate from the existing win-only `streak` (**F-08** already documents that field as win-only). Increments once per calendar day on *either* a research-article read or a Term of the Day attempt (engagement-based, not correctness-gated — matches the doc's "consistent daily engagement" framing, distinct from Gauntlet's correctness-gated XP).

---

## 1. G-09 · Knowledge Base rename

- [x] Renamed "Research Hub" → "Knowledge Base" everywhere it's user-facing display copy: home page footer link, guide card body, draft page's "From Research Hub" tag, the `/research` page's own H1, docs feature list, nav dropdown label
- [x] Route (`/research`), API paths, component/file names, and P-12's existing holes are untouched — rebrand only
- [x] `npm run check` — 0 errors.
- [x] **Test:** grepped for "Research Hub" — zero remaining outside one internal code comment (correctly untouched, not user-facing).

## 2. G-10 · Term of the Day — schema

- [x] `daily_terms` table: `id, term, definition, quizOptions (jsonb), correctOption, xpReward, activeDate, createdAt` — mirrors `gauntlet_questions`' shape
- [x] `term_attempts` table: `id, userId, termId, answer, correct, xpEarned, attemptedAt` — mirrors `gauntlet_attempts`
- [x] `users.researchStreak` (int, default 0) + `users.lastResearchDate` (date, nullable)
- [x] Migration applied 2026-08-27 via `drizzle-kit push --force` — additive only (2 new tables, 2 new nullable/defaulted columns), no destructive statements.
- [x] `npm run check` — 0 errors.
- [x] **Test:** migration ran against the real DB and succeeded.

## 3. G-10 · Term of the Day — backend

- [x] `term-of-day.ts`: seeded term bank (10 real terms with definitions + 3 plausible-but-wrong quiz distractors each), `ensureTodayTermSeeded()` mirroring `gauntlet.ts`'s deterministic date-hash pick
- [x] `POST /api/term/answer` — one attempt/user/day, awards XP on correct, bumps `researchStreak` on *any* attempt via the shared `bumpResearchStreak()` helper
- [x] `GET /api/term/today` — today's term + whether this user already attempted it
- [x] `bumpResearchStreak()` shared between `/api/term/answer` and `/api/research/read` — same helper, one streak, either path counts once per day
- [x] `npm run check` — 0 errors.
- [x] **Test: live-verified 2026-08-27** through the real dev server: `GET /api/term/today` correctly self-seeded a deterministic term with shuffled options; `POST /api/term/answer` correctly scored a right answer (+20 XP), correctly refused a second attempt (409); confirmed directly in the DB that `research_streak` became `1` and `last_research_date` was set by the shared `bumpResearchStreak()` helper.

## 4. G-10 · Term of the Day — UI

- [ ] A `TermOfDay.svelte` component (dashboard placement, alongside/near `Gauntlet.svelte`), showing the term + definition, then a quick multiple-choice quiz on submit
- [ ] Research streak surfaced somewhere visible (dashboard stat or profile) — distinct from the existing day-streak display
- [ ] **Test:** needs a browser, same as every other UI piece this session.

---

## Definition of done

All boxes checked and live-verified. Code-complete isn't the same as working — same standing rule as every checklist before this one.

_Living doc — update checkmarks as work lands and gets verified, don't mark something done because it's merely written._
