import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import type {
  AccessRole,
  TokenMintKey,
  ConfigAccountKey,
  RoleAccountKey,
  DenyListKey,
} from './types';
import { ROLE_ID_MAP } from './types';

// Program ID
export const STBL_CORE_PROGRAM_ID = new PublicKey('SSSCFmmtaU1oToJ9eMqzTtPbK9EAyoXdivUG4irBHVP');
export const STBL_HOOK_PROGRAM_ID = new PublicKey('HookFvKFaoF9KL8TUXUnQK5r2mJoMYdBENu549seRyXW');

// Static Seeds
const STBL_CONFIG_SEED = Buffer.from('sss-config');
const STBL_ROLE_SEED = Buffer.from('sss-role');
const DENY_LIST_SEED = Buffer.from('blacklist');
const HOOK_EXTRA_METAS_SEED = Buffer.from('extra-account-metas');

export function deriveConfigPda(
  mint: TokenMintKey,
  programId: PublicKey = STBL_CORE_PROGRAM_ID,
): [ConfigAccountKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [STBL_CONFIG_SEED, mint.toBuffer()],
    programId,
  );
  return [pda as ConfigAccountKey, bump];
}

export function deriveRolePda(
  config: ConfigAccountKey,
  address: PublicKey,
  role: AccessRole,
  programId: PublicKey = STBL_CORE_PROGRAM_ID,
): [RoleAccountKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      STBL_ROLE_SEED,
      config.toBuffer(),
      address.toBuffer(),
      Buffer.from([(ROLE_ID_MAP as any)[role] as number]),
    ],
    programId,
  );
  return [pda as RoleAccountKey, bump];
}

export function deriveBlacklistPda(
  mint: TokenMintKey,
  address: PublicKey,
  programId: PublicKey = STBL_HOOK_PROGRAM_ID,
): [DenyListKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [DENY_LIST_SEED, mint.toBuffer(), address.toBuffer()],
    programId,
  );
  return [pda as DenyListKey, bump];
}

export function deriveExtraAccountMetasPda(
  mint: TokenMintKey,
  programId: PublicKey = STBL_HOOK_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([HOOK_EXTRA_METAS_SEED, mint.toBuffer()], programId);
}
