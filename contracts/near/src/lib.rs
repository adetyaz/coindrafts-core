//! CoinDraft Garage: every car and the Gears currency in one NEP-245 multi-token contract.
//!
//! - A car is a token with supply 1 (`car:<id>`). Gears is one fungible token (`gears`).
//! - The game server is the `operator`. It mints cars and Gears, moves tokens for Car Market
//!   trades, and escrows cars for car-for-car races, so players never sign a transaction or pay
//!   gas in the normal game loop. Ownership still lives here, per account, and is readable by
//!   anyone through the standard NEP-245 views.
//! - Token holders can also move their own tokens with the standard `mt_transfer*` methods.
//!
//! Standard: https://github.com/near/NEPs/blob/master/neps/nep-0245.md

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::store::LookupMap;
use near_sdk::{
    AccountId, Gas, PanicOnDefault, PromiseError, PromiseOrValue, assert_one_yocto, env,
    ext_contract, near, require,
};

pub type TokenId = String;

/// Token id of the in-game currency.
pub const GEARS: &str = "gears";
const CAR_PREFIX: &str = "car:";

const GAS_FOR_RESOLVE: Gas = Gas::from_tgas(10);
const GAS_FOR_TRANSFER_CALL: Gas = Gas::from_tgas(30);

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub enum Rarity {
    Common,
    Rare,
    Epic,
    Legendary,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Car {
    pub model: String,
    pub rarity: Rarity,
    pub minted_at_ms: u64,
    pub races: u32,
    pub wins: u32,
}

/// The NEP-245 `Token` view.
#[near(serializers = [json])]
#[derive(Debug)]
pub struct Token {
    pub token_id: TokenId,
    pub owner_id: Option<AccountId>,
}

/// A car-for-car race: every entrant's car is held by this contract until the race settles.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct CarRace {
    pub entries: Vec<(AccountId, TokenId)>,
    pub rarity: Rarity,
    pub winner: Option<AccountId>,
    pub cancelled: bool,
}

#[ext_contract(ext_mt_receiver)]
pub trait MtReceiver {
    fn mt_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_ids: Vec<AccountId>,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>>;
}

#[ext_contract(ext_self)]
pub trait SelfCallbacks {
    fn mt_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
    ) -> Vec<U128>;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Garage {
    owner_id: AccountId,
    operator_id: AccountId,
    balances: LookupMap<(TokenId, AccountId), u128>,
    supply: LookupMap<TokenId, u128>,
    cars: LookupMap<TokenId, Car>,
    /// Car owner, kept alongside `balances` so `mt_token` and the garage view are O(1).
    car_owner: LookupMap<TokenId, AccountId>,
    /// Car ids per account. Garages are small, so a Vec is enough.
    garages: LookupMap<AccountId, Vec<TokenId>>,
    races: LookupMap<String, CarRace>,
}

