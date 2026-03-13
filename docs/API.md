# Backend Microservices API Reference

The SSS Backend is a containerized, event-driven ecosystem. Requests are orchestrated by an **API Gateway** which handles rate limiting, authentication, and routing.

- **Base URL**: `http://localhost:3000` (Gateway Proxy)
- **Header**: `x-api-key: <YOUR_SECURE_API_KEY>`

---

## 🌐 API Gateway & System Status

### `GET /health`
Basic health pulse for the gateway.

### `GET /api/status`
Returns the operational status of all microservices (Mint, Compliance, Webhook).
- **Response**: `{ "gateway": "healthy", "services": { "mint": "URL", ... }, "timestamp": "ISO" }`

---

## 🛠 Mint Service (`/api/mint/*`)

All operation endpoints handle Automatic ATA creation and support both Wallet Addresses and Token Accounts.

### `POST /api/mint`
Mints tokens to a recipient.
- **Payload**: `{ "mint": "Pubkey", "to": "Wallet", "amount": "String (base units)" }`

### `POST /api/burn`
Burns tokens via permanent delegate authority.
- **Payload**: `{ "mint": "Pubkey", "from": "Wallet", "amount": "String" }`

### `POST /api/seize`
Admin-only forced transfer.
- **Payload**: `{ "mint": "Pubkey", "from": "Source", "to": "Dest", "amount": "String" }`

### `POST /api/freeze` / `POST /api/thaw`
Restrict or restore account functionality.
- **Payload**: `{ "mint": "Pubkey", "account": "Wallet" }`

### `POST /api/pause` / `POST /api/unpause`
Global emergency circuit breaker.
- **Payload**: `{ "mint": "Pubkey" }`

---

## ⚖️ Compliance Service (`/api/compliance/*`)

### `POST /api/compliance/blacklist/add`
Blocks an address on-chain and in the compliance database.
- **Payload**: `{ "mint": "Pubkey", "address": "Wallet", "reason": "Max 128 chars" }`

### `POST /api/compliance/blacklist/remove`
Removes an address from the blacklist.

### `GET /api/compliance/blacklist/check/:mint/:address`
Performs an **on-chain** check for an address's blacklist status.

### `GET /api/compliance/blacklist`
Returns all currently active blacklisted addresses from the database.

### `GET /api/compliance/audit-log`
Comprehensive activity history.
- **Query Params**: `action` (e.g. `TokensMinted`), `limit` (default 25, max 100).

### `GET /api/compliance/screen/:address`
Integration with external regulatory gateways for proactive risk assessment.

---

## 🔔 Webhook Service (`/api/webhooks/*`)

Full management suite for real-time event notifications.

### `POST /api/webhooks`
Register a new event listener.
- **Payload**: `{ "url": "URL", "eventTypes": ["TokensMinted", ...], "retryCount": 3 }`

### `GET /api/webhooks` / `GET /api/webhooks/:id`
List or retrieve webhook configurations.

### `PUT /api/webhooks/:id`
Update an existing webhook (URL, event types, or active status).

### `DELETE /api/webhooks/:id`
Remove a webhook registration.

### `GET /api/webhooks/:id/deliveries`
Returns the delivery history and response codes for a specific webhook.

### `POST /api/webhooks/:id/test`
Dispatches a dummy payload to the configured URL to verify connectivity.

---

## Implementation Details
1. **Validation**: All inputs are validated using **Zod** schemas (e.g. `mintToSchema`, `blacklistAddSchema`).
2. **Persistence**: The compliance and webhook modules use **PostgreSQL** for durable indexing.
3. **Async Core**: Internal event signaling is handled via **Redis Pub/Sub**.
4. **Resilience**: The gateway includes a 15-minute window rate limiter (100 requests per IP).
