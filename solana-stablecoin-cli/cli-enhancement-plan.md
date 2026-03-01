# CLI Enhancement Plan — Matching Full Admin CLI Spec

## Current State Audit

### ✅ Already Implemented & Working
| Requirement | CLI Command | Status |
|---|---|---|
| `sss-token init --preset sss-1/2/3` | `init -p sss-1 -n NAME -s SYM` | ✅ Working, supports presets & JSON config |
| `sss-token mint <recipient> <amount>` | `mint -m MINT -r ADDR -a AMT` | ✅ Working |
| `sss-token burn <amount>` | `burn -m MINT -a AMT` | ✅ Working |
| `sss-token freeze <address>` | `freeze -m MINT -a ADDR` | ✅ Working |
| `sss-token thaw <address>` | `thaw -m MINT -a ADDR` | ✅ Working |
| `sss-token pause / unpause` | `pause -m MINT` / `unpause -m MINT` | ✅ Working |
| `sss-token status` | `status -m MINT` | ✅ Working (rich table UI) |
| `sss-token supply` | `supply -m MINT` | ✅ Working (supply overview card) |
| `sss-token blacklist add` | `blacklist add -m MINT -a ADDR --reason` | ✅ Working |
| `sss-token blacklist remove` | `blacklist remove -m MINT -a ADDR` | ✅ Working |
| `sss-token blacklist check` | `blacklist check -m MINT -a ADDR` | ✅ Working |
| `sss-token seize` | `seize -m MINT -f FROM -t TO -a AMT` | ✅ Working (SSS-1 only; SSS-2 known limitation) |
| `sss-token roles grant` | `roles grant -m MINT -a ADDR -r ROLE` | ✅ Working |
| `sss-token roles revoke` | `roles revoke -m MINT -a ADDR -r ROLE` | ✅ Working |
| `sss-token roles list` | `roles list -m MINT -a ADDR` | ✅ Working (checks all 7 roles) |

### ❌ Missing Commands (from the spec)
| Requirement | Notes |
|---|---|
| `sss-token init --custom config.toml` | Partially done — supports JSON but not TOML |
| `sss-token minters list / add / remove` | Not implemented. Needs new `minters` sub-command group |
| `sss-token holders [--min-balance <amount>]` | Not implemented. Requires RPC `getProgramAccounts` scan |
| `sss-token audit-log [--action <type>]` | Not implemented. Requires on-chain log parsing or indexer |

### 🔧 UX Gaps
| Issue | Description |
|---|---|
| Positional args vs flags | Spec uses `sss-token mint <recipient> <amount>` but CLI uses flags `-r`, `-a`. Need to support both. |
| Global `--mint` context | Every command requires `-m MINT`. Could add env var `SSS_MINT` or config file. |
| Explorer links | Success results show raw tx sig but no clickable explorer link. |
| Tx confirmation feedback | No progress bar or block confirmation indicator. |

---

## Implementation Plan

### Phase 1: UX Polish (Priority: HIGH, Effort: Small)

#### 1.1 Global Mint Context via `SSS_MINT` env var
- Modify `cli.tsx` to read fallback `SSS_MINT` env var when `--mint` is not provided
- Update all commands to use `options.mint || process.env.SSS_MINT`
- Add `.env` support via `dotenv` (already a workspace dep)

#### 1.2 Positional Arguments Support
- Update Commander definitions to accept positional args alongside flags
- Example: `sss-token mint <recipient> <amount>` AND `sss-token mint -r ADDR -a AMT`
- Commander supports `.argument('<recipient>', 'desc')` natively

#### 1.3 Explorer Links in Success Output
- Add a `formatExplorerUrl(sig: string, cluster: string)` helper in `utils/config.ts`
- Update `Success` component to render clickable Solana Explorer link
- Read cluster from env `SOLANA_CLUSTER` (devnet/mainnet)

#### 1.4 `.sss-config.json` Context File
- `sss-token init` should write a `.sss-config.json` with `{ mint, preset, cluster }` to CWD
- All commands auto-discover this file if `--mint` is not given
- Enables zero-flag workflows for repeat usage

---

### Phase 2: Missing Commands (Priority: HIGH, Effort: Medium)

#### 2.1 `minters` Sub-command Group
Create `src/commands/minters.tsx` with three sub-commands:

```
sss-token minters list -m MINT       → lists all addresses with minter role
sss-token minters add -m MINT -a ADDR   → grants minter role (alias for roles grant -r minter)
sss-token minters remove -m MINT -a ADDR → revokes minter role
```

**Implementation:**
- `list` — Use `connection.getProgramAccounts()` with memcmp filters on role PDA accounts where `role = ROLE_MINTER`
- `add` / `remove` — Thin wrappers around `sss.roles.grant(addr, roleType('minter'))` and `sss.roles.revoke(addr, roleType('minter'))`
- These are convenience aliases; the underlying SDK calls are already available
- Ink UI: render a table of minter addresses with their PDA addresses

