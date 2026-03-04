//! Fuzz: Pause guard on role operations (H-2 fix) — when the token is paused,
//! non-Admin role grants and revokes must be rejected.  Admin-role operations
//! must remain functional so responders can recover the token.
//!
//! Properties:
//!
//! 1. Non-admin grant is blocked when paused.
//! 2. Non-admin revoke is blocked when paused.
//! 3. Admin grant/revoke always succeeds when performed by a valid admin,
//!    regardless of the paused state.
//! 4. Unpausing re-enables non-admin role operations.

use proptest::prelude::*;
use solana_sdk::pubkey::Pubkey;
use sss_core::state::{config::StablecoinConfig, role::Role};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn make_config(paused: bool) -> StablecoinConfig {
    StablecoinConfig {
        authority: Pubkey::default(),
        mint: Pubkey::default(),
        preset: 1,
        paused,
        supply_cap: None,
        total_minted: 0,
        total_burned: 0,
        bump: 0,
        name: String::new(),
        symbol: String::new(),
        uri: String::new(),
        decimals: 6,
        enable_permanent_delegate: false,
        enable_transfer_hook: false,
        default_account_frozen: false,
        admin_count: 1,
        oracle_feed_id: None,
    }
}

/// Role indices as u8 to derive `Role` from fuzzer-generated integers.
fn role_from_u8(n: u8) -> Role {
    match n % 7 {
        0 => Role::Admin,
        1 => Role::Minter,
        2 => Role::Freezer,
        3 => Role::Pauser,
        4 => Role::Burner,
        5 => Role::Blacklister,
        _ => Role::Seizer,
    }
}

/// Simulates the pause guard from `manage_roles::handler_grant` (H-2 fix).
///
/// Returns true when the operation would be allowed on-chain.
fn simulated_grant(config: &StablecoinConfig, role: Role) -> bool {
    if config.paused && !matches!(role, Role::Admin) {
        return false; // Blocked — H-2 guard
    }
    true // All other pre-conditions assumed satisfied for this simulation
}

/// Simulates the pause guard from `manage_roles::handler_revoke` (H-2 fix).
fn simulated_revoke(config: &StablecoinConfig, role: Role) -> bool {
    if config.paused && !matches!(role, Role::Admin) {
        return false; // Blocked — H-2 guard
    }
    true
}

// ---------------------------------------------------------------------------
// Proptest strategies
// ---------------------------------------------------------------------------

/// Non-admin role (indices 1–6).
fn arb_non_admin_role() -> impl Strategy<Value = Role> {
    (1u8..7u8).prop_map(role_from_u8)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

proptest! {
    /// **H-2 / property 1**: Any non-Admin grant is blocked when the token is
    /// paused.
    #[test]
    fn non_admin_grant_blocked_when_paused(
        role_idx in 1u8..7u8,
    ) {
        let paused_config = make_config(true);
        let role = role_from_u8(role_idx);
        prop_assert!(
            !simulated_grant(&paused_config, role),
            "Non-admin grant must be blocked when paused (role: {:?})",
            role
        );
    }

    /// **H-2 / property 2**: Any non-Admin revoke is blocked when paused.
    #[test]
    fn non_admin_revoke_blocked_when_paused(
        role_idx in 1u8..7u8,
    ) {
        let paused_config = make_config(true);
        let role = role_from_u8(role_idx);
        prop_assert!(
            !simulated_revoke(&paused_config, role),
            "Non-admin revoke must be blocked when paused (role: {:?})",
            role
        );
    }

    /// **H-2 / property 3**: Admin grant always passes the pause guard,
    /// regardless of the paused state.
    #[test]
    fn admin_grant_always_allowed_regardless_of_pause(paused in any::<bool>()) {
        let config = make_config(paused);
        prop_assert!(
            simulated_grant(&config, Role::Admin),
            "Admin grant must never be blocked by the pause guard"
        );
    }

    /// **H-2 / property 4**: Admin revoke always passes the pause guard.
    #[test]
    fn admin_revoke_always_allowed_regardless_of_pause(paused in any::<bool>()) {
        let config = make_config(paused);
        prop_assert!(
            simulated_revoke(&config, Role::Admin),
            "Admin revoke must never be blocked by the pause guard"
        );
    }

    /// **H-2 / property 5**: Unpausing re-enables all role operations.
    /// Confirms that the guard is purely a `config.paused` check and does not
    /// permanently disable operations.
    #[test]
    fn non_admin_ops_re_enabled_after_unpause(
        role_idx in 1u8..7u8,
    ) {
        let mut config = make_config(true);
        let role = role_from_u8(role_idx);

        // Blocked while paused.
        prop_assert!(!simulated_grant(&config, role));
        prop_assert!(!simulated_revoke(&config, role));

        // Unpause.
        config.paused = false;

        // Now allowed.
        prop_assert!(
            simulated_grant(&config, role),
            "Grant must be allowed after unpause (role: {:?})",
            role
        );
        prop_assert!(
            simulated_revoke(&config, role),
            "Revoke must be allowed after unpause (role: {:?})",
            role
        );
    }

    /// **H-2 / property 6**: Randomly interleaved pause/role-op sequences
    /// always respect the invariant — if paused at the time of the call, all
    /// non-admin ops fail; if unpaused, they succeed.
    #[test]
    fn pause_state_at_call_time_governs_result(
        ops in prop::collection::vec((any::<bool>(), 1u8..7u8), 1..50),
    ) {
        for (paused, role_idx) in ops {
            let config = make_config(paused);
            let role = role_from_u8(role_idx);
            let expected_allowed = !paused;

            prop_assert_eq!(
                simulated_grant(&config, role),
                expected_allowed,
                "Grant result mismatch: paused={}, role={:?}",
                paused,
                role
            );
            prop_assert_eq!(
                simulated_revoke(&config, role),
                expected_allowed,
                "Revoke result mismatch: paused={}, role={:?}",
                paused,
                role
            );
        }
    }
}
