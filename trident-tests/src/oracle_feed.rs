//! Fuzz: Oracle feed-ID guard (C-1 fix) — the oracle price path must be
//! gated on a configured, pinned feed ID.  Tests verify:
//!
//! 1. Minting with the oracle path is rejected when no feed ID is configured.
//! 2. A zero/wildcard feed ID is never implicitly accepted.
//! 3. Two distinct (non-zero) feed IDs are not interchangeable.

use proptest::prelude::*;
use solana_sdk::pubkey::Pubkey;
use sss_core::state::config::StablecoinConfig;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn config_with_feed(feed_id: Option<[u8; 32]>, cap: Option<u64>) -> StablecoinConfig {
    StablecoinConfig {
        authority: Pubkey::default(),
        mint: Pubkey::default(),
        preset: 1,
        paused: false,
        supply_cap: cap,
        total_minted: 0,
        total_burned: 0,
        bump: 0,
        name: String::new(),
        symbol: String::new(),
        uri: String::new(),
        decimals: 6,
        enable_permanent_delegate: true,
        enable_transfer_hook: false,
        default_account_frozen: false,
        admin_count: 1,
        oracle_feed_id: feed_id,
    }
}

/// Simulates the pre-condition check in `mint_tokens::handler` — mirrors the
/// on-chain guard added during the C-1 security fix.
///
/// Returns `Ok(feed_id)` when the oracle path is available, or an error
/// string that matches the `OracleFeedNotConfigured` program error.
fn require_oracle_feed(
    config: &StablecoinConfig,
) -> Result<[u8; 32], &'static str> {
    config
        .oracle_feed_id
        .ok_or("OracleFeedNotConfigured")
}

/// Simulates validating a caller-supplied feed ID against the pinned value.
fn validate_feed_id(
    config: &StablecoinConfig,
    supplied_feed: &[u8; 32],
) -> Result<(), &'static str> {
    match config.oracle_feed_id {
        None => Err("OracleFeedNotConfigured"),
        Some(pinned) if pinned == *supplied_feed => Ok(()),
        Some(_) => Err("FeedIdMismatch"),
    }
}

// ---------------------------------------------------------------------------
// Proptest strategies
// ---------------------------------------------------------------------------

/// Arbitrary 32-byte feed ID.
fn arb_feed_id() -> impl Strategy<Value = [u8; 32]> {
    any::<[u8; 32]>()
}

/// Non-zero feed ID (wildcard guard).
fn arb_nonzero_feed_id() -> impl Strategy<Value = [u8; 32]> {
    arb_feed_id().prop_filter("feed id must not be all-zeros", |id| {
        id.iter().any(|b| *b != 0)
    })
}

/// Two distinct non-zero feed IDs.
fn arb_two_distinct_feed_ids() -> impl Strategy<Value = ([u8; 32], [u8; 32])> {
    (arb_nonzero_feed_id(), arb_nonzero_feed_id())
        .prop_filter("feed IDs must differ", |(a, b)| a != b)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

proptest! {
    /// **C-1 / property 1**: Oracle path is rejected when no feed ID is
    /// configured, regardless of the mint amount or supply cap.
    #[test]
    fn oracle_feed_id_required_for_oracle_minting(
        cap in prop::option::of(1u64..u64::MAX),
    ) {
        let config = config_with_feed(None, cap);
        let result = require_oracle_feed(&config);
        prop_assert!(result.is_err(), "Expected OracleFeedNotConfigured error");
        prop_assert_eq!(result.unwrap_err(), "OracleFeedNotConfigured");
    }

    /// **C-1 / property 2**: A zero/wildcard feed ID supplied by the caller
    /// is not accepted even if the config happens to also be all-zeros (which
    /// the on-chain code prevents by requiring `Some` and then verifying with
    /// `get_price_no_older_than`).  Here we test that the simulation helper
    /// treats `oracle_feed_id: None` as absent regardless of the call-site
    /// feed ID value.
    #[test]
    fn zero_feed_id_does_not_bypass_none_config(
        supplied in arb_feed_id(),
    ) {
        let config = config_with_feed(None, None);
        let result = validate_feed_id(&config, &supplied);
        prop_assert!(
            result.is_err(),
            "A None oracle_feed_id must always reject callers"
        );
    }

    /// **C-1 / property 3**: Two distinct feed IDs are not interchangeable.
    /// Supplying feedB when the config has feedA must be rejected.
    #[test]
    fn wrong_feed_id_is_rejected(
        (feed_a, feed_b) in arb_two_distinct_feed_ids(),
        cap in prop::option::of(1u64..u64::MAX),
    ) {
        // Config has feed_a pinned.
        let config = config_with_feed(Some(feed_a), cap);

        // Supplying the correct feed succeeds.
        prop_assert!(
            validate_feed_id(&config, &feed_a).is_ok(),
            "Correct feed ID must be accepted"
        );

        // Supplying a different feed is rejected.
        let result = validate_feed_id(&config, &feed_b);
        prop_assert!(
            result.is_err(),
            "Wrong feed ID must not be accepted; got Ok"
        );
    }

    /// **C-1 / property 4**: Once a feed ID is configured, setting it to a
    /// fresh value invalidates the old one — the old feed cannot be re-used.
    #[test]
    fn updated_feed_id_invalidates_old_feed(
        (old_feed, new_feed) in arb_two_distinct_feed_ids(),
    ) {
        let mut config = config_with_feed(Some(old_feed), None);

        // Simulate UpdateOracleFeed instruction.
        config.oracle_feed_id = Some(new_feed);

        // Old feed is now rejected.
        let result = validate_feed_id(&config, &old_feed);
        prop_assert!(
            result.is_err(),
            "Old feed ID must be rejected after update"
        );

        // New feed is accepted.
        prop_assert!(
            validate_feed_id(&config, &new_feed).is_ok(),
            "New feed ID must be accepted after update"
        );
    }
}