#### 2.2 `holders` Command
Create `src/commands/holders.tsx`:

```
sss-token holders -m MINT [--min-balance 100]
```

**Implementation:**
- Use `connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: mintAddress } }] })` to find all token accounts for this mint
- Parse each account's balance using `AccountLayout` from `@solana/spl-token`
- Filter by `--min-balance` if provided
- Sort by balance descending
- Ink UI: Table with columns: `Wallet`, `Balance`, `Frozen?`
- Cap display at 50 holders with a note about total count

#### 2.3 `audit-log` Command
Create `src/commands/audit-log.tsx`:

```
sss-token audit-log -m MINT [--action mint|burn|freeze|seize|pause|blacklist] [--limit 20]
```

**Implementation:**
- Use `connection.getSignaturesForAddress(configPda)` to get recent transaction signatures
- For each signature, fetch the transaction and parse program logs
- Filter by instruction discriminator (action type) if `--action` is provided
- Display: timestamp, action type, actor, amount (if applicable), tx sig
- Ink UI: scrollable table with color-coded action badges
- Default limit: 20 recent events

---

### Phase 3: TOML Config Support (Priority: MEDIUM, Effort: Small)

#### 3.1 Custom Config File Parsing
- Add `toml` npm package as a dependency
- Update `init.tsx` to detect `.toml` extension and parse accordingly
- Support both `config.toml` and `config.json`

**TOML example (`stablecoin.toml`):**
```toml
[stablecoin]
name = "My Stablecoin"
symbol = "MUSD"
preset = "sss-2"
decimals = 6
supply_cap = 1000000000

[oracle]
feed = "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD"
max_age = 300

[compliance]
enable_blacklist = true
enable_seize = true
```

---

### Phase 4: UI Enhancements (Priority: MEDIUM, Effort: Small)

#### 4.1 Confirmation Spinner with Block Count
- After sending tx, show a "Confirming... (1/3 confirmations)" progress
- Use `connection.onSignature()` or poll `getSignatureStatuses()`

#### 4.2 Color-Coded Badges for Presets
- SSS-1: green "MINIMAL" badge
- SSS-2: yellow "COMPLIANT" badge  
- SSS-3: purple "CONFIDENTIAL" badge

#### 4.3 Help Improvements
- Add examples in each command's description
- Add a `sss-token examples` command that prints common workflows

---

## File Structure After Implementation

```
solana-stablecoin-cli/src/
├── cli.tsx                      # Commander definitions (updated)
├── commands/
│   ├── init.tsx                 # ✅ Existing (add TOML support)
│   ├── status.tsx               # ✅ Existing
│   ├── supply.tsx               # ✅ Existing
│   ├── mint.tsx                 # ✅ Existing (add positional args)
│   ├── burn.tsx                 # ✅ Existing
│   ├── freeze.tsx               # ✅ Existing
│   ├── thaw.tsx                 # ✅ Existing
│   ├── pause.tsx                # ✅ Existing
│   ├── seize.tsx                # ✅ Existing
│   ├── roles.tsx                # ✅ Existing
│   ├── blacklist.tsx            # ✅ Existing
│   ├── minters.tsx              # 🆕 NEW — minters list/add/remove
│   ├── holders.tsx              # 🆕 NEW — token holder scan
│   ├── audit-log.tsx            # 🆕 NEW — on-chain event log
│   └── index.tsx                # ✅ Existing
├── components/
│   └── ui.tsx                   # ✅ Existing (add ProgressBar, ExplorerLink)
└── utils/
    ├── config.ts                # ✅ Existing (add .sss-config.json, TOML, explorer URL)
    └── toml.ts                  # 🆕 NEW — TOML parser wrapper
```

---

## Priority & Estimated Effort

| Phase | Priority | Effort | Impact |
|---|---|---|---|
| Phase 1: UX Polish | 🔴 HIGH | ~2 hours | Major DX improvement |
| Phase 2: Missing Commands | 🔴 HIGH | ~4 hours | Feature completeness |
| Phase 3: TOML Config | 🟡 MEDIUM | ~1 hour | Nice-to-have |
| Phase 4: UI Enhancements | 🟡 MEDIUM | ~1 hour | Polish |

**Recommended order:** Phase 1 → Phase 2.1 (minters) → Phase 2.2 (holders) → Phase 2.3 (audit-log) → Phase 3 → Phase 4

---

## Dependencies to Add
```json
{
  "smol-toml": "^1"       // Phase 3: TOML parsing (lightweight, no native deps)
}
```

No other new dependencies needed — everything else uses existing `@solana/web3.js`, `@solana/spl-token`, and SDK APIs.
