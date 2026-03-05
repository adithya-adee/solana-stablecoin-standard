import { PublicKey, Keypair } from '@solana/web3.js';

declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TierLabel = Brand<'sss-1' | 'sss-2' | 'sss-3', 'TierLabel'>;
export type AccessRole = Brand<
  'admin' | 'minter' | 'freezer' | 'pauser' | 'burner' | 'blacklister' | 'seizer',
  'AccessRole'
>;
export type AccessRoleId = Brand<0 | 1 | 2 | 3 | 4 | 5 | 6, 'AccessRoleId'>;

export const asTier = (v: 'sss-1' | 'sss-2' | 'sss-3'): TierLabel => v as TierLabel;
export const asRole = (
  v: 'admin' | 'minter' | 'freezer' | 'pauser' | 'burner' | 'blacklister' | 'seizer',
): AccessRole => v as AccessRole;
export const asRoleId = (v: 0 | 1 | 2 | 3 | 4 | 5 | 6): AccessRoleId => v as AccessRoleId;

// Branded key types for compile-time distinction of PublicKey uses
export type TokenMintKey = Brand<PublicKey, 'TokenMintKey'>;
export type ConfigAccountKey = Brand<PublicKey, 'ConfigAccountKey'>;
export type RoleAccountKey = Brand<PublicKey, 'RoleAccountKey'>;
export type DenyListKey = Brand<PublicKey, 'DenyListKey'>;

export const asMint = (v: PublicKey): TokenMintKey => v as TokenMintKey;
export const asConfig = (v: PublicKey): ConfigAccountKey => v as ConfigAccountKey;
export const asRoleKey = (v: PublicKey): RoleAccountKey => v as RoleAccountKey;
export const asDenyListKey = (v: PublicKey): DenyListKey => v as DenyListKey;

export interface TokenDeployOptions {
  preset: TierLabel;
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  supplyCap?: bigint;
  mint?: Keypair;
  oracleFeedId?: Uint8Array | number[];
}

export interface TokenStateSnapshot {
  mint: TokenMintKey;
  authority: PublicKey;
  preset: TierLabel;
  paused: boolean;
  supplyCap: bigint | null;
  totalMinted: bigint;
  totalBurned: bigint;
  currentSupply: bigint;
}

export interface AccessRoleInfo {
  config: ConfigAccountKey;
  address: PublicKey;
  role: AccessRole;
  grantedBy: PublicKey;
  grantedAt: Date;
}

export interface DenyListInfo {
  mint: TokenMintKey;
  address: PublicKey;
  addedBy: PublicKey;
  addedAt: Date;
  reason: string;
}

// String-keyed maps with branded type values
export const ROLE_ID_MAP: Record<string, AccessRoleId> = {
  admin: asRoleId(0),
  minter: asRoleId(1),
  freezer: asRoleId(2),
  pauser: asRoleId(3),
  burner: asRoleId(4),
  blacklister: asRoleId(5),
  seizer: asRoleId(6),
};

export const TIER_ORDINAL_MAP: Record<string, number> = {
  'sss-1': 1,
  'sss-2': 2,
  'sss-3': 3,
};

export const ORDINAL_TO_TIER_MAP: Record<number, TierLabel> = {
  1: asTier('sss-1'),
  2: asTier('sss-2'),
  3: asTier('sss-3'),
};

export const StablecoinTiers = {
  SSS_1: asTier('sss-1'),
  SSS_2: asTier('sss-2'),
  SSS_3: asTier('sss-3'),
} as const;

export interface ExtensionFlags {
  permanentDelegate?: boolean;
  transferHook?: boolean;
  defaultAccountFrozen?: boolean;
  confidentialTransfer?: boolean;
}

export interface TokenExtensionOptions {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  supplyCap?: bigint;
  extensions: ExtensionFlags;
  oracleFeedId?: Uint8Array | number[];
}
