# Design sketch — two players can't draft the same coin

Not started, no code touched. This is what it would actually take, based on how drafting works today.

## Why this isn't a small change

Today's draft is **fully client-local until a single atomic submit**:
- `src/routes/draft/+page.svelte`'s `lineup` is local Svelte state (`$state`) — `addToken()`/`removePick()` (lines ~213-251) never call the server. Nothing is written to the DB while you're drafting.
- The server only finds out what you picked in one shot: `POST /api/contest/[id]/lineup` (`src/routes/api/contest/[id]/lineup/+server.ts`), which takes all 5 picks at once and is also the *lock* action — there's no separate "submit a pick" step today.
- The two players never see each other's board while drafting. The opponent's picks aren't knowable server-side until they've also locked.
- A contest only goes `live` once **both** lineups exist (`+server.ts:160-194`) — there's no turn order, no shared clock during the draft itself, just "however long each player wants before they hit lock."

Excluding shared picks needs the server to know about a pick **the moment it's made**, not five minutes later when the whole lineup is submitted — otherwise there's nothing to check against. That means drafting has to stop being silent-until-submit.

## The shape of a fix (simultaneous drafting, not turn-based)

Keep today's "both players draft independently, no turns, no waiting on each other" feel — just make individual picks live instead of batched.

1. **New endpoint: reserve a pick.** `POST /api/contest/[id]/pick` — takes one `{ sector, currencyId }`, writes it immediately (a new `lineup_picks` row, or a lightweight `draft_reservations` table keyed by `contestId + currencyId`). Reject with 409 if that `currencyId` is already reserved by the *other* user in this same contest.
2. **Race condition, handled at the DB, not in application code.** A unique constraint on `(contest_id, currency_id)` (excluding the user's own prior reservation of a slot they're changing) makes "both clicked the same coin in the same 100ms" resolve to exactly one winner, atomically — the loser's request just gets a 409 back, same as any other constraint violation. No manual locking needed.
3. **Client needs to see the opponent's takenness live.** Something has to tell the draft page "BTC just got taken by the other player" while you're still looking at it — short-interval polling (e.g. every 3-5s, same pattern already used for the nav's active-match pill and lobby result polling) is the cheap option; a websocket/SSE channel is the real one if this needs to feel instant. Recommend starting with polling — it's the pattern already proven elsewhere in this codebase, upgrade later if it feels laggy.
4. **Releasing a reservation.** `removePick()` today just drops it from local state. With live reservations, that has to also tell the server to free it — `DELETE /api/contest/[id]/pick` or similar — so a token you picked-then-changed-your-mind-on doesn't stay falsely blocked for your opponent for the rest of the draft.
5. **Abandoned drafts.** If a player reserves tokens and then never locks (walks away), their reservations shouldn't hold those tokens hostage forever. Probably ties into whatever timeout already governs an unlocked contest — needs checking, not yet looked at.
6. **Lock changes meaning.** `POST /api/contest/[id]/lineup` stops being "here are your 5 picks" and becomes "finalize whatever I've already reserved" — a smaller, different job than it does today.

## Open questions worth settling before building

- **UI for "taken"**: greyed-out + disabled in the token pool, or still clickable with an inline error? Greying out is friendlier but needs the live opponent-picks feed to be genuinely fast, or it'll look stale.
- **Does this apply to every mode, or just 1v1?** Lobbies/tournaments (3+ players) make shared-pick exclusion a bigger pool to check against — worth deciding scope now rather than after 1v1 is built.
- **Scrimmage (vs bot)**: `draftBotLineup()` (`src/lib/server/botDraft.ts`) is called server-side from inside the same request that saves the human's lock (`lineup/+server.ts:114-119`), so the human's picks are already in the DB by the time the bot drafts — the timing works in exclusion's favor here. It doesn't take an exclusion list today though; it'd need a parameter added to skip whatever `currencyId`s the human just took. Smaller change than the live-reservation system above, not free.

## Recommendation on sequencing

Build the reservation endpoint + DB constraint first and prove the race-condition handling works under real concurrent clicks, before touching the draft page's UI — the hard part is the server-side contention, not the greyed-out-token styling.
