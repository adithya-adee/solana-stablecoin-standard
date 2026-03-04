import { StablecoinClient } from './client';
export { StablecoinClient };

import type {
  TierLabel,
  AccessRole,
  AccessRoleId,
  TokenMintKey,
  ConfigAccountKey,
  RoleAccountKey,
  DenyListKey,
  TokenDeployOptions,
  TokenStateSnapshot,
  AccessRoleInfo,
  DenyListInfo,
  ExtensionFlags,
  TokenExtensionOptions,
} from './types';

/** @deprecated Use TierLabel instead */
export type { TierLabel as Preset };
export type { TierLabel };
export type { AccessRole };
export type { AccessRoleId };
export type { TokenMintKey };
export type { ConfigAccountKey };
export type { RoleAccountKey };
export type { DenyListKey };
export type { TokenDeployOptions };
export type { TokenStateSnapshot };
export type { AccessRoleInfo };
export type { DenyListInfo };
export type { ExtensionFlags };
export type { TokenExtensionOptions };

import {
  ROLE_ID_MAP,
  TIER_ORDINAL_MAP,
  ORDINAL_TO_TIER_MAP,
  StablecoinTiers,
  asTier,
  asRole,
  asRoleId,
} from './types';

export { ROLE_ID_MAP };
export { TIER_ORDINAL_MAP };
export { ORDINAL_TO_TIER_MAP };
export { StablecoinTiers };
/** @deprecated Use asTier instead */
export { asTier as present };
export { asTier };
/** @deprecated Use asRole instead */
export { asRole as roleType };
export { asRole };
/** @deprecated Use asRoleId instead */
export { asRoleId as roleId };
export { asRoleId };

// Backwards-compatible aliases for older barrel consumers/tests
export const Presets = {
  SSS_1: 'sss-1',
  SSS_2: 'sss-2',
  SSS_3: 'sss-3',
} as const;

export const ROLE_MAP = ROLE_ID_MAP;
export const PRESET_MAP = TIER_ORDINAL_MAP;
export const REVERSE_PRESET_MAP = ORDINAL_TO_TIER_MAP;

import {
  deriveConfigPda,
  deriveRolePda,
  deriveBlacklistPda,
  deriveExtraAccountMetasPda,
  STBL_CORE_PROGRAM_ID,
  STBL_HOOK_PROGRAM_ID,
} from './pda';

export { deriveConfigPda };
export { deriveRolePda };
export { deriveBlacklistPda };
export { deriveExtraAccountMetasPda };
export { STBL_CORE_PROGRAM_ID };
export { STBL_HOOK_PROGRAM_ID };

import {
  StablecoinError,
  PausedError,
  NotPausedError,
  SupplyCapExceededError,
  UnauthorizedError,
  InvalidPresetError,
  LastAdminError,
  ArithmeticOverflowError,
  MintMismatchError,
  InvalidSupplyCapError,
  ZeroAmountError,
  InvalidRoleError,
  SenderBlacklistedError,
  ReceiverBlacklistedError,
  ReasonTooLongError,
  translateAnchorError,
} from './errors';

export { StablecoinError };
export {
  PausedError,
  NotPausedError,
  SupplyCapExceededError,
  UnauthorizedError,
  InvalidPresetError,
  LastAdminError,
  ArithmeticOverflowError,
  MintMismatchError,
  InvalidSupplyCapError,
  ZeroAmountError,
  InvalidRoleError,
  SenderBlacklistedError,
  ReceiverBlacklistedError,
  ReasonTooLongError,
};
export { translateAnchorError as mapAnchorError };

// Legacy error alias
export { StablecoinError as SssError };

// Legacy client aliases
export const SolanaStablecoin = StablecoinClient;
export const SSS = StablecoinClient;

import { createSss1MintTx } from './presets/sss1';
import type { Tier1MintParams } from './presets/sss1';
export { createSss1MintTx };
export type { Tier1MintParams };
/** @deprecated Use createSss1MintTx */
export const createSss1MintTransaction = createSss1MintTx;

import { createSss2MintTx } from './presets/sss2';
import type { Tier2MintParams } from './presets/sss2';
export { createSss2MintTx };
export type { Tier2MintParams };
/** @deprecated Use createSss2MintTx */
export const createSss2MintTransaction = createSss2MintTx;

import { createSss3MintTx, compileConfidentialMintInstruction } from './presets/sss3';
import type { Tier3MintParams } from './presets/sss3';
export { createSss3MintTx };
export { compileConfidentialMintInstruction };
export type { Tier3MintParams };
/** @deprecated Use createSss3MintTx */
export const createSss3MintTransaction = createSss3MintTx;

import { PrivacyOpsBuilder, generateDummyElgamalKeys, generateDummyAesKey } from './confidential';
export { PrivacyOpsBuilder };
export { generateDummyElgamalKeys };
export { generateDummyAesKey };

import {
  compileInitInstruction,
  compileIssuanceInstruction,
  compileRedemptionInstruction,
  compileFreezeInstruction,
  compileThawInstruction,
  compilePauseInstruction,
  compileResumeInstruction,
  compileSeizeInstruction,
  compileGrantInstruction,
  compileRevokeInstruction,
  compileAuthorityTransferInstruction,
  compileMinterUpdateInstruction,
  compileCapUpdateInstruction,
  compileHookMetaInitInstruction,
  compileDenyListAddInstruction,
  compileDenyListRemoveInstruction,
} from './instructions';

export { compileInitInstruction };
export { compileIssuanceInstruction };
export { compileRedemptionInstruction };
export { compileFreezeInstruction };
export { compileThawInstruction };
export { compilePauseInstruction };
export { compileResumeInstruction };
export { compileSeizeInstruction };
export { compileGrantInstruction };
export { compileRevokeInstruction };
export { compileAuthorityTransferInstruction };
export { compileMinterUpdateInstruction };
export { compileCapUpdateInstruction };
export { compileHookMetaInitInstruction };
export { compileDenyListAddInstruction };
export { compileDenyListRemoveInstruction };

export type { SssCore } from './idl/sss_core';
export type { SssTransferHook } from './idl/sss_transfer_hook';
export { SssCoreIdl, SssTransferHookIdl } from './idl/index';

import {
  decodePythFeed,
  loadPythFeed,
  convertUsdToRawAmount,
  convertRawAmountToUsd,
  packOracleMeta,
  PRICE_FEED_REGISTRY,
} from './oracle';
import type { PriceFeedData } from './oracle';

export { decodePythFeed };
export { loadPythFeed };
export { convertUsdToRawAmount };
export { convertRawAmountToUsd };
export { packOracleMeta };
export { PRICE_FEED_REGISTRY };
export type { PriceFeedData };