#[near]
impl Garage {
    #[init]
    pub fn new(owner_id: AccountId, operator_id: AccountId) -> Self {
        Self {
            owner_id,
            operator_id,
            balances: LookupMap::new(b"b"),
            supply: LookupMap::new(b"s"),
            cars: LookupMap::new(b"c"),
            car_owner: LookupMap::new(b"o"),
            garages: LookupMap::new(b"g"),
            races: LookupMap::new(b"r"),
        }
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    pub fn set_operator(&mut self, operator_id: AccountId) {
        self.assert_owner();
        self.operator_id = operator_id;
    }

    pub fn operator(&self) -> AccountId {
        self.operator_id.clone()
    }

    // ── Operator: minting ────────────────────────────────────────────────────

    /// Creates a car (supply 1) for `owner_id`. `car_id` is the game's own id; the token id is
    /// `car:<car_id>`.
    pub fn mint_car(
        &mut self,
        car_id: String,
        owner_id: AccountId,
        model: String,
        rarity: Rarity,
    ) -> TokenId {
        self.assert_operator();
        let token_id = format!("{CAR_PREFIX}{car_id}");
        require!(!self.cars.contains_key(&token_id), "Car already exists");
        self.cars.insert(
            token_id.clone(),
            Car {
                model,
                rarity,
                minted_at_ms: env::block_timestamp_ms(),
                races: 0,
                wins: 0,
            },
        );
        self.supply.insert(token_id.clone(), 1);
        self.credit(&token_id, &owner_id, 1);
        emit(
            "mt_mint",
            json!([{ "owner_id": owner_id, "token_ids": [token_id], "amounts": ["1"] }]),
        );
        token_id
    }

    /// Race winnings, starter grants and the like.
    pub fn mint_gears(&mut self, owner_id: AccountId, amount: U128, memo: Option<String>) {
        self.assert_operator();
        let token_id = GEARS.to_string();
        let supply = self.supply.get(&token_id).copied().unwrap_or(0);
        self.supply.insert(
            token_id.clone(),
            supply.checked_add(amount.0).expect("Supply overflow"),
        );
        self.credit(&token_id, &owner_id, amount.0);
        emit(
            "mt_mint",
            json!([with_memo(
                json!({ "owner_id": owner_id, "token_ids": [token_id], "amounts": [amount] }),
                memo
            )]),
        );
    }

    /// Gears spent on paint, decals or garage space leave circulation.
    pub fn burn_gears(&mut self, owner_id: AccountId, amount: U128, memo: Option<String>) {
        self.assert_operator();
        let token_id = GEARS.to_string();
        self.debit(&token_id, &owner_id, amount.0);
        let supply = self.supply.get(&token_id).copied().unwrap_or(0);
        self.supply.insert(token_id.clone(), supply - amount.0);
        emit(
            "mt_burn",
            json!([with_memo(
                json!({ "owner_id": owner_id, "authorized_id": self.operator_id, "token_ids": [token_id], "amounts": [amount] }),
                memo
            )]),
        );
    }

    // ── Operator: Car Market ─────────────────────────────────────────────────

    /// One atomic sale: `price` Gears go buyer → seller and the car goes seller → buyer.
    /// Either both happen or neither does.
    pub fn trade_car(
        &mut self,
        car_token_id: TokenId,
        seller_id: AccountId,
        buyer_id: AccountId,
        price: U128,
    ) {
        self.assert_operator();
        require!(
            seller_id != buyer_id,
            "Seller and buyer are the same account"
        );
        self.assert_car(&car_token_id);
        let operator = self.operator_id.clone();
        self.move_tokens(
            &buyer_id,
            &seller_id,
            &[GEARS.to_string()],
            &[price.0],
            Some(&operator),
            Some(format!("buy {car_token_id}")),
        );
        self.move_tokens(
            &seller_id,
            &buyer_id,
            std::slice::from_ref(&car_token_id),
            &[1],
            Some(&operator),
            Some(format!("sell {car_token_id}")),
        );
    }

    /// Moves tokens on a player's behalf (bots selling to bots, gifts, admin fixes).
    pub fn game_transfer(
        &mut self,
        from_id: AccountId,
        to_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        memo: Option<String>,
    ) {
        self.assert_operator();
        let amounts: Vec<u128> = amounts.iter().map(|a| a.0).collect();
        let operator = self.operator_id.clone();
        self.move_tokens(
            &from_id,
            &to_id,
            &token_ids,
            &amounts,
            Some(&operator),
            memo,
        );
    }

    // ── Operator: car-for-car races ──────────────────────────────────────────

    /// Locks every entrant's car in this contract. All cars must be the same rarity.
    pub fn open_car_race(&mut self, race_id: String, entries: Vec<(AccountId, TokenId)>) {
        self.assert_operator();
        require!(!self.races.contains_key(&race_id), "Race already exists");
        require!(entries.len() >= 2, "A car race needs at least 2 entrants");
        let rarity = self.assert_car(&entries[0].1).rarity;
        let escrow = env::current_account_id();
        let operator = self.operator_id.clone();
        for (account, car) in &entries {
            require!(
                self.assert_car(car).rarity == rarity,
                "All cars in a car race must share a rarity"
            );
            self.move_tokens(
                account,
                &escrow,
                std::slice::from_ref(car),
                &[1],
                Some(&operator),
                Some(format!("stake in {race_id}")),
            );
        }
        self.races.insert(
            race_id,
            CarRace {
                entries,
                rarity,
                winner: None,
                cancelled: false,
            },
        );
    }

    /// The winner takes every staked car. Each car's race count goes up; the winner's own car
    /// records the win.
    pub fn settle_car_race(&mut self, race_id: String, winner_id: AccountId) {
        self.assert_operator();
        let race = self.races.get(&race_id).cloned().expect("Race not found");
        require!(
            race.winner.is_none() && !race.cancelled,
            "Race already closed"
        );
        let winner_entry = race
            .entries
            .iter()
            .find(|(a, _)| *a == winner_id)
            .expect("Winner did not enter this race");
        let escrow = env::current_account_id();
        let operator = self.operator_id.clone();
        for (_, car) in &race.entries {
            let stats = self.cars.get_mut(car).expect("Car not found");
            stats.races += 1;
            if *car == winner_entry.1 {
                stats.wins += 1;
            }
            self.move_tokens(
                &escrow,
                &winner_id,
                std::slice::from_ref(car),
                &[1],
                Some(&operator),
                Some(format!("won {race_id}")),
            );
        }
        self.races.insert(
            race_id,
            CarRace {
                winner: Some(winner_id),
                ..race
            },
        );
    }

    /// Returns every staked car to its owner (race abandoned, server error).
    pub fn cancel_car_race(&mut self, race_id: String) {
        self.assert_operator();
        let race = self.races.get(&race_id).cloned().expect("Race not found");
        require!(
            race.winner.is_none() && !race.cancelled,
            "Race already closed"
        );
        let escrow = env::current_account_id();
        let operator = self.operator_id.clone();
        for (account, car) in &race.entries {
            self.move_tokens(
                &escrow,
                account,
                std::slice::from_ref(car),
                &[1],
                Some(&operator),
                Some(format!("refund {race_id}")),
            );
        }
        self.races.insert(
            race_id,
            CarRace {
                cancelled: true,
                ..race
            },
        );
    }

    // ── NEP-245: change methods (called by the token holder) ─────────────────

    #[payable]
    pub fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        require!(approval.is_none(), "Approval Management is not supported");
        let sender = env::predecessor_account_id();
        self.move_tokens(&sender, &receiver_id, &[token_id], &[amount.0], None, memo);
    }

