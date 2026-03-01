import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  getMintLen,
  ExtensionType,
  createSetAuthorityInstruction,
  AuthorityType,
  TYPE_SIZE,
  LENGTH_SIZE,
} from '@solana/spl-token';
import { createInitializeInstruction, pack, type TokenMetadata } from '@solana/spl-token-metadata';
import type { MintAddress } from '../types';
import { deriveConfigPda } from '../pda';

export interface Sss1MintOptions {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
}

/**
 * Build a transaction that creates a Token-2022 mint for SSS-1 (Minimal preset).
 *
 * Extensions: MetadataPointer, PermanentDelegate
 * Metadata: on-chain Token Metadata
 *
 * The config PDA acts as mint authority, freeze authority, and permanent delegate.
 */
export async function createSss1MintTransaction(
  connection: Connection,
  payer: PublicKey,
  mintKeypair: Keypair,
  options: Sss1MintOptions,
  coreProgramId: PublicKey,
): Promise<Transaction> {
  const [configPda] = deriveConfigPda(mintKeypair.publicKey as MintAddress, coreProgramId);
  const decimals = options.decimals ?? 6;

  const extensions = [ExtensionType.MetadataPointer, ExtensionType.PermanentDelegate];
  const mintLen = getMintLen(extensions);

  const metadata: TokenMetadata = {
    mint: mintKeypair.publicKey,
    name: options.name,
    symbol: options.symbol,
    uri: options.uri ?? '',
    additionalMetadata: [],
    updateAuthority: configPda,
  };
  // Token-2022 extension requires exactly TYPE_SIZE (2) + LENGTH_SIZE (2) + data length bytes
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
    createInitializeMint2Instruction(
      mintKeypair.publicKey,
      decimals,
      payer, // mint authority = payer temporarily
      payer, // freeze authority = payer temporarily
      TOKEN_2022_PROGRAM_ID,
    ),
    // Initialize on-chain token metadata (requires mint authority to sign)
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mintKeypair.publicKey,
      metadata: mintKeypair.publicKey,
      name: options.name,
      symbol: options.symbol,
      uri: options.uri ?? '',
      mintAuthority: payer, // payer signs
      updateAuthority: configPda, // update authority set to configPda immediately
    }),
    // Transfer mint authority to configPda
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      payer,
      AuthorityType.MintTokens,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
    // Transfer freeze authority to configPda
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
