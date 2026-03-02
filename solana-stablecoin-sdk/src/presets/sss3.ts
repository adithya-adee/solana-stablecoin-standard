import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
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
import type { TokenMintKey } from '../types';
import { resolveConfigAccount } from '../pda';

export interface Tier3MintParams {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  auditorElGamalPubkey?: Uint8Array;
  autoApproveNewAccounts?: boolean;
}

export function compileConfidentialMintInstruction(
  mint: PublicKey,
  authority: PublicKey | null,
  autoApproveNewAccounts: boolean,
  auditorElGamalPubkey: Uint8Array | null,
): TransactionInstruction {
  const data = Buffer.alloc(67);
  let offset = 0;
  data.writeUInt8(27, offset);
  offset += 1;
  data.writeUInt8(0, offset);
  offset += 1;
  if (authority) {
    authority.toBuffer().copy(data, offset);
  }
  offset += 32;
  data.writeUInt8(autoApproveNewAccounts ? 1 : 0, offset);
  offset += 1;
  if (auditorElGamalPubkey) {
    if (auditorElGamalPubkey.length !== 32) {
      throw new Error(`Auditor ElGamal pubkey must be 32 bytes, got ${auditorElGamalPubkey.length}`);
    }
    Buffer.from(auditorElGamalPubkey).copy(data, offset);
  }
  offset += 32;

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [{ pubkey: mint, isSigner: false, isWritable: true }],
    data,
  });
}

export async function assembleTier3MintTx(
  connection: Connection,
  payer: PublicKey,
  mintKeypair: Keypair,
  options: Tier3MintParams,
  coreProgramId: PublicKey,
): Promise<Transaction> {
  const [configPda] = resolveConfigAccount(mintKeypair.publicKey as TokenMintKey, coreProgramId);
  const decimals = options.decimals ?? 6;
  const autoApprove = options.autoApproveNewAccounts ?? true;
  const auditorKey = options.auditorElGamalPubkey ?? new Uint8Array(32);

  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.ConfidentialTransferMint,
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
    compileConfidentialMintInstruction(
      mintKeypair.publicKey,
      configPda,
      autoApprove,
      auditorKey,
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
