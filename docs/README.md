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
3. **Build the entire workspace (Powered by Turbo):**
   ```bash
   pnpm build
   ```
4. **Run the local frontend:**
   ```bash
   pnpm dev --filter frontend
   ```
5. **Run the backend services (Docker):**
   ```bash
   docker compose up -d
   ```
6. **Use the CLI to manage stablecoins:**
   ```bash
   pnpm start --filter @stbr/sss-cli
   ```

## Preset Comparison

| Feature                    | SSS-1 (Minimal) | SSS-2 (Compliant)     | SSS-3 (Private)           |
| -------------------------- | --------------- | --------------------- | ------------------------- |
| Minting/Burning            | Yes             | Yes                   | Yes                       |
| Role Management            | Yes             | Yes                   | Yes                       |
| Freeze/Thaw                | Yes             | Yes                   | Yes                       |
| Transfer Hook Blacklist    | No              | Yes                   | No                        |
| Permanent Delegate (Seize) | No              | Yes                   | Yes                       |
| Confidential Transfers     | No              | No                    | Yes                       |
| Use Case                   | Simple payments | Regulated stablecoins | Institutional/Private txs |

## Standard Specifications

- [SSS-1 (Minimal)](SSS-1.md) - Baseline stablecoin configuration.
- [SSS-2 (Compliant)](SSS-2.md) - On-chain compliance and administrative controls.
- [SSS-3 (Private)](SSS-3.md) - Experimental Zero-Knowledge confidential transfers.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Frontend["Next.js Dashboard"]
        CLI["React Ink (TUI)"]
        External["External Integrations"]
    end

    subgraph "SDK Layer (@stbr/sss-token)"
        SDK["Stablecoin Client"]
        Batcher["Tx Batcher / Splitter"]
        Oracle["Pyth Oracle Client"]
        ZK["ZK Proof Gen (WASM)"]
    end

    subgraph "Backend Tier (Microservices)"
        Gateway["API Gateway"]
        MintSvc["Mint Service"]
        CompSvc["Compliance Service"]
        EventIndexer["Event Indexer"]
        Webhook["Webhook Dispatcher"]
        Redis[("Redis (Pub/Sub)")]
        Postgres[("PostgreSQL")]
    end

    subgraph "On-Chain Layer (Solana)"
        Core["SSS Core Program"]
        Hook["SSS Transfer Hook"]
        T22["SPL Token-2022"]
        Pyth["Pyth V2 Oracle"]
    end

    %% Interactions
    Frontend & CLI & External --> SDK
    
    %% SDK interactions
    SDK --> Gateway
    SDK --> Batcher
    SDK --> ZK
    Batcher --> Core
    Batcher --> T22
    SDK --> Oracle
    Oracle --> Pyth

    %% Backend Flow
    Gateway --> MintSvc & CompSvc & Webhook
    MintSvc & CompSvc --> Redis
    Webhook --> Redis
    EventIndexer -- "Indexes" --> T22 & Hook
    EventIndexer -- "Persists" --> Postgres
    CompSvc -- "Queries" --> Postgres

    %% On-Chain logic
    Core -- "CPI (Mint/Burn/Freeze)" --> T22
    T22 -- "CPI (Transfer-Hook)" --> Hook
    Hook -- "PDA Checks" --> Core
```
