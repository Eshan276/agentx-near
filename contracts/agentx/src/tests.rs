use super::*;
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const NOW_MS: u64 = 1_800_000_000_000;

fn owner() -> AccountId {
    "agentx.testnet".parse().unwrap()
}
fn game() -> AccountId {
    "game.agentx.testnet".parse().unwrap()
}
fn ramu() -> AccountId {
    "ramu.agentx.testnet".parse().unwrap()
}

fn key() -> SigningKey {
    SigningKey::from_bytes(&[7u8; 32])
}

fn ctx(predecessor: &AccountId) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(game())
        .predecessor_account_id(predecessor.clone())
        .signer_account_id(predecessor.clone())
        .block_timestamp(NOW_MS * 1_000_000)
        .storage_usage(10_000)
        .account_balance(NearToken::from_near(10))
        .build());
}

fn setup() -> Contract {
    ctx(&owner());
    let pk: PublicKey = format!("ed25519:{}", bs58::encode(key().verifying_key().to_bytes()).into_string()).parse().unwrap();
    let mut c = Contract::new(owner(), pk);
    c.seed_pool("plank".into(), U128(1000), U128(200 * GOLD));
    c.register_agent(ramu());
    c
}

fn voucher(resource: &str, units: u128, nonce: u64, expires_at_ms: u64) -> Voucher {
    let msg = voucher_message(&game(), &ramu(), resource, units, nonce, expires_at_ms);
    Voucher { nonce, expires_at_ms, signature: Base64VecU8(key().sign(msg.as_bytes()).to_bytes().to_vec()) }
}

#[test]
fn register_grants_starting_gold_once() {
    let mut c = setup();
    assert_eq!(c.ft_balance_of(ramu()).0, STARTING_GOLD);
    c.register_agent(ramu());
    assert_eq!(c.ft_balance_of(ramu()).0, STARTING_GOLD, "second registration must not mint again");
    assert_eq!(c.get_config().agents, 1);
}

#[test]
fn seed_pool_sets_price_and_reserves() {
    let c = setup();
    assert_eq!(c.get_price("plank".into()).0, GOLD / 5); // 200 GGLD / 1000 planks
    assert_eq!(c.ft_balance_of(game()).0, 200 * GOLD);
    assert_eq!(c.ft_total_supply().0, 200 * GOLD + STARTING_GOLD);
}

#[test]
fn sell_with_voucher_pays_gold_from_reserves() {
    let mut c = setup();
    ctx(&ramu());
    let quote = c.preview_sell("plank".into(), U128(10)).0;
    let out = c.sell("plank".into(), U128(10), U128(quote), voucher("plank", 10, 1, NOW_MS + 60_000)).0;
    assert_eq!(out, quote);
    // x*y=k with fee: 10*997*200e18 / (1000*1000 + 9970)
    assert_eq!(out, 10 * 997 * 200 * GOLD / (1000 * 1000 + 10 * 997));
    assert_eq!(c.ft_balance_of(ramu()).0, STARTING_GOLD + out);
    assert_eq!(c.ft_balance_of(game()).0, 200 * GOLD - out);
    assert_eq!(c.ft_total_supply().0, 200 * GOLD + STARTING_GOLD, "selling moves gold, never mints it");
    let a = c.get_agent(ramu()).unwrap();
    assert_eq!((a.swaps, a.sell_nonce), (1, 1));
    assert!(c.get_price("plank".into()).0 < GOLD / 5, "selling pushes the price down");
}

#[test]
#[should_panic(expected = "voucher already used")]
fn voucher_cannot_be_replayed() {
    let mut c = setup();
    ctx(&ramu());
    let v = || voucher("plank", 5, 1, NOW_MS + 60_000);
    c.sell("plank".into(), U128(5), U128(0), v());
    c.sell("plank".into(), U128(5), U128(0), v());
}

#[test]
#[should_panic(expected = "invalid voucher")]
fn voucher_is_bound_to_the_amount() {
    let mut c = setup();
    ctx(&ramu());
    c.sell("plank".into(), U128(500), U128(0), voucher("plank", 5, 1, NOW_MS + 60_000));
}

#[test]
#[should_panic(expected = "invalid voucher")]
fn voucher_from_another_key_is_rejected() {
    let mut c = setup();
    ctx(&ramu());
    let msg = voucher_message(&game(), &ramu(), "plank", 5, 1, NOW_MS + 60_000);
    let forged = SigningKey::from_bytes(&[9u8; 32]).sign(msg.as_bytes()).to_bytes().to_vec();
    c.sell("plank".into(), U128(5), U128(0), Voucher { nonce: 1, expires_at_ms: NOW_MS + 60_000, signature: Base64VecU8(forged) });
}

#[test]
#[should_panic(expected = "voucher expired")]
fn expired_voucher_is_rejected() {
    let mut c = setup();
    ctx(&ramu());
    c.sell("plank".into(), U128(5), U128(0), voucher("plank", 5, 1, NOW_MS - 1));
}

#[test]
#[should_panic(expected = "not a registered agent")]
fn unregistered_accounts_cannot_trade() {
    let mut c = setup();
    let stranger: AccountId = "mallory.testnet".parse().unwrap();
    ctx(&stranger);
    c.buy("plank".into(), U128(1), U128(u128::MAX));
}

#[test]
#[should_panic(expected = "slippage")]
fn sell_respects_min_out() {
    let mut c = setup();
    ctx(&ramu());
    c.sell("plank".into(), U128(10), U128(100 * GOLD), voucher("plank", 10, 1, NOW_MS + 60_000));
}

#[test]
fn buy_burns_nothing_and_moves_gold_to_reserves() {
    let mut c = setup();
    ctx(&ramu());
    let quote = c.preview_buy("plank".into(), U128(10)).0;
    let paid = c.buy("plank".into(), U128(10), U128(quote)).0;
    assert_eq!(paid, quote);
    assert_eq!(c.ft_balance_of(ramu()).0, STARTING_GOLD - paid);
    assert_eq!(c.ft_balance_of(game()).0, 200 * GOLD + paid);
    assert_eq!(c.get_pools()[0].reserve_resource.0, 990);
    assert!(c.get_price("plank".into()).0 > GOLD / 5, "buying pushes the price up");
}

#[test]
#[should_panic(expected = "insufficient GGLD")]
fn buy_needs_enough_gold() {
    let mut c = setup();
    ctx(&ramu());
    c.buy("plank".into(), U128(900), U128(u128::MAX));
}

#[test]
#[should_panic(expected = "owner only")]
fn only_owner_registers_agents() {
    let mut c = setup();
    ctx(&ramu());
    c.register_agent("someone.testnet".parse().unwrap());
}
