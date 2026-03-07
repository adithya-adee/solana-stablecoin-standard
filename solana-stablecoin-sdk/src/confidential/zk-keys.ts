/**
 * Token-2022 confidential transfer key derivation and AE encryption.
 *
 * Key derivation uses the standard Token-2022 / zk-keygen convention:
 * - Two separate wallet signMessage calls with fixed seed strings (not a single signature split).
 * - Sign("ElGamalSecretKey" + emptyPublicSeed) → derive ElGamal keypair from that signature.
 * - Sign("AeKey" + emptyPublicSeed) → derive AES (AeKey) from that signature.
 *
 * AE ciphertext (PodAeCiphertext) uses @solana/zk-sdk's AeKey encrypt/decrypt (authenticated
 * encryption), not raw AES-128-CTR. Format: 16-byte nonce + 16-byte ciphertext + 4-byte tag (36 bytes).
 *
 * @see https://docs.solana.com/tokens/extensions/confidential-transfer
 */

/** Empty public seed used with seed strings for Token-2022 key derivation. */
export const CONFIDENTIAL_TRANSFER_EMPTY_PUBLIC_SEED = new Uint8Array(0);

/**
 * Message the wallet must sign to derive the ElGamal keypair.
 * Use: wallet.signMessage(new TextEncoder().encode(ELGAMAL_SEED_MESSAGE))
 * or with empty public seed: ELGAMAL_SEED_MESSAGE + CONFIDENTIAL_TRANSFER_EMPTY_PUBLIC_SEED.
 */
export const CONFIDENTIAL_TRANSFER_ELGAMAL_SEED_MESSAGE = 'ElGamalSecretKey';

/**
 * Message the wallet must sign to derive the AeKey (for decryptable balance encryption).
 * Use: wallet.signMessage(new TextEncoder().encode(AE_KEY_SEED_MESSAGE))
 * or with empty public seed: AE_KEY_SEED_MESSAGE + CONFIDENTIAL_TRANSFER_EMPTY_PUBLIC_SEED.
 */
export const CONFIDENTIAL_TRANSFER_AE_KEY_SEED_MESSAGE = 'AeKey';

type ZkModule = {
  ElGamalSecretKey: { fromBytes(bytes: Uint8Array): { free(): void; toBytes(): Uint8Array } };
  ElGamalKeypair: {
    fromSecretKey(sk: unknown): {
      pubkey(): { toBytes(): Uint8Array };
      secret(): { toBytes(): Uint8Array };
      free(): void;
    };
  };
  AeKey: {
    fromBytes(bytes: Uint8Array): {
      encrypt(amount: bigint): { toBytes(): Uint8Array };
      decrypt(ct: unknown): bigint;
      toBytes(): Uint8Array;
      free(): void;
    };
  };
  AeCiphertext: { fromBytes(bytes: Uint8Array): unknown | undefined };
};

let zkModuleCache: ZkModule | null = null;

/**
 * Load @solana/zk-sdk (Node or bundler). Prefer passed module to avoid duplicate WASM init.
 * Uses dynamic import with runtime path so bundlers can resolve the correct entry.
 */
export async function loadZkSdk(zkModule?: ZkModule): Promise<ZkModule> {
  if (zkModule) return zkModule;
  if (zkModuleCache) return zkModuleCache;
  const base = '@solana/zk-sdk';
  try {
    const node = await import(/* webpackIgnore: true */ `${base}/node`);
    zkModuleCache = node as unknown as ZkModule;
    return zkModuleCache;
  } catch {
    const bundler = await import(/* webpackIgnore: true */ `${base}/bundler`);
    zkModuleCache = bundler as unknown as ZkModule;
    return zkModuleCache;
  }
}

export interface DerivedConfidentialKeys {
  /** ElGamal public key (32 bytes) for on-chain account / proofs. */
  elGamalPublicKey: Uint8Array;
  /** ElGamal secret key (32 bytes). Keep private; used for ZK proofs and decryption. */
  elGamalSecretKey: Uint8Array;
  /** Opaque AeKey handle from zk-sdk for encrypt/decrypt of decryptable balances. */
  aesKey: unknown;
}

