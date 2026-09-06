# Boosts, Perks, Badges — What Each Is For

_Created 2026-08-29. A design discussion, not a build plan. Grounded in what's actually in the codebase today._

> **DEFERRED TO THE NEXT WAVE — 2026-08-30.** Parked deliberately, not abandoned: the
> current focus is making what's already built work properly rather than adding another
> system on top of it. Everything below stands as the argument for when it's picked up.
>
> **Nothing here is a blocker.** Boosts now work, so the one broken thing in this area is
> already fixed. Badges being decorative and perks not existing are *missing features*,
> not defects — the app is coherent without them.

---

## The problem, stated plainly

There are three reward systems and **they don't connect to each other**.

| | What it does today |
| --- | --- |
| **Boosts** | Earned from a Research read or a correct Gauntlet answer. Sector-specific, 24h, ×1.25. **Now actually affects scoring** (fixed this cycle — it did nothing for months). |
| **Badges** | Six exist. Earning one displays a toast and fills a slot in a cabinet. **Nothing else happens.** A dead end. |
| **Perks** | `freeHitsAvailable` is in the schema, is read by the AI agent, and **nothing in the app ever grants one**. Every other perk (Captain, Shield, Late Swap) is a proposal with no code. |

So: one working reward, one decorative one, and one that doesn't exist.

---

## The model I'd argue for

Three layers, each with a different job. Keeping them distinct is what stops the
system collapsing into "grind number goes up".

**Boosts = momentum.** Temporary, frequent, small. Earned by *learning* — reading,
answering. They reward showing up on days you don't want to play, and they reward
drafting what you actually researched. Low stakes, high frequency.

**Perks = power.** Consumable, tactical, spent on a specific game. They change *how*
you play a hand, not how strong you are. A perk should be a decision — "do I use it
now, or save it?"

**Badges = status.** Permanent, non-transferable, and **grant no power of their own.**
They're identity: what you've done, visible to others.

> **The rule that keeps this honest: badges must never make you stronger.** The moment
> a badge grants a permanent advantage, veterans are mechanically better than new
> players for reasons unrelated to skill, and the game gets worse every month it runs.

---

## The missing connection: badges should *grant* perks

This is the single change that makes all three systems into one system.

Right now earning a badge is a dead end, and no perk has an earn path. Wire them
together and both problems disappear:

```
Play  →  earn a BADGE (permanent status)
             ↓  grants
         a PERK (consumable power)
             ↓  spent on
         a better game  →  more badges
```

Badges stay pure status — the badge itself never makes you stronger. But *earning* it
hands you something you can spend once. Veterans don't accumulate permanent advantage;
they get a moment of it, and then it's gone.

That also revives `X-11 Free Hit`, which is currently dead code: it's read by the draft
agent and granted by nothing.

---

## Current badges are all about winning — that's a problem

Five of the six require **winning**: first win, 3-streak, 5-streak, 10 wins, 25 wins.
The sixth is creating a league.

**A player who loses their first ten games earns nothing at all.** That's exactly the
player most in need of a reason to stay. And it makes badges a rich-get-richer
mechanism: good players get badges, badges grant perks, perks make them better.

Worth adding categories that aren't win-gated:

- **Participation** — play 10 contests, play in every mode
- **Learning** — a 7-day research streak (`researchStreak` is already tracked and
  **never displayed anywhere** — hole #12)
- **Variety** — draft in all five sectors, win with each sector's pick leading
- **Rivalry** — play the same opponent 5 times (ties into the rematch loop)

These are earned by *playing*, not by *beating people*. That's what a new player needs.

---

## A perk catalogue worth building

Each is a single-use consumable, granted by a badge or a streak, spent at draft time.

| Perk | Effect | Where it comes from |
| --- | --- | --- |
| **Free Hit** (`X-11`) | One AI agent use with no XP cost | Already in schema — needs a grant path |
| **Captain** (`X-08`) | One pick counts ×2 | A win-streak badge |
| **Shield** (`X-09`) | One pick's loss floors at zero | A participation badge |
| **Second Look** (`X-10`) | Swap one pick in the first minute | A learning-streak badge |

**Captain and Shield need a foundation that doesn't exist yet:** scoring currently
weights all five picks equally, with no concept of a per-pick multiplier. That's a real
change to `calcPickScore`'s contract, not a new field.

**Second Look contradicts a current rule** — "locking is instant and final" — and needs
a new entry price captured mid-contest. It's a scoring-integrity question, not UI.

**Free Hit is the cheap one.** It needs no scoring changes at all; the mechanic already
works. It's the obvious first perk.

---

## On boosts specifically

The current design is defensible and I'd keep it: you read about DeFi, you get a DeFi
boost, so you're rewarded for drafting what you researched. That's "research is the
cheat code" actually working.

Two things worth fixing:

**Expired boosts are never cleaned** from the `activeBoosts` array — it grows forever.

**A boost you can't use is wasted.** If you research DeFi and don't draft DeFi, nothing
happens. That's arguably correct (it rewards drafting what you know) but it's invisible
— the player never learns why their boost did nothing. At minimum the draft screen
should show unused boosts expiring.

---

## Minting badges on 0G — this is the right fit

You raised this, and it's a much better idea than the bot-NFT one you declined.

**Why badges specifically work:** they're *earned*, *permanent*, and *non-transferable*
— which is exactly what a soulbound token is. The whole point of an achievement is that
it can't be bought, and a badge minted as non-transferable says so cryptographically.

It also gives the record independence: your achievements exist outside CoinDraft's
database, so they survive the app and can't be quietly edited.

**The one rule that must hold:** if badges were transferable they'd stop being
achievements and become inventory. Mint them soulbound or not at all.

**And it pairs with the perk model above** — the badge is permanent and on-chain, the
perk it granted is consumable and off-chain. The valuable, permanent thing is the one
worth minting.

---

## What I'd build first, in order

1. **Grant Free Hit from a badge.** Smallest possible version of the whole model — one
   badge grants one perk. No scoring changes, and it revives dead code.
2. **Non-win badges** — participation, learning, variety. Fixes new players earning
   nothing, and surfaces `researchStreak`.
3. **Clean up expired boosts** and show unused ones on the draft screen.
4. **Per-pick weighting** in scoring — the foundation Captain and Shield both need.
5. **Soulbound badge minting on 0G.**

Steps 1–3 need no new foundations. Step 4 is the real work.

_Nothing here is built. This is the argument, not the implementation._
