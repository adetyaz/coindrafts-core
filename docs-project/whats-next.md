# What's next

Forward-looking punch list — what's genuinely left to do, not a bug log (see `presubmit-flaws.md` for that). Every item below was checked against the actual code/DB/chain, not assumed.

---

## Done since this file was first written

**Achievement NFT artwork** — 9 hand-built vector badge medallions (`static/badges/*.svg`, generator: `scripts/generate-achievement-badges.mjs`), a real ERC-721 metadata endpoint (`src/routes/api/achievements/metadata/[typeId]`) serving `{name, description, image, attributes}` per type, and every type's `metadataURI` pushed on-chain — verified by reading `tokenURI()` back. See the README's Mainnet Deployment section for the live links.

**Mainnet migration** — Chain, Storage and Compute all live on mainnet, not testnet. `CoinDraftAchievements` deployed and bootstrapped (`contracts/scripts/bootstrap-achievements.ts`) — all 9 types seeded WITH metadata in the same transactions, signer authorised. Network selection is automatic (`src/lib/server/zgNetwork.ts`, `src/lib/evmWallet.ts`) based on whether the app is running under `vite dev` or a real build — no manual flag. See README for every address/hash, independently re-verified (replication, proof-verified downloads, on-chain reads), not just trusted from a script's own output.

## 1. Demo video — not recorded yet

Everything it needs to show is already built and working (`docs-project/demo-video-checklist.md` has the shot list). This is the only thing standing between the current state and a complete submission per `submission-readiness.md`.

## 2. Real-money wager settlement via 0G Chain escrow

Wagers currently settle in XP only (`src/lib/server/gauntlet.ts` / contest resolution flow) — no actual money escrow exists on-chain yet. This is the flagged 4th-wave item.

