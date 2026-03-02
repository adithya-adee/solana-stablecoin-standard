# CLI & TUI Reference

The `sss-token` CLI (located in `solana-stablecoin-cli`) provides a powerful, interactive Terminal User Interface (TUI) and direct command-line access to management operations.

## Installation & Setup

1. **Build the CLI**:
   ```bash
   cd solana-stablecoin-cli
   pnpm install
   pnpm build
   ```

2. **Configure Environment**:
   Create a `.env` file or export variables:
   ```bash
   SOLANA_RPC_URL="https://api.devnet.solana.com"
   SOLANA_KEYPAIR="~/.config/solana/id.json"
   SSS_MINT="<YOUR_MINT_ADDRESS>" # Optional: Sets global context
   ```

3. **Link for convenience** (Optional):
   ```bash
   npm link
   ```

## Interactive Dashboard (TUI)

The recommended way to manage your stablecoin is through the interactive dashboard.

```bash
sss-token tui
```

**Features:**
- **Dashboard Tab**: Real-time supply monitoring and status overview.
- **Operations Tab**: Execute Mint, Burn, Freeze, Thaw, Pause, and Seize actions.
- **Compliance Tab**: Manage roles and the transfer blacklist.
- **Holders Tab**: View top token holders.
- **Audit Tab**: Browse on-chain event history.

## Command Line Interface

For CI/CD or direct execution, use the subcommand structure.

### Global Options

| Option | Env Var | Description |
| :--- | :--- | :--- |
| `--mint` | `SSS_MINT` | The stablecoin mint address to operate on. |
| `--keypair` | `SOLANA_KEYPAIR` | Path to the authority keypair. |
| `--rpc` | `SOLANA_RPC_URL` | Solana RPC endpoint. |

### Core Commands

#### init
Initialize a new stablecoin.
```bash
sss-token init --preset sss-1 --name "My Token" --symbol "MTK"
```

#### info / status
Display stablecoin configuration and supply.
```bash
sss-token info --mint <MINT>
```

#### supply
Display supply utilization and caps.
```bash
sss-token supply --mint <MINT>
```

### Operation Commands
*All operation commands now support direct wallet addresses and handle ATAs automatically.*

#### mint
```bash
sss-token mint --mint <MINT> --recipient <WALLET> --amount 1000
```

#### burn
```bash
sss-token burn --mint <MINT> --from <WALLET> --amount 500
```

#### freeze / thaw
```bash
sss-token freeze --mint <MINT> --address <WALLET>
sss-token thaw --mint <MINT> --address <WALLET>
```

#### pause / unpause
```bash
sss-token pause --mint <MINT>
sss-token unpause --mint <MINT>
```

#### seize
```bash
sss-token seize --mint <MINT> --from <WALLET> --to <DEST_WALLET> --amount 1000
```

### Compliance & roles

#### roles list / grant / revoke
```bash
# List roles for an address (or self by default)
sss-token roles list --mint <MINT>

# Grant a role (Admin only)
sss-token roles grant --mint <MINT> --address <WALLET> --role minter
```

#### blacklist add / remove / check
```bash
sss-token blacklist add --mint <MINT> --address <WALLET> --reason "Suspicious"
```

### Monitoring

#### holders
List top holders.
```bash
sss-token holders --mint <MINT>
```

#### audit-log
View event history.
```bash
sss-token audit-log --mint <MINT> --limit 10
```
