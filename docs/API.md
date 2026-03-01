# Backend API Reference

The backend API handles indexing, state verification, and advanced metadata serving for the Solana Stablecoin Standard platform.

*(Note: API implementations will vary based on backend indexing architecture. The following represents the standard expected REST endpoints for the UI to consume).*

## Endpoints

### `GET /api/v1/mints`
Returns all SSS-managed mints deployed by the connected issuer wallet.

### `GET /api/v1/mint/:mintAddress/holders`
Returns the current token holders, their balances, and config statuses. 
*(Requires an external indexer mapping `TokenAccount`s to `Mint`s)*.

### `GET /api/v1/mint/:mintAddress/operations`
Fetches a historical ledger of all administrative events (mints, burns, freezes, role changes) by parsing Solana transaction logs for Anchor events.

### `POST /api/v1/compliance/check`
Validates whether a user's identity satisfies off-chain KYC criteria before the backend submits an on-chain transaction to un-blacklist or allowlist them.

## Indexer Architecture Recommendations

The SSS platform operates trustlessly by deriving all state from on-chain data. To power the `/operations` and `/holders` endpoints with low latency, you must implement a robust indexer.

For building the fastest and most reliable indexer, we strongly recommend implementing your pipeline utilizing:
1. **Yellowstone Geyser (gRPC)**: The industry standard for high-performance, low-latency data streaming directly from Solana validator nodes.
2. **Helius Enhanced RPCs / Webhooks**: An excellent, managed alternative providing parsed token transaction streams if operating a dedicated gRPC node is too resource-intensive.

*Security Note:* Proof generation for SSS-3 (Confidential Transfers) **must** remain entirely on the client side (e.g., via native CLI or hardware-accelerated desktop environments) to guarantee a trustless environment. Offloading proof generation to a centralized server introduces critical security vulnerabilities and trust assumptions that contradict the protocol design.
