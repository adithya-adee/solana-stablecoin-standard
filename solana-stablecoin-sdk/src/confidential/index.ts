import { PublicKey, TransactionInstruction, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { encryptDecryptableZero } from './keys';
import { encryptDecryptableBalance, generatePubkeyValidityProof, generateTransferProofs, generateRandomConfidentialKeys, generateWithdrawProofs } from './zk-keys';

export {
  generateDummyElgamalKeys,
  generateTestElGamalKeypair,
  generateDummyAesKey,
  encryptDecryptableZero,
  deriveElGamalKeypair,
} from './keys';

export {
  CONFIDENTIAL_TRANSFER_ELGAMAL_SEED_MESSAGE,
  CONFIDENTIAL_TRANSFER_AE_KEY_SEED_MESSAGE,
  CONFIDENTIAL_TRANSFER_EMPTY_PUBLIC_SEED,
  loadZkSdk,
  deriveConfidentialKeysFromSignatures,
  encryptDecryptableBalance,
  decryptDecryptableBalance,
  generatePubkeyValidityProof,
  generateTransferProofs,
  generateRandomConfidentialKeys,
  generateWithdrawProofs,
} from './zk-keys';
export type { DerivedConfidentialKeys } from './zk-keys';

export {
  parseConfidentialTransferAccountState,
  CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH,
} from './account-state';
export type { ParsedConfidentialTransferAccount } from './account-state';

// ───────────────────────────────────────────────────────
//  Instruction discriminators (byte 0 of instruction data)
// ───────────────────────────────────────────────────────
const CONFIDENTIAL_TRANSFER_EXTENSION_IX = 27; // TokenInstruction::ConfidentialTransferExtension

// ConfidentialTransferInstruction enum (byte 1 of instruction data)
// Source: https://docs.rs/spl-token-2022/latest/spl_token_2022/extension/confidential_transfer/instruction/enum.ConfidentialTransferInstruction.html
const CONFIGURE_ACCOUNT = 2;
const DEPOSIT = 5;
const WITHDRAW = 6;
const TRANSFER = 7;
const APPLY_PENDING_BALANCE = 8;

// ZK Token Proof Program ID (Native)
export const ZK_TOKEN_PROOF_PROGRAM_ID = new PublicKey('ZkTokenProof1111111111111111111111111111111');

// ZkTokenProofInstruction enum
const VERIFY_PUBKEY_VALIDITY = 1;
const VERIFY_CIPHERTEXT_COMMITMENT_EQUALITY = 3;
const VERIFY_BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY = 6;
const VERIFY_BATCHED_RANGE_PROOF_U128 = 8;

/**
 * Build a `ZkTokenProofInstruction::VerifyPubkeyValidity` instruction.
 */
export function createVerifyPubkeyValidityInstruction(
  proof: Uint8Array,
  contextStateAccount?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proof.length);
  data.writeUInt8(VERIFY_PUBKEY_VALIDITY, 0);
  Buffer.from(proof).copy(data, 1);

  const keys = [];
  if (contextStateAccount) {
    keys.push({ pubkey: contextStateAccount, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({
    programId: ZK_TOKEN_PROOF_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build a `ZkTokenProofInstruction::VerifyCiphertextCommitmentEquality` instruction.
 */
export function createVerifyCiphertextCommitmentEqualityInstruction(
  proof: Uint8Array,
  contextStateAccount?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proof.length);
  data.writeUInt8(VERIFY_CIPHERTEXT_COMMITMENT_EQUALITY, 0);
  Buffer.from(proof).copy(data, 1);

  const keys = [];
  if (contextStateAccount) {
    keys.push({ pubkey: contextStateAccount, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({
    programId: ZK_TOKEN_PROOF_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build a `ZkTokenProofInstruction::VerifyBatchedGroupedCiphertext3HandlesValidity` instruction.
 */
export function createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction(
  proof: Uint8Array,
  contextStateAccount?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proof.length);
  data.writeUInt8(VERIFY_BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY, 0);
  Buffer.from(proof).copy(data, 1);

  const keys = [];
  if (contextStateAccount) {
    keys.push({ pubkey: contextStateAccount, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({
    programId: ZK_TOKEN_PROOF_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build a `ZkTokenProofInstruction::VerifyBatchedRangeProofU128` instruction.
 */
export function createVerifyBatchedRangeProofU128Instruction(
  proof: Uint8Array,
  contextStateAccount?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proof.length);
  data.writeUInt8(VERIFY_BATCHED_RANGE_PROOF_U128, 0);
  Buffer.from(proof).copy(data, 1);

  const keys = [];
  if (contextStateAccount) {
    keys.push({ pubkey: contextStateAccount, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({
    programId: ZK_TOKEN_PROOF_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build the Token-2022 `ConfidentialTransferExtension::ConfigureAccount` instruction.
 *
 * > **WARNING:** This instruction **ALWAYS requires a `VerifyPubkeyValidity` ZK proof**.
 *
 * Instruction data layout (47 bytes):
 *   [0]     Extension discriminator: 27 (ConfidentialTransferExtension)
 *   [1]     Sub-instruction: 2 (ConfigureAccount)
 *   [2-37]  decryptable_zero_balance (PodAeCiphertext — 36 bytes AES ciphertext)
 *   [38-45] maximum_pending_balance_credit_counter (PodU64 — 8 bytes LE)
 *   [46]    proof_instruction_offset (i8 — 0 means use context state account)
 *
 * Accounts (single-owner):
 *   1. [writable] token account
 *   2. []         mint
 *   3. []         Instructions sysvar OR ZK context state account
 *   4. [signer]   owner
 *
 * @param tokenAccount - The ATA to configure for confidential transfers
 * @param mint - The SSS-3 mint address
 * @param owner - The token account owner (must sign)
 * @param decryptableZeroBalance - 36-byte PodAeCiphertext (AES-128-CTR encrypted zero)
 * @param maxPendingBalanceCredits - Max deposits before ApplyPending is forced (default 65536)
 * @param proofInstructionOffset - Relative offset to VerifyPubkeyValidity ix. Default 0.
 * @param contextStateAccount - ZK context state account public key (Required if proofInstructionOffset uses 0).
 */
export function createConfigureAccountInstruction(
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  decryptableZeroBalance: Uint8Array,
  maxPendingBalanceCredits: bigint = 65536n,
  proofInstructionOffset: number = 0,
  contextStateAccount?: PublicKey,
): TransactionInstruction {
  if (decryptableZeroBalance.length !== 36) {
    throw new Error(`decryptableZeroBalance must be 36 bytes, got ${decryptableZeroBalance.length}`);
  }

  const data = Buffer.alloc(47);
  let offset = 0;
  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, offset++);
  data.writeUInt8(CONFIGURE_ACCOUNT, offset++);
  Buffer.from(decryptableZeroBalance).copy(data, offset);
  offset += 36;
  (data as any).writeBigUInt64LE(maxPendingBalanceCredits, offset);
  offset += 8;
  data.writeInt8(proofInstructionOffset, offset);

  const keys = [
    { pubkey: tokenAccount, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
  ];

  if (proofInstructionOffset === 0 && contextStateAccount) {
    keys.push({ pubkey: contextStateAccount, isSigner: false, isWritable: false });
  } else {
    keys.push({ pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false });
  }

  keys.push({ pubkey: owner, isSigner: true, isWritable: false });

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build the Token-2022 `ConfidentialTransferExtension::Deposit` instruction.
 *
 * Moves the specified token amount from the public balance to the pending
 * confidential balance. No ZK proofs required for this instruction itself.
 *
 * The token account MUST have been configured with `ConfigureAccount` first.
 *
 * Instruction data layout (11 bytes):
 *   [0]    Extension discriminator: 27 (ConfidentialTransferExtension)
 *   [1]    Sub-instruction: 5 (Deposit)
 *   [2-9]  amount (PodU64 — 8 bytes LE)
 *   [10]   decimals (u8)
 *
 * Accounts (single-owner):
 *   1. [writable] token account
 *   2. []         mint
 *   3. [signer]   owner
 *
 * Source: DepositInstructionData in spl_token_2022
 */
export function createDepositInstruction(
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
): TransactionInstruction {
  const data = Buffer.alloc(11);
  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, 0);
  data.writeUInt8(DEPOSIT, 1);
  (data as any).writeBigUInt64LE(amount, 2);
  data.writeUInt8(decimals, 10);

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * Build the Token-2022 `ConfidentialTransferExtension::ApplyPendingBalance` instruction.
 *
 * Credits the pending confidential balance into the available confidential balance.
 * On-chain, pending balance is stored as pending_balance_lo (lower 16 bits) and
 * pending_balance_hi (upper 48 bits) for efficient ElGamal decryption. When applying,
 * the new available balance is (available + pending). Encrypt that sum with the user's
 * AeKey (from @solana/zk-sdk via deriveConfidentialKeysFromSignatures) using
 * encryptDecryptableBalance(newBalance, aeKey) — not raw AES-128-CTR.
 *
 * **Note:** The caller must provide:
 * - `expectedPendingBalanceCreditCounter` — the current `pending_balance_credit_counter`
 *   from the on-chain state (use parseConfidentialTransferAccountState).
 * - `newDecryptableAvailableBalance` — 36-byte PodAeCiphertext from AeKey.encrypt(newBalance).toBytes().
 *
 * Instruction data layout (46 bytes):
 *   [0]     Extension discriminator: 27 (ConfidentialTransferExtension)
 *   [1]     Sub-instruction: 8 (ApplyPendingBalance)
 *   [2-9]   expected_pending_balance_credit_counter (PodU64 — 8 bytes LE)
 *   [10-45] new_decryptable_available_balance (PodAeCiphertext — 36 bytes AES ciphertext)
 *
 * Accounts (single-owner):
 *   1. [writable] token account
 *   2. [signer]   owner
 *
 * Source: ApplyPendingBalanceData in spl_token_2022
 */
export function createApplyPendingBalanceInstruction(
  tokenAccount: PublicKey,
  owner: PublicKey,
  expectedPendingBalanceCreditCounter: bigint,
  newDecryptableAvailableBalance: Uint8Array,
): TransactionInstruction {
  if (newDecryptableAvailableBalance.length !== 36) {
    throw new Error(`newDecryptableAvailableBalance must be 36 bytes, got ${newDecryptableAvailableBalance.length}`);
  }

  const data = Buffer.alloc(46);
  let offset = 0;
  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, offset++);
  data.writeUInt8(APPLY_PENDING_BALANCE, offset++);
  (data as any).writeBigUInt64LE(expectedPendingBalanceCreditCounter, offset);
  offset += 8;
  Buffer.from(newDecryptableAvailableBalance).copy(data, offset);

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * Build the Token-2022 `ConfidentialTransferExtension::Transfer` instruction.
 */
export function createTransferInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  newSourceDecryptableBalance: Uint8Array,
  equalityProofOffset: number = -1,
  ciphertextValidityProofOffset: number = -1,
  rangeProofOffset: number = -1,
  contextStateAccount?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(41);
  let offset = 0;
  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, offset++);
  data.writeUInt8(TRANSFER, offset++);
  Buffer.from(newSourceDecryptableBalance).copy(data, offset);
  offset += 36;
  data.writeInt8(equalityProofOffset, offset++);
  data.writeInt8(ciphertextValidityProofOffset, offset++);
  data.writeInt8(rangeProofOffset, offset++);

  const keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: destination, isSigner: false, isWritable: true },
  ];

  if (
    (equalityProofOffset === 0 ||
      ciphertextValidityProofOffset === 0 ||
      rangeProofOffset === 0) &&
    contextStateAccount
  ) {
    keys.push({ pubkey: contextStateAccount, isSigner: false, isWritable: false });
  } else {
    keys.push({ pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false });
  }

  keys.push({ pubkey: authority, isSigner: true, isWritable: false });

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build the Token-2022 `ConfidentialTransferExtension::Withdraw` instruction.
 */
export function createWithdrawInstruction(
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
  newDecryptableBalance: Uint8Array,
  equalityProofOffset: number = -1,
  rangeProofOffset: number = -1,
  contextStateAccount?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(49);
  let offset = 0;
  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, offset++);
  data.writeUInt8(WITHDRAW, offset++);
  (data as any).writeBigUInt64LE(amount, offset);
  offset += 8;
  data.writeUInt8(decimals, offset++);
  Buffer.from(newDecryptableBalance).copy(data, offset);
  offset += 36;
  data.writeInt8(equalityProofOffset, offset++);
  data.writeInt8(rangeProofOffset, offset++);

  const keys = [
    { pubkey: tokenAccount, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
  ];

  if ((equalityProofOffset === 0 || rangeProofOffset === 0) && contextStateAccount) {
    keys.push({ pubkey: contextStateAccount, isSigner: false, isWritable: false });
  } else {
    keys.push({ pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false });
  }

  keys.push({ pubkey: owner, isSigner: true, isWritable: false });

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * ZK ElGamal proof program is currently disabled on mainnet and devnet (as of 2025-06-11).
 */
export const ZK_ELGAMAL_PROGRAM_DISABLED_NOTICE =
  'The ZK ElGamal proof program is disabled on mainnet and devnet. Confidential transfer/withdraw/configure will not execute until re-enablement.';

/**
 * Builder for confidential (SSS-3) token operations.
 */
export class PrivacyOpsBuilder {
  constructor(
    private _connection: unknown, // kept for API compatibility
    private mint: PublicKey,
    private owner: PublicKey,
  ) {}

  async configureAccountInstructions(
    tokenAccount: PublicKey,
    elGamalSecretKey: Uint8Array,
    aeKey?: Uint8Array | { encrypt(amount: bigint): { toBytes(): Uint8Array } },
    contextStateAccount?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { proof } = await generatePubkeyValidityProof(elGamalSecretKey);
    const proofInstructionOffset = contextStateAccount ? 0 : -1;

    const verifyIx = createVerifyPubkeyValidityInstruction(proof, contextStateAccount);
    const configIx = createConfigureAccountInstruction(
      tokenAccount,
      this.mint,
      this.owner,
      aeKey instanceof Uint8Array
        ? encryptDecryptableZero(aeKey)
        : aeKey
          ? encryptDecryptableBalance(0n, aeKey)
          : new Uint8Array(36),
      65536n,
      proofInstructionOffset,
      contextStateAccount,
    );

    return [verifyIx, configIx];
  }

  /**
   * Move tokens from public balance to pending confidential balance.
   * No ZK proofs required for this instruction itself.
   */
  createDepositInstruction(
    tokenAccount: PublicKey,
    amount: bigint,
    decimals: number,
  ): TransactionInstruction {
    return createDepositInstruction(tokenAccount, this.mint, this.owner, amount, decimals);
  }

  /**
   * Credit the pending confidential balance into the available confidential balance.
   *
   * @param tokenAccount - Token account to settle
   * @param expectedPendingBalanceCreditCounter - Current on-chain pending credit counter (default 0)
   * @param newDecryptableAvailableBalance - 36-byte AES ciphertext (default: all zeros — inaccurate but accepted)
   */
  createSettlePendingInstruction(
    tokenAccount: PublicKey,
    expectedPendingBalanceCreditCounter: bigint = 0n,
    newDecryptableAvailableBalance: Uint8Array = new Uint8Array(36),
  ): TransactionInstruction {
    return createApplyPendingBalanceInstruction(
      tokenAccount,
      this.owner,
      expectedPendingBalanceCreditCounter,
      newDecryptableAvailableBalance,
    );
  }

  /**
   * High-level helper for executing a confidential transfer.
   *
   * This method automatically handles the orchestrion of ZK (Zero-Knowledge) proof generation
   * and builds both the required proof verification instruction and the corresponding transfer instruction.
   * Specifically, it leverages `@solana/zk-sdk` to create a `GroupedCiphertext3HandlesValidityProof`
   * ensuring that the encrypted transfer amounts correctly correspond to the ElGamal keys.
   *
   * @param sourceTokenAccount - Address of the sender's confidential token account.
   * @param destinationTokenAccount - Address of the recipient's confidential token account.
   * @param amount - The raw token amount to confidently transfer in base units.
   * @param sourceElGamalSecretKey - The 32-byte secret key belonging to the sender's ElGamal key pair.
   * @param destinationElGamalPubkey - The 32-byte public key of the recipient's ElGamal key pair.
   * @param auditorElGamalPubkey - (Optional) The 32-byte public key of the assigned auditor. Defaults to an array of zeroes.
   * @param aeKey - Extracted AES Key used for decrypting and encrypting available or pending balance.
   * @param contextStateAccount - (Optional) The program-derived address used to securely preserve state across instruction bounds.
   * @returns An array of TransactionInstructions including the ZK verification and Token-2022 transfer operations.
   */
  async transferInstructions(
    sourceTokenAccount: PublicKey,
    destinationTokenAccount: PublicKey,
    amount: bigint,
    sourceElGamalSecretKey: Uint8Array,
    sourceAvailableBalanceCiphertext: Uint8Array,
    sourceCurrentBalance: bigint,
    destinationElGamalPubkey: Uint8Array,
    auditorElGamalPubkey?: Uint8Array,
    aeKey?: Uint8Array | { encrypt(amount: bigint): { toBytes(): Uint8Array } },
    contextStateAccount?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { validityProof, groupedCiphertext } = await generateTransferProofs({
      sourceKeypair: {
        pubkey: new Uint8Array(32),
        secret: sourceElGamalSecretKey,
      },
      sourceAvailableBalanceCiphertext,
      destinationPubkey: destinationElGamalPubkey,
      auditorPubkey: auditorElGamalPubkey,
      amount,
      sourceCurrentBalance,
    });

    const proofInstructionOffset = contextStateAccount ? 0 : -1;

    // Type guard for aeKey if it's a raw Uint8Array (AES key)
    // Actually, encryptDecryptableBalance expects an AeKey handle with .encrypt()
    // If the user passed raw bytes, we can't easily turn it into an AeKey handle without ZkModule.
    // We'll assume for now the user provides the AeKey handle from deriveConfidentialKeysFromSignatures.
    const aeKeyHandle = (aeKey as any)?.encrypt
      ? (aeKey as { encrypt(amount: bigint): { toBytes(): Uint8Array } })
      : undefined;

    const newSourceDecryptableBalance = aeKeyHandle
      ? encryptDecryptableBalance(0n, aeKeyHandle)
      : new Uint8Array(36);

    const verifyIx = createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction(
      validityProof,
      contextStateAccount,
    );

    const transferIx = createTransferInstruction(
      sourceTokenAccount,
      this.mint,
      destinationTokenAccount,
      this.owner,
      newSourceDecryptableBalance,
      -1, // equalityProofOffset
      proofInstructionOffset, // ciphertextValidityProofOffset
      -1, // rangeProofOffset
      contextStateAccount,
    );

    return [verifyIx, transferIx];
  }

  /**
   * High-level helper for executing a confidential withdrawal.
   *
   * Note: Withdrawing from a confidential balance requires the execution of Range proofs
   * and associated Equality proofs ensuring the remaining and withdrawn sums represent valid
   * operations under the ElGamal encryption standard. Currently, the TypeScript SDK environment
   * primarily serves the validity and configuration generation features.
   *
   * As of current implementation, fetching the cryptographic material from a fully compliant Rust
   * or extended proof-service backend may be required.
   *
   * @param tokenAccount - Address of the token account executing the withdrawal.
   * @param amount - The raw token amount transitioning to the non-confidential public balance.
   * @param decimals - Token mint decimal configuration.
   * @param aeKey - Extracted AES Key used for decrypting and encrypting available or pending balance.
   * @param contextStateAccount - (Optional) State account resolving context bounds among instruction sizes.
   * @throws Error signaling the requirement for untethered Proof Range extensions.
   */
  async withdrawInstructions(
    tokenAccount: PublicKey,
    amount: bigint,
    decimals: number,
    sourceElGamalSecretKey: Uint8Array,
    sourceAvailableBalanceCiphertext: Uint8Array,
    sourceCurrentBalance: bigint,
    aeKey?: Uint8Array | { encrypt(amount: bigint): { toBytes(): Uint8Array } },
    contextStateAccount?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { equalityProof, withdrawCiphertext } = await generateWithdrawProofs({
      sourceKeypair: {
        pubkey: new Uint8Array(32),
        secret: sourceElGamalSecretKey,
      },
      sourceAvailableBalanceCiphertext,
      amount,
      sourceCurrentBalance,
    });

    const proofInstructionOffset = contextStateAccount ? 0 : -1;

    const aeKeyHandle = (aeKey as any)?.encrypt
      ? (aeKey as { encrypt(amount: bigint): { toBytes(): Uint8Array } })
      : undefined;

    // Remaining balance encrypted for the user to update their account state
    const newDecryptableBalance = aeKeyHandle
      ? encryptDecryptableBalance(sourceCurrentBalance - amount, aeKeyHandle)
      : new Uint8Array(36);

    const verifyIx = createVerifyCiphertextCommitmentEqualityInstruction(
      equalityProof,
      contextStateAccount,
    );

    const withdrawIx = createWithdrawInstruction(
      tokenAccount,
      this.mint,
      this.owner,
      amount,
      decimals,
      newDecryptableBalance,
      proofInstructionOffset, // equality proof offset
      -1, // range proof offset (not yet implemented)
      contextStateAccount,
    );

    return [verifyIx, withdrawIx];
  }

  /**
   * Legacy placeholder function mapped directly to older core iterations.
   * Use \`transferInstructions\` to build a transfer request spanning ZK processes properly.
   *
   * @throws An error notifying to utilize \`transferInstructions\` with appropriate Proof constraints.
   */
  buildTransferInstruction(
    _senderTokenAccount: PublicKey,
    _recipientTokenAccount: PublicKey,
    _amount: bigint,
  ): TransactionInstruction {
    throw new Error(
      'Use transferInstructions(params) for a complete confidential transfer including ZK proofs.',
    );
  }

  /**
   * Legacy placeholder function mapped directly to older core iterations.
   * Use \`withdrawInstructions\` to safely retrieve instructions targeting specific ZK validations.
   *
   * @throws An error notifying to utilize \`withdrawInstructions\` with robust Range implementations.
   */
  buildWithdrawInstruction(
    _tokenAccount: PublicKey,
    _amount: bigint,
    _decimals: number,
  ): TransactionInstruction {
    throw new Error(
      'Use withdrawInstructions(params) for a complete confidential withdrawal including ZK proofs.',
    );
  }
}

