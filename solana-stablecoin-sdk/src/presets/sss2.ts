import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
  createInitializeDefaultAccountStateInstruction,
  getMintLen,
  ExtensionType,
  AccountState,
  createSetAuthorityInstruction,
  AuthorityType,
  TYPE_SIZE,
  LENGTH_SIZE,
} from '@solana/spl-token';
import { createInitializeInstruction, pack, type TokenMetadata } from '@solana/spl-token-metadata';
import type { TokenMintKey } from '../types';
import { resolveConfigAccount, STBL_HOOK_PROGRAM_ID } from '../pda';

export interface Tier2MintParams {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  hookProgramId?: PublicKey;
}

export async function assembleTier2MintTx(
  connection: Connection,
  payer: PublicKey,
  mintKeypair: Keypair,
  options: Tier2MintParams,
  coreProgramId: PublicKey,
): Promise<Transaction> {
  const [configPda] = resolveConfigAccount(mintKeypair.publicKey as TokenMintKey, coreProgramId);
  const hookProgramId = options.hookProgramId ?? STBL_HOOK_PROGRAM_ID;
  const decimals = options.decimals ?? 6;

  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
  ];
  const mintLen = getMintLen(extensions);

  const metadata: TokenMetadata = {
    mint: mintKeypair.publicKey,
    name: options.name,
    symbol: options.symbol,
    uri: options.uri ?? '',
    additionalMetadata: [],
    updateAuthority: configPda,
  };
  const metadataLen = pack(metadata).length;
  const totalLen = mintLen + TYPE_SIZE + LENGTH_SIZE + metadataLen;

  const lamports = await connection.getMinimumBalanceForRentExemption(totalLen);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mintKeypair.publicKey,
      configPda,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializePermanentDelegateInstruction(
      mintKeypair.publicKey,
      configPda,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeTransferHookInstruction(
      mintKeypair.publicKey,
      configPda,
      hookProgramId,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeDefaultAccountStateInstruction(
      mintKeypair.publicKey,
      AccountState.Frozen,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMint2Instruction(
      mintKeypair.publicKey,
      decimals,
      payer,
      payer,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mintKeypair.publicKey,
      metadata: mintKeypair.publicKey,
      name: options.name,
      symbol: options.symbol,
      uri: options.uri ?? '',
      mintAuthority: payer,
      updateAuthority: configPda,
    }),
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      payer,
      AuthorityType.MintTokens,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      payer,
      AuthorityType.FreezeAccount,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  return tx;
}
