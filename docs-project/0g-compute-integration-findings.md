# 0G Compute Integration — Grounded Findings (testnet + mainnet)

_Written 2026-08-25. Every claim below was pulled live from docs.0g.ai (fetched today) or cross-checked by search — not carried forward from the earlier `0g-integration-plan.md`/`0g-handoff.md`, which got some of this wrong or left it as "unverified." Where those two docs conflict with this one, **this one wins** — it's newer and actually checked against the current docs, not assumed. See "What the earlier docs got wrong" below._

---

## 1. TL;DR

- 0G Compute has **two separate integration paths**: **Router** (unified, OpenAI-compatible, API-key auth) and **Direct** (per-provider, wallet-signed, SDK-driven). **Router is the right one for this project** — it's explicitly built for "server-side applications (agents, backends, CLIs)... reuse existing OpenAI/Anthropic code without rewriting," which is exactly what `/api/mentor` and `/api/breakdown` are.
- It is **not** a pure "change the base URL and go" swap the way the old docs implied. Before any code change, a human has to: connect a wallet at `pc.0g.ai` (mainnet) or `pc.testnet.0g.ai` (testnet), **deposit 0G tokens on-chain** into the Router's payment contract, and generate an `sk-` API key from the dashboard. Only after that does the code-level change become a genuine "swap `baseURL`/`apiKey`."
- **0G mainnet is live** (Aristotle Mainnet, launched 2025-09-22) — this resolves the old docs' open question "is 0G production-ready." Chain ID `16661`, RPC `https://evmrpc.0g.ai`. Testnet (Galileo) is chain ID `16602`, RPC `https://evmrpc-testnet.0g.ai`, still active, faucet still gives 0.1 0G/day/wallet.
- Streaming is supported (`"stream": true`, standard OpenAI SSE) — confirms `/api/mentor`'s streaming path works unchanged.
- The model catalog is **live and dynamic** (`GET /v1/models`), not a fixed list — whether an exact equivalent to `openai/gpt-oss-120b` (current Groq model) is on 0G's catalog **could not be confirmed from docs alone and must be checked at build time** against the real endpoint, testnet and mainnet separately (see §7, open items).
- A genuinely new, useful finding not in the old docs: the Router itself (not just the more complex Direct/broker flow) supports **TEE-verified inference** via a `verify_tee: true` request field and an `X-0G-Provider-Trust-Mode` header (`standard` / `verified` / `private`). This means the "cryptographically provable AI usage" pitch from `0g-integration-plan.md` §5 (the XP-handicap idea) doesn't require the heavier Direct/broker SDK — it's available on the simple Router path too. Worth remembering if that pitch gets revisited.

---

## 2. What the earlier docs got wrong or left unverified

Being direct about this, since the earlier docs were themselves careful to flag their own gaps:

| Claim in `0g-integration-plan.md` / `0g-handoff.md` | What's actually true |
| --- | --- |
| "Point an existing OpenAI-shaped SDK at it and it works as a drop-in replacement" — implied as roughly a config change | True for the **code**, but only after a manual, human, wallet-based setup step (connect wallet → deposit 0G → generate API key via a web dashboard) that has nothing to do with the codebase. This can't be automated by an agent — it needs a person with a funded wallet. |
| "Whether 0G Chain / Compute is genuinely production-ready... or still testnet-primary" (open question) | **Resolved: mainnet has been live since 2025-09-22.** Both testnet and mainnet Router endpoints exist and are documented, in parallel, with separate dashboards, separate contracts, separate balances. |
| "Exact available model list... not confirmed at plan-writing time" (open question) | Still genuinely unresolved — see §7. The catalog is queried live via `/v1/models`, not documented as a static list. This isn't a gap in the research, it's how 0G designed it (models come and go as providers join). |
| No mention of TEE verification being available through the simple Router path | It is — `verify_tee: true` / `X-0G-Provider-Trust-Mode`, see §5.4. This is a new, positive finding. |
| No mention that Router and Direct use **separate, non-interchangeable balances** | Confirmed separate: funds deposited via the Direct/compute-marketplace flow do NOT show up in the Router balance. They're different contracts. Don't let anyone deposit into the wrong one. |

---

## 3. Router vs. Direct — why Router is the right choice here

