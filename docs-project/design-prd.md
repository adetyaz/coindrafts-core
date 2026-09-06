# CoinDraft — Design PRD

_Companion to the Design Brief (tone/direction). This doc is the work order: what actually needs design, screen by screen, state by state. The Brief tells the designer how it should feel; this tells them what they're designing._

---

## 1. Why this pass exists

The full product is built and functional — every flow described below works end-to-end today. What it doesn't have yet is a real design pass: screens render with a working but plain token system (dark-default, orange primary, 5-color sector palette), and every state transition — winning a contest, unlocking a badge, getting matched, a boost activating — currently just re-renders instantly with no feedback. The product feels complete but not alive. That's the gap this brief closes.

## 2. Goals

- Give every core screen a real visual pass on top of the existing token system (which is a foundation to build from, not a constraint to preserve as-is).
- Design and spec the microinteractions/animations for every state-change moment listed in §5 — currently zero of these exist.
- Keep the "dense data, low cognitive load" balance — this is a data-heavy product (prices, scores, XP, sectors) and clarity cannot be sacrificed for polish.

## 3. Non-goals (this pass)

- No new features or flows — this is a design pass on what already exists, not a scope expansion.
- Not designing the Midnight/privacy-contest mode — that's a separate, not-yet-built feature track.
- Not redesigning the underlying information architecture (nav structure, page groupings) unless a screen's design genuinely requires it — flag if so, don't assume.

## 4. What already exists (starting point)

- **Theme:** dark-default, explicit light-mode opt-in (toggle in nav), both fully supported.
- **Brand color:** `#FF6B35` (orange), replacing an earlier purple.
- **Sector palette** (5, deliberately spread around the color wheel so none reads as the brand color): L1 green `#10B981`, L2 blue `#3B82F6`, DeFi violet `#8B5CF6`, Meme pink `#EC4899`, Wildcard cyan `#06B6D4`.
- **Semantic colors:** positive (green), negative (red), warning (amber) — kept separate from the brand accent.
- Tokens are CSS custom properties (`--color-*`), theme-reactive — a designer's palette work should map onto this system, not fight it.

## 5. Microinteraction / animation inventory

This is the core deliverable gap. Every one of these currently happens with zero transition — instant re-render, no feedback. Each needs a designed motion spec (what animates, timing, easing) even if simple.

| Moment | Where | Current state | What's needed |
| --- | --- | --- | --- |
| Contest won / lost reveal | Contest Result page | Static text | A real reveal moment — this is the emotional peak of the 1v1 loop |
| Ranked lobby reveal | Lobby Result page | Static ranked table | A different reveal problem than win/loss — this is "where did I place among N," needs its own moment (e.g. countdown/build to your own row, not just a table appearing) |
| Badge unlocked | Toast, anywhere it fires | Generic toast | A distinct, more celebratory treatment than a normal toast |
| XP gained | Gauntlet, Research, result pages | Number just appears | Count-up or tick animation |
| Boost activated | Draft page, sector slot | Static badge appears | Some kind of "charge" or activation feedback |
| Matched with an opponent (1v1) | Matchmaking page | Spinner → static "found" state | Transition between searching and matched states |
| Lobby fills up | Lobby page, waiting-room view | Headcount number just updates | Feedback as each new player joins, and a distinct moment when the lobby actually fills and transitions to drafting |
| Lineup slot filled | Draft page (used by both 1v1 contests and lobbies) | Instant swap from empty to filled card | Fill-in transition, ideally reinforcing which sector just locked |
| Lock Lineup submit | Draft page | Button → redirect | Some confirmation feedback before the redirect |
| Streak milestone | Dashboard, leaderboard | Static flame emoji | Could use motion at milestone thresholds (3, 5, etc.) |
| Mentor response streaming | Mentor page | Text appends, no other feedback | Typing/thinking indicator already exists (3-dot bounce) — worth a real pass |
| Tab/dropdown open (nav) | Nav bar | Instant show/hide | Basic transition at minimum |

## 6. Screen-by-screen scope

For each screen: what it does today, and what needs design attention. All states (loading / empty / error / populated) need covering where noted — currently most only have a populated state properly designed.

### Landing (`/`)
Marketing/entry page — hero, "how it works," social proof, CTA. Needs: hero treatment, motion on entry (this is the one screen where a bigger moment is justified).

### Dashboard (`/dashboard`)
Home base after login — stats row, matchmaking CTA, sector performance, whale-flow alerts, daily Gauntlet quiz, badge strip, hot tokens, news feed, contest list. Needs: this is the densest screen in the product — hierarchy pass is the priority over decoration. Loading state exists (skeleton-ish) but is minimal.

### Draft (`/draft`)
The core mechanic — 5 sector slots, token pool with search/filter, lock-in flow. Shared by both 1v1 contests and lobbies (reads a `contestId` or `lobbyId` param) — a "Ranked lobby" badge distinguishes the lobby case today, but it's otherwise the same UI for both. Needs: this is the screen users spend the most active time on. Slot-fill interaction (§5), sector-pill selection state, token-pool row hover/select states, and a design decision on whether the lobby case should visually differ more than just a badge (e.g. showing other participants' lock progress).

