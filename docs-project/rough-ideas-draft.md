# Rough ideas draft

Unrefined — capturing as said, not designed yet. Don't treat anything here as decided; revisit and turn into a real design doc (like `shared-pick-exclusion-design.md`) once it's actually being built.

---

## Gauntlet anti-cheat via AI

Started from: penalize a player who asks the in-app AI Mentor for today's Gauntlet answer (0 XP for that day — see the fuller writeup in this conversation, not yet saved as its own doc since the design questions there are still open).

**The real problem, raised directly:** even if the Mentor itself is locked down (refuses to discuss the quiz, or never has the answer to leak), that only blocks *this app's own AI*. Nothing stops a player from opening ChatGPT, Claude, or any other AI in a different tab — or on their phone, a second device entirely — and just asking it there. Any defense that only touches the Mentor is solving a fraction of the actual problem.

**Idea 1 — blur + explicit-attempt gate.** Hide the Gauntlet quiz (question and answer options) behind a blur by default. A button — "Attempt Gauntlet Quiz" — reveals it. Clicking it pops a modal warning the player not to leave the browser tab or navigate away until they've submitted an answer.

**Idea 2 — the modal is an honor-system nudge, not real enforcement.** Explicitly acknowledged in the same breath: a player can just have their phone out. There's no technical way to stop someone from asking a second device or a second AI regardless of what the modal says or what the tab-focus state does. So whatever gets built here is a deterrent/friction layer, not an actual cheat-proof gate — worth being honest about that rather than pretending blur + modal "solves" it.

**Idea 3 — separate tangent, only loosely connected:** a credit-token system where players pay (real money or some in-app currency) for AI usage/credits generally, not just Mentor. Came up in the same thought but is really a different problem (monetizing/rate-limiting AI usage overall) than the Gauntlet-cheating problem specifically — don't conflate the two when this gets designed for real. Worth its own thread later.

**Open, unresolved:**
- Is a pure honor-system deterrent (idea 1+2) actually worth building, given idea 2 admits it doesn't stop the real exploit path (another device/another AI)?
- Does idea 3 (paid AI credits) actually help the Gauntlet-cheating problem at all, or is it a separate monetization idea that just happened to surface in the same conversation?
- Nothing here has been checked against `shared-pick-exclusion-design.md`'s pattern (grounding in real current code) — this is pure brainstorm, not yet.
