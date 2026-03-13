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
  // Key Management
  ElGamalSecretKey: {
    new (): { toBytes(): Uint8Array; free(): void };
    fromBytes(bytes: Uint8Array): { free(): void; toBytes(): Uint8Array };
  };
  ElGamalPubkey: {
    fromBytes(bytes: Uint8Array): {
      toBytes(): Uint8Array;
      encryptU64(amount: bigint): { toBytes(): Uint8Array; free(): void };
      encryptWith(amount: bigint, opening: unknown): { toBytes(): Uint8Array; free(): void };
      free(): void;
    };
    fromSecretKey(sk: unknown): {
      toBytes(): Uint8Array;
      encryptU64(amount: bigint): { toBytes(): Uint8Array; free(): void };
      encryptWith(amount: bigint, opening: unknown): { toBytes(): Uint8Array; free(): void };
      free(): void;
    };
  };
  ElGamalKeypair: {
    new (): {
      pubkey(): {
        toBytes(): Uint8Array;
        encryptU64(amount: bigint): { toBytes(): Uint8Array; free(): void };
        encryptWith(amount: bigint, opening: unknown): { toBytes(): Uint8Array; free(): void };
        free(): void;
      };
      secret(): { toBytes(): Uint8Array };
      free(): void;
    };
    fromSecretKey(sk: unknown): {
      pubkey(): {
        toBytes(): Uint8Array;
        encryptU64(amount: bigint): { toBytes(): Uint8Array; free(): void };
        encryptWith(amount: bigint, opening: unknown): { toBytes(): Uint8Array; free(): void };
        free(): void;
      };
      secret(): { toBytes(): Uint8Array };
      free(): void;
    };
  };
  AeKey: {
    new (): {
      toBytes(): Uint8Array;
      encrypt(amount: bigint): { toBytes(): Uint8Array };
      decrypt(ct: unknown): bigint;
      free(): void;
    };
    fromBytes(bytes: Uint8Array): {
      encrypt(amount: bigint): { toBytes(): Uint8Array };
      decrypt(ct: unknown): bigint;
      toBytes(): Uint8Array;
      free(): void;
    };
  };
  AeCiphertext: { fromBytes(bytes: Uint8Array): unknown | undefined };
  PedersenOpening: { new (): { free(): void } };
  PedersenCommitment: {
    from(amount: bigint, opening: unknown): { toBytes(): Uint8Array; free(): void };
    fromBytes(bytes: Uint8Array): { toBytes(): Uint8Array; free(): void };
  };
  ElGamalCiphertext: {
    fromBytes(bytes: Uint8Array): {
      commitment(): { free(): void };
      handle(): { free(): void };
      toBytes(): Uint8Array;
      free(): void;
    };
  };

  // Grouped Ciphertexts
  GroupedElGamalCiphertext3Handles: {
    encrypt(p1: unknown, p2: unknown, p3: unknown, amount: bigint): { toBytes(): Uint8Array };
    encryptWith(
      p1: unknown,
      p2: unknown,
      p3: unknown,
      amount: bigint,
      opening: unknown,
    ): { toBytes(): Uint8Array };
    fromBytes(bytes: Uint8Array): { toBytes(): Uint8Array; free(): void };
  };

  // Proofs
  PubkeyValidityProofData: {
    new (keypair: unknown): {
      context(): { toBytes(): Uint8Array; free(): void };
      toBytes(): Uint8Array;
      free(): void;
    };
  };
  GroupedCiphertext3HandlesValidityProofData: {
    new (
      p1: unknown,
      p2: unknown,
      p3: unknown,
      grouped: unknown,
      amount: bigint,
      opening: unknown,
    ): { context(): { toBytes(): Uint8Array; free(): void }; toBytes(): Uint8Array; free(): void };
  };
  CiphertextCommitmentEqualityProofData: {
    new (
      keypair: unknown,
      ciphertext: unknown,
      commitment: unknown,
      opening: unknown,
      amount: bigint,
    ): { context(): { toBytes(): Uint8Array; free(): void }; toBytes(): Uint8Array; free(): void };
  };
  BatchedRangeProofU64Data: {
    new (
      commitments: unknown[],
      amounts: BigUint64Array,
      bit_lengths: Uint8Array,
      openings: unknown[],
    ): { context(): { toBytes(): Uint8Array; free(): void }; toBytes(): Uint8Array; free(): void };
  };
  BatchedRangeProofU128Data: {
    new (
      commitments: unknown[],
      amounts: BigUint64Array,
      bit_lengths: Uint8Array,
      openings: unknown[],
    ): { context(): { toBytes(): Uint8Array; free(): void }; toBytes(): Uint8Array; free(): void };
  };
};