| | **Router** (recommended) | Direct |
| --- | --- | --- |
| Auth | Server-side API key (`sk-...`) | End-user wallet signs every request |
| Client | Any OpenAI-SDK-shaped client, just change `baseURL`/`apiKey` | 0G's own SDK (`@0gfoundation/0g-compute-ts-sdk`), broker object, manual provider selection |
| Balance | One unified on-chain balance | Per-provider sub-accounts, funded individually |
| Best for | Server-side backends, agents, CLIs — "reuse existing OpenAI/Anthropic code without rewriting" | Browser dApps where the *end user's* wallet should be the one paying/signing |
| Failover | Automatic across healthy providers | Manual |

CoinDraft's `/api/mentor` and `/api/breakdown` are SvelteKit server routes that already hold a server-side secret (`GROQ_API_KEY`) and call `groq.chat.completions.create()`. That is exactly the Router's documented use case. The Direct/broker SDK path is for scenarios where an individual end user's wallet should pay per-request (e.g. if a future feature let a *player's own wallet* pay for their own Mentor usage) — not relevant to Phase 1 as scoped.

---

## 4. Network facts (verified against docs.0g.ai, 2026-08-25)

| | Testnet (Galileo) | Mainnet (Aristotle) |
| --- | --- | --- |
| Chain ID | `16602` | `16661` |
| Chain RPC | `https://evmrpc-testnet.0g.ai` | `https://evmrpc.0g.ai` |
| Explorer | `chainscan-galileo.0g.ai` | (not needed for this integration) |
| Router dashboard (connect wallet, deposit, create API key) | `pc.testnet.0g.ai` | `pc.0g.ai` |
| Router API base URL | `https://router-api-testnet.integratenetwork.work/v1` | `https://router-api.0g.ai/v1` |
| Router payment contract | `0x0AD9690e0b34aB2d493DE02cDF149ee34f6C9939` | `0xA3b15Bd2aD18BFB6b5f92D8AA9F444Dd59d1cE32` |
| Getting 0G tokens | Faucet, `faucet.0g.ai`, 0.1 0G/day/wallet, free | Real 0G token — must be acquired (exchange/bridge), not a faucet |

Note the testnet Router API is hosted on `integratenetwork.work`, not a `0g.ai` subdomain — this looked suspicious at first glance but it's the literal URL documented on `docs.0g.ai` itself (confirmed twice, independently, from the official docs). Worth a sanity-check against the live docs page again right before wiring it up, since a third-party domain backing an official testnet endpoint is unusual enough to double-check hasn't changed.

Mainnet requires real, purchased 0G tokens with actual monetary value — this is not a testnet-style free resource. Budget accordingly before mainnet cutover; testnet is free and should be used for all development/validation.

---

## 5. The API itself

### 5.1 Getting set up (manual, one-time, per network — cannot be scripted by an agent)

1. Go to `pc.testnet.0g.ai` (testnet) or `pc.0g.ai` (mainnet).
2. Connect a wallet (MetaMask, WalletConnect, or social login via Privy).
3. Dashboard → Deposit → send 0G tokens into the Router's payment contract (testnet: faucet-funded; mainnet: real tokens). No documented minimum deposit amount.
4. Dashboard → API Keys → Create → copy the `sk-...` key immediately (shown once, never again).

This has to happen once per network (testnet and mainnet are fully separate: separate wallet connection context, separate balance, separate key). It is **not** something that can be done from inside this codebase or by an agent — it needs a human with a funded wallet, per environment.

### 5.2 Making a request

Standard OpenAI-compatible endpoint. Any OpenAI SDK works by changing two fields:

```ts
import OpenAI from 'openai';

const client = new OpenAI({
	baseURL: 'https://router-api.0g.ai/v1', // or the testnet URL
	apiKey: process.env.ZG_COMPUTE_API_KEY // an sk-... key from the dashboard
});

const response = await client.chat.completions.create({
	model: 'zai-org/GLM-5-FP8', // confirm real model id via /v1/models — see §7
	messages: [{ role: 'user', content: 'Hello!' }],
	stream: true // supported, standard OpenAI SSE — /api/mentor's existing loop needs no changes
});
```

