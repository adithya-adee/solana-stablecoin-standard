# Backend API Reference

The backend API (located in `solana-stablecoin-backend`) provides RESTful endpoints for token operations, compliance management, and auditing. It serves as a hardened gateway between your business logic and the Solana blockchain.

## Base URL

`http://localhost:3000` (Default)

## Authentication

All requests require an API key passed in the `x-api-key` header.

```bash
-H "x-api-key: your-secure-api-key"
```

---

## Operations Endpoints

### `POST /operations/mint`

Mint tokens to a recipient.

- **Body:**
  ```json
  {
    "mint": "Mint address",
    "to": "Recipient Wallet OR Token Account",
    "amount": "1000000" (string, in base units)
  }
  ```
- **Note:** Automatically creates an ATA for the recipient if it doesn't exist.

### `POST /operations/burn`

Burn tokens from a wallet.

- **Body:**
  ```json
  {
    "mint": "Mint address",
    "from": "Holder Wallet OR Token Account",
    "amount": "500000"
  }
  ```

### `POST /operations/seize`

Forcibly transfer tokens between wallets.

- **Body:**
  ```json
  {
    "mint": "Mint address",
    "from": "Source Wallet OR Token Account",
    "to": "Destination Wallet OR Token Account",
    "amount": "1000000"
  }
  ```

### `POST /operations/freeze` / `POST /operations/thaw`

Freeze or thaw a wallet.

- **Body:**
  ```json
  {
    "mint": "Mint address",
    "account": "Wallet OR Token Account"
  }
  ```

### `POST /operations/pause` / `POST /operations/unpause`

Pause all operations for a stablecoin.

- **Body:**
  ```json
  {
    "mint": "Mint address"
  }
  ```

---

## Compliance Endpoints

### `POST /compliance/blacklist/add`

Add an address to the blacklist.

- **Body:**
  ```json
  {
    "mint": "Mint address",
    "address": "Wallet address",
    "reason": "Compliance reason"
  }
  ```

### `POST /compliance/blacklist/remove`

Remove an address from the blacklist.

### `GET /compliance/status/:mint/:address`

Check if an address is blacklisted.

### `GET /compliance/audit-trail/:mint`

Fetch historical events (mints, burns, freezes, etc.) for a stablecoin.

- **Query Params:**
  - `action`: Filter by event type (e.g., `TokensMinted`)
  - `limit`: Number of entries (default 25)

---

## Utility Endpoints

### `GET /health`

Returns the health status of the backend and its connection to Solana.

---

## Implementation Notes

1. **Wallet-Awareness**: The backend leverages the SSS SDK to automatically resolve Associated Token Accounts (ATAs). You can pass a standard wallet `PublicKey` to any `to`, `from`, or `account` field.
2. **Atomic Execution**: Operations like `mint` that require ATA creation are executed as a single atomic transaction on Solana.
3. **Screening**: The `/operations/mint` and `/operations/burn` endpoints include a pluggable compliance screening step that can block transactions based on automated risk scores.