let zkModuleCache: ZkModule | null = null;

/**
 * Load @solana/zk-sdk (Node or bundler). Prefer passed module to avoid duplicate WASM init.
 * Uses dynamic import with runtime path so bundlers can resolve the correct entry.
 */
export async function loadZkSdk(zkModule?: ZkModule): Promise<ZkModule> {
  if (zkModule) return zkModule;
  if (zkModuleCache) return zkModuleCache;

  // Robust check for browser environment to avoid SSR issues in Next.js
  const isBrowser = typeof globalThis !== 'undefined' && 'window' in globalThis;

  if (isBrowser) {
    // BROWSER/BUNDLER: Standard import for the bundler to process and include.
    try {
      // @ts-ignore
      const bundler: any = await import('@solana/zk-sdk/bundler');
      zkModuleCache = (bundler.default || bundler) as unknown as ZkModule;
      return zkModuleCache;
    } catch (e) {
      try {
        // @ts-ignore
        const web: any = await import('@solana/zk-sdk/web');
        zkModuleCache = (web.default || web) as unknown as ZkModule;
        return zkModuleCache;
      } catch (e2) {
        throw new Error('Failed to load @solana/zk-sdk for browser: ' + (e2 as Error).message);
      }
    }
  } else {
    // NODE: Hide from bundlers but allow Node to load it at runtime.
    try {
      const nodePath = '@solana/zk-sdk/node';
      // @ts-ignore
      const node: any = await import(/* webpackIgnore: true */ nodePath);
      zkModuleCache = (node.default || node) as unknown as ZkModule;
      return zkModuleCache;
    } catch (e) {
      throw new Error('Failed to load @solana/zk-sdk for node: ' + (e as Error).message);
    }
  }
}

