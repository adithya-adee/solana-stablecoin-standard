#![allow(dead_code, unused_imports)]
//! Property-based fuzz tests for SSS programs.
//!
//! These tests use `proptest` to generate random instruction sequences and
//! verify that critical invariants hold regardless of input:
//!
//! 1. **Role escalation**: Random grant/revoke sequences cannot produce
//!    unauthorized role assignments.
//! 2. **Supply cap overflow**: Random mint/burn sequences cannot exceed
//!    the configured supply cap or cause arithmetic overflow.
//! 3. **Pause bypass**: Operations always fail when the protocol is paused.
//! 4. **Arithmetic overflow**: Large amounts cannot cause u64 overflow in
//!    total_minted or total_burned counters.
//! 5. **Blacklist invariants**: Blacklisted addresses remain blacklisted
//!    until explicitly removed.
//!
//! **Audit-driven additions (security fixes):**
//!
//! 6. **Oracle feed guard (C-1)**: Oracle minting requires a pinned feed ID;
//!    wildcard/zero IDs and wrong IDs are rejected.
//! 7. **Pause-role guard (H-2)**: Non-Admin role grants/revokes are blocked
//!    while the token is paused; Admin ops always remain available.
//! 8. **Burn audit trail (C-2)**: `TokensBurned` events always carry the
//!    token account owner (`from_owner`) so privileged burns are detectable.
//!
//! For on-chain fuzz testing with Trident (honggfuzz), see `trident-tests/fuzz_0/`.

mod arithmetic;
mod burn_audit;
mod confidential_transfer;
mod invariants;
mod oracle_feed;
mod pause_bypass;
mod pause_roles;
mod role_escalation;
mod supply_cap;
