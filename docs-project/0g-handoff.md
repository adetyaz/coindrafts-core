# 0G Integration — Handoff to New Session

_Written 2026-08-23, for whoever/whatever picks up 0G buildathon work in the new fork. This session (in the original `coindraft` repo, `ui-updates` branch) is not continuing this work — a fresh Claude session in the forked repo should start from here._

**Read [`0g-compute-integration-findings.md`](0g-compute-integration-findings.md) (2026-08-25) before starting Phase 1.** It re-verifies everything below against 0G's live docs — testnet/mainnet URLs, contract addresses, the manual wallet/deposit/API-key setup step this doc doesn't mention, and confirms mainnet is now live. The "exactly what needs to change" section below is still accurate on the code side; the findings doc adds what happens before the code side.

## Project context

CoinDraft is a fantasy-sports-style crypto drafting game — SvelteKit (client-rendered, `ssr: false`), Drizzle ORM, Neon serverless Postgres, Tailwind v4 CSS-first `@theme` tokens, deployed on Vercel. Contests: pick one token per sector (L1/L2/DeFi/Meme/Wildcard), lineups lock, a scoring window runs, returns convert to points. Original repo: `github.com/adetyaz/coindraft`, git user `adetyaz`.

**This fork's `main` = the original repo's `ui-updates` branch, merged in.** That branch carries a full UI revamp: dark-default design token system (`src/routes/layout.css`, brand color `#FF6B35`), an extracted `src/lib/components/Nav.svelte` (desktop pill nav + dropdown groups + mobile hamburger drawer, wallet-connect/sign-in status), and a rebuilt landing page. None of that is directly relevant to the 0G work below — just context for why the codebase looks the way it does.

This fork exists solely to build the 0G buildathon integration, isolated from the main coindraft product. Not intended to merge back.

## Read first

`docs-project/0g-integration-plan.md` — the full grounded research from the source session: what each piece of the 0G stack (Chain, Compute, Storage, Agentic ID / ERC-7857, Pay, DA) actually is per their real docs (not marketing copy), mapped onto specific existing CoinDraft features, with a 4-phase build plan. **This file is gitignored in the original repo** (`.gitignore` has `/docs-project`), so it did not travel with the fork automatically — copy it over manually, or reconstruct from this handoff if it's missing. Same for any other `docs-project/*.md` files referenced there.

## Scope decision (locked in 2026-08-23)

Given tight time and a solo build, this round's 0G submission is **Phase 1 only**:
- Point `/api/mentor` and `/api/breakdown` at 0G's Compute Router instead of Groq, behind a feature flag.
- **Explicitly deferred**: Phase 2 (tokenizing the 8 bot personas as Agentic ID / ERC-7857 agents — the flagship "buy/sell trained trading bots" use case), Phase 3 (immutable result records on 0G Storage), Phase 4 (user-owned bots). These are real, well-scoped ideas in the plan doc — just not for this round. Don't start on them without a deliberate decision to expand scope.

**Why Phase 1 only**: Phase 2+ needs Solidity contract work and testnet deployment on top of everything else — not realistic alongside the deadline pressure below. Phase 1 needs no contracts, no new wallet/chain integration — it's a backend API swap. One fully-working piece beats a rushed contract deployment.

## Deadline context

- 0G submission deadline: **2026-08-30**.
- The person driving this is solo and also has an unrelated Midnight buildathon track (different repo/branch, not this one) starting **2026-08-26** — real runway for 0G work before attention splits is roughly 3 days from whenever this handoff is picked up.
- 0G's own submission requirements (repo structure, README expectations, demo video, etc.) were **never verified** in the source session — check the actual buildathon program page / docs.0g.ai before finalizing anything. Don't assume Midnight's requirements (public repo, `midnightntwrk` topic, compiling contract as a hard gate) carry over — that was a different program.

## Exactly what needs to change (Phase 1)

Two files, same pattern in both, both currently using the `groq-sdk` npm package:

- **`src/routes/api/mentor/+server.ts`** — line ~92: `const groq = new Groq({ apiKey: GROQ_API_KEY });`, line ~96: `model: 'llama-3.3-70b-versatile'`, called via `groq.chat.completions.create({...})` **with streaming**.
- **`src/routes/api/breakdown/+server.ts`** — line ~84–86: identical client setup, same model, called **without** streaming (single completion).
- Both import `GROQ_API_KEY` from `$env/static/private`.

0G's Compute Router (`https://router-api.0g.ai/v1`) is OpenAI-API-compatible per their docs. Two ways to wire it up — pick whichever is cleaner once you're actually in the code:
1. Check whether `groq-sdk`'s client constructor accepts a custom `baseURL` override (would be the smallest diff).
2. Or switch to the standard `openai` npm package pointed at 0G's router URL, since that's literally the SDK shape their docs describe as a drop-in replacement.

**Recommended approach**: gate the swap behind a feature flag (e.g. an env var like `USE_0G_COMPUTE`), so the existing Groq path stays as a fallback while you validate 0G's response quality and latency — the original plan flagged "verify response quality/latency is acceptable" as an explicit step, never actually tested.

## Open questions — not verified, check before building

- Exact available model list on 0G Compute's Router — docs pointed to `pc.0g.ai` for the live list, not confirmed at plan-writing time.
- Whether 0G Chain / Compute is genuinely production-ready for a buildathon submission, or still testnet-primary.
- 0G's actual submission checklist (see Deadline context above).

## Explicitly out of scope right now

- No smart contract work, no new wallet integration, no chain/network config changes — Phase 1 touches only the two backend API routes above.
- Don't touch `bots-service/` — separate deployable unit, unrelated to this phase.
- Don't touch anything Midnight-related — different repo/branch, different buildathon, no connection to this work.
