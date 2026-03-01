import { PublicKey } from '@solana/web3.js';
import type { RoleType, MintAddress, ConfigPda, RolePda, BlacklistPda } from './types';
import { ROLE_MAP } from './types';

export const SSS_CORE_PROGRAM_ID = new PublicKey('SSSCFmmtaU1oToJ9eMqzTtPbK9EAyoXdivUG4irBHVP');

export const SSS_HOOK_PROGRAM_ID = new PublicKey('HookFvKFaoF9KL8TUXUnQK5r2mJoMYdBENu549seRyXW');

const SSS_CONFIG_SEED = Buffer.from('sss-config');
const SSS_ROLE_SEED = Buffer.from('sss-role');
const BLACKLIST_SEED = Buffer.from('blacklist');
const EXTRA_ACCOUNT_METAS_SEED = Buffer.from('extra-account-metas');

export function deriveConfigPda(
  mint: MintAddress,
  programId: PublicKey = SSS_CORE_PROGRAM_ID,
): [ConfigPda, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [SSS_CONFIG_SEED, mint.toBuffer()],
    programId,
  );
  return [pda as ConfigPda, bump];
}

export function deriveRolePda(
  config: ConfigPda,
  address: PublicKey,
  role: RoleType,
  programId: PublicKey = SSS_CORE_PROGRAM_ID,
): [RolePda, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      SSS_ROLE_SEED,
      config.toBuffer(),
      address.toBuffer(),
      Buffer.from([(ROLE_MAP as any)[role] as number]),
    ],
    programId,
  );
  return [pda as RolePda, bump];
}

export function deriveBlacklistPda(
  mint: MintAddress,
  address: PublicKey,
  programId: PublicKey = SSS_HOOK_PROGRAM_ID,
): [BlacklistPda, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, mint.toBuffer(), address.toBuffer()],
    programId,
  );
  return [pda as BlacklistPda, bump];
}

export function deriveExtraAccountMetasPda(
  mint: MintAddress,
  programId: PublicKey = SSS_HOOK_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([EXTRA_ACCOUNT_METAS_SEED, mint.toBuffer()], programId);
}
