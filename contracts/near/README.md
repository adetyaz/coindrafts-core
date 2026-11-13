# CoinDraft Garage (NEAR contract)

One [NEP-245](https://github.com/near/NEPs/blob/master/neps/nep-0245.md) multi-token contract that holds every car and the in-game currency for CoinDraft.

- **Testnet:** [`garage.coindraft.testnet`](https://testnet.nearblocks.io/address/garage.coindraft.testnet)
- **Operator (game server):** `coindraft.testnet`

## Tokens

| Token id    | What it is                         | Supply              |
| ----------- | ---------------------------------- | ------------------- |
| `car:<id>`  | One car (model, rarity, races, wins) | 1                 |
| `gears`     | Gears, earned by racing, spent in the Car Market | Minted and burned by the game |

## Who calls what

**The operator (game server)** runs the game loop, so players never sign a transaction or pay gas:

| Method | Does |
| --- | --- |
| `mint_car(car_id, owner_id, model, rarity)` | Creates a car for a player or bot |
| `mint_gears(owner_id, amount, memo)` / `burn_gears(...)` | Race winnings in, spending out |
| `trade_car(car_token_id, seller_id, buyer_id, price)` | One atomic Car Market sale: Gears buyer → seller, car seller → buyer |
| `game_transfer(from_id, to_id, token_ids, amounts, memo)` | Moves tokens on a player's behalf |
| `open_car_race(race_id, entries)` | Escrows every entrant's car (same rarity only) |
| `settle_car_race(race_id, winner_id)` | Winner takes every staked car; car stats update |
| `cancel_car_race(race_id)` | Returns every staked car |

**Token holders** keep the standard NEP-245 methods: `mt_transfer`, `mt_batch_transfer`, `mt_transfer_call`, `mt_batch_transfer_call` (1 yoctoNEAR deposit).

**Views:** `mt_token`, `mt_balance_of`, `mt_batch_balance_of`, `mt_supply`, `mt_batch_supply`, plus `garage(account_id)`, `car(token_id)`, `car_race(race_id)`, `operator()`.

Every mint, burn and transfer emits a NEP-245 `EVENT_JSON` log.

## Build and test

Needs Rust (the version is pinned in `rust-toolchain.toml`) and [cargo-near](https://github.com/near/cargo-near).

```sh
cargo test                                         # 8 unit tests
cargo near build non-reproducible-wasm --no-abi    # → target/near/coindraft_garage.wasm
```

On Windows, set `AWS_LC_SYS_PREBUILT_NASM=1` for `cargo test`. `--no-abi` is needed on Windows because the ABI step can't link natively there.

## Deploy

```sh
near contract deploy garage.<you>.testnet use-file target/near/coindraft_garage.wasm \
  with-init-call new json-args '{"owner_id":"<you>.testnet","operator_id":"<you>.testnet"}' \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send
```