### Matchmaking — 1v1 (`/matchmaking`)
Searching → matched → redirect for head-to-head contests. Needs: full motion pass, see §5. Currently the least designed screen in the product — three flat states, no transition between them.

### Lobby (`/lobby`)
The multiplayer (3+) entry point — genuinely its own hub, not a variant of matchmaking. Four distinct views today, all needing design: **menu** (choose quick-match size or browse open lobbies), **quick-searching** (auto-matching into a fixed-size group of 4/6/8, elapsed timer), **browse** (list of open, creator-hosted lobbies with live headcounts to join), **waiting-room** (you've joined/created an open lobby, seeing headcount fill up, creator can start early). This is currently the least visually resolved flow in the whole product relative to how much state it has — treat as core-loop priority, not secondary.

### Contest Result — 1v1 (`/contest/result`)
Win/loss reveal, score comparison, per-pick breakdown table, AI explanation, share button. Needs: the reveal moment (§5) is the priority here — this is one of the most important screens to get right emotionally.

### Lobby Result (`/lobby/[id]/result`)
Ranked table (not binary win/loss) — rank column, medals for top 3, XP earned per placement, current user's row highlighted. A genuinely different design problem from the 1v1 result: "where did I place among N players" instead of "did I win." Needs its own reveal treatment (§5), not a reuse of the 1v1 result's win/loss motion.

### Leaderboard (`/leaderboard`)
Ranked table, medals for top 3, current-user row highlighted. Needs: rank-change feedback if a user moves up/down between visits (currently no such indicator exists at all — flag as a possible net-new small feature, not just decoration).

### Leagues (`/leagues`, `/leagues/[id]`)
Browse/create/join, standings table, invite code sharing. Needs: create/join modal treatment, standings table hierarchy (this is a second dense-data table like the leaderboard).

### AI Mentor (`/mentor`)
Chat interface, streamed responses, token-mention chips linking to draft. Needs: message bubble treatment, the chip hand-off to draft could use a stronger visual connection between the two screens.

### Research Hub (`/research`)
Sector-tagged news feed, expandable articles, boost-on-read. Needs: card treatment, expand/collapse transition, boost-claimed feedback tied into §5's XP/boost patterns.

### Badges (dashboard strip, no dedicated page yet)
6 badges, earned/locked states. Needs: locked-state treatment (currently just grayscale + opacity), consider whether a dedicated badge/profile page is worth scoping as a small net-new addition — flag, don't assume.

### How to Use Guide (`/guide`) and Documentation (`/docs`)
Reference/onboarding pages, linked under a "Help" nav group — not part of the interactive game loop. Needs: visual-consistency pass only (typography, spacing, token usage matching the rest of the product) rather than the microinteraction treatment core gameplay screens get. Low priority relative to §9, but shouldn't be skipped entirely — they're a new user's first real content-heavy read of the product and currently look plain next to everything else.

### Share Card (`/share/[id]` wrapper page + `/api/contest/[id]/card` SVG generator)
Not an interactive page — a server-generated image (picks, score, win/loss) used as the shareable card when a result gets posted to X/Twitter, surfaced via link-preview crawlers. This is the one product surface most people will see who *aren't* logged into the app, so it deserves real visual design even though nobody clicks anything on it. Needs: a layout spec for the generated SVG card matching the brand (currently exists functionally but was never given a real design pass).

## 7. Component inventory

Reusable pieces worth systemizing rather than designing per-screen:
- Top nav (persistent on every screen — logo, Home/Dashboard, Play/Compete/Learn/Help dropdown groups, theme toggle, wallet/XP display). Functionally complete but only had a token-conversion pass, not a real design pass — this is the single most-seen piece of UI in the whole product.
- Toast (currently one generic style for all message types — success/error/info)
- Modal (league create/join uses this pattern)
- Stat card (used on dashboard, draft VS-bar, leaderboard)
- Badge chip (earned vs. locked states)
- Sector pill/tag (used everywhere — draft, research, result breakdown)
- Empty states (several screens currently have minimal/inconsistent empty-state treatment)

## 8. Deliverables expected

- Updated token values (color/type/spacing) if the palette evolves beyond what's in §4 — should stay as CSS-custom-property-compatible values, not a departure from the token-based system.
- Screen mocks for each item in §6, covering the states actually called out.
- Motion specs for each item in §5 — doesn't need to be full prototypes, but needs concrete enough direction (timing, what moves, what triggers it) that engineering can implement it without guessing.
- Component specs for §7.

## 9. Priority if this needs to be phased

1. Draft + Contest Result + Matchmaking + Lobby + Lobby Result — the actual core loop (1v1 and multiplayer both), and the screens with the least design attention today. Lobby in particular has the most undesigned state of any screen in the product relative to its complexity.
2. Dashboard — highest-traffic screen, hierarchy pass.
3. Leaderboard + Leagues — the two dense-table screens, can share a systemized table treatment.
4. Mentor + Research — lower-traffic but distinctive features worth a real pass once the core loop is solid.
