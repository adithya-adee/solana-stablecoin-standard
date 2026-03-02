import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  resolveConfigAccount,
  resolveRoleAccount,
  resolveDenyListAccount,
  resolveHookMetaAccount,
  STBL_CORE_PROGRAM_ID,
  STBL_HOOK_PROGRAM_ID,
} from '../src/pda';

describe('PDA derivation', () => {
  it('derives config PDA deterministically', () => {
    const mint = PublicKey.unique();
    const [pda1, bump1] = resolveConfigAccount(mint, STBL_CORE_PROGRAM_ID);
    const [pda2, bump2] = resolveConfigAccount(mint, STBL_CORE_PROGRAM_ID);
    expect(pda1.equals(pda2)).toBe(true);
    expect(bump1).toBe(bump2);
  });

  it('derives different PDAs for different mints', () => {
    const mint1 = PublicKey.unique();
    const mint2 = PublicKey.unique();
    const [pda1] = resolveConfigAccount(mint1, STBL_CORE_PROGRAM_ID);
    const [pda2] = resolveConfigAccount(mint2, STBL_CORE_PROGRAM_ID);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it('config PDA is off-curve', () => {
    const mint = PublicKey.unique();
    const [pda] = resolveConfigAccount(mint, STBL_CORE_PROGRAM_ID);
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false);
  });

  it('derives role PDA deterministically', () => {
    const config = PublicKey.unique();
    const address = PublicKey.unique();
    const [pda1] = resolveRoleAccount(config, address, 'minter', STBL_CORE_PROGRAM_ID);
    const [pda2] = resolveRoleAccount(config, address, 'minter', STBL_CORE_PROGRAM_ID);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it('derives different role PDAs for different roles', () => {
    const config = PublicKey.unique();
    const address = PublicKey.unique();
    const [minterPda] = resolveRoleAccount(config, address, 'minter', STBL_CORE_PROGRAM_ID);
    const [freezerPda] = resolveRoleAccount(config, address, 'freezer', STBL_CORE_PROGRAM_ID);
    expect(minterPda.equals(freezerPda)).toBe(false);
  });

  it('derives different role PDAs for different addresses', () => {
    const config = PublicKey.unique();
    const address1 = PublicKey.unique();
    const address2 = PublicKey.unique();
    const [pda1] = resolveRoleAccount(config, address1, 'admin', STBL_CORE_PROGRAM_ID);
    const [pda2] = resolveRoleAccount(config, address2, 'admin', STBL_CORE_PROGRAM_ID);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it('derives all four role types without error', () => {
    const config = PublicKey.unique();
    const address = PublicKey.unique();
    const roles = ['admin', 'minter', 'freezer', 'pauser'] as const;
    const pdas = roles.map((r) => resolveRoleAccount(config, address, r, STBL_CORE_PROGRAM_ID));
    // All should be unique
    const pdaSet = new Set(pdas.map(([pda]) => pda.toBase58()));
    expect(pdaSet.size).toBe(4);
  });

  it('derives blacklist PDA deterministically', () => {
    const mint = PublicKey.unique();
    const address = PublicKey.unique();
    const [pda1] = resolveDenyListAccount(mint, address, STBL_HOOK_PROGRAM_ID);
    const [pda2] = resolveDenyListAccount(mint, address, STBL_HOOK_PROGRAM_ID);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it('blacklist PDA is off-curve', () => {
    const mint = PublicKey.unique();
    const address = PublicKey.unique();
    const [pda] = resolveDenyListAccount(mint, address, STBL_HOOK_PROGRAM_ID);
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false);
  });

  it('derives different blacklist PDAs for different addresses', () => {
    const mint = PublicKey.unique();
    const address1 = PublicKey.unique();
    const address2 = PublicKey.unique();
    const [pda1] = resolveDenyListAccount(mint, address1, STBL_HOOK_PROGRAM_ID);
    const [pda2] = resolveDenyListAccount(mint, address2, STBL_HOOK_PROGRAM_ID);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it('derives extra account metas PDA deterministically', () => {
    const mint = PublicKey.unique();
    const [pda1] = resolveHookMetaAccount(mint, STBL_HOOK_PROGRAM_ID);
    const [pda2] = resolveHookMetaAccount(mint, STBL_HOOK_PROGRAM_ID);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it('extra account metas PDA is off-curve', () => {
    const mint = PublicKey.unique();
    const [pda] = resolveHookMetaAccount(mint, STBL_HOOK_PROGRAM_ID);
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false);
  });

  it('uses correct default program IDs', () => {
    const mint = PublicKey.unique();
    // Default should use STBL_CORE_PROGRAM_ID
    const [pdaDefault] = resolveConfigAccount(mint);
    const [pdaExplicit] = resolveConfigAccount(mint, STBL_CORE_PROGRAM_ID);
    expect(pdaDefault.equals(pdaExplicit)).toBe(true);

    // Blacklist default should use STBL_HOOK_PROGRAM_ID
    const address = PublicKey.unique();
    const [blDefault] = resolveDenyListAccount(mint, address);
    const [blExplicit] = resolveDenyListAccount(mint, address, STBL_HOOK_PROGRAM_ID);
    expect(blDefault.equals(blExplicit)).toBe(true);
  });
});
