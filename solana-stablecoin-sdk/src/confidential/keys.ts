import { randomBytes, createCipheriv } from 'crypto';

/**
 * Generate a random ElGamal keypair suitable for TESTING ONLY.
 *
 * In production, the ElGamal keypair must be deterministically derived from
 * the wallet signing key and token account address using the `solana-zk-sdk`
 * Rust crate. These random bytes are NOT a valid keypair for on-chain proofs.
 */
export function generateDummyElgamalKeys(): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  return {
    publicKey: new Uint8Array(randomBytes(32)),
    secretKey: new Uint8Array(randomBytes(32)),
  };
}

/**
 * Alias for generateDummyElgamalKeys() with a descriptive name matching
 * the SSS-3.md documentation examples.
 *
 * @returns A random (non-derived) ElGamal keypair suitable for local tests.
 */
export const generateTestElGamalKeypair = generateDummyElgamalKeys;

/**
 * Generate a random 16-byte AES-128 key for the decryptable balance field.
 */
export function generateDummyAesKey(): Uint8Array {
  return new Uint8Array(randomBytes(16));
}

/**
 * Produce an encrypted zero balance in the format expected by
 * Token-2022's `DecryptableBalance` field (used in ConfigureAccount).
 *
 * **Testing only.** This uses raw AES-128-CTR and a non-standard layout.
 * For production, use `encryptDecryptableBalance(0n, aeKey)` from `./zk-keys` with
 * AeKey from `deriveConfidentialKeysFromSignatures` (Token-2022 uses AeKey from
 * @solana/zk-sdk: 16-byte nonce + 16-byte ciphertext + 4-byte tag).
 *
 * Format (36 bytes total, testing stub):
 *   [0..12]   12-byte nonce (IV)
 *   [12..20]  8-byte ciphertext (AES-128-CTR of 8 zero bytes)
 *   [20..36]  placeholder (zeros)
 *
 * @param aesKey - 16-byte AES-128 key (from generateDummyAesKey)
 * @returns 36-byte encrypted zero balance buffer
 */
export function encryptDecryptableZero(aesKey: Uint8Array): Uint8Array {
  if (aesKey.length !== 16) {
    throw new Error(`AES key must be 16 bytes, got ${aesKey.length}`);
  }
  const nonceStr = randomBytes(16); // aes-128-ctr requires a 16 byte IV in Node
  const plaintext = Buffer.alloc(8, 0); // 8-byte little-endian u64 zero
  const cipher = createCipheriv('aes-128-ctr', Buffer.from(aesKey), nonceStr);
  const ciphertext = cipher.update(plaintext);
  cipher.final();

  const result = new Uint8Array(36);
  result.set(nonceStr.subarray(0, 12), 0); // bytes 0-11: nonce
  result.set(ciphertext, 12); // bytes 12-19: encrypted zero
  // bytes 20-35 remain zero (placeholder tag)
  return result;
}

/**
 * Derive an ElGamal keypair from a signer and token account.
 *
 * This operation requires the `solana-zk-sdk` Rust crate and cannot be
 * performed in TypeScript. Use `generateTestElGamalKeypair()` for local
 * testing, or call the Rust proof service in production.
 *
 * @throws Always throws – Rust-only operation.
 */
export function deriveElGamalKeypair(
  _signer: unknown,
  _tokenAccount: unknown,
): { publicKey: Uint8Array; secretKey: Uint8Array } {
  throw new Error(
    'ElGamal keypair derivation requires the solana-zk-sdk Rust crate. ' +
      'Use generateTestElGamalKeypair() for testing, or call the Rust proof ' +
      'service for production deployments.',
  );
}
