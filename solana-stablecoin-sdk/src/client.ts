import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import type { SssCore } from './idl/sss_core';
import type { SssTransferHook } from './idl/sss_transfer_hook';
import { SssCoreIdl, SssTransferHookIdl } from './idl';
import {
  resolveConfigAccount,
  resolveRoleAccount,
  resolveDenyListAccount,
  STBL_CORE_PROGRAM_ID,
  STBL_HOOK_PROGRAM_ID,
} from './pda';
import type {
  TierLabel,
  AccessRole,
  TokenDeployOptions,
  TokenExtensionOptions,
  TokenStateSnapshot,
  TokenMintKey,
  ConfigAccountKey,
} from './types';
import { TIER_ORDINAL_MAP, ORDINAL_TO_TIER_MAP, ROLE_ID_MAP, asTier, asRole } from './types';
import { translateAnchorError } from './errors';
import * as coreix from './instructions/core';
import * as hookix from './instructions/hook';
import { assembleTier1MintTx } from './presets/sss1';
import { assembleTier2MintTx } from './presets/sss2';
import { assembleTier3MintTx } from './presets/sss3';
import { PrivacyOpsBuilder } from './confidential';

export class StablecoinClient {
  readonly mintAddress: TokenMintKey;
  readonly configPda: ConfigAccountKey;
  readonly configBump: number;
  private ledgerProgram: Program<SssCore>;
  private guardProgram: Program<SssTransferHook>;
  private anchorProvider: AnchorProvider;

  private constructor(
    mint: TokenMintKey,
    configPda: ConfigAccountKey,
    configBump: number,
    ledgerProgram: Program<SssCore>,
    guardProgram: Program<SssTransferHook>,
    anchorProvider: AnchorProvider,
  ) {
    this.mintAddress = mint;
    this.configPda = configPda;
    this.configBump = configBump;
    this.ledgerProgram = ledgerProgram;
    this.guardProgram = guardProgram;
    this.anchorProvider = anchorProvider;
  }

  private async dispatchInstruction(ix: TransactionInstruction): Promise<string> {
    try {
      return await this.anchorProvider.sendAndConfirm(new Transaction().add(ix));
    } catch (err) {
      throw translateAnchorError(err);
    }
  }

  private static buildProgramPair(
    provider: AnchorProvider,
    coreProgramId: PublicKey = STBL_CORE_PROGRAM_ID,
    hookProgramId: PublicKey = STBL_HOOK_PROGRAM_ID,
  ): { ledgerProgram: Program<SssCore>; guardProgram: Program<SssTransferHook> } {
    const ledgerProgram = new Program<SssCore>(SssCoreIdl as SssCore, provider);
    const guardProgram = new Program<SssTransferHook>(
      SssTransferHookIdl as SssTransferHook,
      provider,
    );
    return { ledgerProgram, guardProgram };
  }

  static async create(
    provider: AnchorProvider,
    options: TokenDeployOptions | TokenExtensionOptions,
    mintKeypair?: Keypair,
  ): Promise<StablecoinClient> {
    if ('extensions' in options && options.extensions) {
      return StablecoinClient.initFromExtensions(provider, options as TokenExtensionOptions, mintKeypair);
    }
    const opts = options as TokenDeployOptions;
    const { ledgerProgram, guardProgram } = StablecoinClient.buildProgramPair(provider);
    const mint = mintKeypair ?? Keypair.generate();
    const payer = provider.publicKey;
    const decimals = opts.decimals ?? 6;
    const supplyCap = opts.supplyCap ? new BN(opts.supplyCap.toString()) : null;

    let mintTx: Transaction;
    switch (opts.preset) {
      case 'sss-1':
        mintTx = await assembleTier1MintTx(
          provider.connection,
          payer,
          mint,
          {
            name: opts.name,
            symbol: opts.symbol,
            uri: opts.uri,
            decimals,
          },
          ledgerProgram.programId,
        );
        break;
      case 'sss-2':
        mintTx = await assembleTier2MintTx(
          provider.connection,
          payer,
          mint,
          {
            name: opts.name,
            symbol: opts.symbol,
            uri: opts.uri,
            decimals,
          },
          ledgerProgram.programId,
        );
        break;
      case 'sss-3':
        mintTx = await assembleTier3MintTx(
          provider.connection,
          payer,
          mint,
          {
            name: opts.name,
            symbol: opts.symbol,
            uri: opts.uri,
            decimals,
          },
          ledgerProgram.programId,
        );
        break;
      default:
        throw new Error(`Unknown preset: ${opts.preset}`);
    }

    const initIx = await coreix.compileInitInstruction(
      ledgerProgram,
      mint.publicKey as TokenMintKey,
      payer,
      {
        preset: (TIER_ORDINAL_MAP as any)[opts.preset],
        name: opts.name,
        symbol: opts.symbol,
        uri: opts.uri ?? '',
        decimals,
        supplyCap,
      },
    );

    mintTx.add(initIx);

    if (opts.preset === 'sss-2') {
      const hookInitIx = await hookix.compileHookMetaInitInstruction(
        guardProgram,
        mint.publicKey as TokenMintKey,
        payer,
      );
      mintTx.add(hookInitIx);
    }

    try {
      await provider.sendAndConfirm(mintTx, [mint]);
    } catch (err) {
      throw translateAnchorError(err);
    }

    const [configPda, configBump] = resolveConfigAccount(
      mint.publicKey as TokenMintKey,
      ledgerProgram.programId,
    );

    return new StablecoinClient(
      mint.publicKey as TokenMintKey,
      configPda,
      configBump,
      ledgerProgram,
      guardProgram,
      provider,
    );
  }

