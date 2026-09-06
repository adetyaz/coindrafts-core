# Midnight submission checklist — coindrafts-mn

Repo: [github.com/adetyaz/coindrafts-mn](https://github.com/adetyaz/coindrafts-mn) — confirmed public, `main` default branch, empty so far.

Every item below maps to a literal line in the rules you pasted. Order matters — items 1–2 gate everything else.

---

## 1. Build something real, specific to Midnight — the eligibility gate

> "Forks and existing codebases may be used only where the submission introduces meaningful new functionality or material improvements related to Midnight. Mere copies or minor modifications are not eligible."

`coindrafts-mn` starts as a copy of the shared CoinDraft app (via the hub, per `hub-migration-plan.md`). That copy, on its own, **does not qualify**. What has to actually exist before this is a valid submission at all:

- The **commit-reveal contract** from `midnight-integration-findings.md` §3 — private lineup picks, built in real Compact, deployed to a real Midnight network (testnet at minimum). Not a description of the pattern — working code, the same bar as the 0G submission's "verified, not just claimed" standard.
- Realistically the "Scouting" / private-lineup contest mode (§5's table) is the feature this becomes, since it's the one genuinely strong fit already identified.
- Before writing a line of Compact: §6 of that doc flagged real unknowns (DUST mechanics, real browser proof-generation latency, whether Kūkolu-phase mainnet restricts third-party deploys, whether preview/preprod are still current) — worth a fresh check against docs.midnight.network first, it's been a couple weeks since that research.

**Nothing else on this list matters if this isn't real.** A polished README describing a contract that doesn't exist is exactly the "mere copy" this rule exists to exclude.

## 2. Apache 2.0 compliance — ✅ done

Full Apache License 2.0 text added as `LICENSE` on `coindrafts-mn`'s `main` branch. Per-file header comments aren't required by the license itself; skipping unless judges ask.

## 3. The `midnightntwrk` GitHub label — ✅ done

Confirmed a repo topic, not an issue label. Set via the API and verified live: `coindrafts-mn`'s topics now show `["midnightntwrk"]`.

## 4. Populate the repo with the shared app

Per `hub-migration-plan.md` — full history or fresh start is still your call (asked twice now, still open). Either way this happens *after* item 1 has real Midnight code to bring along, not before — no reason to push a bare copy now and re-push once the real feature exists.

## 5. The README

> "A clear README explaining the project, setup process, architecture, Midnight integration, and how judges can test or evaluate the submission."

Five required sections, explicitly:
- What the project is
- Setup process (mirrors what's already in `coindrafts`' README, minus anything 0G-specific)
- Architecture
- **Midnight integration specifically** — this is the part that has to be genuinely new writing, not adapted from the 0G doc. Real commit-reveal contract details, what it hides, what it doesn't (the honest §4 limitation from the findings doc is worth including verbatim in spirit — judges tend to trust a submission more when it states its own limits plainly, per how the 0G submission handled the same instinct).
- How judges test/evaluate — needs to be concrete: a live testnet URL, a wallet-connect flow, a specific thing to click that demonstrates the private-pick mechanism working.

Per the hub migration plan, this README stays local to `coindrafts-mn` — never overwritten by a sync from the hub.

## 6. Slide deck

The 0G pitch deck exists already (`pitch-deck.md` / published artifact from earlier). Not a straight reuse — needs a Midnight-specific version: same product, different chain story (privacy/commit-reveal instead of Compute/Storage/Chain infrastructure).

## 7. Demo video

Also can't reuse the 0G videos directly — needs to actually show the Midnight-specific flow: connecting Lace, committing a private pick, the reveal. If the private-lineup mode is genuinely a separate, opt-in contest type (per the findings doc's own scoping), the demo should show it as its own distinct thing, not imply it replaces the existing draft flow.

## 8. Progress-during-Wave writeup

> "A description of the progress completed during the applicable Wave."

Needs the actual Wave dates/number for this round (not yet confirmed here — check the current call for submissions page, `midnight-0g-timeline.md`'s "Wave 1 starts Aug 26" is over a month stale now).

## 9. Resubmission note

> "When resubmitting a project from an earlier Wave, a clear explanation of what has changed."

Not applicable yet — this is a first submission. Keep in mind if this becomes a multi-Wave project like the 0G one did.

## 10. Live presentation, if selected

No action now — just something to expect if judges request it.

---

## Suggested order

1. Fresh-check the §6 unknowns against current Midnight docs.
2. Build the real commit-reveal contract + private-lineup mode (item 1) — this is the actual work.
3. Add LICENSE (item 2) and the `midnightntwrk` topic (item 3) — quick, do these early so they're not forgotten at the end.
4. Populate `coindrafts-mn` from the hub (item 4), now carrying the real Midnight feature.
5. Write the Midnight-specific README (item 5).
6. Deck (item 6) and demo video (item 7) — last, once the feature is stable enough to film/present honestly.
7. Progress writeup (item 8).