/**
 * Derive ElGamal keypair and AeKey from the two Token-2022 standard message signatures.
 * The wallet must sign two separate messages: ELGAMAL_SEED_MESSAGE and AE_KEY_SEED_MESSAGE
 * (each optionally concatenated with empty public seed). Do not split a single signature.
 *
 * @param elGamalMessageSignature - 64-byte Ed25519 signature of "ElGamalSecretKey" (+ optional empty seed)
 * @param aeKeyMessageSignature - 64-byte Ed25519 signature of "AeKey" (+ optional empty seed)
 * @param zkModule - Optional pre-loaded @solana/zk-sdk module (e.g. from bundler in browser)
 */
export async function deriveConfidentialKeysFromSignatures(
  elGamalMessageSignature: Uint8Array,
  aeKeyMessageSignature: Uint8Array,
  zkModule?: ZkModule,
): Promise<DerivedConfidentialKeys> {
  if (elGamalMessageSignature.length < 32) {
    throw new Error(
      `elGamalMessageSignature must be at least 32 bytes, got ${elGamalMessageSignature.length}`,
    );
  }
  if (aeKeyMessageSignature.length < 16) {
    throw new Error(
      `aeKeyMessageSignature must be at least 16 bytes, got ${aeKeyMessageSignature.length}`,
    );
  }
  const zk = await loadZkSdk(zkModule);
  const skBytes = elGamalMessageSignature.slice(0, 32);
  const aesBytes = aeKeyMessageSignature.slice(0, 16);

  const elGamalSk = zk.ElGamalSecretKey.fromBytes(skBytes);
  const keypair = zk.ElGamalKeypair.fromSecretKey(elGamalSk);
  const pubkey = keypair.pubkey();
  const secret = keypair.secret();
  const elGamalPublicKey = new Uint8Array(pubkey.toBytes());
  const elGamalSecretKey = new Uint8Array(secret.toBytes());
  elGamalSk.free?.();
  keypair.free?.();

  const aesKey = zk.AeKey.fromBytes(aesBytes);
  return {
    elGamalPublicKey,
    elGamalSecretKey,
    aesKey,
  };
}

/**
 * Encrypt a 64-bit balance for Token-2022 decryptable balance field (PodAeCiphertext).
 * Uses AeKey from @solana/zk-sdk (authenticated encryption), not raw AES-CTR.
 * Returns 36 bytes: 16-byte nonce + 16-byte ciphertext + 4-byte tag.
 *
 * @param amount - Balance value (u64)
 * @param aeKey - AeKey from deriveConfidentialKeysFromSignatures (zk-sdk AeKey instance)
 */
export function encryptDecryptableBalance(
  amount: bigint,
  aeKey: { encrypt(amount: bigint): { toBytes(): Uint8Array } },
): Uint8Array {
  const ct = aeKey.encrypt(amount);
  const bytes = new Uint8Array(ct.toBytes());
  if (bytes.length !== 36) {
    throw new Error(`Expected PodAeCiphertext 36 bytes, got ${bytes.length}`);
  }
  return bytes;
}

/**
 * Decrypt a 36-byte PodAeCiphertext (decryptable_available_balance or decryptable_pending_balance).
 * Loads zk-sdk if not already loaded (e.g. after deriveConfidentialKeysFromSignatures).
 *
 * @param ciphertextBytes - 36-byte PodAeCiphertext from on-chain account
 * @param aeKey - AeKey from deriveConfidentialKeysFromSignatures (has .decrypt(ciphertext))
 * @param zkModule - Optional pre-loaded @solana/zk-sdk module
 */
export async function decryptDecryptableBalance(
  ciphertextBytes: Uint8Array,
  aeKey: { decrypt(ciphertext: unknown): bigint },
  zkModule?: ZkModule,
): Promise<bigint> {
  if (ciphertextBytes.length !== 36) {
    throw new Error(
      `ciphertextBytes must be 36 bytes (PodAeCiphertext), got ${ciphertextBytes.length}`,
    );
  }
  const zk = zkModule ?? zkModuleCache ?? (await loadZkSdk());
  const ct = zk.AeCiphertext.fromBytes(ciphertextBytes);
  if (!ct) throw new Error('Invalid PodAeCiphertext bytes');
  return aeKey.decrypt(ct);
}
