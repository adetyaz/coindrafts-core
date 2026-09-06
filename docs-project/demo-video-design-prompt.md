# CoinDraft demo video — prompt file

Rewritten against real screenshots of the live app (both `localhost:5173` and the deployed `coindrafts.vercel.app`) — every headline, button label, and number below is copied from an actual screen, not paraphrased. Cross-reference: `docs-project/demo-video-checklist.md` for recording setup, `README.md`'s "Mainnet Deployment" section for the real contract/storage addresses if any should appear on screen as text.

---

## Style brief

CoinDraft's own visual language: off-white/mint-tinted background, coral primary accent (`#F78E79`), mint for positive states, dark ink cards for emphasis. Archivo for display type, JetBrains Mono for numbers. A live ticker tape of token prices runs across the top of nearly every page — let it be visible, it's part of the app's identity. Screen-recording style — this is a real product demo, every scene should show something actually happening on screen.

---

## Where "0G" actually appears on screen — read this before writing narration

Three real, concrete places the app currently shows "0G" visually. Don't invent a fourth — narrate over the gaps instead.

1. **The wallet's own transaction popup, during a badge claim — the strongest one.** This isn't CoinDraft's UI, it's MetaMask's own confirmation screen, which makes it more credible, not less: **"Transaction request" → Network: `OG-Mainnet` → Request from: `coindrafts.vercel.app` → Interacting with: `0x4D165...42Caa`.** That address is the real, live, deployed `CoinDraftAchievements` contract. This is the money shot — hold on it.
2. **Profile page section header:** `ACHIEVEMENTS — UNCLAIMED ON 0G`, with body copy "You've earned these. Claiming mints it to your own wallet — you approve and pay the gas, it's genuinely yours."
3. **AI Draft Agent receipt**, shown after it fills a slot: `✓ Assist verified on 0G` — "This draft is recorded as AI-assisted, with the inference receipt attached."

**Gap worth knowing:** the Knowledge Base / Word of the Day screen does **not** currently show "0G" as on-screen text, even though that content is genuinely archived on 0G Storage. If that scene is filmed as-is, the narration has to carry the claim — the screen won't. (If there's time before recording, a small "Stored on 0G Storage" caption near Word of the Day would close this gap — flagging as a suggestion, not something already built.)

---

## Scene 1 — What CoinDraft is (0:00–0:20)

**Visual:** The landing page. Headline **"Draft coins. / Beat people."** (first line black, second line coral), the pill **"3 CONTESTS LIVE"**, subtext: *"One token per sector, five sectors, twenty-four hours. No leverage, no liquidations — your read against theirs, scored on relative return."* The live ticker tape scrolling. The mockup card on the right showing a real lineup ("YOUR LINEUP · LOCKS IN 00:42", BTC/L1 +0.5%, ARB/L2 +30.6%, UNI/DEFI +12.5%) with the overlaid "You won / 742 / 689 · +140 XP" result card.

**Narration:** "CoinDraft is a fantasy-sports-style crypto drafting game. One token per sector, five sectors, twenty-four hours. No leverage, no liquidations — it's your read against theirs, scored on relative return."

---

## Scene 2 — The three ways to play (0:20–0:50)

**Visual:** Cut to the Scrimmage page. Eyebrow **"SCRIMMAGE"**, headline **"Play a bot, keep your rank"**, body: *"Draft against a bot opponent and earn Scrimmage XP. Same board, same scoring, same result screen — but nothing here touches your real rank, win rate, or badges. No waiting for an opponent: the bot drafts a full lineup the moment you lock yours."* Show the duration picker (10 min / 20 min / 45 min / 3 hours / 24 hours / 7 days) and the button **"Start Scrimmage · 24 hours"**.

**Narration, three beats:**
- **Scrimmage** — "Practice mode. Draft against a bot, earn Scrimmage XP — it never touches your real rank."
- **Single Match** — "Head-to-head against a real opponent, matched on duration and stake."
- **Tournament** — "Bracket-style — create or join one, everyone drafts, top scorers advance."

---

## Scene 3 — Single Match walkthrough (main demo, 0:50–2:45)