Full standard OpenAI parameters are accepted (`temperature`, `top_p`, `max_tokens`, tool calling, JSON mode). Reasoning-capable models return a `reasoning_content` field alongside `content` — CoinDraft's existing extraction (`delta?.content ?? ''` in `/api/mentor`, `message?.content` in `/api/breakdown`) already ignores unknown fields, so **no extraction-logic changes are needed**, same as when the Groq model was swapped to `gpt-oss-120b` per `testing-findings.md`.

### 5.3 Checking balance / usage (management key, `mk-...`, separate from the `sk-...` inference key)

```
GET /v1/account/balance      — deposit_balance, total_balance (in "neuron" units; 1e18 neuron = 1 0G)
GET /v1/account/usage/stats
GET /v1/account/usage/history
```
Auth via a separate `mk-` management key (never billed, admin-only — list/create/revoke `sk-` keys, read balance/usage). Keep both key types server-side only.

### 5.4 TEE-verified inference (new finding, optional, not required for Phase 1)

- `"X-0G-Provider-Trust-Mode": "verified"` header — routes only to providers offering verifiable execution (the response provably came from the real model).
- `"verify_tee": true` in the request body — Router synchronously verifies the provider's TEE signature before returning.
- `"X-0G-Provider-Trust-Mode": "private"` — strictest tier, TeeML only, prompt never visible to 0G or the provider.

This is what makes the "provably ran through 0G, can't be faked" pitch (from `0g-integration-plan.md` §5's evolved mapping) actually cheap to add later — it's a header, not a different architecture.

### 5.5 Rate limits & errors

- Standard OpenAI-shaped rate-limit headers (`X-RateLimit-Limit-Requests`, `X-RateLimit-Remaining-Requests`, `X-RateLimit-Reset-Requests`); `429` with `Retry-After` on excess. Exact numeric limits aren't published — "depend on your account state."
- `402 insufficient_balance` if the deposited balance runs out — this is the one most worth handling explicitly, since it's a new failure mode Groq never had (Groq bills the account holder's card, not an on-chain balance you can silently drain).
- `503 no_available_provider` if every provider for the chosen model is unhealthy — the existing catch-all error handling in both endpoints (`catch` block returning 502) already covers "the AI call failed, degrade gracefully," so this doesn't need new code, just awareness that it's a real, expected failure mode to watch for in testing.

---

## 6. Exactly where this integrates in the codebase

Two files, unchanged from what `0g-handoff.md` already correctly identified — confirmed still accurate against the current code (both were touched since, to fix the dead-Groq-model bug in `testing-findings.md`, but the integration points are the same):

- **[src/routes/api/mentor/+server.ts](../src/routes/api/mentor/+server.ts)** — line 92: `const groq = new Groq({ apiKey: GROQ_API_KEY });`, line 96: `model: 'openai/gpt-oss-120b'`, called via `groq.chat.completions.create({..., stream: true})`, streamed to the client via a `ReadableStream` that reads `chunk.choices[0]?.delta?.content`.
- **[src/routes/api/breakdown/+server.ts](../src/routes/api/breakdown/+server.ts)** — line 84: identical client setup, line 92: same model constant, `max_tokens: 400`, called **without** streaming (`chat.choices[0]?.message?.content?.trim()`).
- Both currently import `GROQ_API_KEY` from `$env/static/private` and depend on the `groq-sdk` npm package (already in `package.json`).

### 6.1 Two ways to wire it up — the actual code diff

**Option A — reuse `groq-sdk`, override `baseURL`.** `groq-sdk` is itself a thin fork of the OpenAI Node client and its constructor already accepts a `baseURL` option (confirmed — `new Groq({ apiKey, baseURL })` is a documented, supported pattern). Smallest possible diff: no new dependency, same `.chat.completions.create()` call shape in both files.

```ts
const groq = new Groq({
	apiKey: USE_0G_COMPUTE ? ZG_COMPUTE_API_KEY : GROQ_API_KEY,
	baseURL: USE_0G_COMPUTE ? ZG_COMPUTE_BASE_URL : undefined // undefined = groq-sdk's own default
});
```

**Option B — add the official `openai` npm package**, since that's the client 0G's own docs actually reference and test against ("Any OpenAI client library works"). Slightly bigger diff (new dependency, `import OpenAI from 'openai'` instead of `import Groq from 'groq-sdk'`), but removes any risk of `groq-sdk`-specific request-shaping quirks that 0G never tested against.

