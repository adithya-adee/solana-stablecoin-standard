# Solana Stablecoin Standard (SSS)

## Overview
The Solana Stablecoin Standard (SSS) is a comprehensive, production-ready framework for issuing and managing stablecoins on the Solana blockchain. Built on top of the Token-2022 (Token Extensions) program, SSS provides institutional-grade controls, compliance features, and privacy options through a unified interface.

## Quick Start
1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-repo/solana-stablecoin-standard.git
   cd solana-stablecoin-standard
   ```
2. **Install dependencies:**
   ```bash
   pnpm install
   ```
3. **Build the SDK and frontend:**
   ```bash
   pnpm --filter @stbr/sss-token build
   pnpm --filter frontend build
   ```
4. **Run the local frontend:**
   ```bash
   pnpm --filter frontend dev
   ```
5. **Use the CLI to deploy a stablecoin:**
   ```bash
   cd solana-stablecoin-cli
   cargo run -- init --preset sss-1 --name "My USD" --symbol MUSD --decimals 6
   ```

## Preset Comparison
| Feature | SSS-1 (Minimal) | SSS-2 (Compliant) | SSS-3 (Private) |
|---------|---------|---------|---------|
| Minting/Burning | Yes | Yes | Yes |
| Role Management | Yes | Yes | Yes |
| Freeze/Thaw | Yes | Yes | Yes |
| Transfer Hook Blacklist | No | Yes | No |
| Permanent Delegate (Seize) | No | Yes | Yes |
| Confidential Transfers | No | No | Yes |
| Use Case | Simple payments | Regulated stablecoins | Institutional/Private txs |

## Architecture Diagram
```mermaid
graph TD
    Client[Client Apps / CLI / Frontend] --> SDK[@stbr/sss-token SDK]
    SDK --> Core[SSS Core Program]
    SDK --> Token2022[Token-2022 Program]
    Core --> Token2022
    Token2022 --> TransferHook[SSS Transfer Hook Program]
```
