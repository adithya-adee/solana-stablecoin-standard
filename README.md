<div align="center">

# Solana Stablecoin Standard

**Enterprise-Ready Toolkit for On-Chain Fiat and Compliant Tokens on Solana via Token-2022**

*Modular Architecture · 3 Compliance Tiers · Privacy Modes · API & Webhooks · Full TUI Dashboard*

[![CI](https://github.com/solanabr/solana-stablecoin-standard/actions/workflows/ci.yml/badge.svg)](https://github.com/solanabr/solana-stablecoin-standard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Anchor](https://img.shields.io/badge/Anchor-0.32-blueviolet.svg)](https://www.anchor-lang.com/)
[![Solana](https://img.shields.io/badge/Solana-Token--2022-00FFA3.svg)](https://spl.solana.com/token-2022)

</div>

---

## 📌 Overview

The Solana Stablecoin Standard is an opinionated, production-grade framework designed to simplify the issuance of fiat-pegged or fiat-backed tokens on the Solana network. Rather than piecing together individual Token-2022 extensions, issuers can select from three predefined tiers (SSS-1, SSS-2, and SSS-3) that bundle the exact capabilities needed for their regulatory and operational requirements.

Whether you're building an internal DAO settlement token, a fully regulated USDC-like asset with mandatory denylists, or exploring zero-knowledge confidential transfers, this toolkit provides the smart contracts, SDKs, backend services, and interactive CLI dashboards to manage the entire token lifecycle.

---

## 🏗 System Architecture

The project is structured in three composable layers to ensure maximum flexibility while enforcing secure defaults.

```text
+-------------------------------------------------------------+
|                     Client Applications                     |
|           (Web Dashboard / Next.js / Express API)           |
+-----------------------------+-------------------------------+
                              |
+-----------------------------v-------------------------------+
|                      Stablecoin SDK                         |
|      (@stbr/sss-token - Highly optimized & Tree-shakable)   |
+-----------+-----------------+-------------------+-----------+
            |                 |                   |
     +------v------+   +------v------+     +------v------+
     |   Tier 1    |   |   Tier 2    |     |   Tier 3    |
     |  (Utility)  |   | (Regulated) |     |  (Private)  |
     +------+------+   +------+------+     +------+------+
            |                 |                   |
+-----------v-----------------v-------------------v-----------+
|                      Core Smart Contracts                    |
|   [sss-core] (Base Logic, Authorities, Mint/Burn Quotas)    |
|   [sss-transfer-hook] (Strict Transfer Policy Enforcement)  |
+-------------------------------------------------------------+
```

---

## 🎛 The Three Tiers

| Capability Snapshot              | Tier 1 (Utility) | Tier 2 (Regulated) | Tier 3 (Private) |
| :---                             | :---:            | :---:              | :---:            |
| **Core Lifecycle (Mint/Burn)**   | ✅               | ✅                 | ✅               |
| **Account Freeze/Thaw**          | ✅               | ✅                 | ✅               |
| **Global Emergency Pause**       | ✅               | ✅                 | ✅               |
| **Supply Caps & Oracle Locks**   | ✅               | ✅                 | ✅               |
| **Permanent Delegate (Seize)**   | ✅               | ✅                 | ✅               |
| **Denylist (Transfer Hooks)**    | -                | ✅                 | -                |
| **Default Frozen Accounts**      | -                | ✅                 | -                |
| **Confidential ZK Transfers**    | -                | -                  | ✅               |
| **Auditor Keys**                 | -                | -                  | ✅               |
| *Target Audience*                | *DAO Treasuries* | *Fiat Stablecoins* | *Dark Pools*     |

---

## 🚀 Quick Setup Guide

### Dependencies
Make sure your environment has:
- **Rust** >= 1.75
- **Solana CLI** >= 1.18
- **Anchor Framework** >= 0.32
- **Node.js** >= 20 (with `pnpm`)

### Installation & Build

```bash
git clone https://github.com/solanabr/solana-stablecoin-standard.git
cd solana-stablecoin-standard
pnpm install

# Compile the Anchor programs
anchor build

# Run all test layers
anchor test           # Integration coverage (97 tests)
pnpm test:sdk         # Typescript SDK coverage (90 tests)
cargo test            # Rust unit & property tests (16 tests)
```

---

## 💻 Working with the TypeScript SDK

The `@stbr/sss-token` SDK is built with strong typing, tree-shakability, and an intuitive class-based client.

```typescript
import { StablecoinClient, StablecoinTiers } from '@stbr/sss-token';
import { AnchorProvider } from '@coral-xyz/anchor';

const provider = AnchorProvider.env();

// 1. Deploy a heavily-regulated Tier 2 token
const stablecoin = await StablecoinClient.create(provider, {
  preset: StablecoinTiers.SSS_2,
  name: 'Global Euro Dollar',
  symbol: 'GEUR',
  decimals: 6,
  supplyCap: 1_000_000_000_000n, // Optional hard cap
});

// 2. Manage Roles
await stablecoin.accessControl.grant(treasuryWallet.publicKey, 'minter');

// 3. Issue and Burn
await stablecoin.issueTokens(treasuryWallet.publicKey, 500_000_000n);
const circulating = await stablecoin.fetchCirculatingSupply();

// 4. Regulatory Enforcement (Tier 2 only)
await stablecoin.denyList.add(maliciousAddress, 'OFAC Sanctions match');
await stablecoin.enforcement.seize(frozenHackerAccount, treasuryWallet, amount);
```

---

## 🎛 CLI & Interactive Dashboard

The terminal application is powered by React Ink, giving operators an advanced dashboard with tabs, active network configurations, and rapid-response actions.

![CLI Demo](docs/images/cli-demo.gif)

```bash
# Launch the interactive terminal UI (TUI)
cd solana-stablecoin-cli
pnpm build
sss-token tui

# Or use direct commands for CI/CD integrations
sss-token init --preset sss-2 --name "Regulated USD" --symbol "rUSD" --decimals 6
sss-token mint --mint <MINT_ADDRESS> --recipient <TARGET_WALLET> --amount 1000
sss-token supply --mint <MINT_ADDRESS>
sss-token blacklist add --mint <MINT_ADDRESS> --address <TARGET_WALLET> --reason "Suspicious Activity"
```

---

## 🔌 Backend Integrations

The backend service is an Express.js application designed to run in a Docker container alongside your infrastructure. It features:
- **Event Monitors:** WebSocket connections that parse raw log streams into clean webhook payloads.
- **Webhooks:** Automated notifications with configurable backoff arrays.
- **REST Endpoints:** Hardened endpoints with API-key middleware and built-in rate limiters.
- **Docker-ready:** Non-root execution environments with native health checks.

```bash
cd solana-stablecoin-backend
cp .env.example .env

# Start up the entire backend stack
docker compose up
```

---

## 🌐 Deployment to Devnet

The core programs are already deployed and rigorously verified on the Solana Devnet. You can review the raw transaction receipts spanning all three tiers in [`deployments/devnet-proof.json`](deployments/devnet-proof.json).

| Smart Contract | Address on Devnet |
| :--- | :--- |
| `sss-core` | `SSSCFmmtaU1oToJ9eMqzTtPbK9EAyoXdivUG4irBHVP` |
| `sss-transfer-hook` | `HookFvKFaoF9KL8TUXUnQK5r2mJoMYdBENu549seRyXW` |

---

## 🧪 Test Coverage

We maintain absolute strictness regarding correct execution. The repository houses **203 fully passing tests**:

- **97 Integration Tests:** Full end-to-end flows asserting role escalations and hook boundaries.
- **90 SDK Unit Tests:** Isolated checks for PDA math, strict type exports, and proper HTTP error transformations.
- **16 Rust Fuzz/Unit Tests:** Edge cases covering supply mathematical overflows and access-control bypasses.

---

## 📁 Directory Layout

```text
├── sss-programs/
│   ├── sss-core/               # Primary stablecoin state and authority
│   └── sss-transfer-hook/      # Token-2022 Transfer Hook policy manager
├── solana-stablecoin-sdk/      # TypeScript SDK (@stbr/sss-token)
├── solana-stablecoin-cli/      # React Ink CLI + Dashboard
├── solana-stablecoin-backend/  # Express REST API, Websockets & Webhooks
├── solana-stablecoin-frontend/ # Next.js Web Dashboard
├── tests/                      # Anchor integration suite
├── trident-tests/              # Rust property-based fuzz tests
├── deployments/                # Devnet proofs
└── docs/                       # Architectural reference
```

---

## 📚 Docs Index

For deep-dive documentation, consult the files in `/docs`:

- **[Architecture Deep-Dive](docs/ARCHITECTURE.md)** (State flows and program relationships)
- **[SDK Documentation](docs/SDK.md)** (Typescript API references and types)
- **[CLI Runbook](docs/CLI.md)** (Full list of subcommands)
- **[Backend API Spec](docs/API.md)** (REST boundaries and error codes)
- **[Tier Specs](docs/)** (Individual breakdowns for `SSS-1.md`, `SSS-2.md`, and `SSS-3.md`)
- **[Operator Guidelines](docs/OPERATIONS.md)** (Emergency response procedures)
- **[Security Posture](docs/SECURITY.md)** (Threat modeling)

---

## ⚠️ Known Constraints & Edge Cases

1. **Seizing via Permanent Delegate on Tier 2:** Token-2022 constraints prevent forwarding additional auxiliary accounts during a `TransferChecked` CPI. When using `seize` on an `SSS-2` mint, the transaction requires hook validation accounts that bypass the permanent delegate CPI. The established workaround is to freeze the account and execute an admin-authorized bypass flow. Tier 1 and Tier 3 seize functions normally.
2. **Admin Revocation:** Built-in safeguards prevent the last active admin from removing themselves from the contract (which would brick the token). However, any active Administrator can revoke any other Administrator. We strongly recommend assigning the Admin role to a multisig (e.g., Squads) rather than individual keypairs.

---

## 🤝 Contributing

We welcome community extensions and patches.

1. Fork the repository
2. Create your isolated feature branch (`git checkout -b feature/your-feature`)
3. Validate your changes against the entire suite (`anchor test && pnpm test:sdk && cargo test`)
4. Submit your pull request against `main`

---

## 📄 License

This codebase is distributed under the MIT License. See [LICENSE](LICENSE) for more information.
