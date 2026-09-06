# Hub → repo migration plan

How code moves from the private hub (`coindrafts-core`) out to the public, per-buildathon repos, and how each stays visibly themed to its own chain without duplicating the whole app by hand.

---

## 1. The repos, current state

| Repo | Visibility | Chain focus | Status |
| --- | --- | --- | --- |
| `coindrafts-core` | Private | none — shared/chain-agnostic core | ✅ Created, populated with `coindrafts`' full history (`C:\Users\PC\Documents\Projects\Work\coindrafts-core`) |
| `coindrafts` | Public | 0G | This is the current working copy — already 0G-themed throughout (docs, README, achievements on 0G Chain, etc.) |
| `coindraft` | Public | SoSoValue | Exists, last touched Aug 25, sitting on `ui-updates`. Not being repurposed — `coindrafts-mn` is the real Midnight repo instead, so `coindraft` stays the SoSoValue submission as-is. |
| `coindraft-mn` — [github.com/adetyaz/coindrafts-mn](https://github.com/adetyaz/coindrafts-mn) | Public | Midnight | ✅ Resolved — this is the Midnight repo, confirmed. `main` is the default branch. Has: Apache 2.0 `LICENSE`, the `midnightntwrk` topic, a plain project description. Not yet populated with app code — waiting on the real Compact commit-reveal contract to exist first (per `midnight-submission-checklist.md` §1, the eligibility gate), then populated from the hub the same way `coindrafts-core` was. |

**The four repos this hub interacts with, for reference:**
- `coindrafts-core` — https://github.com/adetyaz/coindrafts-core (this repo, private)
- `coindrafts` — https://github.com/adetyaz/coindrafts (0G, public)
- `coindraft` — https://github.com/adetyaz/coindraft (SoSoValue, public)
- `coindrafts-mn` — https://github.com/adetyaz/coindrafts-mn (Midnight, public)

## 2. Two things this plan has to solve separately

**(A) Getting the shared app code into a target repo.** Drafting, matchmaking, scoring, the dashboard, Gauntlet, Mentor — none of that is 0G- or Midnight-specific. This should be able to flow into any target repo without manual re-copying.

**(B) Keeping each repo's *documentation* pointed at its own chain.** This is the part that can't just be "sync everything" — `coindrafts`' README talks about 0G Compute/Storage/Chain; a Midnight repo's README needs to talk about Compact contracts, Lace, commit-reveal, not 0G. Syncing blindly would silently overwrite one chain's story with the other's.

## 3. Proposed structure for (B) — doc files stay local to each repo, never synced

Keep chain-specific docs **out of the sync entirely**, in a fixed set of files each repo maintains independently:

- `README.md`
- `ARCHITECTURE.md`
- Anything under `docs-project/` that's chain-specific (e.g. `0g-*.md` stays in `coindrafts` only, a `midnight-*.md` equivalent stays only in the Midnight repo)

The sync mechanism (below) would explicitly **exclude** these paths, the same way `.gitignore` excludes `.env`. Concretely: a small exclude-list the sync script reads, e.g. `README.md`, `ARCHITECTURE.md`, `docs-project/` — everything else (app code, `src/`, `contracts/`, etc.) syncs freely.

This means: when you push a shared feature (say, a new dashboard widget) from the hub, it lands in both `coindrafts` and the Midnight repo — but each repo's README keeps saying what it's always said about its own chain, untouched.

**Trade-off worth naming:** this means doc changes never auto-propagate — if you improve the *shared, chain-agnostic* parts of a README (say, the gameplay explanation both repos share), you'd copy that paragraph by hand into both. Given how different the two chains' stories actually are, that's probably the right trade — full doc automation would need each repo's README to be templated/generated, which is more machinery than this needs right now. Flagging it so it's a deliberate choice, not a gap you find later.

### 3a. `docs-project/` specifically — a one-off manual copy, not part of any sync yet

Separate issue from the README/ARCHITECTURE exclusion above, worth its own note: `docs-project/` was gitignored on every repo (`coindrafts`, `coindraft`, presumably `coindrafts-mn` once populated) — deliberate, keeps internal planning notes out of what judges see on the public repos. That meant it had never been committed anywhere, including here.

It's here now (2026-09-06) as a **one-time manual copy** from `coindrafts` at that moment, with this hub's own `.gitignore` edited to stop excluding it — that edit is local to `coindrafts-core` only, the public repos' `.gitignore`s are untouched on purpose. **This does not auto-update.** Anything edited in `coindrafts`' `docs-project/` after that copy won't appear here until copied again by hand, same limitation as everything else in this section until the real GitHub Actions sync exists.

## 4. Proposed structure for (A) — GitHub Actions, triggered from wherever you push

Matches what you described: you push code somewhere, and a workflow fans it out to whichever target repo(s)/branch(es) you choose that time — not always all of them.

**Where the workflow lives:** in `coindrafts-core` (the hub). Reasoning: it's the one repo that's private, so the fan-out logic and the PAT it needs aren't exposed in a public repo's Actions logs/config. You'd push your day-to-day work into the hub; the hub is what actually distributes outward.

**This does shift your workflow slightly from what you have today** — right now you push directly to `coindrafts` (public). Under this plan, `coindrafts-core` becomes the place you push to first, and syncing to `coindrafts` becomes one of the fan-out targets rather than the default `git push`. Worth confirming that's what you want before I build it — the alternative is putting the workflow in `coindrafts` itself instead, which is simpler (no change to your push habit) but means the fan-out config and secret live in a public repo.

**Selecting targets per push** — two ways to do this, pick one:
- **`workflow_dispatch` with checkboxes/inputs** — you go to the Actions tab, tick which repos/branches to sync to, click run. Explicit, no chance of an accidental sync, but it's a manual step separate from `git push`.
- **Branch-name convention** — e.g. pushing to a branch named `sync/coindrafts` in the hub triggers a sync to `coindrafts` main only; `sync/midnight` triggers the Midnight repo only; `sync/all` triggers both. Closer to "just push and it happens," but means remembering the right branch name each time.

Your example — "push to main on the Midnight repo and `ui-updates` on `coindraft`, while leaving 0G out of it" — both approaches support that; it's really about how you'd like to *express* the choice at push time.

**What the workflow actually does**, once triggered: checks out the hub, removes the excluded doc paths from a temp copy, force-pushes that filtered tree onto the target repo's chosen branch (as a new commit, not a history rewrite of the target — the target keeps its own commit history, this is a push of new content on top).

**The PAT** — needs push access to `coindrafts` and whichever Midnight repo you hand me, stored as a secret on `coindrafts-core` only (never on the public repos, since anyone with write access there could otherwise read it). You'd generate this yourself (a fine-grained PAT scoped to just those repos is safer than a classic all-repo token) and hand me the secret name once it's added — I won't need to see the token value itself, just confirmation it's there.

## 5. Sequencing — what happens when

1. ✅ Done — `coindrafts-core` created, private, populated (app code + `docs-project/`).
2. ✅ Done — Midnight repo confirmed: `coindrafts-mn`. LICENSE + topic + description set (see `midnight-submission-checklist.md`).
3. **In progress, on you** — the real Compact commit-reveal contract (`midnight-submission-checklist.md` §1) has to exist before `coindrafts-mn` gets populated with app code at all — populating it early with a bare copy risks the "mere copy, not eligible" disqualification.
4. Once that feature is real: populate `coindrafts-mn` from the hub (full history or fresh copy — still your call, unanswered below), then write its Midnight-specific `README.md`/`ARCHITECTURE.md`.
5. Confirm the two open decisions below (workflow location, target-selection method).
6. Build the actual GitHub Actions workflow + PAT wiring.
7. Test it once with a trivial, reversible change before trusting it with anything real.

## 6. Open questions, still yours

- Full git history into `coindrafts-mn`, or fresh start (same question as `coindrafts-core`, unanswered so far)?
- Workflow lives in `coindrafts-core` (my recommendation) or in `coindrafts`?
- Dispatch-input selection or branch-name convention?