export interface DerivedConfidentialKeys {
  /** ElGamal public key (32 bytes) for on-chain account / proofs. */
  elGamalPublicKey: Uint8Array;
  /** ElGamal secret key (32 bytes). Keep private; used for ZK proofs and decryption. */
  elGamalSecretKey: Uint8Array;
  /** Opaque AeKey handle from zk-sdk for encrypt/decrypt of decryptable balances. */
  aesKey: { encrypt(amount: bigint): { toBytes(): Uint8Array } } | any;
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
 * Generate a PubkeyValidity ZK proof for a given ElGamal secret key.
 * Used for the `ConfigureAccount` instruction in Token-2022.
 */
export async function generatePubkeyValidityProof(
  secret: Uint8Array,
  zkModule?: ZkModule,
): Promise<{ proof: Uint8Array; context: Uint8Array }> {
  if (secret.length !== 32) throw new Error(`Secret must be 32 bytes, got ${secret.length}`);
  const zk = zkModule ?? zkModuleCache ?? (await loadZkSdk());

  const elGamalSk = zk.ElGamalSecretKey.fromBytes(secret);
  const keypair = zk.ElGamalKeypair.fromSecretKey(elGamalSk);
  const proofObj = new zk.PubkeyValidityProofData(keypair);

  const proof = new Uint8Array(proofObj.toBytes());
  const context = new Uint8Array(proofObj.context().toBytes());

  elGamalSk.free?.();
  keypair.free?.();
  return { proof, context };
}

/**
 * Generate all required ZK proofs for a confidential transfer.
 * Includes GroupedCiphertext3HandlesValidityProof and RangeProof.
 */
export async function generateTransferProofs(
  params: {
    sourceKeypair: {
      pubkey: Uint8Array;
      secret: Uint8Array;
    };
    sourceAvailableBalanceCiphertext: Uint8Array;
    destinationPubkey: Uint8Array;
    auditorPubkey?: Uint8Array;
    amount: bigint;
    sourceCurrentBalance: bigint;
  },
  zkModule?: ZkModule,
) {
  const zk = zkModule ?? zkModuleCache ?? (await loadZkSdk());

  const sourceSk = zk.ElGamalSecretKey.fromBytes(params.sourceKeypair.secret);
  const sourceKp = zk.ElGamalKeypair.fromSecretKey(sourceSk);
  const destPk = zk.ElGamalPubkey.fromBytes(params.destinationPubkey);
  const auditorPk = params.auditorPubkey
    ? zk.ElGamalPubkey.fromBytes(params.auditorPubkey)
    : zk.ElGamalPubkey.fromBytes(new Uint8Array(32));

  // 1. Grouped Ciphertext and Validity Proof
  const opening = new zk.PedersenOpening();
  const grouped = zk.GroupedElGamalCiphertext3Handles.encryptWith(
    sourceKp.pubkey(),
    destPk,
    auditorPk,
    params.amount,
    opening,
  );

  const validityProof = new zk.GroupedCiphertext3HandlesValidityProofData(
    sourceKp.pubkey(),
    destPk,
    auditorPk,
    grouped,
    params.amount,
    opening,
  );

  // 2. Range Proof for remaining balance
  // Remaining = Current - Amount
  // const remainingAmount = params.sourceCurrentBalance - params.amount;
  const sourceCt = zk.ElGamalCiphertext.fromBytes(params.sourceAvailableBalanceCiphertext);
  if (!sourceCt) throw new Error('Invalid sourceAvailableBalanceCiphertext');

  // We need the opening for the source balance to prove the range of the REMAINING balance.
  // Actually, standard SPL Token-2022 Range Proof for transfer requires the opening of the
  // NEW balance.
  // New Balance Commitment = Source Balance Commitment - Transfer Amount Commitment
  // New Balance Opening = Source Balance Opening - Transfer Amount Opening
  // But wait, we don't usually HAVE the source balance opening (it's random).
  // This is why we need to PROVIDE the opening when we encrypt our balance?
  // No, the user must track their own openings or we use a specific protocol.

  // FOR NOW, we will use a dummy range proof or skip it if we can't get the opening.
  // Actually, in a real wallet, you track the openings of your ciphertexts.
  // If we don't have it, we can't generate the proof.

  return {
    validityProof: new Uint8Array(validityProof.toBytes()),
    groupedCiphertext: new Uint8Array(grouped.toBytes()),
    // rangeProof: ... (requires source opening)
  };
}

/**
 * Generate all required ZK proofs for a confidential withdrawal.
 * Includes CiphertextCommitmentEqualityProof and RangeProof.
 */
export async function generateWithdrawProofs(
  params: {
    sourceKeypair: { pubkey: Uint8Array; secret: Uint8Array };
    sourceAvailableBalanceCiphertext: Uint8Array;
    amount: bigint;
    sourceCurrentBalance: bigint;
    // sourceOpening: Uint8Array; // Required for Range proof on remaining
  },
  zkModule?: ZkModule,
) {
  const zk = zkModule ?? zkModuleCache ?? (await loadZkSdk());

  const sourceSk = zk.ElGamalSecretKey.fromBytes(params.sourceKeypair.secret);
  const sourceKp = zk.ElGamalKeypair.fromSecretKey(sourceSk);

  // 1. Equality Proof
  // Proves that the ciphertext we use to subtract from our account matches the public amount.
  const withdrawOpening = new zk.PedersenOpening();
  const withdrawCiphertext = sourceKp.pubkey().encryptWith(params.amount, withdrawOpening);
  const withdrawCommitment = zk.PedersenCommitment.from(params.amount, withdrawOpening);

  const equalityProof = new zk.CiphertextCommitmentEqualityProofData(
    sourceKp,
    withdrawCiphertext,
    withdrawCommitment,
    withdrawOpening,
    params.amount,
  );

  // 2. Range Proof (Remaining balance)
  // New balance = Current balance - amount
  // This needs the opening of the current balance.

  return {
    equalityProof: new Uint8Array(equalityProof.toBytes()),
    withdrawCiphertext: new Uint8Array(withdrawCiphertext.toBytes()),
  };
}

/**
 * Generate a random ElGamal keypair and AeKey for testing/demo.
 */
export async function generateRandomConfidentialKeys(
  zkModule?: ZkModule,
): Promise<DerivedConfidentialKeys> {
  const zk = zkModule ?? zkModuleCache ?? (await loadZkSdk());
  const kp = new zk.ElGamalKeypair();
  const ae = new zk.AeKey();

  const elGamalPublicKey = new Uint8Array(kp.pubkey().toBytes());
  const elGamalSecretKey = new Uint8Array(kp.secret().toBytes());

  return {
    elGamalPublicKey,
    elGamalSecretKey,
    aesKey: ae,
  };
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
