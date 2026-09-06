# Wager — Everything Specified So Far

_Captured 2026-08-28. **Parked deliberately — you asked to think it through thoroughly before building.** This is the complete record of what's been said, in one place, with the points that don't yet reconcile flagged rather than resolved. Nothing here is built._

Supersedes the wager sections scattered across `game-modes-redesign.md`, `wager-and-money-mode-plan.md` and `game-flow-redesign.md`; those stay accurate on everything else.

---

## 1. Scope and positioning

- **Real opponents only.** No bots in any wagered game.
- **Cross-cutting, not a mode.** Stated directly: *"having space for wager across all modes so it'll be a plug-and-play integration."* Wager attaches to a game; it isn't a separate game type.
- **Tournaments don't use wagers — they use a prize.** Set once by the organiser at tournament creation: no prize, or a funded pot. That's a different mechanic and shouldn't be conflated.
- **Build order:** *"just create the mechanic first, once I can test it we can discuss wager."*

## 2. Prize structures (tournaments)

Both already exist in the schema and in `applyPayoutStructure()`:
- **Winner takes all**
- **Top three, split by XP**

No new work identified here.

## 3. Choosing terms — before matching

From the flow redesign: selecting Single Match presents duration **and** wager choice up front, and *"the matching is done based on that."*

- Wager amounts are **"floaty", not strict** — matched in ranges: *about 25, about 50, about 100*.
- The tier is a **matching filter**, not the final amount.

## 4. Negotiating the exact amount — after matching

Stated most recently, and the most precise version so far:

1. **User A enters an amount** (example given: `$35`).
2. **User B sees it** and answers **agree — yes or no**.
3. **Yes → it proceeds.**
4. **No → 30 seconds is added.** Both players are shown the remaining time, which is *what was left of the first 30s* **plus** the new 30s — and are told that **the default prize will be used** if the clock runs out.
5. **On timeout → both are prompted to pay**, and the money goes into **escrow**.

**Escrow can be simulated for now** — explicitly stated. This matters: it means the entire mechanic is buildable without the custodial-vs-on-chain decision being made.

Also carried over, not yet revisited: **both players confirm 18+** before any amount can be set.

## 5. Where it sits in the flow

`Choose terms (duration + wager tier) → Match → Draft → Start screen → Race → Result`

The **start screen** is where the amount is still adjustable: *"on the start screen user can still change wager price before it is locked in."* So the tier is agreed by matching, and the exact figure is settled at the start screen, before the clock starts.

---

## Points that don't reconcile yet

Not objections — these are the places where two things said at different times point in different directions, and a build would have to pick one.

**A. What is "the default prize"?**
The most recent spec says a timeout falls back to *"the default prize."* An earlier answer said a timeout *"defaults to whatever amount is currently on the table."* Those are different rules:
- The **tier's nominal value** (matched on "about 50" → 50), or
- The **last proposal made** (A said 35, B declined, no counter → 35).

Worth deciding, because it changes who benefits from stalling.

**B. Can the clock be extended indefinitely?**
Each "no" adds 30s. If declining is unlimited, one player can hold the other indefinitely. Probably wants a cap — a maximum number of extensions, or a hard ceiling on total negotiation time.

**C. Does B counter, or only accept/reject?**
The latest spec is binary: agree, yes or no. The earlier one had full **propose / accept / counter / decline**. If it's only yes/no, "no" just buys 30 more seconds — but it isn't stated whether B can then *enter their own number*, or whether A revises. Without a counter, "no" is only a delay, which makes the negotiation thinner than the earlier spec.

**D. What happens if someone doesn't pay after the prompt?**
Both players have drafted by then — real effort committed. Forfeit, cancel, or fall back to an unwagered game?

**E. How wide is a tier?**
"About 50" needs a definition. If A can enter $35 inside the "about 50" bucket, the range is wide; if tiers are narrow, matching fragments further. This interacts directly with the pool-splitting concern — duration options × wager tiers multiplies the buckets a small player base has to fill.

**F. Where does the 18+ confirmation now appear?**
It was specced when wager was chosen after drafting. Terms are now picked before matching, so it probably belongs at the point a player first selects a wagered game — but that hasn't been restated.

---

## What this unblocks

**Simulated escrow removes the blocker.** The money-mode plan's Phase 0 was "build the mechanic against a settlement adapter, decide real escrow later" — and *"we can simulate this for now"* is exactly that. The negotiation, the timer, the tiers, the start-screen adjustment and the payment prompt can all be built and tested against a simulated settlement provider, with real escrow swapped in behind the same interface once the custodial-vs-on-chain call is made.

**The integrity gates still apply before real money.** Unchanged from the money-mode plan: forgeable session tokens (H-01), and contests that can be settled early on demand — the second of which gets sharper on short wagered games.

_Parked pending your review. No code written._
