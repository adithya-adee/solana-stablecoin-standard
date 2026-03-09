/**
 * Parse Token-2022 ConfidentialTransferAccount extension state.
 *
 * Layout (repr(C)): approved(1), elgamal_pubkey(32), pending_balance_lo(64),
 * pending_balance_hi(64), available_balance(64), decryptable_available_balance(36),
 * allow_confidential_credits(1), allow_non_confidential_credits(1),
 * pending_balance_credit_counter(8), maximum_pending_balance_credit_counter(8),
 * expected_pending_balance_credit_counter(8), actual_pending_balance_credit_counter(8).
 * Total 295 bytes. Pending balance is split into lo (lower 16 bits) and hi (upper 48 bits)
 * for efficient ElGamal decryption on-chain.
 */

const LEN_BOOL = 1;
const LEN_ELGAMAL_PUBKEY = 32;
const LEN_ELGAMAL_CIPHERTEXT = 64; // PodElGamalCiphertext
const LEN_AE_CIPHERTEXT = 36; // PodAeCiphertext
const LEN_U64 = 8;

const OFF_APPROVED = 0;
const OFF_ELGAMAL_PUBKEY = OFF_APPROVED + LEN_BOOL;
const OFF_PENDING_BALANCE_LO = OFF_ELGAMAL_PUBKEY + LEN_ELGAMAL_PUBKEY;
const OFF_PENDING_BALANCE_HI = OFF_PENDING_BALANCE_LO + LEN_ELGAMAL_CIPHERTEXT;
const OFF_AVAILABLE_BALANCE = OFF_PENDING_BALANCE_HI + LEN_ELGAMAL_CIPHERTEXT;
const OFF_DECRYPTABLE_AVAILABLE_BALANCE = OFF_AVAILABLE_BALANCE + LEN_ELGAMAL_CIPHERTEXT;
const OFF_ALLOW_CONFIDENTIAL_CREDITS = OFF_DECRYPTABLE_AVAILABLE_BALANCE + LEN_AE_CIPHERTEXT;
const OFF_ALLOW_NON_CONFIDENTIAL_CREDITS = OFF_ALLOW_CONFIDENTIAL_CREDITS + LEN_BOOL;
const OFF_PENDING_BALANCE_CREDIT_COUNTER = OFF_ALLOW_NON_CONFIDENTIAL_CREDITS + LEN_BOOL;
const OFF_MAXIMUM_PENDING_BALANCE_CREDIT_COUNTER = OFF_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64;
const OFF_EXPECTED_PENDING_BALANCE_CREDIT_COUNTER =
  OFF_MAXIMUM_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64;
const OFF_ACTUAL_PENDING_BALANCE_CREDIT_COUNTER =
  OFF_EXPECTED_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64;

export const CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH =
  OFF_ACTUAL_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64; // 295

export interface ParsedConfidentialTransferAccount {
  approved: boolean;
  elgamalPubkey: Uint8Array;
  /** Pending balance low 16 bits (encrypted). With pending_balance_hi forms full pending balance. */
  pendingBalanceLo: Uint8Array;
  /** Pending balance high 48 bits (encrypted). */
  pendingBalanceHi: Uint8Array;
  availableBalance: Uint8Array;
  /** 36-byte PodAeCiphertext; decrypt with user's AeKey to get available balance. */
  decryptableAvailableBalance: Uint8Array;
  allowConfidentialCredits: boolean;
  allowNonConfidentialCredits: boolean;
  /** Current counter; pass to ApplyPendingBalance as expected_pending_balance_credit_counter. */
  pendingBalanceCreditCounter: bigint;
  maximumPendingBalanceCreditCounter: bigint;
  expectedPendingBalanceCreditCounter: bigint;
  actualPendingBalanceCreditCounter: bigint;
}

/**
 * Parse raw ConfidentialTransferAccount extension data (295 bytes).
 * Use this with the extension payload only (not the full token account).
 *
 * @param data - Raw extension data
 */
export function parseConfidentialTransferAccountState(
  data: Uint8Array,
): ParsedConfidentialTransferAccount {
  if (data.length < CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH) {
    throw new Error(
      `ConfidentialTransferAccount data must be at least ${CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH} bytes, got ${data.length}`,
    );
  }
  const readU64 = (offset: number) => {
    const lo =
      data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24);
    const hi =
      data[offset + 4]! |
      (data[offset + 5]! << 8) |
      (data[offset + 6]! << 16) |
      (data[offset + 7]! << 24);
    return BigInt(lo) + BigInt(hi) * 0x1_0000_0000n;
  };
  return {
    approved: data[OFF_APPROVED]! !== 0,
    elgamalPubkey: data.slice(OFF_ELGAMAL_PUBKEY, OFF_ELGAMAL_PUBKEY + LEN_ELGAMAL_PUBKEY),
    pendingBalanceLo: data.slice(
      OFF_PENDING_BALANCE_LO,
      OFF_PENDING_BALANCE_LO + LEN_ELGAMAL_CIPHERTEXT,
    ),
    pendingBalanceHi: data.slice(
      OFF_PENDING_BALANCE_HI,
      OFF_PENDING_BALANCE_HI + LEN_ELGAMAL_CIPHERTEXT,
    ),
    availableBalance: data.slice(
      OFF_AVAILABLE_BALANCE,
      OFF_AVAILABLE_BALANCE + LEN_ELGAMAL_CIPHERTEXT,
    ),
    decryptableAvailableBalance: data.slice(
      OFF_DECRYPTABLE_AVAILABLE_BALANCE,
      OFF_DECRYPTABLE_AVAILABLE_BALANCE + LEN_AE_CIPHERTEXT,
    ),
    allowConfidentialCredits: data[OFF_ALLOW_CONFIDENTIAL_CREDITS]! !== 0,
    allowNonConfidentialCredits: data[OFF_ALLOW_NON_CONFIDENTIAL_CREDITS]! !== 0,
    pendingBalanceCreditCounter: readU64(OFF_PENDING_BALANCE_CREDIT_COUNTER),
    maximumPendingBalanceCreditCounter: readU64(OFF_MAXIMUM_PENDING_BALANCE_CREDIT_COUNTER),
    expectedPendingBalanceCreditCounter: readU64(OFF_EXPECTED_PENDING_BALANCE_CREDIT_COUNTER),
    actualPendingBalanceCreditCounter: readU64(OFF_ACTUAL_PENDING_BALANCE_CREDIT_COUNTER),
  };
}