Three real options, not yet decided between (the first two already flagged as the open question in `docs-project/0g-usable-inventory.md`):
- **On-chain escrow** — an audited standard Solidity escrow (OpenZeppelin's or similar) deploys to 0G Chain as-is, no 0G-specific pattern to learn. Means CoinDraft never custodies user funds. Real cost: players need $0G in their wallet before they can enter a wager at all, which is genuine friction on mainnet since almost nobody already holds it — see #3 below, gasless transactions are the direct mitigation for exactly this.
- **Custodial / DB-backed hold** — no wallet friction, players wager off a balance the app tracks. Makes CoinDraft the entity actually holding real user money, which is a money-transmission/custody question, not a technical one — needs a real decision, not an engineering default.
- **Third-party escrow service** — hand custody/settlement to an existing provider instead of building either of the above in-house. Not yet researched which providers actually support 0G Chain specifically (most third-party escrow/custody infra targets Ethereum/major L2s by default) — worth checking before assuming one is a drop-in option. Trades engineering effort for a vendor dependency and probably fees; also still needs the money-transmission/regulatory question above answered, just with a third party's compliance posture standing in for CoinDraft's own.

## 3. Gasless transactions on 0G Chain

Every on-chain action right now costs the player real gas: claiming an achievement (`claimAchievement()`), and — if #4 above goes the on-chain-escrow route — entering a wager too. That's real friction for anyone who doesn't already hold 0G, which is most players on mainnet.

Worth researching before building:
- **EIP-2771 meta-transactions** (a trusted-forwarder relayer, OpenZeppelin's `ERC2771Context`) — the backend relays a player's signed message and pays the gas itself, while the contract still verifies the player actually authorized it. Fits naturally on top of the achievement contract's existing off-chain-signature pattern.
- **ERC-4337 account abstraction** (bundler + paymaster) — the more general, more infrastructure-heavy version of the same idea. Worth checking whether 0G has an official paymaster/relayer service before building one from scratch.
- **Whether 0G itself offers a first-party gasless/relayer solution** — not yet researched. Check 0G's own docs before assuming this needs to be built entirely in-house.

**Real tension worth naming, not glossing over:** the achievement-claim flow's whole pitch to judges right now is "the player pays their own gas — proof this is real, player-initiated on-chain activity, not the backend faking it" (see `submission-readiness.md` section 3, and the demo video's "money shot" framing). Making that gasless changes what the transaction proves, even though the player's own signature is still what authorizes it. Worth deciding deliberately whether gasless applies to achievement claims specifically, or is scoped to wager entry only, rather than defaulting to "gasless everywhere."

## 4. Wallet-signed 18+ age confirmation

Today the age check is a checkbox: `StakeCommit.svelte` sends `confirmedAdult: true` and `commitToStake()` (`src/lib/server/wager.ts`) takes the client's word for it. Anyone can `curl` the commit endpoint with that flag set and the database records an age confirmation no human ever made. For a real-money wager feature that's a genuine gap, not a nitpick.

The intended replacement: the player signs a plain-English statement with their own wallet, the server rebuilds the exact wording itself and verifies the signature recovers to their stored wallet address, then keeps message + signature verbatim so it can be re-verified later by anyone.

**Built once and reverted — read this before rebuilding it.** Two things went wrong, both fixable:

1. **The shared message builder must not import wallet code.** It was put in a module that imported `$lib/appkit`, then imported into server-side `wager.ts` — dragging AppKit → Solana adapters → `@ledgerhq/errors` into the server bundle. That package uses extensionless ESM imports that Node refuses to resolve, so the dev server died on boot and every API route went down. The builder has to live in its own dependency-free module that both sides import.
2. **Address casing broke verification.** `/api/auth/verify` stores EVM addresses lowercased (`siweMessage.address.toLowerCase()`), but AppKit's `getAccount().address` returns the EIP-55 checksummed form. Client built `Wallet: 0xAbC…`, server rebuilt `Wallet: 0xabc…`, byte comparison failed, and every signature was rejected as unverifiable. Normalise the address inside the shared builder — lowercase for `0x`-prefixed EVM addresses **only**, since Solana base58 addresses are case-sensitive and lowercasing them corrupts them.

Other details worth keeping from that attempt: bind the message to the `stakeId` so one signature can't be reused for other wagers; reject attestations older than ~15 minutes so an old signature can't be replayed; support both wallet families (`ethers.verifyMessage` for EVM, `tweetnacl` ed25519 for Solana, mirroring the existing sign-in paths).

**Database note:** rebuilding this needs three columns on `stake_participants` — `adult_attestation` (the exact signed text), `adult_attestation_signature`, and `adult_attestation_at`. They were added during the reverted attempt and have since been dropped again, so the table is back to its original shape; add them back as part of the rebuild. Store the message verbatim rather than reducing it to a boolean, since the whole point is that it can be independently re-verified later.

## 5. Perks/boosts progression system

Captain, Shield, Free Hit — meant to tie into the badge/achievement system, which now has real art and is fully live on mainnet (see "Done" above). Not started.

## 6. Non-EVM (Solana) users can never claim achievements

`getClaimableAchievements()` (`src/lib/server/achievements.ts:100-102`) hard-returns `claimable: []` for `chainType !== 'evm'` — badges live on 0G Chain, which is EVM, so a Solana-signed-in player has no compatible address to mint to. Known, not silently ignored, but still unresolved. No fix planned unless/until it's worth building a bridge or a separate Solana-side claim path.

## 7. Tournament creation — "sub tournament / one-time tournament" option

Flagged early in the project, never got a clear answer on what this should actually do. Needs a real conversation before it's buildable — still open in `presubmit-flaws.md`.

## 8. Tournament listing page — visual pass never done

The privacy leak (private tournaments showing publicly) got fixed, but the page itself is still on its original template styling. Open in `presubmit-flaws.md`.

## 9. Confirm 0G Chain actually shows in the wallet's network picker

`appkit.ts` declares both 0G Mainnet and Testnet correctly (`zeroGMainnet`, `zeroGTestnet` in the `networks` array passed to both AppKit and the Wagmi adapter) — nothing malformed in code. Never got a live confirmation of whether it actually renders in the wallet modal's chain list; Reown Cloud's project dashboard can also restrict which chains a WalletConnect session offers, independent of what's declared in code. Needs an actual look at the wallet modal to close out.

## 10. 0G Storage — only `tx_seq` recorded per batch, not the full tx hash

Each vocab batch upload only saves the sequence number, not the transaction hash — makes it harder to link directly to a specific upload without going through the indexer/root-hash lookup first. Minor, but worth a column addition if judges want to spot-check individual uploads.
