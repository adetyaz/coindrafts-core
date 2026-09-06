# Mode 4 — Multiplayer (Lobby rename) — Build & Test Checklist

_Created 2026-08-27. Same rule as the other mode checklists: a box only gets checked once it's actually built **and verified working**, not merely written. For the **why**, see `G-04` in `user-stories-by-surface.md` and Mode 4 in `game-modes-redesign.md`._

**Scope, confirmed by the doc itself:** *"No functional change identified in the redesign beyond being repositioned as one of three top-level mode choices."* This pass is a rename + entry-point pass, not a Lobby feature rebuild. `P-05`'s existing holes (no solo test path, missing `maxSize` on created lobbies, ambiguous started-vs-deleted detection) are explicitly untouched — the doc says so directly ("Nothing here changes those"), and Mode 3 was deferred rather than bundling unrelated fixes in, so the same discipline applies here.

**Naming convention decided while scoping this:** "Multiplayer" is the mode's top-level name (nav, dashboard entry point, the mode-selection framing). "Lobby"/"lobbies" stays as the in-page noun for the room itself once you're inside the feature — that's normal gaming vocabulary (a Fortnite lobby, an Among Us lobby), not a name needing to be purged. Only the mode-level framing changes; internal room copy ("Create lobby", "You host this lobby", the `/lobby` route, the `lobbies` table) is untouched.

---

## 1. Dashboard entry point (the actual gap — Multiplayer currently had zero discovery path)

- [x] Added a "Join Multiplayer" button to the dashboard hero, between "Find an opponent" (Single Match) and "Open draft" — same prominence, always visible (not conditional like Scrimmage's zero-contest-only CTA, matching Single Match's always-on treatment). Routes to `/lobby`.
- [x] `npm run check` — 0 errors, 0 warnings.
- [x] `eslint` — one new `goto()`-without-`resolve()` warning on this line, matching the file's own pre-existing convention (neither of the two sibling buttons in this same row uses `resolve()` either — `dashboard/+page.svelte` hasn't adopted that pattern anywhere yet). Confirmed via `git diff` this is the only genuinely new line among the errors reported; making just this one line an outlier would be worse than matching the file's existing style. Not a regression this pass is responsible for fixing repo-wide.
- [ ] **Test:** confirm visually once the dev server is checked — button is visible and routes to `/lobby`.

## 2. Rename to "Multiplayer" at the mode-selection level

- [x] `Nav.svelte`'s dropdown item: `label: 'lobbies'` → `'multiplayer'`
- [x] `/lobby` page's own top eyebrow badge: "Ranked lobby" → "Multiplayer" (this is the page's mode-identity badge, the equivalent of Scrimmage's subtitle — the room-level copy below it stays as-is)
- [x] `guide/+page.svelte`'s "Group play" path card: title `'Lobbies'` → `'Multiplayer'`, matching the same card list where "Practice" already became "Scrimmage"
- [x] `docs/+page.svelte` — already said "Multiplayer lobbies" as the feature name; confirmed, no change needed there
- [x] **Test:** grepped for "lobby"/"lobbies" across all `.svelte` mode-selection copy — only remaining instances are the intentionally-kept in-page room vocabulary (`/lobby` route, "Create lobby", toast messages, `/lobby/[id]/result` copy), none in nav, dashboard CTA, or the guide card title.

---

## Definition of done for Mode 4

Both sections checked and visually confirmed once the dev server is reachable — this pass has no DB-dependent logic to test (pure copy + a nav link), so it doesn't share Mode 1/2's network blocker.

_Living doc — update checkmarks as work lands and gets verified, don't mark something done because it's merely written._
