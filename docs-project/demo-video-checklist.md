# Demo video checklist

Max 3 minutes, public link (YouTube/Loom), must show core functionality + user flow + 0G integration.

Run this whole checklist twice: once as a **local trial** against `localhost:5173` on testnet 0G (no recording — just to catch anything that breaks or feels awkward), and once for the **real recording** — after `mainnet-migration-checklist.md` is done, against mainnet.

## Before you hit record

- [ ] Two funded test accounts (two different wallets) so matchmaking actually pairs you with someone — one browser profile per wallet, or two browsers.
- [ ] Both wallets have 0G in them (testnet for the trial, mainnet for the real take) — the achievement-badge claim near the end is a real transaction and needs gas.
- [ ] Have a resolved match already sitting in your account from earlier testing, as a fallback for the 0G Compute and 0G Chain shots in case you don't want to wait for a live one to finish.
- [ ] Screen recorder ready, browser zoomed/sized so text is readable in a small video player.
- [ ] Close other tabs/notifications — nothing distracting on screen.
- [ ] Do the local trial run first, without recording, so you're not discovering surprises live.

## Shot list (budget ~3 min total — these are targets, not hard stops)

- [ ] **0:00–0:20 — Sign in.** Connect a wallet, sign the message. Say in one sentence what CoinDraft is: *"CoinDraft is a fantasy-sports-style crypto drafting game — you pick tokens across five sectors, compete head-to-head, and score on real price movement."* Should be one signature, no surprise network-switch prompt — that only happens later, at the claim step.
- [ ] **0:20–0:50 — Draft.** Pick tokens into a few slots. Use the AI Draft Agent on one slot — pause on its "verified on 0G" receipt, point it out explicitly: *"That's running on 0G Compute, not a canned pick."* On the trial run: if the receipt is slow or blank, fix that before the real take, don't just talk over it.
- [ ] **0:50–1:10 — Lock in, land on the race screen.** Show both players' lineups, the per-token colored chart starting to move. Trial-run check: each token should have its own line color — if two picks share a color, that's a real bug to fix, not a video problem to work around.
- [ ] **1:10–1:40 — 0G Compute, second proof.** Ask the AI Mentor a question live, or open a resolved match's post-match breakdown. Say out loud that this is 0G Compute answering, not a canned response. Trial-run check: note actual latency here — if it's slow enough to feel like dead air, decide now whether Mentor or the pre-written breakdown is the safer pick for the real take.
- [ ] **1:40–2:10 — 0G Storage.** Open the Knowledge Base page, show Word of the Day or a Gauntlet quiz question. Mention this content is generated and permanently stored on 0G Storage — not just your own database. Make sure whatever's showing isn't mid-generation or stale from a previous session.
- [ ] **2:10–2:50 — 0G Chain, the money shot.** Win a match (or use one already resolved), go to `/profile`, claim an achievement badge. Let the wallet popup show on screen — you approving and paying gas for the transaction is the single strongest frame in the whole video, since it's proof the player is doing something real on-chain, not the backend faking it. This step now force-switches your wallet to 0G right before the tx — confirm on the trial run that this transition looks smooth, not like a stall. No claimable badge on this account? Use the fallback account, or trigger a fast win via Scrimmage vs a bot first.
- [ ] **2:50–3:00 — Close.** One sentence on what's next (mainnet, real-money wagers), if there's time — *"Next up: mainnet, and real-money wagers."* If you're already tight on time, cut this — don't run over 3 minutes to fit it in.

## After the trial run specifically

- [ ] Note anything that felt slow, broke, or needed an unplanned explanation.
- [ ] Fix or re-test anything that broke — don't carry a known issue into the real recording.
- [ ] Time the full run — if it's already tight at 3:00 with no mistakes, plan to trim narration on the real take rather than add more.

## After the real recording

- [ ] Upload to YouTube (unlisted is fine, must be publicly viewable via link) or Loom.
- [ ] Confirm the link actually plays in a private/incognito window — logged-out check.
- [ ] Confirm runtime is under 3:00.
- [ ] Paste the link into the submission form and into `submission-readiness.md`.
