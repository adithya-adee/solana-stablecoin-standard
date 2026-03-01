# CLI Enhancement TODO

## Phase 1: UX Polish
- [x] 1.1 Global Mint Context via `SSS_MINT` env var (modify `cli.tsx`, `.env` support)
- [x] 1.2 Positional Arguments Support (update commander definitions)
- [x] 1.3 Explorer Links in Success Output (`formatExplorerUrl` in utils, use in `Success` component)
- [x] 1.4 `.sss-config.json` Context File (`init` writes it, commands auto-discover)

## Phase 2: Missing Commands
- [x] 2.1 `minters` Sub-command Group (`list`, `add`, `remove`)
- [x] 2.2 `holders` Command (scan RPC, parse balances, filter/sort)
- [x] 2.3 `audit-log` Command (parse transaction logs, filter by action)

## Phase 3: TOML Config Support
- [x] 3.1 Custom Config File Parsing (add `smol-toml` dep, parse in `init.tsx`)

## Phase 4: UI Enhancements
- [x] 4.1 Confirmation Spinner with Block Count
- [x] 4.2 Color-Coded Badges for Presets
- [x] 4.3 Help Improvements (examples in command descriptions, `examples` command)
