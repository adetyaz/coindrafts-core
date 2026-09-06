# Mainnet migration checklist

Everything CoinDraft touches on 0G (Compute, Storage, Chain) is testnet-only right now. This is the ordered list to get all three onto mainnet before the final demo video is recorded. Do this after the local trial run (`demo-video-checklist.md`) goes clean — no point migrating a flow that still has bugs.

**Network switching is already automatic, no code change needed at migration time.** `src/lib/server/zgNetwork.ts` (server) and `src/lib/evmWallet.ts` (client wallet chain-switch) both key off `dev` from `$app/environment` — true only under `npm run dev`, false for anything built/deployed. Local dev always reads the plain-named env vars (testnet); a deployed instance (Vercel preview or production) always reads the `_MAINNET`-suffixed ones instead. So this checklist is entirely about **filling in the blank `_MAINNET` vars already sitting in `.env`** and doing the real on-chain setup they point at — not touching application code.

Endpoints marked **[VERIFY]** below are what this project's own config currently assumes (from `contracts/hardhat.config.ts` and prior research in `docs-project/0g-roadmap.md`) — confirm each against 0G's official docs before using it for real, don't trust the placeholder blindly.

---

## 1. 0G Chain

- [ ] **[VERIFY]** Mainnet chain ID `16661`, RPC `https://evmrpc.0g.ai` (default in `hardhat.config.ts` — confirm current against 0G's docs, endpoints on newer chains sometimes move).
- [ ] Fund the deployer/owner wallet with real 0G — this is genuine spend, not a faucet.
- [ ] Redeploy `CoinDraftAchievements`: `npm run deploy:mainnet` in `contracts/` (or `hardhat run scripts/deploy.ts --network 0g-mainnet`). Record the new contract address.
- [ ] Re-seed all 9 achievement types on the new mainnet contract (`seed-achievements.ts` for the original 4, `add-more-achievement-types.ts` for the 5 added this session) — **ideally with real `metadataURI` values already, if the NFT artwork from `whats-next.md` #1 is done by then.** Don't re-seed with empty strings again if you can avoid it — one less thing to fix later.
- [ ] Call `setSigner(<voucher signer address>, true)` on the new mainnet contract, same as the testnet deploy did.
- [ ] Fill in `.env`: `ACHIEVEMENTS_CONTRACT_ADDRESS_MAINNET`, `ACHIEVEMENTS_RPC_URL_MAINNET` (already pre-filled with the current best-known RPC — just confirm it, see [VERIFY] above).
- [ ] Fund the signer wallet itself with a small amount of mainnet 0G — voucher signing is free (off-chain), but the same wallet needs gas for the seed/setSigner txs above.

## 2. 0G Storage

- [ ] **[VERIFY]** Confirm 0G Storage's mainnet indexer/RPC endpoints exist and are stable — this project has only ever researched/used testnet (`indexer-storage-testnet-turbo.0g.ai`). Don't assume a mainnet equivalent is production-ready without checking 0G's own docs/status first.
- [ ] Fill in `.env`: `ZG_STORAGE_PRIVATE_KEY_MAINNET` (a real funded wallet — do NOT reuse the testnet throwaway key), `ZG_STORAGE_RPC_URL_MAINNET` (pre-filled, confirm it), `ZG_STORAGE_INDEXER_URL_MAINNET` (deliberately left blank, no safe default to guess — this is the one to actually verify against 0G's docs).
- [ ] Fund the storage wallet (can stay the same key as the achievements signer) with mainnet 0G for upload gas.
- [ ] Do one real upload against mainnet and verify it the same way testnet was verified: `indexer.getFileLocations(root)` shows real node replication, `indexer.download(root, path, true)` proof-verifies. Don't take a success response at face value — this project got explicitly burned by trusting an unverified claim before.
- [ ] Decide whether to re-upload the existing vocab pool content to mainnet, or let it accumulate fresh from mainnet's first real day — either is defensible, just pick one deliberately.

## 3. 0G Compute

- [ ] Real spend here — mainnet inference is metered per `docs-project/0g-roadmap.md`'s probe (31 models available on mainnet vs testnet's 2, many TEE-attested). Testnet currently uses `qwen2.5-omni`; the same doc found mainnet options that are both cheaper and stronger (`qwen3-vl-30b` ≈ $0.00017/call, `deepseek-v4-flash` ≈ $0.00022/call at realistic token counts) — worth deciding whether to switch models at the same time as switching networks, rather than doing it twice.
- [ ] Set a real budget/deposit on the mainnet compute account before testing anything — this is metered, unlike testnet.
- [ ] Fill in `.env`: `ZG_COMPUTE_API_KEY_MAINNET`, `ZG_COMPUTE_BASE_URL_MAINNET`, `ZG_COMPUTE_MODEL_MAINNET`.
- [ ] Confirm the app's `402` payment-required handling (if any exists — check `src/lib/server/aiCompute.ts`) actually works against a metered mainnet account, not just a pre-funded testnet one.

## 4. App-wide checks after all three are pointed at mainnet

- [ ] `appkit.ts` already lists `zeroGMainnet` in its `networks` array — no code change needed there, just confirm the wallet modal actually offers it (same open question as testnet, `whats-next.md` #9).
- [ ] Deploy the app itself (Vercel or wherever) — this is what flips `dev` to `false` and makes `zgNetwork.ts`/`evmWallet.ts` actually start reading the `_MAINNET` vars. Nothing reads them under `npm run dev`, by design.
- [ ] Run through the full demo-video shot list again, this time against the deployed instance end to end: sign in, draft (AI agent), race, Mentor/breakdown, Knowledge Base, and — the one that actually spends real 0G — claim a badge for real and verify the mint on `chainscan.0g.ai` (mainnet explorer, not `chainscan-galileo.0g.ai`).
- [ ] Update `docs-project/submission-readiness.md`, `README.md`, and `ARCHITECTURE.md` with the new mainnet contract address and any changed endpoints — the testnet numbers currently in those files will be stale once this is done.
- [ ] Update the in-app `/docs` page if it names the testnet contract address anywhere specific (check the Architecture/0G Integration sections).

## 5. Only then — record the real video

Once every box above is checked and the mainnet trial run went clean, record the actual submission video using the same shot list, now genuinely showing production 0G activity instead of testnet.
