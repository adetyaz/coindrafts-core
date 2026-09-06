# Tournament Mode — Build & Test Checklist

_Created 2026-08-27. Same rule as every other mode checklist: a box only gets checked once it's actually built **and verified working**, not merely written. For the **why**, see `G-05` in `user-stories-by-surface.md` and the Tournaments section of `game-modes-redesign.md`._

## Scope for this pass, confirmed 2026-08-27

**Public access + free-to-play funding only.** Private access ("pay to create") and Sponsor access both require the same real-money mechanic Wager Mode is blocked on, which is explicitly parked until it exists and is tested — building a payment flow that doesn't actually move money was already rejected once for Wager, the same call applies here. AC 2's "money mode" is deferred with it. Brackets (AC 4), sector-restriction (AC 5 / `G-08`), and XP-based payout structures (AC 3, applied to XP rather than cash) have no such dependency and are fully in scope.

**Architecture decision:** a tournament bracket stage (a qualifier group, or the final) *is* a `lobbies` row — not a new parallel contest primitive. `lobbies` gains two nullable columns (`tournamentId`, `tournamentStage`); everything else — join, start, draft, `resolveLobby()`'s scoring/XP/ranking — is reused completely unchanged. The only new logic is the orchestration layer: creating a tournament, assigning joiners into a filling qualifier group (auto-creating a new one when the current one is full), and advancing winners into the final once qualifiers close.

