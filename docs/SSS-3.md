# SSS-3: Confidential Stablecoin Standard

SSS-3 is an experimental extension of the Solana Stablecoin Standard that leverages **Token-2022 Confidential Transfers**. It allows users to hide their token balances and transfer amounts using Zero-Knowledge (ZK) proofs, specifically ElGamal encryption and Σ-protocols.

> [!WARNING]
> **Experimental Status**: SSS-3 is currently a Proof-of-Concept (POC). The on-chain ZK ElGamal Proof Program is currently undergoing security audits and is disabled on Solana Mainnet and Devnet (as of 2025). This standard is intended for research and testing on local validators where the feature can be enabled.

## Architecture

SSS-3 tokens are built using the `ConfidentialTransferMint` extension of the SPL Token-2022 program.

- **Privacy Mechanism**: Twisted ElGamal Encryption.
- **Proofs**: Transfers require Equality, Ciphertext Validity, and Range proofs to ensure the sender has sufficient funds without revealing the amount.
- **Auditing**: Optional auditor ElGamal public key can be configured at minting time to allow a designated authority to view balances for compliance.

## SDK Usage

The SSS-1/2/3 SDK provides the `StablecoinClient.confidential` namespace to manage private operations.

### 1. Key Management

Users must derive an ElGamal keypair (for ZK proofs) and an AES key (for local balance decryption).

```typescript
import { StablecoinClient } from '@solanabr/sss-sdk';

// Derive keys from wallet signatures (standard convention)
const elGamalSig = await wallet.signMessage(Buffer.from("ElGamalSecretKey"));
const aesSig = await wallet.signMessage(Buffer.from("AeKey"));

const keys = await StablecoinClient.confidential.deriveKeys(elGamalSig, aesSig);
// keys.elGamalPublicKey, keys.elGamalSecretKey, keys.aesKey
```

### 2. Configure Token Account

A standard Token-2022 account must be "opted-in" to confidential transfers. This generates a ZK proof of pubkey validity.

```typescript
await client.confidential.configureAccount(
  tokenAccount,
  keys.elGamalSecretKey,
  keys.aesKey
);
```

### 3. Move Funds to Private Balance (Deposit)

Transparent tokens in your account can be "deposited" into your confidential balance.

```typescript
await client.confidential.deposit(tokenAccount, 1000_000n, 6);
```

### 4. Confidential Transfer

Executing a private transfer requires generating several ZK proofs using the `@solana/zk-sdk` (WASM).

```typescript
await client.confidential.transfer(
  sourceAta,
  destAta,
  amount,
  keys.elGamalSecretKey,
  sourceCiphertext, // Fetched from account state
  currentBalance,   // Decrypted locally
  destElGamalPk,    // Recipient's public key
  auditorPk         // Optional auditor key
);
```

## On-Chain Logic

SSS-3 uses the native `ZkTokenProof1111111111111111111111111111111` program for verification. Instructions are batched:
1. `VerifyProof` (Pubkey Validity, Equality, or Range).
2. `ConfidentialTransfer` (Token-2022 instruction).

## Resources

- [Solana Token-2022 Docs](https://spl.solana.com/token-2022/extensions#confidential-transfers)
- [Solana ZK SDK](https://github.com/solana-labs/solana-zk-sdk)