### 3a. Duration and stake
**Visual:** The Single Match setup screen. Eyebrow **"SINGLE MATCH"**, headline **"How long should it run?"**, body: *"You'll be matched with someone who picked the same length, so prices are read over the same window. Shorter games fill more slowly — there are fewer people waiting on them."* Duration pills (10 min selected). Then **"PLAY FOR SOMETHING?"** stake pills (No stake / 25 XP / 50 XP / 100 XP / 250 XP), body: *"You'll be matched with someone who chose the same stake. Before the game starts you can raise — but it always settles at the **lower** of the two, so you can never be pushed above your own number."* Balance shown ("Balance: 2760 XP"). Button **"Find an opponent · 10 min · 25 XP"**.

### 3b. Matchmaking
**Visual:** The "Finding your rival" screen — **"SEARCHING"** pill, spinning animation, countdown, body: *"Scanning for a real, currently-available opponent. No bots here — if no one's around you'll get the option to Scrimmage instead while we keep looking."* Button "Cancel search". Then cut to **"MATCHED"** → **"Opponent found"** → "Redirecting to the draft..." with the green "Opponent found!" toast.

### 3c. Drafting across sectors
**Visual:** The draft board. Headline **"Build your lineup"**, subtext *"One token per sector · scoring runs 24h from lock"*, live countdown ("44:11 to lock"). Show sector cards filling in order — L1 (picked), L2 (picked), DeFi (picked), Meme (open), Wildcard (open, showing a live % even while empty). Hover a token to show the real Stats/News popover (Price, 24h Volume, 24h High/Low, Market Cap, From ATH). Show the "PROJECTED SCORE" panel updating live as sectors fill.

**Narration:** "Five slots, five sectors — Wildcard takes anything, the other four are sector-locked."

### 3d. AI Draft Agent
**Visual:** Open the **"✨ Need a hand?"** popover, choose "Fill the next empty slot" or "Auto-draft everything left." Let the pick land, then show the real receipt: **"✓ Assist verified on 0G"** — "This draft is recorded as AI-assisted, with the inference receipt attached."

**Narration:** "Don't know what to pick? The Draft Agent fills a slot for you — and this receipt is real, not decorative: it's a genuine 0G Compute inference call."

### 3e. The wager
**Visual:** After both lock, the "Ready" screen — **"player_99bd4b vs player_980e6d"**, **"READY"** pill, *"Both lineups are locked at their entry prices. From here it's decided by the market — whoever's five move furthest, wins."* Stats row (Time Left / Duration / Picks). Then the stake commit card: **"YOUR STAKE — Matched at 25 XP"**, body about confirm-or-raise settling at the lower commit, the amount input, the **"I confirm I am 18 or over"** checkbox, button **"Commit 25 XP"** (disabled until checked). After committing: **"COMMITTED — 25 XP"**, *"Waiting for your opponent to commit. Nothing expires — take your time."*

