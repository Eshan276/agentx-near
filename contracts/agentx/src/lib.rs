//! AGENTX on NEAR — one contract, three jobs:
//!
//! 1. **GameGold (GGLD)**, a NEP-141 fungible token (18 decimals). Agents earn it by selling what
//!    they harvest and spend it on food and gear. It is a real token: the human who owns an agent
//!    account can `ft_transfer` it anywhere.
//! 2. **A multi-resource constant-product AMM.** One pool per resource (`plank`, `fish`, …), priced
//!    in GGLD, 0.3% fee. Resources are virtual reserves (the game server holds inventories); GGLD
//!    reserves are real tokens held by this contract.
//! 3. **An agent registry.** Every agent is a named NEAR account (`ramu.agentx.testnet`) registered
//!    here once, with its swap count and volume tracked on-chain.
//!
//! Selling needs a **voucher** signed by the game server's voucher key: proof the agent really
//! harvested what it is selling. Without it, anyone could call `sell` and mint GGLD out of thin air.
//! Buying needs no voucher — the agent pays real GGLD.
use near_contract_standards::fungible_token::events::FtMint;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::{FungibleToken, FungibleTokenCore, FungibleTokenResolver};
use near_contract_standards::storage_management::{StorageBalance, StorageBalanceBounds, StorageManagement};
use near_sdk::borsh::BorshSerialize;
use near_sdk::collections::LazyOption;
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::serde_json::json;
use near_sdk::store::IterableMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue, PublicKey};