  static async initFromExtensions(
    provider: AnchorProvider,
    options: TokenExtensionOptions,
    mintKeypair?: Keypair,
  ): Promise<StablecoinClient> {
    const p: TierLabel = options.extensions.confidentialTransfer
      ? asTier('sss-3')
      : options.extensions.transferHook
        ? asTier('sss-2')
        : asTier('sss-1');

    return StablecoinClient.create(
      provider,
      {
        preset: p,
        name: options.name,
        symbol: options.symbol,
        uri: options.uri,
        decimals: options.decimals,
        supplyCap: options.supplyCap,
      },
      mintKeypair,
    );
  }

  static async load(provider: AnchorProvider, mint: TokenMintKey): Promise<StablecoinClient> {
    const { ledgerProgram, guardProgram } = StablecoinClient.buildProgramPair(provider);
    const [configPda, configBump] = resolveConfigAccount(mint, ledgerProgram.programId);

    const configAccount = await ledgerProgram.account.stablecoinConfig.fetchNullable(configPda);
    if (!configAccount) {
      throw new Error(`No StablecoinConfig found for mint ${mint.toBase58()}`);
    }

    return new StablecoinClient(mint, configPda, configBump, ledgerProgram, guardProgram, provider);
  }

  async mint(options: { recipient: PublicKey; amount: bigint }): Promise<string> {
    return this.issueTokens(options.recipient, options.amount);
  }

  async issueTokens(to: PublicKey, amount: bigint): Promise<string> {
    const minter = this.anchorProvider.publicKey;
    const ix = await coreix.compileIssuanceInstruction(
      this.ledgerProgram,
      this.mintAddress,
      minter,
      to,
      new BN(amount.toString()),
    );
    return this.dispatchInstruction(ix);
  }

  async burn(from: PublicKey, amount: bigint): Promise<string> {
    const burner = this.anchorProvider.publicKey;
    const ix = await coreix.compileRedemptionInstruction(
      this.ledgerProgram,
      this.mintAddress,
      burner,
      from,
      new BN(amount.toString()),
    );
    return this.dispatchInstruction(ix);
  }

  async freeze(tokenAccount: PublicKey): Promise<string> {
    const freezer = this.anchorProvider.publicKey;
    const ix = await coreix.compileFreezeInstruction(
      this.ledgerProgram,
      this.mintAddress,
      freezer,
      tokenAccount,
    );
    return this.dispatchInstruction(ix);
  }

  async thaw(tokenAccount: PublicKey): Promise<string> {
    const freezer = this.anchorProvider.publicKey;
    const ix = await coreix.compileThawInstruction(
      this.ledgerProgram,
      this.mintAddress,
      freezer,
      tokenAccount,
    );
    return this.dispatchInstruction(ix);
  }

  async pause(): Promise<string> {
    const pauser = this.anchorProvider.publicKey;
    const ix = await coreix.compilePauseInstruction(this.ledgerProgram, this.configPda, pauser);
    return this.dispatchInstruction(ix);
  }

  async unpause(): Promise<string> {
    const pauser = this.anchorProvider.publicKey;
    const ix = await coreix.compileResumeInstruction(this.ledgerProgram, this.configPda, pauser);
    return this.dispatchInstruction(ix);
  }

  async seize(from: PublicKey, to: PublicKey, amount: bigint): Promise<string> {
    const seizer = this.anchorProvider.publicKey;
    const ix = await coreix.compileSeizeInstruction(
      this.ledgerProgram,
      this.mintAddress,
      seizer,
      from,
      to,
      new BN(amount.toString()),
    );
    return this.dispatchInstruction(ix);
  }

  async updateSupplyCap(newSupplyCap: bigint | null): Promise<string> {
    const admin = this.anchorProvider.publicKey;
    const capBN = newSupplyCap !== null ? new BN(newSupplyCap.toString()) : null;
    const ix = await coreix.compileCapUpdateInstruction(this.ledgerProgram, this.configPda, admin, capBN);
    return this.dispatchInstruction(ix);
  }

  async transferAuthority(newAuthority: PublicKey): Promise<string> {
    const admin = this.anchorProvider.publicKey;
    const ix = await coreix.compileAuthorityTransferInstruction(
      this.ledgerProgram,
      this.configPda,
      admin,
      newAuthority,
    );
    return this.dispatchInstruction(ix);
  }