Recommendation: **Option A for Phase 1** — it's the smaller diff, matches the "gate behind a feature flag, keep Groq as fallback" plan already agreed in `0g-handoff.md`, and `groq-sdk`'s request/response shape is close enough to stock OpenAI (it has to be, to serve Groq's own OpenAI-compatible API) that the risk is low. Revisit Option B only if Option A produces request-shape errors 0G's providers reject.

### 6.2 Feature flag + env vars needed

Matches the approach `0g-handoff.md` already recommended, now with concrete variable names:

```
USE_0G_COMPUTE=true|false        # feature flag, default false — keeps Groq as the fallback path
ZG_COMPUTE_API_KEY=sk-...        # from pc.testnet.0g.ai or pc.0g.ai, per environment
ZG_COMPUTE_BASE_URL=https://router-api-testnet.integratenetwork.work/v1   # or the mainnet URL
ZG_COMPUTE_MODEL=...             # NOT hardcoded — the catalog is live/dynamic, see §7
```

`ZG_COMPUTE_BASE_URL` and `ZG_COMPUTE_MODEL` should differ between whatever environment maps to testnet vs. mainnet (e.g. Vercel preview/dev = testnet, production = mainnet, once mainnet is actually funded) — don't hardcode either value into the route files themselves.

---

## 7. Open items — genuinely unresolved, do not assume, verify before building

- **Exact model id to use is not confirmed.** Docs only ever show `zai-org/GLM-5-FP8` as an *example* — the real, current catalog must be pulled live: `curl https://router-api-testnet.integratenetwork.work/v1/models` (testnet) and `curl https://router-api.0g.ai/v1/models` (mainnet) — separately, since the two networks' provider sets aren't guaranteed to match. Look specifically for whether a `gpt-oss-120b`-class reasoning model exists, to keep behavior close to the current Groq setup; if not, the closest available model becomes a product decision (response quality/latency), not just a technical one — this is the same "verify response quality/latency is acceptable" step the original plan flagged and never completed.
- **No documented minimum deposit amount** for the Router — budget a small amount for testnet validation first (testnet tokens are free from the faucet regardless, so this only matters once mainnet is in play).
- **Numeric rate limits aren't published** ("depend on account state") — can't be planned around precisely, only handled defensively (already partially true: both endpoints already degrade gracefully on any non-2xx).
- **Whether the odd `integratenetwork.work` testnet domain is still current** should be re-checked directly against `docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview` immediately before wiring up testnet, since it's an unusual choice for an official endpoint and worth a fresh look rather than trusting this document if much time has passed.

---

## Sources

- [0G Documentation home](https://docs.0g.ai/)
- [0G Compute Network (concept)](https://docs.0g.ai/concepts/compute)
- [Compute Network — Inference SDK](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/sdk)
- [Compute Network — Inference](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference)
- [Router — Overview](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview)
- [Router — Quickstart](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/quickstart)
- [Router — Chat Completions](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/chat-completions)
- [Router — Models](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/models)
- [Router — Deposits & Billing](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/account/deposits)
- [Router — Authentication](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/authentication)
- [Router — Privacy & ZDR](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/privacy)
- [Router — Provider Routing](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/routing)
- [Router — Rate Limits](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/rate-limits)
- [Router — Errors](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/errors)
- [Router — Router vs Direct comparison](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/comparison)
- [Router — FAQ](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/faq)
- [Mainnet Overview](https://docs.0g.ai/developer-hub/mainnet/mainnet-overview)
- [Testnet Overview](https://docs.0g.ai/developer-hub/testnet/testnet-overview)
- [GitHub — 0gfoundation/0g-compute-ts-sdk](https://github.com/0gfoundation/0g-compute-ts-sdk)
- [npm — @0glabs/0g-serving-broker](https://www.npmjs.com/package/@0glabs/0g-serving-broker)
- [0G Labs Launches Aristotle Mainnet — Chainwire](https://chainwire.org/2025/09/22/0g-labs-launches-aristotle-mainnet-with-largest-day-one-ecosystem-for-decentralized-ai/)
- [0G Mainnet chain settings — ChainList](https://chainlist.org/chain/16661)
- [0G Galileo Testnet chain settings — ChainList](https://chainlist.org/chain/16602)
