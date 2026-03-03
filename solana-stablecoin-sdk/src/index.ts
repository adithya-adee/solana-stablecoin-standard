import { StablecoinClient } from './client';
/** @deprecated Use StablecoinClient instead */
export { StablecoinClient as SSS };
/** @deprecated Use StablecoinClient instead */
export { StablecoinClient as SolanaStablecoin };
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
/** @deprecated Use AccessRole instead */
export type { AccessRole as RoleType };
export type { AccessRole };
/** @deprecated Use AccessRoleId instead */
export type { AccessRoleId as RoleId };
export type { AccessRoleId };
/** @deprecated Use TokenMintKey instead */
export type { TokenMintKey as MintAddress };
export type { TokenMintKey };
/** @deprecated Use ConfigAccountKey instead */
export type { ConfigAccountKey as ConfigPda };
export type { ConfigAccountKey };
/** @deprecated Use RoleAccountKey instead */
export type { RoleAccountKey as RolePda };
export type { RoleAccountKey };
/** @deprecated Use DenyListKey instead */
export type { DenyListKey as BlacklistPda };
export type { DenyListKey };
/** @deprecated Use TokenDeployOptions instead */
export type { TokenDeployOptions as StablecoinCreateOptions };
export type { TokenDeployOptions };
/** @deprecated Use TokenStateSnapshot instead */
export type { TokenStateSnapshot as StablecoinInfo };
export type { TokenStateSnapshot };
/** @deprecated Use AccessRoleInfo instead */
export type { AccessRoleInfo as RoleInfo };
export type { AccessRoleInfo };
/** @deprecated Use DenyListInfo instead */
export type { DenyListInfo as BlacklistInfo };
export type { DenyListInfo };
/** @deprecated Use ExtensionFlags instead */
export type { ExtensionFlags as StablecoinExtensionConfig };
export type { ExtensionFlags };
/** @deprecated Use TokenExtensionOptions instead */
export type { TokenExtensionOptions as StablecoinCustomOptions };
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

/** @deprecated Use ROLE_ID_MAP instead */
export { ROLE_ID_MAP as ROLE_MAP };
export { ROLE_ID_MAP };
/** @deprecated Use TIER_ORDINAL_MAP instead */
export { TIER_ORDINAL_MAP as PRESET_MAP };
export { TIER_ORDINAL_MAP };
/** @deprecated Use ORDINAL_TO_TIER_MAP instead */
export { ORDINAL_TO_TIER_MAP as REVERSE_PRESET_MAP };
export { ORDINAL_TO_TIER_MAP };
/** @deprecated Use StablecoinTiers instead */
export { StablecoinTiers as Presets };
export { StablecoinTiers };
/** @deprecated Use asTier instead */
export { asTier as preset };
export { asTier };
/** @deprecated Use asRole instead */
export { asRole as roleType };
export { asRole };
/** @deprecated Use asRoleId instead */
export { asRoleId as roleId };
export { asRoleId };

import {
  resolveConfigAccount,
  resolveRoleAccount,
  resolveDenyListAccount,
  resolveHookMetaAccount,
  STBL_CORE_PROGRAM_ID,
  STBL_HOOK_PROGRAM_ID,
} from './pda';

/** @deprecated Use resolveConfigAccount instead */
export { resolveConfigAccount as deriveConfigPda };
export { resolveConfigAccount };
/** @deprecated Use resolveRoleAccount instead */
export { resolveRoleAccount as deriveRolePda };
export { resolveRoleAccount };
/** @deprecated Use resolveDenyListAccount instead */
export { resolveDenyListAccount as deriveBlacklistPda };
export { resolveDenyListAccount };
/** @deprecated Use resolveHookMetaAccount instead */
export { resolveHookMetaAccount as deriveExtraAccountMetasPda };
export { resolveHookMetaAccount };
/** @deprecated Use STBL_CORE_PROGRAM_ID instead */
export { STBL_CORE_PROGRAM_ID as SSS_CORE_PROGRAM_ID };
export { STBL_CORE_PROGRAM_ID };
/** @deprecated Use STBL_HOOK_PROGRAM_ID instead */
export { STBL_HOOK_PROGRAM_ID as SSS_HOOK_PROGRAM_ID };
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

/** @deprecated Use StablecoinError instead */
export { StablecoinError as SssError };
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
/** @deprecated Use translateAnchorError instead */
export { translateAnchorError as mapAnchorError };
export { translateAnchorError };

import { assembleTier1MintTx } from './presets/sss1';
import type { Tier1MintParams } from './presets/sss1';
/** @deprecated Use assembleTier1MintTx instead */
export { assembleTier1MintTx as createSss1MintTransaction };
export { assembleTier1MintTx };
/** @deprecated Use Tier1MintParams instead */
export type { Tier1MintParams as Sss1MintOptions };
export type { Tier1MintParams };