  async fetchConfig(): Promise<TokenStateSnapshot> {
    const onChainState = await this.ledgerProgram.account.stablecoinConfig.fetch(this.configPda);

    const totalMinted = BigInt(onChainState.totalMinted.toString());
    const totalBurned = BigInt(onChainState.totalBurned.toString());
    const supplyCap = onChainState.supplyCap ? BigInt(onChainState.supplyCap.toString()) : null;

    return {
      mint: onChainState.mint as TokenMintKey,
      authority: onChainState.authority,
      preset: ORDINAL_TO_TIER_MAP[onChainState.preset] ?? asTier('sss-1'),
      paused: onChainState.paused,
      supplyCap,
      totalMinted,
      totalBurned,
      currentSupply: totalMinted - totalBurned,
    };
  }

  async fetchCirculatingSupply(): Promise<bigint> {
    const state = await this.fetchConfig();
    return state.currentSupply;
  }

  accessControl = {
    grant: async (address: PublicKey, role: AccessRole): Promise<string> => {
      const admin = this.anchorProvider.publicKey;
      const ix = await coreix.compileGrantInstruction(
        this.ledgerProgram,
        this.configPda,
        admin,
        address,
        role,
      );
      return this.dispatchInstruction(ix);
    },

    revoke: async (address: PublicKey, role: AccessRole): Promise<string> => {
      const admin = this.anchorProvider.publicKey;
      const [roleAccountPda] = resolveRoleAccount(
        this.configPda,
        address,
        role,
        this.ledgerProgram.programId,
      );
      const ix = await coreix.compileRevokeInstruction(
        this.ledgerProgram,
        this.configPda,
        admin,
        roleAccountPda,
      );
      return this.dispatchInstruction(ix);
    },

    check: async (address: PublicKey, role: AccessRole): Promise<boolean> => {
      const [rolePda] = resolveRoleAccount(this.configPda, address, role, this.ledgerProgram.programId);
      const account = await this.ledgerProgram.account.roleAccount.fetchNullable(rolePda);
      return account !== null;
    },
  };

  denyList = {
    add: async (address: PublicKey, reason: string): Promise<string> => {
      const blacklister = this.anchorProvider.publicKey;
      const ix = await hookix.compileDenyListAddInstruction(
        this.guardProgram,
        this.mintAddress,
        blacklister,
        address,
        reason,
        this.ledgerProgram.programId,
      );
      return this.dispatchInstruction(ix);
    },

    remove: async (address: PublicKey): Promise<string> => {
      const blacklister = this.anchorProvider.publicKey;
      const ix = await hookix.compileDenyListRemoveInstruction(
        this.guardProgram,
        this.mintAddress,
        blacklister,
        address,
        this.ledgerProgram.programId,
      );
      return this.dispatchInstruction(ix);
    },

    check: async (address: PublicKey): Promise<boolean> => {
      const [blacklistPda] = resolveDenyListAccount(
        this.mintAddress,
        address,
        this.guardProgram.programId,
      );
      const account = await this.guardProgram.account.blacklistEntry.fetchNullable(blacklistPda);
      return account !== null;
    },
  };

  get enforcement() {
    return {
      blacklistAdd: (address: PublicKey, reason: string) => this.denyList.add(address, reason),
      blacklistRemove: (address: PublicKey) => this.denyList.remove(address),
      blacklistCheck: (address: PublicKey) => this.denyList.check(address),
      seize: (from: PublicKey, to: PublicKey, amount: bigint) => this.seize(from, to, amount),
    };
  }

  privacyOps = {
    deposit: async (tokenAccount: PublicKey, amount: bigint, decimals: number): Promise<string> => {
      const ops = new PrivacyOpsBuilder(
        this.anchorProvider.connection,
        this.mintAddress,
        this.anchorProvider.publicKey,
      );
      const ix = ops.compileDepositInstruction(tokenAccount, amount, decimals);
      return this.dispatchInstruction(ix);
    },

    applyPending: async (tokenAccount: PublicKey): Promise<string> => {
      const ops = new PrivacyOpsBuilder(
        this.anchorProvider.connection,
        this.mintAddress,
        this.anchorProvider.publicKey,
      );
      const ix = ops.compileSettlePendingInstruction(tokenAccount);
      return this.dispatchInstruction(ix);
    },

    transfer: async (
      _senderAccount: PublicKey,
      _recipientAccount: PublicKey,
      _amount: bigint,
    ): Promise<string> => {
      throw new Error('Confidential transfer requires Rust proof service. See docs/SSS-3.md');
    },

    withdraw: async (
      _tokenAccount: PublicKey,
      _amount: bigint,
      _decimals: number,
    ): Promise<string> => {
      throw new Error('Confidential withdraw requires Rust proof service. See docs/SSS-3.md');
    },
  };

  // Backwards compat aliases for older functions missing from the new client mapping
  async info(): Promise<TokenStateSnapshot> { return this.fetchConfig(); }
  async getTotalSupply(): Promise<bigint> { return this.fetchCirculatingSupply(); }
  roles = this.accessControl;
  blacklist = this.denyList;
  compliance = this.enforcement;
  confidential = this.privacyOps;
  mintTokens(to: PublicKey, amount: bigint): Promise<string> { return this.issueTokens(to, amount); }
}
