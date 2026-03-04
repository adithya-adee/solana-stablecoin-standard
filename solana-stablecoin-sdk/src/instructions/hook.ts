import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import type { SssTransferHook } from '../idl/sss_transfer_hook';
import type { TokenMintKey } from '../types';
import {
  deriveBlacklistPda,
  deriveConfigPda,
  deriveExtraAccountMetasPda,
  deriveRolePda,
  STBL_CORE_PROGRAM_ID,
} from '../pda';
import { asRole } from '../types';

/**
 * Build the `initializeExtraAccountMetas` instruction.
 */
export function compileHookMetaInitInstruction(
  program: Program<SssTransferHook>,
  mint: TokenMintKey,
  payer: PublicKey,
) {
  return program.methods
    .initializeExtraAccountMetas()
    .accounts({
      payer,
      mint,
    })
    .instruction();
}

/**
 * Build the `addToBlacklist` instruction.
 */
export function compileDenyListAddInstruction(
  program: Program<SssTransferHook>,
  mint: TokenMintKey,
  blacklister: PublicKey,
  address: PublicKey,
  reason: string,
  coreProgramId: PublicKey = STBL_CORE_PROGRAM_ID,
) {
  const [configPda] = deriveConfigPda(mint, coreProgramId);
  const [blacklisterRolePda] = deriveRolePda(
    configPda,
    blacklister,
    asRole('blacklister'),
    coreProgramId,
  );

  return program.methods
    .addToBlacklist(reason)
    .accounts({
      blacklister,
      blacklisterRole: blacklisterRolePda,
      mint,
      address,
    })
    .instruction();
}

/**
 * Build the `removeFromBlacklist` instruction.
 */
export function compileDenyListRemoveInstruction(
  program: Program<SssTransferHook>,
  mint: TokenMintKey,
  blacklister: PublicKey,
  address: PublicKey,
  coreProgramId: PublicKey = STBL_CORE_PROGRAM_ID,
) {
  const [blacklistEntryPda] = deriveBlacklistPda(mint, address, program.programId);

  const [configPda] = deriveConfigPda(mint, coreProgramId);
  const [blacklisterRolePda] = deriveRolePda(
    configPda,
    blacklister,
    asRole('blacklister'),
    coreProgramId,
  );

  return program.methods
    .removeFromBlacklist()
    .accountsPartial({
      blacklister,
      blacklisterRole: blacklisterRolePda,
      mint,
      blacklistEntry: blacklistEntryPda,
    })
    .instruction();
}
