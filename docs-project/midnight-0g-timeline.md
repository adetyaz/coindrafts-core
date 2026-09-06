# Midnight × 0G — Build Timeline (as of Aug 16, 2026)

_Discussion-phase output. Both integrations already have their own detailed docs — this is just the scheduling decision that resolves the conflict between them._

**Read [`midnight-integration-findings.md`](midnight-integration-findings.md) (2026-08-26) before scoping any Midnight work.** It's the first actually-grounded research on Midnight for this project — this doc's `midnight-integration-notes.md` reference (below, "Still open") turns out not to exist in this repo, same situation as `0g-integration-plan.md`'s missing `CoinDraft.dc.html`. The findings doc covers current mainnet/testnet status (mainnet is live but federated, not fully decentralized yet), a verified commit-reveal contract pattern for private lineups, and an important limitation: Midnight doesn't solve CoinDraft's actual price-resolution trust problem, only pick-privacy between players.

## The dates

- Today: **Aug 16**
- 0G deadline: **Aug 30** (14 days out)
- Midnight Wave 1 starts: **Aug 26** (10 days out)
- Overlap window: **Aug 26–30** (4–5 days)

Solo build. The overlap lands on Midnight's highest-effort days (learning Compact, standing up the Docker proof server, wiring Lace wallet connect), which is the actual problem — not the calendar overlap itself.

## Resolution: compress, don't parallelize

Front-load 0G's real building into the 10 days before Midnight starts, so the overlap window only has to absorb low-effort submission-prep (README, demo video, deck) rather than active building.

| Days | Focus | What |
| --- | --- | --- |
| Aug 16–21 (5 days) | 0G — building | Phase 1 (Compute swap on `/api/mentor`, `/api/breakdown`) + Phase 2 (Agentic ID for the 8 bots) |
| Aug 22–25 (4 days) | 0G — wrapping | Overrun buffer, then README/demo video/deck |
| Aug 26 | 0G done, Midnight starts | Submission goes in whenever ready inside this window — not still mid-build |
| Aug 26–30 | Midnight — building | Full attention — Compact commit/reveal contract |
| Aug 30 | 0G deadline passes | Already submitted, nothing competing |
| Aug 30 onward | Midnight — building | Runs to Wave 1's actual close, no competing deadline |

## Scope cut this forces (and is the right call regardless)

0G's build for this round: **Phase 1 + Phase 2 only.**
- Phase 1 — Compute swap (fast, close to a config change)
- Phase 2 — Agentic ID for the bots (meatier, but has a real existing artifact to tokenize — the 8-bot roster already running in `bots-service/keep-bots-online.cjs`)

Phase 3 (Storage for immutable results) and Phase 4 (user-owned bots) are deferred, not cut for good — see `0g-integration-plan.md` for the full four-phase plan. Two things built well beats four things shipped shallow for a solo build on this clock.

## Still open (from `midnight-integration-notes.md`, unresolved)

- [ ] Confirm `coindraft` repo is public (Midnight submission hard gate)
- [ ] Lace-wallet friction call — accept it plainly for the Private Contest mode vs. try to isolate further
