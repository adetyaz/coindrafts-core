# Pre-submit flaws

Full pass over everything flagged this session, sorted by status. Add new ones below the dividers as you hit them.

---

## Still open

- **Tournament creation is missing a "sub tournament / one-time tournament" option** — you flagged this and I never got a clear answer on what it should actually do. Needs a real conversation before it's buildable.
- **Tournament listing page "looks ugly"** — I fixed the privacy leak that came up in the same conversation (private tournaments showing publicly), but never actually did a visual pass on the page itself. Still on the original template styling.
- **0G chain not showing in the wallet's network list** — investigated: `appkit.ts` has both 0G Mainnet and Testnet correctly defined (full `rpcUrls`/`nativeCurrency`/etc., nothing malformed). Never got confirmation whether it's actually showing now or not — possible cause not ruled out: Reown Cloud's project dashboard can restrict which chains a WalletConnect session offers, separate from what's declared in code. Needs you to actually check the wallet modal again.

## Fixed this session

- Dashboard "Draft your first lineup" card — unwarranted whitespace (layout fix), and glassy/blurred coral background.
- Multiplayer removed as a redundant separate mode — nav, dashboard, docs, guide all point to Tournament now.
- Private tournaments leaking into the public "Open tournaments" list.
- Tournament creation had no public/private toggle and no invite UI at all — both built, plus the invite link itself was pointing at a page that didn't exist.
- A real 1v1 game's clock used to start the instant the first player locked, eating the second player's draft time — now waits for both.
- AI Draft Agent handed two opponents in the same match identical lineups — now samples from ranked candidates instead of always picking #1.
- Race chart was blank/flat — live price fetching was using the same fragile per-token pattern that was already fixed for entry prices; fixed the same way. Each token also now gets its own color instead of sharing one per sector.
- Token hover overlay's News tab was unclickable — `pointer-events: none` blocked the whole panel, and the tabs had no click handler at all. Also fixed the mouse-leaves-before-you-reach-it dismiss timing.
- Scrimmage was completely broken — the 8 seeded bot accounts never made it into the Supabase database after the migration, so every bot-lineup insert failed on a foreign key. Reseeded.
- Nav showed stale/zero XP while the actual page showed the real number — nav now polls its own live figure instead of trusting a snapshot from page load.
- No way to navigate back to an active game after leaving it — dashboard now links live/waiting contests to `/game/[id]` instead of always back to `/draft`. Also closed a real exploit found while fixing this: re-opening `/draft` for an already-locked live contest let you silently redraft and reset your entry prices mid-race.
- Word of the Day was wrongly merged into the Gauntlet instead of being moved to the Knowledge Base — rebuilt as its own feature there, sharing the same AI-generated vocab pool as the Gauntlet's vocab-category questions rather than either duplicating or disappearing.
- 0G Storage was never actually uploading (SDK not installed) — installed now, verified with a real upload (root hash + tx confirmed on 0G testnet). A separate bug in the vocab batch generator was also found and fixed (the AI's `value` fields collided, silently failing every batch) — needs your dev server restarted to confirm live.

## Already correct, just re-verified

- **Draft sector-lock** ("only L1 chains in the L1 slot, etc.") — checked the code just now: this was already enforced (`filteredTokens` restricts by sector, `addToken` has a belt-and-suspenders check too, only Wildcard accepts anything). Not a bug — whatever you saw may have been from before another fix landed, or worth a fresh look now that other things are working.