    #[payable]
    pub fn mt_batch_transfer(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Option<(AccountId, u64)>>>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        require!(approvals.is_none(), "Approval Management is not supported");
        let sender = env::predecessor_account_id();
        let amounts: Vec<u128> = amounts.iter().map(|a| a.0).collect();
        self.move_tokens(&sender, &receiver_id, &token_ids, &amounts, None, memo);
    }

    #[payable]
    pub fn mt_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        self.mt_batch_transfer_call(
            receiver_id,
            vec![token_id],
            vec![amount],
            approval.map(|a| vec![Some(a)]),
            memo,
            msg,
        )
    }

    #[payable]
    pub fn mt_batch_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Option<(AccountId, u64)>>>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        assert_one_yocto();
        require!(approvals.is_none(), "Approval Management is not supported");
        let sender = env::predecessor_account_id();
        let raw: Vec<u128> = amounts.iter().map(|a| a.0).collect();
        self.move_tokens(&sender, &receiver_id, &token_ids, &raw, None, memo);
        ext_mt_receiver::ext(receiver_id.clone())
            .with_static_gas(GAS_FOR_TRANSFER_CALL)
            .mt_on_transfer(
                sender.clone(),
                vec![sender.clone(); token_ids.len()],
                token_ids.clone(),
                amounts.clone(),
                msg,
            )
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RESOLVE)
                    .mt_resolve_transfer(sender, receiver_id, token_ids, amounts),
            )
            .into()
    }

    /// Returns unused tokens to the sender. If the receiver failed, everything goes back.
    #[private]
    pub fn mt_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        #[callback_result] unused: Result<Vec<U128>, PromiseError>,
    ) -> Vec<U128> {
        let unused: Vec<u128> = match unused {
            Ok(list) if list.len() == amounts.len() => list
                .iter()
                .zip(&amounts)
                .map(|(u, a)| u.0.min(a.0))
                .collect(),
            _ => amounts.iter().map(|a| a.0).collect(),
        };
        let mut used = Vec::with_capacity(amounts.len());
        for ((token_id, amount), back) in token_ids.iter().zip(&amounts).zip(unused) {
            let held = self.balance(token_id, &receiver_id);
            let refund = back.min(held);
            if refund > 0 {
                self.move_tokens(
                    &receiver_id,
                    &sender_id,
                    std::slice::from_ref(token_id),
                    &[refund],
                    None,
                    Some("refund".into()),
                );
            }
            used.push(U128(amount.0 - refund));
        }
        used
    }

    // ── NEP-245: views ───────────────────────────────────────────────────────

    pub fn mt_token(&self, token_ids: Vec<TokenId>) -> Vec<Option<Token>> {
        token_ids
            .into_iter()
            .map(|token_id| {
                if token_id == GEARS {
                    let exists = self.supply.contains_key(&token_id);
                    exists.then_some(Token {
                        token_id,
                        owner_id: None,
                    })
                } else {
                    let owner_id = self.car_owner.get(&token_id).cloned();
                    owner_id.map(|o| Token {
                        token_id,
                        owner_id: Some(o),
                    })
                }
            })
            .collect()
    }

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: TokenId) -> U128 {
        U128(self.balance(&token_id, &account_id))
    }

    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<TokenId>) -> Vec<U128> {
        token_ids
            .iter()
            .map(|t| U128(self.balance(t, &account_id)))
            .collect()
    }

    pub fn mt_supply(&self, token_id: TokenId) -> Option<U128> {
        self.supply.get(&token_id).map(|s| U128(*s))
    }

    pub fn mt_batch_supply(&self, token_ids: Vec<TokenId>) -> Vec<Option<U128>> {
        token_ids
            .iter()
            .map(|t| self.supply.get(t).map(|s| U128(*s)))
            .collect()
    }

    // ── Game views ───────────────────────────────────────────────────────────

    /// Every car an account owns, with its stats.
    pub fn garage(&self, account_id: AccountId) -> Vec<(TokenId, Car)> {
        self.garages
            .get(&account_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| self.cars.get(id).map(|c| (id.clone(), c.clone())))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn car(&self, token_id: TokenId) -> Option<Car> {
        self.cars.get(&token_id).cloned()
    }

    pub fn car_race(&self, race_id: String) -> Option<CarRace> {
        self.races.get(&race_id).cloned()
    }
}

