import { Program, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import type { SssCore } from '../idl/sss_core';
import { deriveConfigPda, deriveRolePda } from '../pda';
import type { AccessRole, TokenMintKey, ConfigAccountKey, RoleAccountKey } from '../types';
import { ROLE_ID_MAP, asRole } from '../types';

/**
 * Build the `initialize` instruction.
 */
export function createInitInstruction(
  program: Program<SssCore>,
  mint: TokenMintKey,
  authority: PublicKey,
  args: {
    preset: number;
    name: string;
    symbol: string;
    uri: string;
    decimals: number;
    supplyCap: BN | null;
    enablePermanentDelegate?: boolean | null;
    enableTransferHook?: boolean | null;
    defaultAccountFrozen?: boolean | null;
  },
) {
  const [configPda] = deriveConfigPda(mint, program.programId);
  const [adminRolePda] = deriveRolePda(configPda, authority, asRole('admin'), program.programId);

  return program.methods
    .initialize({
      preset: args.preset,
      name: args.name,
      symbol: args.symbol,
      uri: args.uri,
      decimals: args.decimals,
      supplyCap: args.supplyCap,
      enablePermanentDelegate: args.enablePermanentDelegate ?? null,
      enableTransferHook: args.enableTransferHook ?? null,
      defaultAccountFrozen: args.defaultAccountFrozen ?? null,
    })
    .accounts({
      authority,
      mint,
      adminRole: adminRolePda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build the `mintTokens` instruction.
 */
export function createIssuanceInstruction(
  program: Program<SssCore>,
  mint: TokenMintKey,
  minter: PublicKey,
  to: PublicKey,
  amount: BN,
  priceUpdate: PublicKey | null = null,
) {
  const [configPda] = deriveConfigPda(mint, program.programId);
  const [minterRolePda] = deriveRolePda(configPda, minter, asRole('minter'), program.programId);

  return program.methods
    .mintTokens(amount)
    .accounts({
      minter,
      mint,
      minterRole: minterRolePda,
      to,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      priceUpdate: priceUpdate ?? null,
    })
    .instruction();
}

/**
 * Build the `burnTokens` instruction.
 */
export function createRedemptionInstruction(
  program: Program<SssCore>,
  mint: TokenMintKey,
  burner: PublicKey,
  from: PublicKey,
  amount: BN,
) {
  const [configPda] = deriveConfigPda(mint, program.programId);
  const [burnerRolePda] = deriveRolePda(configPda, burner, asRole('burner'), program.programId);

  return program.methods
    .burnTokens(amount)
    .accounts({
      burner,
      mint,
      burnerRole: burnerRolePda,
      from,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build the `freezeAccount` instruction.
 */
export function createFreezeInstruction(
  program: Program<SssCore>,
  mint: TokenMintKey,
  freezer: PublicKey,
  tokenAccount: PublicKey,
) {
  const [configPda] = deriveConfigPda(mint, program.programId);
  const [freezerRolePda] = deriveRolePda(configPda, freezer, asRole('freezer'), program.programId);

  return program.methods
    .freezeAccount()
    .accounts({
      freezer,
      mint,
      freezerRole: freezerRolePda,
      tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build the `thawAccount` instruction.
 */
export function createThawInstruction(
  program: Program<SssCore>,
  mint: TokenMintKey,
  freezer: PublicKey,
  tokenAccount: PublicKey,
) {
  const [configPda] = deriveConfigPda(mint, program.programId);
  const [freezerRolePda] = deriveRolePda(configPda, freezer, asRole('freezer'), program.programId);

  return program.methods
    .thawAccount()
    .accounts({
      freezer,
      mint,
      freezerRole: freezerRolePda,
      tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build the `pause` instruction.
 */
export function createPauseInstruction(
  program: Program<SssCore>,
  configPda: ConfigAccountKey,
  pauser: PublicKey,
) {
  const [pauserRolePda] = deriveRolePda(configPda, pauser, asRole('pauser'), program.programId);

  return program.methods
    .pause()
    .accountsPartial({
      pauser,
      config: configPda,
      pauserRole: pauserRolePda,
    })
    .instruction();
}

/**
 * Build the `unpause` instruction.
 */
export function createResumeInstruction(
  program: Program<SssCore>,
  configPda: ConfigAccountKey,
  pauser: PublicKey,
) {
  const [pauserRolePda] = deriveRolePda(configPda, pauser, asRole('pauser'), program.programId);

  return program.methods
    .unpause()
    .accountsPartial({
      pauser,
      config: configPda,
      pauserRole: pauserRolePda,
    })
    .instruction();
}

/**
 * Build the `seize` instruction.
 */
export function createSeizeInstruction(
  program: Program<SssCore>,
  mint: TokenMintKey,
  seizer: PublicKey,
  from: PublicKey,
  to: PublicKey,
  amount: BN,
) {
  const [configPda] = deriveConfigPda(mint, program.programId);
  const [seizerRolePda] = deriveRolePda(configPda, seizer, asRole('seizer'), program.programId);

  return program.methods
    .seize(amount)
    .accounts({
      seizer,
      mint,
      seizerRole: seizerRolePda,
      from,
      to,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build the `grantRole` instruction.
 */
export function createGrantInstruction(
  program: Program<SssCore>,
  configPda: ConfigAccountKey,
  admin: PublicKey,
  grantee: PublicKey,
  role: AccessRole,
) {
  const [adminRolePda] = deriveRolePda(configPda, admin, asRole('admin'), program.programId);
  const [roleAccountPda] = deriveRolePda(configPda, grantee, role, program.programId);

  return program.methods
    .grantRole((ROLE_ID_MAP as any)[role] as number)
    .accountsPartial({
      admin,
      config: configPda,
      adminRole: adminRolePda,
      grantee,
      roleAccount: roleAccountPda,
    })
    .instruction();
}

/**
 * Build the `revokeRole` instruction.
 */
export function createRevokeInstruction(
  program: Program<SssCore>,
  configPda: ConfigAccountKey,
  admin: PublicKey,
  roleAccountPda: RoleAccountKey,
) {
  const [adminRolePda] = deriveRolePda(configPda, admin, asRole('admin'), program.programId);

  return program.methods
    .revokeRole()
    .accountsPartial({
      admin,
      config: configPda,
      adminRole: adminRolePda,
      roleAccount: roleAccountPda,
    })
    .instruction();
}

/**
 * Build the `transferAuthority` instruction.
 */
export function createAuthorityTransferInstruction(
  program: Program<SssCore>,
  configPda: ConfigAccountKey,
  admin: PublicKey,
  newAuthority: PublicKey,
) {
  const [adminRolePda] = deriveRolePda(configPda, admin, asRole('admin'), program.programId);
  // derive new admin role PDA
  const [newAdminRolePda] = deriveRolePda(
    configPda,
    newAuthority,
    asRole('admin'),
    program.programId,
  );
  return program.methods
    .transferAuthority()
    .accountsPartial({
      admin,
      config: configPda,
      adminRole: adminRolePda,
      newAuthority,
      newAdminRole: newAdminRolePda,
    })
    .instruction();
}

/**
 * Build the `updateMinter` instruction.
 */
export function createMinterUpdateInstruction(
  program: Program<SssCore>,
  configPda: ConfigAccountKey,
  admin: PublicKey,
  minterRoleAccountPda: RoleAccountKey,
  newQuota: BN | null,
) {
  const [adminRolePda] = deriveRolePda(configPda, admin, asRole('admin'), program.programId);

  return program.methods
    .updateMinter(newQuota)
    .accountsPartial({
      admin,
      config: configPda,
      adminRole: adminRolePda,
      minterRole: minterRoleAccountPda,
    })
    .instruction();
}

/**
 * Build the `updateSupplyCap` instruction.
 */
export function createCapUpdateInstruction(
  program: Program<SssCore>,
  configPda: ConfigAccountKey,
  admin: PublicKey,
  newSupplyCap: BN | null,
) {
  const [adminRolePda] = deriveRolePda(configPda, admin, asRole('admin'), program.programId);

  return program.methods
    .updateSupplyCap(newSupplyCap)
    .accountsPartial({
      admin,
      config: configPda,
      adminRole: adminRolePda,
    })
    .instruction();
}
