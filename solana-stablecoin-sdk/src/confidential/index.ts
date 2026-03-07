import { PublicKey, TransactionInstruction, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { encryptDecryptableZero } from './keys';

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
const APPLY_PENDING_BALANCE = 8;

/**
 * Build the Token-2022 `ConfidentialTransferExtension::ConfigureAccount` instruction.
 *
 * > **WARNING:** This instruction **ALWAYS requires a `VerifyPubkeyValidity` ZK proof**
 * > in the same transaction (via `zk_elgamal_proof` program). It CANNOT succeed from
 * > pure TypeScript. Use this builder only when combined with a Rust proof service.
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
 *   3. []         Instructions sysvar (or ZK context state account)
 *   4. [signer]   owner
 *
 * Source: ConfigureAccountInstructionData in spl_token_2022
 *
 * @param tokenAccount - The ATA to configure for confidential transfers
 * @param mint - The SSS-3 mint address
 * @param owner - The token account owner (must sign)
 * @param decryptableZeroBalance - 36-byte PodAeCiphertext (AES-128-CTR encrypted zero)
 * @param maxPendingBalanceCredits - Max deposits before ApplyPending is forced (default 65536)
 * @param proofInstructionOffset - Relative offset to VerifyPubkeyValidity instruction (default 0 = context state)
 */
export function createConfigureAccountInstruction(
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  decryptableZeroBalance: Uint8Array,
  maxPendingBalanceCredits: bigint = 65536n,
  proofInstructionOffset: number = 0,
): TransactionInstruction {
  if (decryptableZeroBalance.length !== 36) {
    throw new Error(
      `decryptableZeroBalance must be 36 bytes (PodAeCiphertext), got ${decryptableZeroBalance.length}`,
    );
  }

  // [0] discriminator, [1] sub-ix, [2-37] PodAeCiphertext, [38-45] PodU64, [46] i8
  const data = Buffer.alloc(47);
  let offset = 0;

  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, offset++);
  data.writeUInt8(CONFIGURE_ACCOUNT, offset++);
  // decryptable_zero_balance: PodAeCiphertext (36 bytes)
  Buffer.from(decryptableZeroBalance).copy(data, offset);
  offset += 36;
  // maximum_pending_balance_credit_counter: PodU64 (8 bytes LE)
  (data as any).writeBigUInt64LE(maxPendingBalanceCredits, offset);
  offset += 8;
  // proof_instruction_offset: i8
  data.writeInt8(proofInstructionOffset, offset);

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      // Instructions sysvar is required for the ZK proof offset to work
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
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
    throw new Error(
      `newDecryptableAvailableBalance must be 36 bytes (PodAeCiphertext), got ${newDecryptableAvailableBalance.length}`,
    );
  }

  const data = Buffer.alloc(46);
  let offset = 0;

  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, offset++);
  data.writeUInt8(APPLY_PENDING_BALANCE, offset++);
  // expected_pending_balance_credit_counter: PodU64 (8 bytes LE)
  (data as any).writeBigUInt64LE(expectedPendingBalanceCreditCounter, offset);
  offset += 8;
  // new_decryptable_available_balance: PodAeCiphertext (36 bytes)
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
 * ZK ElGamal proof program is currently disabled on mainnet and devnet (as of 2025-06-11).
 * Transfer, Withdraw, and ConfigureAccount (ZK proof instructions) will not execute until
 * Solana re-enables the program after audits. Deposit and ApplyPendingBalance do not use
 * the ZK program and can still be used where supported.
 */
export const ZK_ELGAMAL_PROGRAM_DISABLED_NOTICE =
  'The ZK ElGamal proof program is disabled on mainnet and devnet. Confidential transfer/withdraw/configure will not execute until re-enablement.';

/**
 * Builder for confidential (SSS-3) token operations.
 *
 * All ZK operations require the zk_elgamal_proof program and follow a multi-transaction flow:
 * 1. Invoke the ZK proof program to verify proof data.
 * 2. Proof metadata is stored in a "context state" account.
 * 3. Invoke the Token-2022 instruction (Transfer/Withdraw/ConfigureAccount) passing the context state accounts.
 * 4. Close the context state accounts to recover rent.
 * This is at least 3 transactions and requires managing temporary keypairs for context accounts.
 *
 * Operations:
 *  - `configureAccount` — needs `VerifyPubkeyValidity` ZK proof (and context state flow).
 *  - `createDepositInstruction` — no ZK; move public → pending.
 *  - `createSettlePendingInstruction` — no ZK; use AeKey.encrypt(available+pending) for new decryptable balance.
 *  - `buildTransferInstruction` — needs CiphertextValidity + RangeProof + EqualityProof (and context state flow).
 *  - `buildWithdrawInstruction` — needs RangeProof + EqualityProof (and context state flow).
 *
 * Transfer history of confidential amounts is not available on-chain; only the account owner can decrypt.
 */
export class PrivacyOpsBuilder {
  constructor(
    private _connection: unknown, // kept for API compatibility
    private mint: PublicKey,
    private owner: PublicKey,
  ) {}

  /**
   * Configure a token account for confidential transfers.
   *
   * Requires a `VerifyPubkeyValidity` ZK proof in the same transaction.
   * Cannot succeed without a Rust proof service.
   *
   * @param tokenAccount - The ATA to configure
   * @param _elGamalPubkey - 32-byte ElGamal public key (part of ZK proof, NOT in instruction data)
   * @param aesKey - Optional 16-byte AES key for decryptable balance encryption
   */
  configureAccount(
    tokenAccount: PublicKey,
    _elGamalPubkey: Uint8Array,
    aesKey?: Uint8Array,
  ): TransactionInstruction {
    const decryptableZero = aesKey ? encryptDecryptableZero(aesKey) : new Uint8Array(36);
    return createConfigureAccountInstruction(tokenAccount, this.mint, this.owner, decryptableZero);
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
   * Build a confidential transfer instruction.
   * **Requires the Rust proof service.** Cannot be generated in TypeScript.
   *
   * @throws Always
   */
  buildTransferInstruction(
    _senderTokenAccount: PublicKey,
    _recipientTokenAccount: PublicKey,
    _amount: bigint,
  ): TransactionInstruction {
    throw new Error(
      'Confidential transfers require ZK proofs (range, equality, ciphertext validity) ' +
        'that must be generated by a Rust proof service. ' +
        'See docs/SSS-3.md for the proof service architecture.',
    );
  }

  /**
   * Build a confidential withdraw instruction.
   * **Requires the Rust proof service.** Cannot be generated in TypeScript.
   *
   * @throws Always
   */
  buildWithdrawInstruction(
    _tokenAccount: PublicKey,
    _amount: bigint,
    _decimals: number,
  ): TransactionInstruction {
    throw new Error(
      'Confidential withdrawals require ZK proofs (range, equality) ' +
        'that must be generated by a Rust proof service. ' +
        'See docs/SSS-3.md for the proof service architecture.',
    );
  }
}