// ── Internals ────────────────────────────────────────────────────────────────

impl Garage {
    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the owner can do this"
        );
    }

    fn assert_operator(&self) {
        require!(
            env::predecessor_account_id() == self.operator_id,
            "Only the game operator can do this"
        );
    }

    fn assert_car(&self, token_id: &TokenId) -> Car {
        self.cars.get(token_id).cloned().expect("Car not found")
    }

    fn balance(&self, token_id: &TokenId, account: &AccountId) -> u128 {
        self.balances
            .get(&(token_id.clone(), account.clone()))
            .copied()
            .unwrap_or(0)
    }

    fn credit(&mut self, token_id: &TokenId, account: &AccountId, amount: u128) {
        let next = self
            .balance(token_id, account)
            .checked_add(amount)
            .expect("Balance overflow");
        self.balances
            .insert((token_id.clone(), account.clone()), next);
        if token_id.starts_with(CAR_PREFIX) {
            self.car_owner.insert(token_id.clone(), account.clone());
            let mut ids = self.garages.get(account).cloned().unwrap_or_default();
            ids.push(token_id.clone());
            self.garages.insert(account.clone(), ids);
        }
    }

    fn debit(&mut self, token_id: &TokenId, account: &AccountId, amount: u128) {
        let held = self.balance(token_id, account);
        require!(
            held >= amount,
            format!("Not enough {token_id}: has {held}, needs {amount}")
        );
        let left = held - amount;
        if left == 0 {
            self.balances.remove(&(token_id.clone(), account.clone()));
        } else {
            self.balances
                .insert((token_id.clone(), account.clone()), left);
        }
        if token_id.starts_with(CAR_PREFIX) && left == 0 {
            self.car_owner.remove(token_id);
            if let Some(ids) = self.garages.get_mut(account) {
                ids.retain(|id| id != token_id);
            }
        }
    }

    /// Debits and credits each token, then emits one NEP-245 `mt_transfer` event.
    fn move_tokens(
        &mut self,
        from: &AccountId,
        to: &AccountId,
        token_ids: &[TokenId],
        amounts: &[u128],
        authorized: Option<&AccountId>,
        memo: Option<String>,
    ) {
        require!(!token_ids.is_empty(), "No tokens to transfer");
        require!(
            token_ids.len() == amounts.len(),
            "token_ids and amounts differ in length"
        );
        require!(from != to, "Sender and receiver are the same account");
        for (token_id, amount) in token_ids.iter().zip(amounts) {
            require!(*amount > 0, "Amount must be positive");
            self.debit(token_id, from, *amount);
            self.credit(token_id, to, *amount);
        }
        let amounts: Vec<U128> = amounts.iter().map(|a| U128(*a)).collect();
        let mut log = json!({ "old_owner_id": from, "new_owner_id": to, "token_ids": token_ids, "amounts": amounts });
        if let Some(a) = authorized {
            log["authorized_id"] = json!(a);
        }
        emit("mt_transfer", json!([with_memo(log, memo)]));
    }
}