import { assembleTier2MintTx } from './presets/sss2';
import type { Tier2MintParams } from './presets/sss2';
/** @deprecated Use assembleTier2MintTx instead */
export { assembleTier2MintTx as createSss2MintTransaction };
export { assembleTier2MintTx };
/** @deprecated Use Tier2MintParams instead */
export type { Tier2MintParams as Sss2MintOptions };
export type { Tier2MintParams };

import { assembleTier3MintTx, compileConfidentialMintInstruction } from './presets/sss3';
import type { Tier3MintParams } from './presets/sss3';
/** @deprecated Use assembleTier3MintTx instead */
export { assembleTier3MintTx as createSss3MintTransaction };
export { assembleTier3MintTx };
/** @deprecated Use compileConfidentialMintInstruction instead */
export { compileConfidentialMintInstruction as createInitializeConfidentialTransferMintInstruction };
export { compileConfidentialMintInstruction };
/** @deprecated Use Tier3MintParams instead */
export type { Tier3MintParams as Sss3MintOptions };
export type { Tier3MintParams };

import { PrivacyOpsBuilder, generateDummyElgamalKeys, generateDummyAesKey } from './confidential';
/** @deprecated Use PrivacyOpsBuilder instead */
export { PrivacyOpsBuilder as ConfidentialOps };
export { PrivacyOpsBuilder };
/** @deprecated Use generateDummyElgamalKeys instead */
export { generateDummyElgamalKeys as generateTestElGamalKeypair };
export { generateDummyElgamalKeys };
/** @deprecated Use generateDummyAesKey instead */
export { generateDummyAesKey as generateTestAesKey };
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

/** @deprecated Use compileInitInstruction instead */
export { compileInitInstruction as buildInitializeIx };
export { compileInitInstruction };
/** @deprecated Use compileIssuanceInstruction instead */
export { compileIssuanceInstruction as buildMintTokensIx };
export { compileIssuanceInstruction };
/** @deprecated Use compileRedemptionInstruction instead */
export { compileRedemptionInstruction as buildBurnTokensIx };
export { compileRedemptionInstruction };
/** @deprecated Use compileFreezeInstruction instead */
export { compileFreezeInstruction as buildFreezeAccountIx };
export { compileFreezeInstruction };
/** @deprecated Use compileThawInstruction instead */
export { compileThawInstruction as buildThawAccountIx };
export { compileThawInstruction };
/** @deprecated Use compilePauseInstruction instead */
export { compilePauseInstruction as buildPauseIx };
export { compilePauseInstruction };
/** @deprecated Use compileResumeInstruction instead */
export { compileResumeInstruction as buildUnpauseIx };
export { compileResumeInstruction };
/** @deprecated Use compileSeizeInstruction instead */
export { compileSeizeInstruction as buildSeizeIx };
export { compileSeizeInstruction };
/** @deprecated Use compileGrantInstruction instead */
export { compileGrantInstruction as buildGrantRoleIx };
export { compileGrantInstruction };
/** @deprecated Use compileRevokeInstruction instead */
export { compileRevokeInstruction as buildRevokeRoleIx };
export { compileRevokeInstruction };
/** @deprecated Use compileAuthorityTransferInstruction instead */
export { compileAuthorityTransferInstruction as buildTransferAuthorityIx };
export { compileAuthorityTransferInstruction };
/** @deprecated Use compileMinterUpdateInstruction instead */
export { compileMinterUpdateInstruction as buildUpdateMinterIx };
export { compileMinterUpdateInstruction };
/** @deprecated Use compileCapUpdateInstruction instead */
export { compileCapUpdateInstruction as buildUpdateSupplyCapIx };
export { compileCapUpdateInstruction };
/** @deprecated Use compileHookMetaInitInstruction instead */
export { compileHookMetaInitInstruction as buildInitializeExtraAccountMetasIx };
export { compileHookMetaInitInstruction };
/** @deprecated Use compileDenyListAddInstruction instead */
export { compileDenyListAddInstruction as buildAddToBlacklistIx };
export { compileDenyListAddInstruction };
/** @deprecated Use compileDenyListRemoveInstruction instead */
export { compileDenyListRemoveInstruction as buildRemoveFromBlacklistIx };
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

/** @deprecated Use decodePythFeed instead */
export { decodePythFeed as parsePythPrice };
export { decodePythFeed };
/** @deprecated Use loadPythFeed instead */
export { loadPythFeed as fetchPythPrice };
export { loadPythFeed };
/** @deprecated Use convertUsdToRawAmount instead */
export { convertUsdToRawAmount as usdToTokenAmount };
export { convertUsdToRawAmount };
/** @deprecated Use convertRawAmountToUsd instead */
export { convertRawAmountToUsd as tokenAmountToUsd };
export { convertRawAmountToUsd };
/** @deprecated Use packOracleMeta instead */
export { packOracleMeta as buildOracleRemainingAccount };
export { packOracleMeta };
/** @deprecated Use PRICE_FEED_REGISTRY instead */
export { PRICE_FEED_REGISTRY as PYTH_FEEDS };
export { PRICE_FEED_REGISTRY };
/** @deprecated Use PriceFeedData instead */
export type { PriceFeedData as OraclePrice };
export type { PriceFeedData };
