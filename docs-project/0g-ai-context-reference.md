# 0G — Official AI-Context Reference

_Saved 2026-08-26, fetched directly from **https://docs.0g.ai/ai-context** — 0G's own "AI Coding Context" page, which they maintain specifically for AI coding assistants to reference. This is site-wide (Chain, Storage, Compute, DA, Agentic ID), not just Compute. Reformatted from raw scraped text into clean markdown; nothing added or reworded — this is their content, kept close to verbatim so it stays trustworthy as a reference._

**⚠️ One real conflict with `0g-compute-integration-findings.md`, flagged, not silently resolved:** that doc's §4 lists a "Router payment contract" (testnet `0x0AD9690e...`, mainnet `0xA3b15Bd2...`). This official page lists different addresses for **"Compute Ledger"** (testnet `0xE70830508dAc0A97e6c087c75f402f9Be669E406`, mainnet `0x2dE54c845Cd948B72D2e32e39586fe89607074E3`) — see §2 below. Trust **this page's addresses** over the other doc's, since this is the primary source and the other one came through a summarizing fetch. The "Compute Ledger" name is more likely correct for what backs Router deposits; re-verify on-chain before relying on either for anything that moves funds.

---

## 1. Network configurations

### Testnet — Galileo

| Parameter | Value |
| --- | --- |
| Network name | 0G Galileo Testnet |
| Chain ID | `16602` |
| Token symbol | 0G |
| RPC endpoint | `https://evmrpc-testnet.0g.ai` (dev only — use a third-party RPC for production) |
| Block explorer | `https://chainscan-galileo.0g.ai` |
| Storage explorer | `https://storagescan-galileo.0g.ai` |
| Faucet | `https://faucet.0g.ai` — 0.1 0G/day |
| Faucet (Google Cloud) | `https://cloud.google.com/application/web3/faucet/0g/galileo` |
| Storage indexer | `https://indexer-storage-testnet-turbo.0g.ai` (API base — root `/` can 404, that's normal) |
| Storage start block | `1` |
| DA start block | `940000` |
| Docs | `https://docs.0g.ai/developer-hub/testnet/testnet-overview` |

Third-party RPCs recommended for production: QuickNode (`quicknode.com/chains/0g`), ThirdWeb (`thirdweb.com/0g-galileo-testnet-16601`), Ankr (`ankr.com/rpc/0g/`), dRPC NodeCloud (`drpc.org/chainlist/0g-galileo-testnet-rpc`).

### Mainnet — Aristotle

| Parameter | Value |
| --- | --- |
| Network name | 0G Mainnet |
| Chain ID | `16661` |
| Token symbol | 0G |
| RPC endpoint | `https://evmrpc.0g.ai` |
| Storage indexer | `https://indexer-storage-turbo.0g.ai` |
| Block explorer | `https://chainscan.0g.ai` |
| Storage start block | `2387557` |
| Docs | `https://docs.0g.ai/developer-hub/mainnet/mainnet-overview` |

Third-party RPCs: QuickNode, ThirdWeb (`thirdweb.com/0g-aristotle`), Ankr.

---

## 2. Smart contract addresses

### Testnet

| Contract | Address | Purpose |
| --- | --- | --- |
| Flow | `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296` | Storage data flow management |
| Mine | `0x00A9E9604b0538e06b268Fb297Df333337f9593b` | Storage mining rewards |
| Reward | `0xA97B57b4BdFEA2D0a25e535bd849ad4e6C440A69` | Reward distribution |
| DAEntrance | `0xE75A073dA5bb7b0eC622170Fd268f35E675a957B` | DA blob submission |
| DASigners | `0x0000000000000000000000000000000000001000` | DA signer management (precompile) |
| WrappedOGBase | `0x0000000000000000000000000000000000001001` | Wrapped native token (precompile) |
| **Compute Ledger** | `0xE70830508dAc0A97e6c087c75f402f9Be669E406` | Compute network payment ledger |
| Compute Inference | `0xa79F4c8311FF93C06b8CfB403690cc987c93F91E` | Compute inference service |
| Compute FineTuning | `0xaC66eBd174435c04F1449BBa08157a707B6fa7b1` | Compute fine-tuning service |

### Mainnet

| Contract | Address | Purpose |
| --- | --- | --- |
| Flow | `0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526` | Storage data flow management |
| Mine | `0xCd01c5Cd953971CE4C2c9bFb95610236a7F414fe` | Storage mining rewards |
| Reward | `0x457aC76B58ffcDc118AABD6DbC63ff9072880870` | Reward distribution |
| DASigners | `0x0000000000000000000000000000000000001000` | DA signer management (precompile) |
| WrappedOGBase | `0x0000000000000000000000000000000000001001` | Wrapped native token (precompile) |
| **Compute Ledger** | `0x2dE54c845Cd948B72D2e32e39586fe89607074E3` | Compute network payment ledger |
| Compute Inference | `0x47340d900bdFec2BD393c626E12ea0656F938d84` | Compute inference service |
| Compute FineTuning | `0x4e3474095518883744ddf135b7E0A23301c7F9c0` | Compute fine-tuning service |

### $0G token

`$0G` is the native gas token on 0G Mainnet — no contract address there. Official token representations elsewhere:

| Network (chain ID) | Token | Address |
| --- | --- | --- |
| 0G Mainnet (16661) | W0G — Wrapped 0G | `0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c` |
| Ethereum (1) | 0G — official bridged | `0x4B948d64dE1F71fCd12fB586f4c776421a35b3eE` |
| BNB Chain (56) | 0G — official bridged | `0x4B948d64dE1F71fCd12fB586f4c776421a35b3eE` |

All 18 decimals. The bridged token shares the same address on Ethereum and BNB Chain (bridged via Stargate). **Any other contract claiming to be $0G is not official.**

---

## 3. 0G Chain

Docs: `docs.0g.ai/concepts/chain`. "Fastest modular AI chain" — **11,000 TPS per shard**, sub-second finality, full EVM compatibility, CometBFT consensus.

```js
// hardhat.config.js
module.exports = {
  networks: {
    testnet: { url: "https://evmrpc-testnet.0g.ai", chainId: 16602, accounts: ["YOUR_PRIVATE_KEY"] },
    mainnet: { url: "https://evmrpc.0g.ai", chainId: 16661, accounts: ["YOUR_PRIVATE_KEY"] }
  },
  solidity: "0.8.20"
};
```

```bash
# Foundry
forge create --rpc-url https://evmrpc-testnet.0g.ai --private-key YOUR_PRIVATE_KEY src/MyContract.sol:MyContract
```

Precompiles:
```solidity
// DASigners — 0x0000000000000000000000000000000000001000
function getEpochNumber(uint256 blockNumber) external view returns (uint256);
function getQuorum(uint256 epochNumber, uint256 quorumId) external view returns (Signer[] memory);
function isSigner(uint256 epochNumber, address account) external view returns (bool);

// WrappedOGBase — 0x0000000000000000000000000000000000001001 (like WETH)
function deposit() external payable;
function withdraw(uint256 amount) external;
function balanceOf(address account) external view returns (uint256);
```

Indexing via Goldsky (`docs.goldsky.com/chains/0g`) — Subgraphs (GraphQL) and Mirror (real-time streaming to a DB).

---

## 4. 0G Storage

Docs: `docs.0g.ai/concepts/storage`. Claims **95% cheaper than centralized alternatives**, 200 MBPS retrieval, TB-scale proven, Proof of Random Access (PoRA) consensus. Two layers: Log (immutable) + KV (mutable).

**Flow contract note:** for TypeScript SDK file uploads, the flow contract is handled internally by the Indexer — only the EVM RPC URL is needed. For KV operations, the flow contract address is required when constructing a `Batcher`. Go SDK's indexer client also handles it internally.

Install:
```bash
npm install @0gfoundation/0g-storage-ts-sdk ethers   # TypeScript
go get github.com/0gfoundation/0g-storage-client      # Go
```

Starter kits: `github.com/0gfoundation/0g-storage-ts-starter-kit` (CLI + library + browser UI with MetaMask), `github.com/0gfoundation/0g-storage-go-starter-kit`.

```ts
import { ZgFile, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const indexer = new Indexer("https://indexer-storage-testnet-turbo.0g.ai");

const file = await ZgFile.fromFilePath("/path/to/file");
const [tree, treeErr] = await file.merkleTree();
console.log("Root Hash:", tree?.rootHash());

const [tx, uploadErr] = await indexer.upload(file, "https://evmrpc-testnet.0g.ai", signer);
await file.close();

// Download (withProof=true enables merkle verification)
const err = await indexer.download(rootHash, "/path/to/output", true);
```

KV operations (need the flow contract explicitly):
```ts
import { Batcher, KvClient } from "@0gfoundation/0g-storage-ts-sdk";
const batcher = new Batcher(1, nodes, flowContract, RPC_URL);
batcher.streamDataBuilder.set(streamId, keyBytes, valueBytes);
const [tx, err] = await batcher.exec();

const kvClient = new KvClient("<kv_node_url>");
const value = await kvClient.getValue(streamId, encodedKey);
```

CLI (Go, built from `0g-storage-client`):
```bash
git clone https://github.com/0gfoundation/0g-storage-client.git && cd 0g-storage-client && go build

0g-storage-client upload --url https://evmrpc-testnet.0g.ai --key YOUR_PRIVATE_KEY \
  --indexer https://indexer-storage-testnet-turbo.0g.ai --file /path/to/file

# with client-side AES-256-CTR encryption
0g-storage-client upload ... --encryption-key <hex_key>

0g-storage-client download --indexer https://indexer-storage-testnet-turbo.0g.ai \
  --root <ROOT_HASH> --file output.dat --proof

0g-storage-client kv-write  --url ... --stream-id <ID> --stream-keys <KEYS> --stream-values <VALUES>
0g-storage-client kv-read   --node <KV_NODE_URL> --stream-id <ID> --stream-keys <KEYS>
```

Indexer REST API (HTTP gateway):
```
GET  /file?root=0x...              # download by merkle root
GET  /file?txSeq=7                 # download by tx sequence
GET  /file/{root}/path/to/file     # download from a folder
GET  /file/info/{cid}              # file info — use this to health-check, not root /
POST /file/segment                 # upload a segment (JSON: txSeq/root, index, data, proof)
```

GitHub: `0g-storage-node`, `0g-storage-kv`, `0g-storage-client` (Go), `0g-storage-ts-sdk`.

---

## 5. 0G Compute

Docs: `docs.0g.ai/concepts/compute`. "90% cheaper AI workloads with OpenAI SDK compatibility" — example given: **$0.003 vs $0.03 per 1K tokens**. Pay-per-use, no subscriptions. Smart-contract escrow. TEE-secured. **50–100ms inference latency** claimed. Supports chatbot (LLM), text-to-image, speech-to-text.

DePIN GPU partners: **io.net** (300,000+ GPUs, 139 countries), **Aethir** (43,000+ enterprise GPUs, 3,000+ H100s/H200s).

### Two integration paths (confirms `0g-compute-integration-findings.md`)

- **Router (recommended)** — single OpenAI-compatible endpoint (`https://router-api.0g.ai/v1`), one unified balance, automatic failover, API key. Best for server-side apps/agents/prototypes. Web UI: `pc.0g.ai`.
- **Direct** — connect to individual providers via `@0gfoundation/0g-compute-ts-sdk`, per-provider sub-accounts, wallet-signs every request. Best for browser dApps or on-chain control. Web UI: `compute-marketplace.0g.ai` (or Advanced mode on `pc.0g.ai`).

**The two balance pools are independent** — a Router deposit does not fund Direct sub-accounts, and vice versa. (Matches the earlier finding.)

### Router quick start

```bash
# 1. Visit https://pc.0g.ai, connect wallet, deposit 0G tokens
# 2. Dashboard → API Keys → create a key with 'inference' permission (starts with sk-)
# 3. Any OpenAI-compatible client works:
curl https://router-api.0g.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "zai-org/GLM-5-FP8", "messages": [{"role": "user", "content": "Hello!"}]}'
```

```python
from openai import OpenAI
client = OpenAI(base_url="https://router-api.0g.ai/v1", api_key="sk-YOUR_API_KEY")
response = client.chat.completions.create(
    model="zai-org/GLM-5-FP8",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**Router also supports, confirmed here for the first time:**
- Image generation: `POST /v1/images/generations` (sync) or `POST /v1/async/images/generations` + `GET /v1/async/jobs/{jobId}?provider_address=...` (recommended for production) — **both must pass `"response_format": "b64_json"` today; URL responses come later.**
- `POST /v1/audio/transcriptions`.
- Provider routing headers: `X-0G-Provider-Sort: latency|price`, `X-0G-Provider-Address: 0x…` (pin), `X-0G-Provider-Max-Price-Usd-Prompt` / `-Completion` / `-Image` (price cap — header-only, malformed values return `400`).
- `GET /v1/models` (no auth), `GET /v1/account/balance`, `GET /v1/account/usage/{stats,history}`.
- **The Router also serves the Anthropic Messages API** (`POST /v1/messages`) — set `ANTHROPIC_BASE_URL=https://router-api.0g.ai` to point an Anthropic SDK or **Claude Code itself** at it. Models carrying `"anthropic"` in `supported_formats` on `GET /v1/models` support this. Dedicated doc: `docs.0g.ai/developer-hub/building-on-0g/compute-network/router/clients/claude-code`. **Not previously found — genuinely new and interesting for this project's own tooling, separate from the CoinDraft integration.**

### Direct (SDK) quick start

```bash
pnpm add @0gfoundation/0g-compute-ts-sdk -g

0g-compute-cli setup-network                 # choose testnet/mainnet
0g-compute-cli login                          # prompts for wallet private key
0g-compute-cli deposit --amount 10
0g-compute-cli inference list-providers
0g-compute-cli transfer-fund --provider <PROVIDER_ADDRESS> --amount 5   # auto-acknowledges
0g-compute-cli inference get-secret --provider <PROVIDER_ADDRESS>       # -> app-sk-<SECRET>
```

```python
from openai import OpenAI
client = OpenAI(base_url="<service_url>/v1/proxy", api_key="app-sk-<YOUR_SECRET>")
```

Fine-tuning is **Direct-only, not available via Router**:
```bash
0g-compute-cli fine-tuning upload-data --file dataset.jsonl   # JSONL: {"prompt":"...","completion":"..."}
0g-compute-cli fine-tuning create-task --model Qwen2.5-0.5B-Instruct --dataset <DATASET_ID> --provider <PROVIDER_ADDRESS>
0g-compute-cli fine-tuning get-task --task-id <TASK_ID>
```

Doc links: Overview (`.../compute-network/overview`), Router Overview/Quickstart/Models/Chat-Completions/Claude-Code/Routing/Deposits/Comparison, Direct Inference/Account/Fine-tuning/Provider-Setup — all under `docs.0g.ai/developer-hub/building-on-0g/compute-network/`.

---

## 6. 0G DA (Data Availability)

Docs: `docs.0g.ai/concepts/da`. **50 Gbps demonstrated throughput**, VRF-based node selection, inherits Ethereum security. For rollup developers: OP Stack integration (`0g-da-op-plasma` repo) and Arbitrum Nitro integration (`nitro` repo, 0gfoundation fork).

---

## 7. Agentic ID (formerly INFT) — full technical reference

Docs: `docs.0g.ai/concepts/agentic-id`. **Agentic ID is the rebrand of what was previously called INFT (Intelligent NFT).** This is a renaming `0g-integration-plan.md` doesn't know about — anything referencing "INFT" elsewhere is the same thing.

ERC-7857 is the underlying NFT standard for tokenizing AI agents — extends ERC-721 with encrypted metadata, secure re-encryption on transfer via TEE/ZKP oracles, cloning, and usage authorization. Reference implementation uses upgradeable beacon proxies + OpenZeppelin AccessControl.

**New, not in `0g-integration-plan.md`:** 0G also officially supports **ERC-8004 (Trustless Agents)** for public on-chain agent identity and discoverability, and Agentic ID is ERC-8004-compatible. Registered agents are discoverable at `8004scan.io`.

GitHub: `github.com/0gfoundation/0g-agent-nft`.

### Core interface

```solidity
interface IERC7857 is IERC721, IERC7857Metadata {
    // Transfer token with encrypted metadata re-encryption
    function iTransferFrom(address _from, address _to, uint256 _tokenId, TransferValidityProof[] calldata _proofs) external;
    // Delegate access-proof signing to an assistant address
    function delegateAccess(address _assistant) external;
    // Get the verifier contract (TEE or ZKP oracle)
    function verifier() external view returns (IERC7857DataVerifier);
}
```

### Key data structures

```solidity
struct IntelligentData {
    string dataDescription;
    bytes32 dataHash;
}
struct TransferValidityProof {
    AccessProof accessProof;       // Signed by receiver
    OwnershipProof ownershipProof; // Signed by TEE/ZKP oracle
}
struct OwnershipProof {
    OracleType oracleType; // TEE or ZKP
    bytes32 dataHash;
    bytes sealedKey;       // Encryption key sealed for receiver
    bytes targetPubkey;
    bytes nonce;
    bytes proof;
}
enum OracleType { TEE, ZKP }
```

### Extensions

- **Cloneable** (`IERC7857Cloneable`) — `iCloneFrom()` creates a new token with the same encrypted metadata.
- **Authorize** (`IERC7857Authorize`) — `authorizeUsage()` / `revokeAuthorization()`, **max 100 users per token, cleared on transfer**. This is the exact mechanism `0g-integration-plan.md` §1 points to for the `bots-service` executor relationship.
- **Data Storage** (`ERC7857IDataStorageUpgradeable`) — on-chain storage for arrays of `IntelligentData` per token.

### Architecture

- `AgentNFT` — main contract: minting, creator tracking, mint fees. Roles: `ADMIN_ROLE`, `OPERATOR_ROLE`, `MINTER_ROLE`.
- `Verifier` — orchestrates TEE/ZKP proof verification with replay protection (nonce-based, **7-day expiry**).
- `TeeVerifier` — ECDSA signature verification against a registered TEE oracle address.
- `AgentMarket` — marketplace: order/offer model, EIP-712 signatures, platform + partner fee distribution, native/ERC20 payment support.

### Transfer flow

1. Receiver signs `AccessProof` (proving they want the data).
2. TEE/ZKP oracle decrypts metadata, re-encrypts with receiver's public key, produces `OwnershipProof` with `sealedKey`.
3. `iTransferFrom()` calls `verifier.verifyTransferValidity()` to validate both proofs.
4. Token ownership transfers; a `PublishedSealedKey` event emits for the receiver to decrypt.

Use cases listed: AI Trading Bots, Personal Assistants, Game Characters, Content Creation AI, Research Tools — "AI Trading Bots" is the first one named, directly matching the bot-tokenization idea in `0g-integration-plan.md`.

### ERC-8004 registry addresses

| Network | IdentityRegistry | ReputationRegistry |
| --- | --- | --- |
| 0G Mainnet (16661) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| 0G Galileo Testnet (16602) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Doc links: Agentic ID Overview, ERC-7857 Standard, Integration Guide, ERC-8004 Guide — all under `docs.0g.ai/developer-hub/building-on-0g/agentic-id/`.

---

## 8. Key concepts not previously captured

### AI Alignment
Docs: `docs.0g.ai/concepts/ai-alignment`. "Monitor AI systems for proper behavior, safety, and alignment with human values." Functions: track model drift, verify outputs, monitor performance, flag anomalies. No further detail given on this context page — worth a dedicated look if it ever becomes relevant.

### DePIN (Decentralized Physical Infrastructure)
Docs: `docs.0g.ai/concepts/depin`. The physical GPU layer behind Compute — same io.net / Aethir partners as §5.

---

## 9. Quick reference

### Add network to MetaMask

```js
// Testnet
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x40DA', // 16602
    chainName: '0G Galileo Testnet',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: ['https://evmrpc-testnet.0g.ai'],
    blockExplorerUrls: ['https://chainscan-galileo.0g.ai']
  }]
});

// Mainnet
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x4115', // 16661
    chainName: '0G Mainnet',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: ['https://evmrpc.0g.ai'],
    blockExplorerUrls: ['https://chainscan.0g.ai']
  }]
});
```

### Vision & mission (docs.0g.ai/introduction/vision-mission)
Mission: *"Make AI a Public Good."* Vision: democratized, transparent, fair, and secure AI infrastructure. Approach: open infrastructure, community ownership, economic alignment, technical excellence.

### Community & support
- Docs: `docs.0g.ai` · Website: `0g.ai` · GitHub: `github.com/0gfoundation` · Discord: `discord.gg/0gLabs` · X: `x.com/0g_Labs`
- Getting help: `docs.0g.ai/developer-hub/getting-started`, Discord `#compute`-style dev channels, GitHub Issues per repo.
- Also linked from the docs site nav: Builder Hub, Ecosystem Explorer, ChainScan, StorageScan, Blog.

### Other reference docs, not yet read in full
- Security: `docs.0g.ai/resources/security`
- Contributing: `docs.0g.ai/resources/how-to-contribute`
- Glossary: `docs.0g.ai/resources/glossary`

---

## 10. What this changes about the CoinDraft integration plan

- **Nothing changes for Phase 1** (`/api/mentor`, `/api/breakdown` via Router) — this page confirms everything already built in `src/lib/server/aiCompute.ts` and verified by curl. The `zai-org/GLM-5-FP8` example model matches what was seen live on testnet's `/v1/models` yesterday.
- **The Router-serves-Anthropic-API finding is new and unrelated to CoinDraft's product** — it means Claude Code itself could be pointed at 0G Compute via `ANTHROPIC_BASE_URL`, if that's ever wanted for this project's own tooling. Not a CoinDraft feature; noting it because it's genuinely new information from this fetch.
- **Agentic ID's `authorizeUsage()` (max 100 users/token, cleared on transfer) is now fully specified**, not just referenced — directly usable if Phase 2 (`X-16` in `user-stories-by-surface.md`) is ever picked back up. Still blocked by the same fact found yesterday: `bots-service/` isn't in this repo, and the in-repo bot has no lineup logic to tokenize in the first place.
- **ERC-8004 support is new information** — if agent discoverability/reputation ever matters for a tokenized-bot pitch, this is the standard to point at, and 0G already has registry contracts live on both networks.
- **The contract-address conflict in §2 above should be resolved before any code depends on either address** — re-check on-chain (`chainscan.0g.ai` / `chainscan-galileo.0g.ai`) rather than trusting either doc blindly.
