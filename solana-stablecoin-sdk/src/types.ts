import { PublicKey, Keypair } from "@solana/web3.js";

declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type Preset = Brand<"sss-1" | "sss-2" | "sss-3", "Preset">;
export type RoleType = Brand<
  "admin" | "minter" | "freezer" | "pauser" | "burner" | "blacklister" | "seizer",
  "RoleType"
>;
export type RoleId = Brand<0 | 1 | 2 | 3 | 4 | 5 | 6, "RoleId">;

export const preset = (v: "sss-1" | "sss-2" | "sss-3") => v as Preset;
export const roleType = (
  v: "admin" | "minter" | "freezer" | "pauser" | "burner" | "blacklister" | "seizer"
) => v as RoleType;
export const roleId = (v: 0 | 1 | 2 | 3 | 4 | 5 | 6) => v as RoleId;

export type MintAddress = Brand<PublicKey, "MintAddress">;
export type ConfigPda = Brand<PublicKey, "ConfigPda">;
export type RolePda = Brand<PublicKey, "RolePda">;
export type BlacklistPda = Brand<PublicKey, "BlacklistPda">;

export interface StablecoinCreateOptions {
  preset: Preset;
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  supplyCap?: bigint;
  mint?: Keypair;
}

export interface StablecoinInfo {
  mint: MintAddress;
  authority: PublicKey;
  preset: Preset;
  paused: boolean;
  supplyCap: bigint | null;
  totalMinted: bigint;
  totalBurned: bigint;
  currentSupply: bigint;
}

export interface RoleInfo {
  config: ConfigPda;
  address: PublicKey;
  role: RoleType;
  grantedBy: PublicKey;
  grantedAt: Date;
}

export interface BlacklistInfo {
  mint: MintAddress;
  address: PublicKey;
  addedBy: PublicKey;
  addedAt: Date;
  reason: string;
}

export const ROLE_MAP = {
  admin: roleId(0),
  minter: roleId(1),
  freezer: roleId(2),
  pauser: roleId(3),
  burner: roleId(4),
  blacklister: roleId(5),
  seizer: roleId(6),
} as Record<RoleType, RoleId>;

export const PRESET_MAP = {
  "sss-1": 1,
  "sss-2": 2,
  "sss-3": 3,
} as Record<Preset, number>;

export const REVERSE_PRESET_MAP: Record<number, Preset> = {
  1: preset("sss-1"),
  2: preset("sss-2"),
  3: preset("sss-3"),
};

export const Presets = {
  SSS_1: preset("sss-1"),
  SSS_2: preset("sss-2"),
  SSS_3: preset("sss-3"),
} as const;

export interface StablecoinExtensionConfig {
  permanentDelegate?: boolean;
  transferHook?: boolean;
  defaultAccountFrozen?: boolean;
  confidentialTransfer?: boolean;
}

export interface StablecoinCustomOptions {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  supplyCap?: bigint;
  extensions: StablecoinExtensionConfig;
}