fn with_memo(mut log: serde_json::Value, memo: Option<String>) -> serde_json::Value {
    if let Some(m) = memo {
        log["memo"] = json!(m);
    }
    log
}

fn emit(event: &str, data: serde_json::Value) {
    let payload = json!({ "standard": "nep245", "version": "1.0.0", "event": event, "data": data });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts, get_logs};
    use near_sdk::{NearToken, testing_env};

    fn ctx(predecessor: AccountId, deposit: u128) {
        testing_env!(
            VMContextBuilder::new()
                .current_account_id("garage.testnet".parse().unwrap())
                .predecessor_account_id(predecessor)
                .attached_deposit(NearToken::from_yoctonear(deposit))
                .build()
        );
    }

    fn operator() -> AccountId {
        accounts(0)
    }

    fn setup() -> Garage {
        ctx(operator(), 0);
        Garage::new(operator(), operator())
    }

    #[test]
    fn mints_cars_and_gears_with_events() {
        let mut g = setup();
        let car = g.mint_car("1".into(), accounts(1), "Viper".into(), Rarity::Rare);
        g.mint_gears(accounts(1), U128(500), Some("starter".into()));
        assert_eq!(car, "car:1");
        assert_eq!(g.mt_balance_of(accounts(1), car.clone()).0, 1);
        assert_eq!(g.mt_balance_of(accounts(1), GEARS.into()).0, 500);
        assert_eq!(g.mt_supply(GEARS.into()).unwrap().0, 500);
        assert_eq!(
            g.mt_token(vec![car]).pop().unwrap().unwrap().owner_id,
            Some(accounts(1))
        );
        assert_eq!(g.garage(accounts(1)).len(), 1);
        assert!(
            get_logs()
                .iter()
                .all(|l| l.starts_with("EVENT_JSON:") && l.contains("\"nep245\""))
        );
    }

    #[test]
    fn trade_moves_car_and_gears_together() {
        let mut g = setup();
        let car = g.mint_car("1".into(), accounts(1), "Viper".into(), Rarity::Common);
        g.mint_gears(accounts(2), U128(400), None);
        g.trade_car(car.clone(), accounts(1), accounts(2), U128(300));
        assert_eq!(g.mt_balance_of(accounts(2), car.clone()).0, 1);
        assert_eq!(g.mt_balance_of(accounts(1), car).0, 0);
        assert_eq!(g.mt_balance_of(accounts(1), GEARS.into()).0, 300);
        assert_eq!(g.mt_balance_of(accounts(2), GEARS.into()).0, 100);
        assert!(g.garage(accounts(1)).is_empty());
    }

    #[test]
    #[should_panic(expected = "Not enough gears")]
    fn trade_fails_without_enough_gears() {
        let mut g = setup();
        let car = g.mint_car("1".into(), accounts(1), "Viper".into(), Rarity::Common);
        g.mint_gears(accounts(2), U128(100), None);
        g.trade_car(car, accounts(1), accounts(2), U128(300));
    }

    #[test]
    fn winner_takes_every_staked_car() {
        let mut g = setup();
        let a = g.mint_car("a".into(), accounts(1), "Viper".into(), Rarity::Rare);
        let b = g.mint_car("b".into(), accounts(2), "Comet".into(), Rarity::Rare);
        g.open_car_race(
            "race-1".into(),
            vec![(accounts(1), a.clone()), (accounts(2), b.clone())],
        );
        assert_eq!(
            g.mt_balance_of("garage.testnet".parse().unwrap(), a.clone())
                .0,
            1
        );
        g.settle_car_race("race-1".into(), accounts(2));
        assert_eq!(g.mt_balance_of(accounts(2), a.clone()).0, 1);
        assert_eq!(g.mt_balance_of(accounts(2), b.clone()).0, 1);
        assert_eq!(g.car(b).unwrap().wins, 1);
        assert_eq!(g.car(a).unwrap().races, 1);
        assert_eq!(g.garage(accounts(2)).len(), 2);
    }

    #[test]
    fn cancelled_race_returns_cars() {
        let mut g = setup();
        let a = g.mint_car("a".into(), accounts(1), "Viper".into(), Rarity::Epic);
        let b = g.mint_car("b".into(), accounts(2), "Comet".into(), Rarity::Epic);
        g.open_car_race(
            "race-2".into(),
            vec![(accounts(1), a.clone()), (accounts(2), b.clone())],
        );
        g.cancel_car_race("race-2".into());
        assert_eq!(g.mt_balance_of(accounts(1), a).0, 1);
        assert_eq!(g.mt_balance_of(accounts(2), b).0, 1);
    }

    #[test]
    #[should_panic(expected = "share a rarity")]
    fn car_race_rejects_mixed_rarities() {
        let mut g = setup();
        let a = g.mint_car("a".into(), accounts(1), "Viper".into(), Rarity::Common);
        let b = g.mint_car("b".into(), accounts(2), "Comet".into(), Rarity::Legendary);
        g.open_car_race("race-3".into(), vec![(accounts(1), a), (accounts(2), b)]);
    }

    #[test]
    #[should_panic(expected = "Only the game operator")]
    fn players_cannot_mint() {
        let mut g = setup();
        ctx(accounts(1), 0);
        g.mint_gears(accounts(1), U128(1_000_000), None);
    }

    #[test]
    fn holder_can_transfer_with_one_yocto() {
        let mut g = setup();
        let car = g.mint_car("1".into(), accounts(1), "Viper".into(), Rarity::Common);
        ctx(accounts(1), 1);
        g.mt_transfer(accounts(3), car.clone(), U128(1), None, None);
        assert_eq!(g.mt_balance_of(accounts(3), car).0, 1);
    }
}