/// 1 GGLD = 10^18 base units.
pub const GOLD: u128 = 1_000_000_000_000_000_000;
/// Every new agent starts with 100 GGLD.
pub const STARTING_GOLD: u128 = 100 * GOLD;
const FEE_NUM: u128 = 997;
const FEE_DENOM: u128 = 1000;
/// Vouchers can be valid for at most 10 minutes.
const MAX_VOUCHER_TTL_MS: u64 = 10 * 60 * 1000;
const MAX_UNITS_PER_SWAP: u128 = 10_000;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    FungibleToken,
    Metadata,
    Pools,
    Agents,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Pool {
    /// Virtual resource units in the pool (whole items, not scaled).
    pub reserve_resource: U128,
    /// GGLD (base units) held by this contract for the pool.
    pub reserve_gold: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Agent {
    pub registered_at_ms: u64,
    /// Highest voucher nonce used; vouchers must strictly increase.
    pub sell_nonce: u64,
    pub swaps: u32,
    /// Lifetime GGLD (base units) moved through the AMM.
    pub volume: U128,
}

#[near(serializers = [json])]
pub struct Voucher {
    pub nonce: u64,
    pub expires_at_ms: u64,
    /// ed25519 signature over [`voucher_message`], base64.
    pub signature: Base64VecU8,
}

#[near(serializers = [json])]
pub struct PoolView {
    pub resource_id: String,
    pub reserve_resource: U128,
    pub reserve_gold: U128,
    /// GGLD base units per resource unit (spot).
    pub price: U128,
}

#[near(serializers = [json])]
pub struct AgentView {
    pub account_id: AccountId,
    pub registered_at_ms: u64,
    pub sell_nonce: u64,
    pub swaps: u32,
    pub volume: U128,
    pub gold: U128,
}

#[near(serializers = [json])]
pub struct ConfigView {
    pub owner_id: AccountId,
    pub voucher_public_key: PublicKey,
    pub agents: u32,
    pub pools: u32,
    pub fee_bps: u32,
    pub starting_gold: U128,
}

/// The exact bytes the game server signs to authorise a sale.
pub fn voucher_message(contract: &AccountId, seller: &AccountId, resource_id: &str, units: u128, nonce: u64, expires_at_ms: u64) -> String {
    format!("agentx-sell:{contract}:{seller}:{resource_id}:{units}:{nonce}:{expires_at_ms}")
}

fn emit(event: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({ "standard": "agentx", "version": "1.0.0", "event": event, "data": [data] })
    ));
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    voucher_public_key: PublicKey,
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    pools: IterableMap<String, Pool>,
    agents: IterableMap<AccountId, Agent>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, voucher_public_key: PublicKey) -> Self {
        require!(voucher_public_key.curve_type() == near_sdk::CurveType::ED25519, "voucher key must be ed25519");
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "GameGold".to_string(),
            symbol: "GGLD".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 18,
        };
        let mut this = Self {
            owner_id,
            voucher_public_key,
            token: FungibleToken::new(StorageKey::FungibleToken),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            pools: IterableMap::new(StorageKey::Pools),
            agents: IterableMap::new(StorageKey::Agents),
        };
        let me = env::current_account_id();
        this.token.internal_register_account(&me);
        this
    }

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
    }

    // ── Owner ────────────────────────────────────────────────────────────────

    /// Create a pool or add liquidity to it. The GGLD is minted to this contract as reserves.
    pub fn seed_pool(&mut self, resource_id: String, resource_units: U128, gold: U128) -> PoolView {
        self.assert_owner();
        require!(!resource_id.is_empty() && resource_id.len() <= 32, "resource id: 1-32 chars");
        require!(resource_units.0 > 0 && gold.0 > 0, "zero liquidity");
        let me = env::current_account_id();
        self.token.internal_deposit(&me, gold.0);
        FtMint { owner_id: &me, amount: gold, memo: Some("pool liquidity") }.emit();
        let mut pool = self.pools.get(&resource_id).cloned().unwrap_or(Pool { reserve_resource: U128(0), reserve_gold: U128(0) });
        pool.reserve_resource = U128(pool.reserve_resource.0 + resource_units.0);
        pool.reserve_gold = U128(pool.reserve_gold.0 + gold.0);
        self.pools.insert(resource_id.clone(), pool.clone());
        emit("pool_seeded", json!({ "resource_id": resource_id, "resource_units": resource_units, "gold": gold }));
        Self::view_pool(resource_id, &pool)
    }

    /// Register a new agent account and grant its 100 GGLD starting balance. Idempotent.
    /// The contract pays the (tiny) token storage from its own balance; only the owner can call this.
    pub fn register_agent(&mut self, account_id: AccountId) -> AgentView {
        self.assert_owner();
        if self.agents.get(&account_id).is_none() {
            if !self.token.accounts.contains_key(&account_id) {
                self.token.internal_register_account(&account_id);
            }
            self.token.internal_deposit(&account_id, STARTING_GOLD);
            FtMint { owner_id: &account_id, amount: U128(STARTING_GOLD), memo: Some("starting gold") }.emit();
            self.agents.insert(
                account_id.clone(),
                Agent { registered_at_ms: env::block_timestamp_ms(), sell_nonce: 0, swaps: 0, volume: U128(0) },
            );
            emit("agent_registered", json!({ "account_id": account_id, "starting_gold": U128(STARTING_GOLD) }));
        }
        self.get_agent(account_id).unwrap()
    }

    pub fn set_voucher_key(&mut self, voucher_public_key: PublicKey) {
        self.assert_owner();
        require!(voucher_public_key.curve_type() == near_sdk::CurveType::ED25519, "voucher key must be ed25519");
        self.voucher_public_key = voucher_public_key;
    }

    // ── Agents ───────────────────────────────────────────────────────────────

    /// Sell `units` of a harvested resource for GGLD. Needs a voucher from the game server.
    pub fn sell(&mut self, resource_id: String, units: U128, min_gold_out: U128, voucher: Voucher) -> U128 {
        let seller = env::predecessor_account_id();
        let mut agent = self.agents.get(&seller).cloned().unwrap_or_else(|| env::panic_str("not a registered agent"));
        require!(units.0 > 0 && units.0 <= MAX_UNITS_PER_SWAP, "units: 1-10000");
        self.check_voucher(&seller, &agent, &resource_id, units.0, &voucher);

        let mut pool = self.pools.get(&resource_id).cloned().unwrap_or_else(|| env::panic_str("pool not found"));
        let gold_out = sell_quote(&pool, units.0);
        require!(gold_out > 0, "trade too small");
        require!(gold_out >= min_gold_out.0, "slippage");
        require!(gold_out < pool.reserve_gold.0, "insufficient gold reserve");

        pool.reserve_resource = U128(pool.reserve_resource.0 + units.0);
        pool.reserve_gold = U128(pool.reserve_gold.0 - gold_out);
        self.pools.insert(resource_id.clone(), pool.clone());

        let me = env::current_account_id();
        self.token.internal_transfer(&me, &seller, gold_out, Some("agentx sell".into()));

        agent.sell_nonce = voucher.nonce;
        agent.swaps += 1;
        agent.volume = U128(agent.volume.0 + gold_out);
        self.agents.insert(seller.clone(), agent);
        emit(
            "sell",
            json!({ "account_id": seller, "resource_id": resource_id, "units": units, "gold_out": U128(gold_out), "price_after": U128(spot_price(&pool)) }),
        );
        U128(gold_out)
    }

    /// Buy `units` of a resource with GGLD. The game server delivers the item after it sees the event.
    pub fn buy(&mut self, resource_id: String, units: U128, max_gold_in: U128) -> U128 {
        let buyer = env::predecessor_account_id();
        let mut agent = self.agents.get(&buyer).cloned().unwrap_or_else(|| env::panic_str("not a registered agent"));
        require!(units.0 > 0 && units.0 <= MAX_UNITS_PER_SWAP, "units: 1-10000");
        let mut pool = self.pools.get(&resource_id).cloned().unwrap_or_else(|| env::panic_str("pool not found"));
        require!(units.0 < pool.reserve_resource.0, "insufficient resource reserve");
        let gold_in = buy_quote(&pool, units.0);
        require!(gold_in <= max_gold_in.0, "slippage");
        require!(self.token.ft_balance_of(buyer.clone()).0 >= gold_in, "insufficient GGLD");

        let me = env::current_account_id();
        self.token.internal_transfer(&buyer, &me, gold_in, Some("agentx buy".into()));
        pool.reserve_gold = U128(pool.reserve_gold.0 + gold_in);
        pool.reserve_resource = U128(pool.reserve_resource.0 - units.0);
        self.pools.insert(resource_id.clone(), pool.clone());

        agent.swaps += 1;
        agent.volume = U128(agent.volume.0 + gold_in);
        self.agents.insert(buyer.clone(), agent);
        emit(
            "buy",
            json!({ "account_id": buyer, "resource_id": resource_id, "units": units, "gold_in": U128(gold_in), "price_after": U128(spot_price(&pool)) }),
        );
        U128(gold_in)
    }

    fn check_voucher(&self, seller: &AccountId, agent: &Agent, resource_id: &str, units: u128, v: &Voucher) {
        let now = env::block_timestamp_ms();
        require!(v.expires_at_ms >= now, "voucher expired");
        require!(v.expires_at_ms <= now + MAX_VOUCHER_TTL_MS, "voucher valid for too long");
        require!(v.nonce > agent.sell_nonce, "voucher already used");
        let sig: [u8; 64] = v.signature.0.as_slice().try_into().unwrap_or_else(|_| env::panic_str("bad signature length"));
        let pk: [u8; 32] = self.voucher_public_key.as_bytes()[1..].try_into().unwrap();
        let msg = voucher_message(&env::current_account_id(), seller, resource_id, units, v.nonce, v.expires_at_ms);
        require!(env::ed25519_verify(&sig, msg.as_bytes(), &pk), "invalid voucher");
    }

    // ── Views ────────────────────────────────────────────────────────────────

    fn view_pool(resource_id: String, p: &Pool) -> PoolView {
        PoolView { resource_id, reserve_resource: p.reserve_resource, reserve_gold: p.reserve_gold, price: U128(spot_price(p)) }
    }

    pub fn get_pools(&self) -> Vec<PoolView> {
        self.pools.iter().map(|(id, p)| Self::view_pool(id.clone(), p)).collect()
    }

    pub fn get_price(&self, resource_id: String) -> U128 {
        U128(self.pools.get(&resource_id).map(spot_price).unwrap_or(0))
    }

    pub fn preview_sell(&self, resource_id: String, units: U128) -> U128 {
        U128(self.pools.get(&resource_id).map(|p| sell_quote(p, units.0)).unwrap_or(0))
    }

    pub fn preview_buy(&self, resource_id: String, units: U128) -> U128 {
        U128(
            self.pools
                .get(&resource_id)
                .map(|p| if units.0 >= p.reserve_resource.0 { u128::MAX } else { buy_quote(p, units.0) })
                .unwrap_or(0),
        )
    }

    pub fn get_agent(&self, account_id: AccountId) -> Option<AgentView> {
        self.agents.get(&account_id).map(|a| AgentView {
            account_id: account_id.clone(),
            registered_at_ms: a.registered_at_ms,
            sell_nonce: a.sell_nonce,
            swaps: a.swaps,
            volume: a.volume,
            gold: self.token.ft_balance_of(account_id.clone()),
        })
    }

    /// Paginated registry of every agent that ever joined.
    pub fn get_agents(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<AgentView> {
        self.agents
            .keys()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .filter_map(|id| self.get_agent(id.clone()))
            .collect()
    }

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            owner_id: self.owner_id.clone(),
            voucher_public_key: self.voucher_public_key.clone(),
            agents: self.agents.len(),
            pools: self.pools.len(),
            fee_bps: ((FEE_DENOM - FEE_NUM) * 10) as u32,
            starting_gold: U128(STARTING_GOLD),
        }
    }
}

fn spot_price(p: &Pool) -> u128 {
    if p.reserve_resource.0 == 0 { 0 } else { p.reserve_gold.0 / p.reserve_resource.0 }
}

/// x·y = k with a 0.3% fee on the input side.
fn sell_quote(p: &Pool, units: u128) -> u128 {
    let in_with_fee = units * FEE_NUM;
    in_with_fee
        .checked_mul(p.reserve_gold.0)
        .unwrap_or_else(|| env::panic_str("overflow"))
        / (p.reserve_resource.0 * FEE_DENOM + in_with_fee)
}

fn buy_quote(p: &Pool, units: u128) -> u128 {
    p.reserve_gold.0
        .checked_mul(units)
        .and_then(|v| v.checked_mul(FEE_DENOM))
        .unwrap_or_else(|| env::panic_str("overflow"))
        / ((p.reserve_resource.0 - units) * FEE_NUM)
        + 1
}

// ── NEP-141 / NEP-145 / NEP-148 plumbing ────────────────────────────────────

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, _burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        used.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        #[allow(unused_variables)]
        if let Some((account_id, balance)) = self.token.internal_storage_unregister(force) {
            true
        } else {
            false
        }
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests;
