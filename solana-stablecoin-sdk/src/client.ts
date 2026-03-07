import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { SssCore } from './idl/sss_core';
import type { SssTransferHook } from './idl/sss_transfer_hook';
import { SssCoreIdl, SssTransferHookIdl } from './idl';
import {
  deriveConfigPda,
  deriveRolePda,
  deriveBlacklistPda,
  deriveExtraAccountMetasPda,
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
import { createSss1MintTx } from './presets/sss1';
import { createSss2MintTx } from './presets/sss2';
import { createSss3MintTx } from './presets/sss3';
import { PrivacyOpsBuilder } from './confidential';

export class StablecoinClient {
  public readonly mintAddress: TokenMintKey;
  public readonly configPda: ConfigAccountKey;
  public readonly configBump: number;
  public ledgerProgram: Program<SssCore>;
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

  /**
   * Resolves the PDA for a specific role account.
   */
  resolveRoleAccount(owner: PublicKey, role: AccessRole): [PublicKey, number] {
    return deriveRolePda(this.configPda, owner, role);
  }

  private async dispatchInstruction(
    ixs: TransactionInstruction | TransactionInstruction[],
  ): Promise<string> {
    try {
      const tx = new Transaction();
      if (Array.isArray(ixs)) {
        ixs.forEach((ix) => tx.add(ix));
      } else {
        tx.add(ixs);
      }
      return await this.anchorProvider.sendAndConfirm(tx);
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
      return StablecoinClient.initFromExtensions(
        provider,
        options as TokenExtensionOptions,
        mintKeypair,
      );
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
        mintTx = await createSss1MintTx(
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
        mintTx = await createSss2MintTx(
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
        mintTx = await createSss3MintTx(
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

    const initIx = await coreix.createInitInstruction(
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
        oracleFeedId: opts.oracleFeedId ?? null,
      },
    );

    mintTx.add(initIx);

    const [configPda, configBump] = deriveConfigPda(
      mint.publicKey as TokenMintKey,
      ledgerProgram.programId,
    );

    if (opts.initialRoles && Array.isArray(opts.initialRoles)) {
      for (const roleStr of opts.initialRoles) {
        let validRole: AccessRole | null = null;
        switch (roleStr.toLowerCase()) {
          case 'admin':
          case 'minter':
          case 'freezer':
          case 'pauser':
          case 'burner':
          case 'blacklister':
          case 'seizer':
            validRole = asRole(roleStr.toLowerCase() as any);
            break;
        }
        if (validRole) {
          // If the user requests 'admin', skip since it's already granted by the smart contract
          if (validRole === asRole('admin')) continue;

          const grantIx = await coreix.createGrantInstruction(
            ledgerProgram,
            configPda,
            payer,
            payer,
            validRole,
          );
          mintTx.add(grantIx);
        }
      }
    }

    if (opts.preset === 'sss-2') {
      const hookInitIx = await hookix.createHookMetaInitInstruction(
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
        oracleFeedId: options.oracleFeedId,
        initialRoles: options.initialRoles,
      },
      mintKeypair,
    );
  }

  static async load(provider: AnchorProvider, mint: TokenMintKey): Promise<StablecoinClient> {
    const { ledgerProgram, guardProgram } = StablecoinClient.buildProgramPair(provider);
    const [configPda, configBump] = deriveConfigPda(mint, ledgerProgram.programId);

    const configAccount = await ledgerProgram.account.stablecoinConfig.fetchNullable(configPda);
    if (!configAccount) {
      throw new Error(`No StablecoinConfig found for mint ${mint.toBase58()}`);
    }

    return new StablecoinClient(mint, configPda, configBump, ledgerProgram, guardProgram, provider);
  }

  async mint(options: { recipient: PublicKey; amount: bigint }): Promise<string> {
    const tx = await this.composeMintTokens(options.recipient, options.amount);
    return this.dispatchInstruction(tx.instructions);
  }

  /**
   * Low-level minting. Recipient must be a token account.
   */
  async issueTokens(to: PublicKey, amount: bigint): Promise<string> {
    const minter = this.anchorProvider.publicKey;
    const ix = await coreix.createIssuanceInstruction(
      this.ledgerProgram,
      this.mintAddress,
      minter,
      to,
      new BN(amount.toString()),
    );
    return this.dispatchInstruction(ix);
  }

  /**
   * Compose a transaction for minting tokens, including ATA creation if needed.
   * For SSS-2 mints with DefaultAccountState::Frozen, automatically thaws
   * newly created accounts before minting.
   */
  async composeMintTokens(to: PublicKey, amount: bigint): Promise<Transaction> {
    const minter = this.anchorProvider.publicKey;
    const tx = new Transaction();

    const ata = getAssociatedTokenAddressSync(
      this.mintAddress,
      to,
      true, // Allow owner off-curve? Usually false but Stablecoin standard often uses PDAs
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const accountInfo = await this.anchorProvider.connection.getAccountInfo(ata);
    const isNewAccount = !accountInfo;
    if (isNewAccount) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          this.anchorProvider.publicKey,
          ata,
          to,
          this.mintAddress,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Fetch config to check preset and oracle settings
    let priceUpdate: PublicKey | null = null;
    let preset = 1;
    try {
      const config = await this.ledgerProgram.account.stablecoinConfig.fetch(this.configPda);
      preset = (config as any).preset ?? 1;
      // oracleFeedId is a [32]u8 array; all-zeros means "no oracle configured"
      const oracleFeedId: number[] | Uint8Array | null | undefined =
        (config as any).oracleFeedId ?? (config as any).oracle_feed_id;
      const hasOracle =
        oracleFeedId != null && (oracleFeedId as number[]).some((b: number) => b !== 0);
      if (hasOracle) {
        // When an oracle IS configured, the caller should provide the correct price update
        // account via a higher-level API. For now we leave it null so the instruction
        // falls back to raw-unit cap enforcement.
        priceUpdate = null;
      }
    } catch (e) {
      // ignore — fall back to defaults
    }

    // SSS-2 has DefaultAccountState::Frozen — newly created ATAs are frozen.
    // We must thaw the account before minting to it.
    if (preset === 2 && isNewAccount) {
      const thawIx = await coreix.createThawInstruction(
        this.ledgerProgram,
        this.mintAddress,
        minter,
        ata,
      );
      tx.add(thawIx);
    }

    const mintIx = await coreix.createIssuanceInstruction(
      this.ledgerProgram,
      this.mintAddress,
      minter,
      ata,
      new BN(amount.toString()),
      priceUpdate,
    );
    tx.add(mintIx);

    return tx;
  }

  /** @deprecated Use mint() */
  // issueTokens restored above

  async burn(from: PublicKey, amount: bigint): Promise<string> {
    const tx = await this.composeBurnTokens(from, amount);
    return this.dispatchInstruction(tx.instructions);
  }

  /**
   * Low-level burn. From must be a token account.
   */
  async burnTokens(from: PublicKey, amount: bigint): Promise<string> {
    const burner = this.anchorProvider.publicKey;
    const ix = await coreix.createRedemptionInstruction(
      this.ledgerProgram,
      this.mintAddress,
      burner,
      from,
      new BN(amount.toString()),
    );
    return this.dispatchInstruction(ix);
  }

  async composeBurnTokens(owner: PublicKey, amount: bigint): Promise<Transaction> {
    const burner = this.anchorProvider.publicKey;
    const ata = getAssociatedTokenAddressSync(
      this.mintAddress,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const ix = await coreix.createRedemptionInstruction(
      this.ledgerProgram,
      this.mintAddress,
      burner,
      ata,
      new BN(amount.toString()),
    );
    return new Transaction().add(ix);
  }

  async freeze(address: PublicKey): Promise<string> {
    const tx = await this.composeFreezeAccount(address);
    return this.dispatchInstruction(tx.instructions);
  }

  /**
   * Low-level freeze. Address must be a token account.
   */
  async freezeAccount(address: PublicKey): Promise<string> {
    const freezer = this.anchorProvider.publicKey;
    const ix = await coreix.createFreezeInstruction(
      this.ledgerProgram,
      this.mintAddress,
      freezer,
      address,
    );
    return this.dispatchInstruction(ix);
  }

  async composeFreezeAccount(address: PublicKey): Promise<Transaction> {
    const freezer = this.anchorProvider.publicKey;
    const ata = getAssociatedTokenAddressSync(
      this.mintAddress,
      address,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const ix = await coreix.createFreezeInstruction(
      this.ledgerProgram,
      this.mintAddress,
      freezer,
      ata,
    );
    return new Transaction().add(ix);
  }

  async thaw(address: PublicKey): Promise<string> {
    const tx = await this.composeThawAccount(address);
    return this.dispatchInstruction(tx.instructions);
  }

  /**
   * Low-level thaw. Address must be a token account.
   */
  async thawAccount(address: PublicKey): Promise<string> {
    const freezer = this.anchorProvider.publicKey;
    const ix = await coreix.createThawInstruction(
      this.ledgerProgram,
      this.mintAddress,
      freezer,
      address,
    );
    return this.dispatchInstruction(ix);
  }

  async composeThawAccount(address: PublicKey): Promise<Transaction> {
    const freezer = this.anchorProvider.publicKey;
    const ata = getAssociatedTokenAddressSync(
      this.mintAddress,
      address,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const ix = await coreix.createThawInstruction(
      this.ledgerProgram,
      this.mintAddress,
      freezer,
      ata,
    );
    return new Transaction().add(ix);
  }

  async pause(): Promise<string> {
    const tx = await this.composePause();
    return this.dispatchInstruction(tx.instructions);
  }

  async composePause(): Promise<Transaction> {
    const pauser = this.anchorProvider.publicKey;
    const ix = await coreix.createPauseInstruction(this.ledgerProgram, this.configPda, pauser);
    return new Transaction().add(ix);
  }

  async unpause(): Promise<string> {
    const tx = await this.composeResume();
    return this.dispatchInstruction(tx.instructions);
  }

  async composeResume(): Promise<Transaction> {
    const pauser = this.anchorProvider.publicKey;
    const ix = await coreix.createResumeInstruction(this.ledgerProgram, this.configPda, pauser);
    return new Transaction().add(ix);
  }

  async seize(from: PublicKey, to: PublicKey, amount: bigint): Promise<string> {
    const tx = await this.composeSeize(from, to, amount);
    return this.dispatchInstruction(tx.instructions);
  }

  async composeSeize(from: PublicKey, to: PublicKey, amount: bigint): Promise<Transaction> {
    const seizer = this.anchorProvider.publicKey;
    const tx = new Transaction();

    // Destination ATA check/create
    const toAta = getAssociatedTokenAddressSync(
      this.mintAddress,
      to,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const toAccountInfo = await this.anchorProvider.connection.getAccountInfo(toAta);
    if (!toAccountInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          this.anchorProvider.publicKey,
          toAta,
          to,
          this.mintAddress,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Source ATA (must exist)
    const fromAta = getAssociatedTokenAddressSync(
      this.mintAddress,
      from,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const seizeIx = await coreix.createSeizeInstruction(
      this.ledgerProgram,
      this.mintAddress,
      seizer,
      fromAta,
      toAta,
      new BN(amount.toString()),
    );
    tx.add(seizeIx);

    return tx;
  }

  async updateSupplyCap(newSupplyCap: bigint | null): Promise<string> {
    const tx = await this.composeUpdateSupplyCap(newSupplyCap);
    return this.dispatchInstruction(tx.instructions);
  }

  async composeUpdateSupplyCap(newSupplyCap: bigint | null): Promise<Transaction> {
    const admin = this.anchorProvider.publicKey;
    const capBN = newSupplyCap !== null ? new BN(newSupplyCap.toString()) : null;
    const ix = await coreix.createCapUpdateInstruction(
      this.ledgerProgram,
      this.configPda,
      admin,
      capBN,
    );
    return new Transaction().add(ix);
  }

  async transferAuthority(newAuthority: PublicKey): Promise<string> {
    const tx = await this.composeTransferAuthority(newAuthority);
    return this.dispatchInstruction(tx.instructions);
  }

  async composeTransferAuthority(newAuthority: PublicKey): Promise<Transaction> {
    const admin = this.anchorProvider.publicKey;
    const ix = await coreix.createAuthorityTransferInstruction(
      this.ledgerProgram,
      this.configPda,
      admin,
      newAuthority,
    );
    return new Transaction().add(ix);
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

  async getTotalSupply(): Promise<bigint> {
    const state = await this.fetchConfig();
    return state.currentSupply;
  }

  async updateMinter(minter: PublicKey, newQuota: bigint | null): Promise<string> {
    const tx = await this.composeUpdateMinter(minter, newQuota);
    return this.dispatchInstruction(tx.instructions);
  }

  async composeUpdateMinter(minter: PublicKey, newQuota: bigint | null): Promise<Transaction> {
    const admin = this.anchorProvider.publicKey;
    const [rolePda] = deriveRolePda(
      this.configPda,
      minter,
      asRole('minter'),
      this.ledgerProgram.programId,
    );
    const quotaBN = newQuota !== null ? new BN(newQuota.toString()) : null;
    const ix = await coreix.createMinterUpdateInstruction(
      this.ledgerProgram,
      this.configPda,
      admin,
      rolePda,
      quotaBN,
    );
    return new Transaction().add(ix);
  }

  get accessControl() {
    return {
      grant: async (address: PublicKey, role: AccessRole): Promise<string> => {
        const tx = await this.composeGrantRole(address, role);
        return this.dispatchInstruction(tx.instructions);
      },

      revoke: async (address: PublicKey, role: AccessRole): Promise<string> => {
        const tx = await this.composeRevokeRole(address, role);
        return this.dispatchInstruction(tx.instructions);
      },

      check: async (address: PublicKey, role: AccessRole): Promise<boolean> => {
        const [rolePda] = deriveRolePda(
          this.configPda,
          address,
          role,
          this.ledgerProgram.programId,
        );
        const account = await this.ledgerProgram.account.roleAccount.fetchNullable(rolePda);
        return account !== null;
      },
    };
  }

  async composeGrantRole(address: PublicKey, role: AccessRole): Promise<Transaction> {
    const admin = this.anchorProvider.publicKey;
    const ix = await coreix.createGrantInstruction(
      this.ledgerProgram,
      this.configPda,
      admin,
      address,
      role,
    );
    return new Transaction().add(ix);
  }

  async composeRevokeRole(address: PublicKey, role: AccessRole): Promise<Transaction> {
    const admin = this.anchorProvider.publicKey;
    const [roleAccountPda] = deriveRolePda(
      this.configPda,
      address,
      role,
      this.ledgerProgram.programId,
    );
    const ix = await coreix.createRevokeInstruction(
      this.ledgerProgram,
      this.configPda,
      admin,
      roleAccountPda,
    );
    return new Transaction().add(ix);
  }

  get denyList() {
    return {
      add: async (address: PublicKey, reason: string): Promise<string> => {
        const tx = await this.composeBlacklistAdd(address, reason);
        return this.dispatchInstruction(tx.instructions);
      },

      remove: async (address: PublicKey): Promise<string> => {
        const tx = await this.composeBlacklistRemove(address);
        return this.dispatchInstruction(tx.instructions);
      },

      check: async (address: PublicKey): Promise<boolean> => {
        const [blacklistPda] = deriveBlacklistPda(
          this.mintAddress,
          address,
          this.guardProgram.programId,
        );
        const account = await this.guardProgram.account.blacklistEntry.fetchNullable(blacklistPda);
        return account !== null;
      },
    };
  }

  async composeBlacklistAdd(address: PublicKey, reason: string): Promise<Transaction> {
    const blacklister = this.anchorProvider.publicKey;
    const ix = await hookix.createDenyListAddInstruction(
      this.guardProgram,
      this.mintAddress,
      blacklister,
      address,
      reason,
      this.ledgerProgram.programId,
    );
    return new Transaction().add(ix);
  }

  async composeBlacklistRemove(address: PublicKey): Promise<Transaction> {
    const blacklister = this.anchorProvider.publicKey;
    const ix = await hookix.createDenyListRemoveInstruction(
      this.guardProgram,
      this.mintAddress,
      blacklister,
      address,
      this.ledgerProgram.programId,
    );
    return new Transaction().add(ix);
  }

  get compliance() {
    return {
      blacklistAdd: (address: PublicKey, reason: string) => this.denyList.add(address, reason),
      blacklistRemove: (address: PublicKey) => this.denyList.remove(address),
      blacklistCheck: (address: PublicKey) => this.denyList.check(address),
      seize: (from: PublicKey, to: PublicKey, amount: bigint) => this.seize(from, to, amount),
    };
  }

  get privacyOps() {
    return {
      configureAccount: async (
        tokenAccount: PublicKey,
        elGamalPubkey: Uint8Array,
        aeKey?: { encrypt(amount: bigint): { toBytes(): Uint8Array } },
        proofInstructionOffset: number = 0,
        contextStateAccount?: PublicKey,
      ): Promise<string> => {
        const ops = new PrivacyOpsBuilder(
          this.anchorProvider.connection,
          this.mintAddress,
          this.anchorProvider.publicKey,
        );
        const ix = ops.configureAccount(
          tokenAccount,
          elGamalPubkey,
          aeKey,
          proofInstructionOffset,
          contextStateAccount,
        );
        return this.dispatchInstruction(ix);
      },
      configureAccountIx: (
        tokenAccount: PublicKey,
        elGamalPubkey: Uint8Array,
        aeKey?: { encrypt(amount: bigint): { toBytes(): Uint8Array } },
        proofInstructionOffset: number = 0,
        contextStateAccount?: PublicKey,
      ): TransactionInstruction => {
        const ops = new PrivacyOpsBuilder(
          this.anchorProvider.connection,
          this.mintAddress,
          this.anchorProvider.publicKey,
        );
        return ops.configureAccount(
          tokenAccount,
          elGamalPubkey,
          aeKey,
          proofInstructionOffset,
          contextStateAccount,
        );
      },

      deposit: async (
        tokenAccount: PublicKey,
        amount: bigint,
        decimals: number,
      ): Promise<string> => {
        const ops = new PrivacyOpsBuilder(
          this.anchorProvider.connection,
          this.mintAddress,
          this.anchorProvider.publicKey,
        );
        const ix = ops.createDepositInstruction(tokenAccount, amount, decimals);
        return this.dispatchInstruction(ix);
      },
      depositIx: (
        tokenAccount: PublicKey,
        amount: bigint,
        decimals: number,
      ): TransactionInstruction => {
        const ops = new PrivacyOpsBuilder(
          this.anchorProvider.connection,
          this.mintAddress,
          this.anchorProvider.publicKey,
        );
        return ops.createDepositInstruction(tokenAccount, amount, decimals);
      },

      applyPending: async (tokenAccount: PublicKey): Promise<string> => {
        const ops = new PrivacyOpsBuilder(
          this.anchorProvider.connection,
          this.mintAddress,
          this.anchorProvider.publicKey,
        );
        const ix = ops.createSettlePendingInstruction(tokenAccount);
        return this.dispatchInstruction(ix);
      },
      applyPendingIx: (tokenAccount: PublicKey): TransactionInstruction => {
        const ops = new PrivacyOpsBuilder(
          this.anchorProvider.connection,
          this.mintAddress,
          this.anchorProvider.publicKey,
        );
        return ops.createSettlePendingInstruction(tokenAccount);
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
  }

  // Backwards compat aliases for older functions missing from the new client mapping
  async info(): Promise<TokenStateSnapshot> {
    return this.fetchConfig();
  }
  get roles() {
    return this.accessControl;
  }
  get blacklist() {
    return this.denyList;
  }
  get confidential() {
    return this.privacyOps;
  }
  mintTokens(to: PublicKey, amount: bigint): Promise<string> {
    return this.issueTokens(to, amount);
  }
}
