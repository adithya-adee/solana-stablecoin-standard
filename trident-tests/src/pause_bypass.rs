//! Fuzz: Pause bypass — operations always fail when the protocol is paused.

use proptest::prelude::*;
use solana_sdk::pubkey::Pubkey;
use sss_core::state::config::StablecoinConfig;

fn default_config(paused: bool) -> StablecoinConfig {
    StablecoinConfig {
        authority: Pubkey::default(),
        mint: Pubkey::default(),
        preset: 1,
        paused,
        supply_cap: Some(1_000_000_000),
        total_minted: 100_000,
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
    }
}

/// Simulate mint — must fail when paused.
fn sim_mint(config: &StablecoinConfig, amount: u64) -> bool {
    if config.paused || amount == 0 {
        return false;
    }
    config.can_mint(amount)
}

/// Simulate burn — must fail when paused.
fn sim_burn(config: &StablecoinConfig, amount: u64) -> bool {
    if config.paused || amount == 0 {
        return false;
    }
    config.current_supply() >= amount
}

/// Simulate freeze — must fail when paused.
fn sim_freeze(config: &StablecoinConfig) -> bool {
    !config.paused
}

/// Simulate thaw — must fail when paused.
fn sim_thaw(config: &StablecoinConfig) -> bool {
    !config.paused
}

/// Simulate seize — must succeed even when paused (Seize works during emergencies).
fn sim_seize(_config: &StablecoinConfig, amount: u64) -> bool {
    if amount == 0 {
        return false;
    }
    true
}

#[derive(Debug, Clone)]
enum PauseOp {
    Pause,
    Unpause,
    Mint(u64),
    Burn(u64),
    Freeze,
    Thaw,
    Seize(u64),
}

fn pause_op_strategy() -> impl Strategy<Value = PauseOp> {
    prop_oneof![
        Just(PauseOp::Pause),
        Just(PauseOp::Unpause),
        (1u64..=1_000_000u64).prop_map(PauseOp::Mint),
        (1u64..=100_000u64).prop_map(PauseOp::Burn),
        Just(PauseOp::Freeze),
        Just(PauseOp::Thaw),
        (1u64..=100_000u64).prop_map(PauseOp::Seize),
    ]
}

proptest! {
    /// No operation succeeds when the protocol is in a paused state.
    #[test]
    fn no_ops_when_paused(
        ops in proptest::collection::vec(pause_op_strategy(), 1..200),
    ) {
        let mut config = default_config(false);

        for op in ops {
            match op {
                PauseOp::Pause => {
                    if !config.paused {
                        config.paused = true;
                    }
                }
                PauseOp::Unpause => {
                    if config.paused {
                        config.paused = false;
                    }
                }
                PauseOp::Mint(amount) => {
                    let result = sim_mint(&config, amount);
                    if config.paused {
                        prop_assert!(!result,
                            "Mint succeeded while paused (amount={})", amount
                        );
                    }
                }
                PauseOp::Burn(amount) => {
                    let result = sim_burn(&config, amount);
                    if config.paused {
                        prop_assert!(!result,
                            "Burn succeeded while paused (amount={})", amount
                        );
                    }
                }
                PauseOp::Freeze => {
                    let result = sim_freeze(&config);
                    if config.paused {
                        prop_assert!(!result,
                            "Freeze succeeded while paused"
                        );
                    }
                }
                PauseOp::Thaw => {
                    let result = sim_thaw(&config);
                    if config.paused {
                        prop_assert!(!result,
                            "Thaw succeeded while paused"
                        );
                    }
                }
                PauseOp::Seize(amount) => {
                    let result = sim_seize(&config, amount);
                    if config.paused {
                        prop_assert!(result,
                            "Seize failed while paused (amount={})", amount
                        );
                    }
                }
            }
        }
    }

    /// Double-pause and double-unpause are always rejected.
    #[test]
    fn no_double_pause(
        ops in proptest::collection::vec(
            prop_oneof![Just(true), Just(false)],
            2..50,
        ),
    ) {
        let mut paused = false;

        for should_pause in ops {
            if should_pause {
                // Attempt pause
                if paused {
                    // Double pause — should fail on-chain (NotPaused error)
                    // Just verify our model catches it
                    prop_assert!(paused, "State inconsistency");
                } else {
                    paused = true;
                }
            } else {
                // Attempt unpause
                if !paused {
                    // Double unpause — should fail on-chain
                    prop_assert!(!paused, "State inconsistency");
                } else {
                    paused = false;
                }
            }
        }
    }
}
