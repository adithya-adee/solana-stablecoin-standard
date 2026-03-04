# Solana Stablecoin Standard — Security Audit Summary (2026-03-04)

## Scope
- Programs: `sss-core`, `sss-transfer-hook`
- SDK, CLI, and all on-chain logic
- Fuzz/property tests (`trident-tests/`)
- Integration tests (`tests/`)

## Key Findings & Fixes

### CRITICAL/HIGH
- **C-1: Oracle feed ID wildcard** — Now requires a pinned feed ID in config; wildcards/zero IDs and mismatches are rejected.  
  _Tested: property tests, integration (oracle.test.ts)_
- **C-2: Burn authority scope** — `TokensBurned` event now always emits `from_owner` for auditability.  
  _Tested: property tests, integration (security.test.ts)_
- **H-1: SSS-2 seize fails** — CPI now forwards remaining accounts for transfer hook compatibility.  
  _Tested: integration (sss-2.test.ts)_
- **H-2: Pause check on roles** — Non-admin role ops blocked when paused; admin ops always allowed.  
  _Tested: property tests, integration (roles.test.ts)_
- **H-4: update_minter PDA seeds** — Explicit PDA seed validation for minter role.  
  _Tested: integration (roles.test.ts)_
- **H-5: Blacklist events** — Blacklist add/remove now emit compliance events.  
  _Tested: integration (transfer-hook.test.ts)_
- **M-4: Sender blacklist owner fix** — Blacklist now uses token account owner, not authority/delegate.  
  _Tested: property tests, integration (transfer-hook.test.ts)_

### MEDIUM/LOW
- **Oracle staleness** — Oracle price must be <2min old (enforced via `get_price_no_older_than`).  
  _Tested: property tests, integration (oracle.test.ts)_
- **can_mint(0)** — Zero-amount mints now always rejected.  
  _Tested: unit test, integration (sss-1.test.ts)_

## Test Coverage
- **Property-based fuzzing:** All critical invariants and audit fixes covered in `trident-tests/` (proptest)
- **Integration tests:** All instruction paths and edge cases in `tests/` (TypeScript, Anchor)
- **Unit tests:** Rust unit tests for config, arithmetic, and error handling

## Verification
- All tests pass: `cargo test`, `anchor test`, `pnpm test:sdk`
- All audit findings are fixed, tested, and committed

---
_Audit by: Claude Opus 4.6