**Narration:** "The wager settles in XP right now — a blind commit that locks at the lower of the two numbers, so raising never costs you more than you chose. Real-money settlement on 0G Chain is next." *(Double-check this line against `docs-project/whats-next.md` at recording time — don't let it go stale.)*

### 3f. The race
**Visual:** Cut to the live game page. **"LIVE · PLAYER_99BD4B VS PLAYER_980E6D"**, countdown, live score comparison. The race chart — solid lines for your picks, dashed for the opponent's, one distinct color per token, a "Leading: AAVE (+0.11%)" callout, per-token live legend rows. Let it actually animate on screen.

**Narration:** "Once both lineups lock, the race is live — real price movement, updating in real time. Solid lines are yours, dashed is your opponent's."

### 3g. Resolution
**Visual:** The result page. **"CONTEST · FINAL — YOU WON"**, score comparison ("257 / 254"), pills (**+250 XP earned**, **+25 XP wager**, **2-2 vs player_99bd4b**). The **"PICK BREAKDOWN"** table (sector / your pick / return / opponent / points). The **"MENTOR TAKE"** AI paragraph explaining the win. The **"BADGE UNLOCKED — Unstoppable"** callout. Buttons: Share result / Rematch / New opponent.

**Narration:** "Every match ends with an AI breakdown of exactly what drove the result — and sometimes a new badge."

---

## Scene 4 — Dashboard (2:45–3:00)

**Visual:** For a fresh account: **"NEW PLAYER"**, headline **"Draft your first lineup"**, buttons (Find an opponent / Tournaments / Open draft / Try Scrimmage). For an established account: **"63% WIN RATE"**, headline **"Ready for your next contest"**, *"8 contests resolved so far this season."* Below: the earned-vs-locked badge row, **"DAILY GAUNTLET"** question preview, **"SECTOR PERFORMANCE"** bars (L1/L2/DeFi/Meme/Wildcard), **"HOT TOKENS"** list, **"SCOUT REPORT"** real news headlines, **"MY CONTESTS"** list with View result links.

**Narration:** "The dashboard is home base — active matches, sector performance, badges, and quick access into everything else."

---

## Scene 5 — Gauntlet quiz (3:00–3:15)

**Visual:** The Daily Gauntlet card on the dashboard — a real question (e.g. *"Which listed token has the best 24-hour performance?"*) with token-symbol answer options. Answer it, show the XP award.

**Narration:** "Every day there's a Gauntlet question — generated fresh, not from a static bank. Answer correctly, earn XP and sometimes a sector boost."

---

## Scene 6 — AI Mentor (3:15–3:30)

**Visual:** The Mentor page. Headline **"AI Mentor"**, subtext *"Ask about sectors, tokens, or your last contest."* Ask a real question — e.g. *"What does 24h volume tell me about a token?"* — and let the real streamed response render, including the clickable token chip and "Open in draft" button.

**Narration:** "The Mentor is grounded in live market data, not a static FAQ — ask it anything about a sector or a token."

---

## Scene 7 — Knowledge Base (3:30–3:45)

**Visual:** The Knowledge Base page. Headline **"Knowledge Base"**, subtext *"News, filtered the way real crypto news sites do — read one, claim the boost, take it into the draft."* Real news cards with source/date tags. The **"WORD OF THE DAY"** card — a real term (e.g. "reorg" — *"A chain replacing recent blocks with an alternative history."*) with button **"Got it — claim +20 XP"**. The **"BOOSTS READY"** panel.

**Narration:** "The Knowledge Base is where the same AI-generated vocabulary that powers the Gauntlet lives — Word of the Day, permanently archived on 0G Storage." *(Say this deliberately — the screen itself doesn't currently label it "0G," see the note at the top of this file.)*

---

## Scene 8 — Profile + claiming an achievement badge (3:45–4:15, closing beat)

**Visual:** The profile header — **"RANK #1 OF 20"**, streak, username, stat row (Contests / Win Rate / Total XP / Day Streak / Scrimmage XP). The **Badge Cabinet** grid (earned badges highlighted coral, unearned greyed — e.g. First Blood, On Fire, Unstoppable earned; Veteran, Champion, League Founder not yet). Scroll to **"ACHIEVEMENTS — UNCLAIMED ON 0G"**. Click **Claim** on "Unstoppable." **Let the real MetaMask popup fill the screen and hold on it**: "Transaction request" — Network **`OG-Mainnet`** — Interacting with **`0x4D165...42Caa`**. Approve it. Cut to the confirmation.

**Narration:** "And this is the moment that matters most for what CoinDraft is actually built on. This badge isn't pushed to my wallet — I'm claiming it myself, a real transaction, on 0G mainnet, paying my own gas. It's a soulbound NFT, and it's genuinely mine."

*(This is the single most important shot in the whole video. Don't cut away before the wallet's own network name and contract address are readable on screen — that's the proof, not the narration.)*

---

## Scene 9 — Tournaments (optional, if time remains)

**Visual:** The "Create a tournament" form — Name, Visibility (Public/Private), Duration, Payout structure, Sector restriction, Players per qualifier group. Then the "Open tournaments" list showing a real card ("Fridays" — Daily, Winner Takes All, L2 Only, "2 joined") with a Join button.

**Narration:** "Tournaments are bracket-style — set the rules once, anyone can join."

---

## Closing line

"CoinDraft runs on all three layers of 0G — Compute for the AI, Storage for the permanent knowledge base, Chain for achievement badges you claim yourself, from your own wallet, on mainnet. Real-money wagers on 0G Chain are next."

---

## Notes for whoever assembles this

- Every "verified on 0G" moment and the wallet popup should be shown actually resolving on screen — don't cut away early.
- If exact addresses/hashes are wanted as on-screen text (not just the wallet popup), pull them from `README.md`'s "Mainnet Deployment" section rather than retyping from memory.
- Scene 3e's real-money line should be checked against `docs-project/whats-next.md` at recording time so it never overstates what's actually built.
- Scene 7's narration carries a claim the screen doesn't visually make yet — see the "Where 0G actually appears" section above before deciding whether to add an on-screen caption first.
