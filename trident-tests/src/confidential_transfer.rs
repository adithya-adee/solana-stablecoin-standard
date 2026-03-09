//! Fuzz: Confidential Transfer (SSS-3) transitions.
//!
//! Models the homomorphic balance states of confidential token accounts:
//! 1. **Public Balance**: Standard Token-2022 balance.
//! 2. **Available Confidential**: Encrypted balance ready for transfer/withdraw.
//! 3. **Pending Confidential**: Encrypted balance from recent deposits/transfers,
//!    waiting for `ApplyPendingBalance`.
//!
//! Invariants:
//! - Σ(Public + Available + Pending) == Constant (modulo mint/burn).
//! - Available balance cannot be negative.
//! - Withdrawals/Transfers fail if they exceed Available.

use proptest::prelude::*;

#[derive(Debug, Clone, Default)]
struct ConfidentialAccount {
    pub_balance: u64,
    available: u64,
    pending: u64,
    configured: bool,
}

#[derive(Debug, Clone)]
enum ConfidentialOp {
    Configure(usize),
    Deposit(usize, u64),
    ApplyPending(usize),
    Transfer(usize, usize, u64), // from, to, amount
    Withdraw(usize, u64),
}

fn confidential_op_strategy() -> impl Strategy<Value = ConfidentialOp> {
    prop_oneof![
        (0usize..2).prop_map(ConfidentialOp::Configure),
        (0usize..2, 1u64..=1_000_000u64).prop_map(|(i, a)| ConfidentialOp::Deposit(i, a)),
        (0usize..2).prop_map(ConfidentialOp::ApplyPending),
        (0usize..2, 0usize..2, 1u64..=100_000u64).prop_map(|(f, t, a)| ConfidentialOp::Transfer(f, t, a)),
        (0usize..2, 1u64..=100_000u64).prop_map(|(i, a)| ConfidentialOp::Withdraw(i, a)),
    ]
}

proptest! {
    #[test]
    fn confidential_state_transitions(
        ops in proptest::collection::vec(confidential_op_strategy(), 1..100),
    ) {
        let mut accounts = vec![
            ConfidentialAccount { pub_balance: 1_000_000, available: 0, pending: 0, configured: false },
            ConfidentialAccount { pub_balance: 1_000_000, available: 0, pending: 0, configured: false },
        ];

        for op in ops {
            match op {
                ConfidentialOp::Configure(i) => {
                    accounts[i].configured = true;
                }
                ConfidentialOp::Deposit(i, amount) => {
                    if accounts[i].pub_balance >= amount && accounts[i].configured {
                        accounts[i].pub_balance -= amount;
                        accounts[i].pending += amount;
                    }
                }
                ConfidentialOp::ApplyPending(i) => {
                    if accounts[i].configured {
                        accounts[i].available += accounts[i].pending;
                        accounts[i].pending = 0;
                    }
                }
                ConfidentialOp::Transfer(f, t, amount) => {
                    if f != t && accounts[f].available >= amount && accounts[f].configured && accounts[t].configured {
                        accounts[f].available -= amount;
                        accounts[t].pending += amount;
                    }
                }
                ConfidentialOp::Withdraw(i, amount) => {
                    if accounts[i].available >= amount && accounts[i].configured {
                        accounts[i].available -= amount;
                        accounts[i].pub_balance += amount;
                    }
                }
            }

            // Invariant: Total balance across all states and accounts is conserved
            let total: u64 = accounts.iter().map(|a| a.pub_balance + a.available + a.pending).sum();
            prop_assert_eq!(total, 2_000_000, "Balance leaked or created (total={})", total);
        }
    }
}
