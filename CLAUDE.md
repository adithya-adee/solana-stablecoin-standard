# SSS -- Solana Stablecoin Standard

## Quick Reference

- **Anchor programs:** `sss-programs/sss-core/`, `sss-programs/sss-transfer-hook/`
- **TypeScript SDK:** `solana-stablecoin-sdk/` (pnpm workspace: `@stbr/sss-token`)
- **TypeScript CLI:** `solana-stablecoin-cli/` (Ink/React CLI, formerly Rust CLI & TUI)
- **Backend:** `solana-stablecoin-backend/` (Express/Fastify)
- **Frontend:** `solana-stablecoin-frontend/` (Next.js 15)
- **Integration tests:** `tests/`
- **Fuzz tests:** `trident-tests/`

## Architecture

Two Anchor programs composed by SDK into 3 presets:

- SSS-1 (minimal): sss-core only
- SSS-2 (compliant): sss-core + sss-transfer-hook
- SSS-3 (private): sss-core + Token-2022 ConfidentialTransfer (no hook -- incompatible)

## Build & Test

- `anchor build` -- build programs
- `anchor test` -- integration tests
- `pnpm test:sdk` -- SDK unit tests
- `cargo test` -- Rust unit & Fuzz tests (in `trident-tests/`)
- `cd solana-stablecoin-cli && npm run dev -- --help` -- Run CLI

## Key Design Decisions & Recent Updates

- Presets are SDK-level, not program-level
- Transfer hooks + confidential transfers are INCOMPATIBLE
- SSS-3 uses auditor key for compliance instead of hooks
- Role-based access: admin(0), minter(1), freezer(2), pauser(3), burner(4), blacklister(5), seizer(6) — PDA per role per address
- Per-minter quotas: `mint_quota: Option<u64>`, `amount_minted: u64` on RoleAccount (ROLE_SPACE=131)
- **Directory Structure:** Refactored to explicit prefixes (`solana-stablecoin-xxx`). The old `cli/` and `tui/` have been fully deprecated and removed.
- **CLI Framework:** Built using `Ink` (React for CLI) and replacing old Rust TUI/CLI. Includes custom theming, improved error messages, and robust Devnet RPC handling (using `getTokenLargestAccounts` to avoid missing secondary index issues). Also features event-driven `audit-log` parsing with Anchor `EventParser`.
- **Trident Tests:** Robust on-chain fuzz testing suite simulating supply caps, strict role escalation across all 7 roles, and specific pause bypass scenarios (e.g. verifying `Seize` operations remain active even when the token is paused, while `Thaw` correctly fails).

## PDA Seeds

- StablecoinConfig: `["sss-config", mint.key()]`
- RoleAccount: `["sss-role", config.key(), address.key(), role_u8]`
- BlacklistEntry: `["blacklist", mint.key(), address.key()]`
- ExtraAccountMetas: `["extra-account-metas", mint.key()]`

## Program IDs

- sss-core: `SSSCFmmtaU1oToJ9eMqzTtPbK9EAyoXdivUG4irBHVP`
- sss-transfer-hook: `HookFvKFaoF9KL8TUXUnQK5r2mJoMYdBENu549seRyXW`
