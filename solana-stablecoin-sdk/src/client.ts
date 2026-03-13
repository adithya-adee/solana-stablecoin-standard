import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, Keypair, TransactionInstruction, Transaction } from '@solana/web3.js';
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
import { TIER_ORDINAL_MAP, ORDINAL_TO_TIER_MAP, asTier, asRole } from './types';
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
    const instructions = Array.isArray(ixs) ? ixs : [ixs];
    if (instructions.length === 0) return '';

    const payer = this.anchorProvider.publicKey;
    let lastSig = '';

    // Simple chunking logic: group instructions into batches that fit in a transaction
    let currentBatch: TransactionInstruction[] = [];
    const batches: TransactionInstruction[][] = [];

    for (const ix of instructions) {
      const testTx = new Transaction();
      [...currentBatch, ix].forEach((i) => testTx.add(i));
      testTx.recentBlockhash = '1'.repeat(32); // mock
      testTx.feePayer = payer;

      try {
        const size = testTx.serialize({
          verifySignatures: false,
          requireAllSignatures: false,
        }).length;

        if (size <= 1232) {
          currentBatch.push(ix);
        } else {
          if (currentBatch.length > 0) batches.push(currentBatch);
          currentBatch = [ix];
        }
      } catch (e) {
        // If even a single instruction is too large, we can't do much but try
        if (currentBatch.length > 0) batches.push(currentBatch);
        currentBatch = [ix];
      }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    try {
      for (let i = 0; i < batches.length; i++) {
        const tx = new Transaction();
        batches[i]!.forEach((ix) => tx.add(ix));
        lastSig = await this.anchorProvider.sendAndConfirm(tx);

        // If we have more batches, we might want to wait a bit or just proceed
        // Usually sendAndConfirm handles the wait.
      }
      return lastSig;
    } catch (err) {
      throw translateAnchorError(err);
    }
  }

  private static buildProgramPair(
    provider: AnchorProvider,
    _coreProgramId: PublicKey = STBL_CORE_PROGRAM_ID,
    _hookProgramId: PublicKey = STBL_HOOK_PROGRAM_ID,
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

    // configPda and configBump are already derived above at line 181

    if (opts.preset === 'sss-2') {
      const hookInitIx = await hookix.createHookMetaInitInstruction(
        guardProgram,
        mint.publicKey as TokenMintKey,
        payer,
      );
      mintTx.add(hookInitIx);
    }

    // Prepare role-granting instructions if requested
    const roleIxs: TransactionInstruction[] = [];
    if (opts.initialRoles && Array.isArray(opts.initialRoles) && opts.initialRoles.length > 0) {
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
        if (validRole && validRole !== asRole('admin')) {
          const grantIx = await coreix.createGrantInstruction(
            ledgerProgram,
            configPda,
            payer,
            payer,
            validRole,
          );
          roleIxs.push(grantIx);
        }
      }
    }

    // Determine if we can fit everything in one transaction
    const combinedTx = new Transaction();
    mintTx.instructions.forEach((ix) => combinedTx.add(ix));
    roleIxs.forEach((ix) => combinedTx.add(ix));

    // To estimate size accurately, we need a blockhash and fee payer
    combinedTx.recentBlockhash = '1'.repeat(32); // Dummy valid-length blockhash
    combinedTx.feePayer = payer;

    let useSingleTx = false;
    try {
      const serializedSize = combinedTx.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      }).length;
      // Solana limit is 1232 bytes for the serialized transaction
      if (serializedSize <= 1232) {
        useSingleTx = true;
      }
    } catch (e) {
      // If serialization fails (e.g. too many keys for legacy tx), fall back to splitting
      useSingleTx = false;
    }

    try {
      if (useSingleTx) {
        // Essential: use the real mintTx but add the role instructions to it
        roleIxs.forEach((ix) => mintTx.add(ix));
        await provider.sendAndConfirm(mintTx, [mint]);
      } else {
        // Phase 1: Deployment
        await provider.sendAndConfirm(mintTx, [mint]);

        // Phase 2: Role Granting (if any)
        if (roleIxs.length > 0) {
          const rolesTx = new Transaction();
          roleIxs.forEach((ix) => rolesTx.add(ix));
          try {
            await provider.sendAndConfirm(rolesTx);
          } catch (err) {
            console.warn('Stablecoin deployed, but initial role granting failed:', err);
          }
        }
      }
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
      console.error(e);
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

  async seize(fromWallet: PublicKey, toWallet: PublicKey, amount: bigint): Promise<string> {
    const tx = await this.composeSeize(fromWallet, toWallet, amount);
    return this.dispatchInstruction(tx.instructions);
  }

  async composeSeize(
    fromWallet: PublicKey,
    toWallet: PublicKey,
    amount: bigint,
  ): Promise<Transaction> {
    const seizer = this.anchorProvider.publicKey;
    const tx = new Transaction();

    // Check if preset needs a hook
    let hookProgramId: PublicKey | undefined;
    try {
      const config = await this.ledgerProgram.account.stablecoinConfig.fetch(this.configPda);
      const preset = (config as any).preset ?? 1;
      const enableTransferHook = (config as any).enableTransferHook;
      if (enableTransferHook !== false && (preset === 2 || enableTransferHook === true)) {
        hookProgramId = STBL_HOOK_PROGRAM_ID;
      }
    } catch (e) {
      console.error(e);
      // Fallback or ignore
    }

    // Destination ATA check/create
    const toAta = getAssociatedTokenAddressSync(
      this.mintAddress,
      toWallet,
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
          toWallet,
          this.mintAddress,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Source ATA (must exist)
    const fromAta = getAssociatedTokenAddressSync(
      this.mintAddress,
      fromWallet,
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

    // Resolve extra hook accounts using canonical spl-token logic if needed
    if (hookProgramId) {
      const { addExtraAccountMetasForExecute } = await import('@solana/spl-token');
      // Authority for the internal transfer is the config PDA
      await addExtraAccountMetasForExecute(
        this.anchorProvider.connection,
        seizeIx,
        hookProgramId,
        fromAta,
        this.mintAddress,
        toAta,
        this.configPda,
        amount,
        'confirmed',
      );
    }

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
      grant: async (address: PublicKey, roles: AccessRole | AccessRole[]): Promise<string> => {
        const tx = await this.composeGrantRole(address, roles);
        return this.dispatchInstruction(tx.instructions);
      },

      revoke: async (address: PublicKey, roles: AccessRole | AccessRole[]): Promise<string> => {
        const tx = await this.composeRevokeRole(address, roles);
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

  async composeGrantRole(
    address: PublicKey,
    role: AccessRole | AccessRole[],
  ): Promise<Transaction> {
    const admin = this.anchorProvider.publicKey;
    const roles = Array.isArray(role) ? role : [role];
    const tx = new Transaction();

    for (const r of roles) {
      const ix = await coreix.createGrantInstruction(
        this.ledgerProgram,
        this.configPda,
        admin,
        address,
        r,
      );
      tx.add(ix);
    }
    return tx;
  }

  async composeRevokeRole(
    address: PublicKey,
    role: AccessRole | AccessRole[],
  ): Promise<Transaction> {
    const admin = this.anchorProvider.publicKey;
    const roles = Array.isArray(role) ? role : [role];
    const tx = new Transaction();

    for (const r of roles) {
      const [roleAccountPda] = deriveRolePda(
        this.configPda,
        address,
        r,
        this.ledgerProgram.programId,
      );
      const ix = await coreix.createRevokeInstruction(
        this.ledgerProgram,
        this.configPda,
        admin,
        roleAccountPda,
      );
      tx.add(ix);
    }
    return tx;
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
      seize: (fromWallet: PublicKey, toWallet: PublicKey, amount: bigint) =>
        this.seize(fromWallet, toWallet, amount),
    };
  }

  get privacyOps(): PrivacyOpsBuilder {
    return new PrivacyOpsBuilder(
      this.anchorProvider.connection,
      this.mintAddress,
      this.anchorProvider.publicKey,
    );
  }

  get confidential() {
    return {
      configureAccount: async (
        tokenAccount: PublicKey,
        elGamalSecretKey: Uint8Array,
        aeKey?: Uint8Array | { encrypt(amount: bigint): { toBytes(): Uint8Array } },
        contextStateAccount?: PublicKey,
      ): Promise<string> => {
        const ixs = await this.privacyOps.configureAccountInstructions(
          tokenAccount,
          elGamalSecretKey,
          aeKey,
          contextStateAccount,
        );
        const tx = new Transaction().add(...ixs);
        return this.anchorProvider.sendAndConfirm(tx);
      },
      configureAccountIxs: async (
        tokenAccount: PublicKey,
        elGamalSecretKey: Uint8Array,
        aeKey?: Uint8Array | { encrypt(amount: bigint): { toBytes(): Uint8Array } },
        contextStateAccount?: PublicKey,
      ): Promise<TransactionInstruction[]> => {
        return this.privacyOps.configureAccountInstructions(
          tokenAccount,
          elGamalSecretKey,
          aeKey,
          contextStateAccount,
        );
      },

      deposit: async (
        tokenAccount: PublicKey,
        amount: bigint,
        decimals: number,
      ): Promise<string> => {
        const ix = this.privacyOps.createDepositInstruction(tokenAccount, amount, decimals);
        return this.dispatchInstruction(ix);
      },
      depositIx: (
        tokenAccount: PublicKey,
        amount: bigint,
        decimals: number,
      ): TransactionInstruction => {
        return this.privacyOps.createDepositInstruction(tokenAccount, amount, decimals);
      },

      applyPending: async (tokenAccount: PublicKey): Promise<string> => {
        const ix = this.privacyOps.createSettlePendingInstruction(tokenAccount);
        return this.dispatchInstruction(ix);
      },
      applyPendingIx: (tokenAccount: PublicKey): TransactionInstruction => {
        return this.privacyOps.createSettlePendingInstruction(tokenAccount);
      },

      transfer: async (
        sourceTokenAccount: PublicKey,
        destinationTokenAccount: PublicKey,
        amount: bigint,
        sourceElGamalSecretKey: Uint8Array,
        sourceAvailableBalanceCiphertext: Uint8Array,
        sourceCurrentBalance: bigint,
        destinationElGamalPubkey: Uint8Array,
        auditorElGamalPubkey?: Uint8Array,
        aeKey?: Uint8Array | { encrypt(amount: bigint): { toBytes(): Uint8Array } },
        contextStateAccount?: PublicKey,
      ): Promise<string> => {
        const ixs = await this.privacyOps.transferInstructions(
          sourceTokenAccount,
          destinationTokenAccount,
          amount,
          sourceElGamalSecretKey,
          sourceAvailableBalanceCiphertext,
          sourceCurrentBalance,
          destinationElGamalPubkey,
          auditorElGamalPubkey,
          aeKey,
          contextStateAccount,
        );
        const tx = new Transaction().add(...ixs);
        return this.anchorProvider.sendAndConfirm(tx);
      },

      withdraw: async (
        tokenAccount: PublicKey,
        amount: bigint,
        decimals: number,
        sourceElGamalSecretKey: Uint8Array,
        sourceAvailableBalanceCiphertext: Uint8Array,
        sourceCurrentBalance: bigint,
        aeKey?: Uint8Array | { encrypt(amount: bigint): { toBytes(): Uint8Array } },
        contextStateAccount?: PublicKey,
      ): Promise<string> => {
        const ixs = await this.privacyOps.withdrawInstructions(
          tokenAccount,
          amount,
          decimals,
          sourceElGamalSecretKey,
          sourceAvailableBalanceCiphertext,
          sourceCurrentBalance,
          aeKey,
          contextStateAccount,
        );
        const tx = new Transaction().add(...ixs);
        return this.anchorProvider.sendAndConfirm(tx);
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
  mintTokens(to: PublicKey, amount: bigint): Promise<string> {
    return this.issueTokens(to, amount);
  }
}