**Placeholder defaults, not final design decisions** — the doc explicitly said these three were left open and *not* questions to ask back about (tie-break, min/max participants, stage-advance threshold). Picking clearly-flagged, easy-to-change defaults so the feature is buildable, not asking again:
- **Min group size:** 4 (matches the "four-ish" floated in the dictation). Configurable per-tournament at creation, no enforced max.
- **Stage advancement:** the outright winner (rank 1) of each qualifier group advances. Simplest, most standard bracket behavior of the candidates floated.
- **Registration close → bracket start:** the tournament creator manually closes registration (mirrors the ownership model lobbies already use for "start early"). Any qualifier group still filling with ≥2 participants force-starts at that point (reuses the lobby `/start` endpoint's existing ≥2 rule); groups with 0-1 participants are dropped, no penalty. A tournament with only one qualifier group skips the final entirely — that group's winner is the tournament winner.
- **Tie-break:** not separately implemented — `resolveLobby()`'s existing score-sort has no explicit tie-break today (equal scores keep insertion order), and that gap isn't specific to tournaments. Not solving it here; noted, not silently ignored.

---

## 1. Schema

- [x] `tournaments` table: `id, name, createdBy, contestType, accessType ('public'), fundingMode ('free'), payoutStructure ('winner_take_all'|'top3_weighted'), sectorRestriction (nullable), groupSize (default 4), status ('open'|'active'|'resolved'), createdAt`
- [x] `lobbies` gains `tournamentId` (nullable FK) and `tournamentStage` (nullable int, 0 = qualifier, 1 = final)
- [x] Migration applied 2026-08-27 via `drizzle-kit push --force` — no destructive statements (new table, two new nullable columns, plus one unrelated pre-existing drift fix on `users.active_boosts`'s default). Confirmed applied cleanly, no errors.
- [x] **Test:** migration ran against the real DB and succeeded — this one's test *is* the apply.

## 2. Bracket orchestration (`src/lib/server/tournament-resolution.ts`)

- [x] `joinTournament(tournamentId, userId)` — finds the current filling qualifier lobby (`tournamentStage: 0`, `status: 'waiting'`, headcount < groupSize) or creates one, adds the participant. Also guards against double-joining a second group in the same tournament.
- [x] `closeRegistration(tournamentId, userId)` — creator-only: force-starts any filling qualifier group with ≥2 participants (reuses the exact ≥2 rule the standalone lobby `/start` endpoint already enforces), drops groups with <2, sets tournament `status: 'active'`
- [x] `onLobbyResolved(lobby)` hook, called from `resolveLobby()` when `lobby.tournamentId` is set — once every qualifier lobby for that tournament is `resolved`, either creates the final (2+ qualifier groups) with each winner auto-enrolled and auto-started (`status: 'drafting'` directly, same state `/start` puts a lobby in), or resolves the tournament directly (exactly 1 qualifier group — its winner is the tournament winner, no final)
- [x] Payout structure applied via `applyPayoutStructure()` at the final stage (or the sole qualifier group, if there was no final): redistributes the *same XP pool* `resolveLobby()`'s standard curve already paid that stage, rather than double-paying — `winner_take_all` zeroes everyone but rank 1, `top3_weighted` applies a 30/25/23-style split across ranks 1-3, everyone below rank 3 keeps their standard-curve XP untouched. Qualifier-stage XP (non-final) is never touched — participants keep the normal curve reward for their group.
- [x] `npm run check` — 0 errors after wiring the hook into `lobby-resolution.ts`.
- [x] **Test: single-group path live-verified 2026-08-27**, real HTTP calls through the dev server, two real users: created a tournament (`groupSize: 2`), both joined the same qualifier group, creator closed registration (force-started it), both submitted lineups (auto-went live), fetched the result (triggered `resolveLobby`). Confirmed: standard curve paid 250/60 pre-redistribution, `applyPayoutStructure`'s `winner_take_all` correctly moved the full 310 pool to rank 1 and zeroed rank 2, and the tournament auto-transitioned to `status: 'resolved'` since there was only one qualifier group — exactly the designed single-group shortcut, no final needed.
- [x] **Test: multi-group → final bracket advancement — live-verified 2026-08-27**, 4 real users through the real dev server. Two bugs found and fixed by this test, not by review:
  1. **`joinTournament`'s "find a filling group" query had the same unqualified-column bug as the detail endpoint's headcount** (see §4) — all 4 users piled into one group of `groupSize: 2` instead of splitting into two groups of 2, because headcount always read 0 so every group looked "not full yet." Fixed with the same hardcoded `"lobbies"."id"` qualification. Re-ran clean afterward: U1/U2 correctly formed group A, U3/U4 correctly started group B.
  2. **`myLobbyId` picked an arbitrary lobby the user had ever participated in, not their current one** — once a player advances to the final, they have rows in both their now-resolved qualifier lobby and the final; the query had no preference between them, so the polling client could get pointed back at a stage the player already finished instead of the final. Fixed by ordering on `desc(lobbies.tournamentStage)`. Confirmed live: before the fix `myLobbyId` stayed on the resolved qualifier; after, it correctly switched to the final.
  Full flow after both fixes: 2 qualifier groups resolved → final auto-created with exactly the 2 winners enrolled → final lineups submitted and resolved → `top3_weighted` payout correctly split the 310-XP pool 169/141 (30:25 weighting, exact expected math) → tournament auto-transitioned to `status: 'resolved'`.
- [x] `npm run check` — 0 errors after both fixes.

## 3. Sector-restricted draft pool (`G-08`)

- [x] `/api/tokens` accepts an optional `?sector=` filter, server-side via `classifySector`
- [x] New `GET /api/lobby/[id]` — didn't exist before, needed so the draft page can look up its lobby's tournament sector restriction (small, minimal endpoint, just `id/contestType/tournamentId/tournamentStage/sectorRestriction`)
- [x] Draft page fetches that on load when `lobbyId` is present, passes `?sector=` through to `/api/tokens`, and shows a visible "L1-only tournament" badge + subtitle so the restriction isn't an invisible filter
- [x] `npm run check` — 0 errors.
- [ ] **Test:** create a sector-restricted tournament, confirm the draft screen only offers that sector's tokens — needs the full tournament flow (§4/§5) to exist first to actually reach this screen via a tournament.

## 4. API routes

- [x] `POST /api/tournaments` — create (name, contestType, payoutStructure, sectorRestriction, groupSize). `accessType`/`fundingMode` are hardcoded server-side to `'public'`/`'free'`, not accepted from the request body at all, so a client can't sneak in `'private'`/`'money'` before the mechanic exists.
- [x] `GET /api/tournaments?status=open` — browse, with a live participant-count subquery per tournament
- [x] `GET /api/tournament/[id]` — detail (status, bracket groups with headcounts, the caller's own group if any) for polling
- [x] `POST /api/tournament/[id]/join` — wraps `joinTournament`
- [x] `POST /api/tournament/[id]/close-registration` — creator-only, wraps `closeRegistration`
- [x] **Bug caught during self-review, fixed before testing:** the detail endpoint's "which group am I in" query joined `lobbyParticipants`→`lobbies` but never filtered by the requesting user's id — it would've returned an arbitrary participant's lobby to everyone. Added the missing `userId` filter.
- [x] `npm run check` — 0 errors.
- [ ] **Test:** blocked on DB connectivity for a full live run.

## 5. `/tournament` page

- [x] Create form (name, daily/weekly, payout structure, optional sector restriction, group size)
- [x] Browse open tournaments, join
- [x] Status view: qualifier groups and headcounts, creator's "Close registration" control, final bracket once active — polls every 3s and auto-redirects to `/draft?lobbyId=` the moment your group leaves `'waiting'`
- [x] `npm run check` — 0 errors.
- [ ] **Test:** needs a browser — not curl-testable, same as the last two modes' UI pieces.

## 6. Entry point

- [x] Nav dropdown gets a "tournament" item; dashboard hero gets a "Tournaments" button alongside the other three modes' entry points
- [x] `npm run check` — 0 errors.
- [ ] **Test:** visual check, needs a browser.

---

## Definition of done

All boxes checked and live-verified — code-complete is not the same as working, same standing rule as every mode before this one.

_Living doc — update checkmarks as work lands and gets verified, don't mark something done because it's merely written._

---

## Confirmed user flow — 2026-08-29

### Entry paths

```
A. Invited          → private tournament, join via invite
B. Browse           → /tournament lists PUBLIC tournaments → join
C. Create           → set terms, choose public or private, invite people
```

### The public list must show, per tournament

- Free-to-play or funded
- Duration / contest type
- **Time remaining until joining closes** — the countdown is the hook

### Creation now requires a closing time

**This is the key change.** A tournament is created with a **registration closing
date/time**. At that moment, two things happen together:

1. **No one else can join.**
2. **The tournament starts.**

So the closing time is not just a cutoff — it's the scheduled start.

---

## What this changes about the current build

| Confirmed behaviour | Built today | Gap |
| --- | --- | --- |
| Closing date set at creation | `tournaments` has no such column | **Add `registrationClosesAt`** |
| Auto-start at that time | `closeRegistration()` is creator-only, manual | **Needs a trigger** — see below |
| Public list with countdown | No listing page | Not built |
| Private + invite | `accessType` exists but only `'public'` is used; no invite mechanism | Not built |

### The trigger problem — same one short games have

Nothing in the app can reliably act at a specific future moment. The only scheduled job
is a **once-daily** cron (`5 0 * * *`), which cannot start a tournament that closes at
14:30. This is the identical gap that leaves short contests unresolved.

The workable pattern is what contest resolution already does: **lazy evaluation** —
whenever anyone loads the tournament page or the public list, check whether
`registrationClosesAt` has passed and start it then, with the daily cron as a backstop
for tournaments nobody looks at. Not elegant, but it needs no new infrastructure and it
matches how the rest of the app already behaves.

### Two things the flow doesn't yet answer

**What if too few people joined by closing time?** Registration closes and the
tournament is supposed to start — but with one participant there's no game.
`closeRegistration()` already drops groups with fewer than two players, so a
one-person tournament would close into nothing. Needs a decision: cancel and notify,
extend the deadline, or start anyway against a bot.

**Can the creator still close early?** The manual `closeRegistration()` exists and
works. Worth keeping as an override — "everyone's here, start now" — with the scheduled
time as the automatic fallback rather than the only path.

### Two different closes — clarified 2026-08-29

The word "close" was doing two jobs. They are different events with different outcomes,
and conflating them was an error in the section above.

| | **Close to START** | **Close to CANCEL** |
| --- | --- | --- |
| Trigger | Closing time reached **and** enough players | Closing time reached **and not** enough players |
| Meaning | Registration ends, the game begins | The tournament dies, never played |
| Resulting status | `active` | **`cancelled`** (new — schema currently has no such state) |
| Participants | Play | Released; any stake refunded in full |
| Reusable? | n/a | Nothing to resume — it is permanent |

**Same moment, two outcomes.** One `registrationClosesAt` timestamp; when it passes,
viability is evaluated and the tournament branches to exactly one of these. It is never
both, and there is no in-between state.

**Schema impact:** `tournaments.status` is currently `'open' | 'active' | 'resolved'`.
It needs **`'cancelled'`**. Without it a dead tournament has nowhere to go and would
either sit in `open` forever (still listed, still joinable) or be faked as `resolved`
(implying someone won).

**Why the distinction matters beyond naming:** once funding exists, a cancel **must
refund every stake**, while a start **must lock them**. Same timestamp, opposite
financial consequence. Getting this wrong means either taking money for a game that
never happened, or releasing stakes from a game that did.

### Invites answer the "too few players" question — for private

Correct: for a **private** tournament, the invite *is* the recruitment mechanism — you
invite the people you expect to play. That greatly reduces the empty-tournament case,
though it doesn't remove it (invite five, two show up), so the viability check still
runs. It simply fires far less often.

**Public tournaments have no such guarantee** — anyone may join, or nobody may. That's
where cancel-close does its real work.

### Auto-created public tournaments

To stop the public list being empty — which is the cold-start problem: no tournaments
listed → nobody joins → nobody creates any.

- The system creates public tournaments on a rolling basis, so there is always something
  joinable.
- Each carries a normal `registrationClosesAt`.
- **If nobody joins by then, it cancel-closes permanently** and quietly disappears.
- Something creates the next one, so the list stays populated without a human.

This makes cancel-close the *common* path rather than an edge case — most auto-created
tournaments will die unjoined, and that is expected, not a failure. It should therefore
be silent: no error, no notification, no clutter in any listing.

**Still open:** what "enough players" means. `closeRegistration()` currently drops
groups under two, so two is the effective floor. Whether a tournament needs more than
two to be worth starting is a product call, not a technical one.
