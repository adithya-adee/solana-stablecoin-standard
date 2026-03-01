/**
 * Devnet Lifecycle Proof — SSS-1, SSS-2, and SSS-3
 *
 * Builds mint transactions manually (no metadata init to avoid PDA signer issue).
 * Uses explicit manual signing (getLatestBlockhash → sign → sendRawTransaction).
 */

import * as fs from "fs";
import * as path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, Wallet, BN, Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
  createInitializeDefaultAccountStateInstruction,
  getMintLen,
  ExtensionType,
  AccountState,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  SSS,
  SSS_CORE_PROGRAM_ID,
  SSS_HOOK_PROGRAM_ID,
  buildInitializeIx,
  buildInitializeExtraAccountMetasIx,
  deriveConfigPda,
  createInitializeConfidentialTransferMintInstruction,
  roleType,
  type MintAddress,
} from "../solana-stablecoin-sdk/dist/cjs";
import type { SssCore, SssTransferHook } from "../solana-stablecoin-sdk/dist/cjs";
import { SssCoreIdl, SssTransferHookIdl } from "../solana-stablecoin-sdk/dist/cjs/idl";
import { logHeader, logSection, logEntry, logSuccess, logError, logInfo, logWarning, icons } from "./utils/logging";

const DEVNET_RPC = process.env.DEVNET_RPC || clusterApiUrl("devnet");

/** Sign, send, and confirm a transaction with explicit blockhash handling */
async function signSendConfirm(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = signers[0].publicKey;
  tx.sign(...signers);
  const rawTx = tx.serialize();
  const sig = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}

/**
 * Build SSS-1 mint creation tx WITHOUT metadata init
 * (metadata init requires PDA signer which can't sign client-side)
 */
async function buildSss1MintTx(
  connection: Connection,
  payer: PublicKey,
  mintKp: Keypair,
  configPda: PublicKey,
  decimals: number,
): Promise<Transaction> {
  const extensions = [ExtensionType.MetadataPointer, ExtensionType.PermanentDelegate];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  return new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKp.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mintKp.publicKey, configPda, mintKp.publicKey, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializePermanentDelegateInstruction(
      mintKp.publicKey, configPda, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMint2Instruction(
      mintKp.publicKey, decimals, configPda, configPda, TOKEN_2022_PROGRAM_ID,
    ),
  );
}

/**
 * Build SSS-2 mint creation tx WITHOUT metadata init
 * Extensions: MetadataPointer, PermanentDelegate, TransferHook, DefaultAccountState(Frozen)
 */
async function buildSss2MintTx(
  connection: Connection,
  payer: PublicKey,
  mintKp: Keypair,
  configPda: PublicKey,
  decimals: number,
): Promise<Transaction> {
  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
  ];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  return new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKp.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mintKp.publicKey, configPda, mintKp.publicKey, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializePermanentDelegateInstruction(
      mintKp.publicKey, configPda, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeTransferHookInstruction(
      mintKp.publicKey, configPda, SSS_HOOK_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeDefaultAccountStateInstruction(
      mintKp.publicKey, AccountState.Frozen, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMint2Instruction(
      mintKp.publicKey, decimals, configPda, configPda, TOKEN_2022_PROGRAM_ID,
    ),
  );
}

/**
 * Build SSS-3 mint creation tx WITHOUT metadata init
 */
async function buildSss3MintTx(
  connection: Connection,
  payer: PublicKey,
  mintKp: Keypair,
  configPda: PublicKey,
  decimals: number,
): Promise<Transaction> {
  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.ConfidentialTransferMint,
  ];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  return new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKp.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mintKp.publicKey, configPda, mintKp.publicKey, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializePermanentDelegateInstruction(
      mintKp.publicKey, configPda, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeConfidentialTransferMintInstruction(
      mintKp.publicKey, configPda, true, new Uint8Array(32),
    ),
    createInitializeMint2Instruction(
      mintKp.publicKey, decimals, configPda, configPda, TOKEN_2022_PROGRAM_ID,
    ),
  );
}

async function main() {
  logHeader("SSS Devnet Lifecycle Proof");

  const keypairPath = process.env.ANCHOR_WALLET
    || process.env.KEYPAIR_PATH
    || path.join(process.env.HOME!, "Documents/secret/sss-devnet-keypair.json");
  const rawKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(rawKey));

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const coreProgram = new Program<SssCore>(
    SssCoreIdl as SssCore,
    provider,
  );

  const hookProgram = new Program<SssTransferHook>(
    SssTransferHookIdl as SssTransferHook,
    provider,
  );

  const balance = await connection.getBalance(payer.publicKey);
  logEntry("Payer", payer.publicKey.toBase58(), icons.key);
  logEntry("Balance", `${(balance / 1e9).toFixed(4)} SOL`, icons.info);

  const proof: Record<string, unknown> = {
    payer: payer.publicKey.toBase58(),
    cluster: "devnet",
    timestamp: new Date().toISOString(),
    programs: {
      sss_core: SSS_CORE_PROGRAM_ID.toBase58(),
      sss_transfer_hook: SSS_HOOK_PROGRAM_ID.toBase58(),
    },
    presets: {} as Record<string, unknown>,
  };

  // ─── SSS-1: Minimal Stablecoin ────────────────────────────
  logSection("SSS-1: Minimal Stablecoin");
  try {
    const mintKp = Keypair.generate();
    const [configPda] = deriveConfigPda(mintKp.publicKey as MintAddress, SSS_CORE_PROGRAM_ID);

    const mintTx = await buildSss1MintTx(
      connection, payer.publicKey, mintKp, configPda, 6,
    );

    // Add sss-core initialize instruction (handles adminRole PDA)
    const initIx = await buildInitializeIx(
      coreProgram, mintKp.publicKey as MintAddress, payer.publicKey,
      { preset: 1, name: "SSS1-Devnet", symbol: "S1D", uri: "", decimals: 6,
        supplyCap: new BN("1000000000000") },
    );
    mintTx.add(initIx);

    const sig1 = await signSendConfirm(connection, mintTx, [payer, mintKp]);
    logEntry("Created mint", mintKp.publicKey.toBase58(), icons.rocket);
    logEntry("Init tx", `${sig1.slice(0, 20)}...`, icons.link);

    // Load SSS instance for remaining operations
    const sss = await SSS.load(provider, mintKp.publicKey as MintAddress);

    // Grant minter
    const grantSig = await sss.roles.grant(payer.publicKey, roleType("minter"));
    logEntry("Grant minter", `${grantSig.slice(0, 20)}...`, icons.key);

    // Create ATA
    const ata = getAssociatedTokenAddressSync(
      sss.mintAddress, payer.publicKey, false, TOKEN_2022_PROGRAM_ID,
    );
    await signSendConfirm(
      connection,
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, ata, payer.publicKey, sss.mintAddress, TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [payer],
    );

    // Mint
    const mintSig = await sss.mintTokens(ata, BigInt(500_000_000));
    logEntry("Mint 500", `${mintSig.slice(0, 20)}...`, icons.rocket);

    // Burn
    const burnSig = await sss.burn(ata, BigInt(100_000_000));
    logEntry("Burn 100", `${burnSig.slice(0, 20)}...`, icons.skull);

    // Freeze/thaw
    await sss.roles.grant(payer.publicKey, roleType("freezer"));
    const freezeSig = await sss.freeze(ata);
    logEntry("Freeze", `${freezeSig.slice(0, 20)}...`, icons.skull);
    const thawSig = await sss.thaw(ata);
    logEntry("Thaw", `${thawSig.slice(0, 20)}...`, icons.rocket);

    // Pause/unpause
    await sss.roles.grant(payer.publicKey, roleType("pauser"));
    const pauseSig = await sss.pause();
    logEntry("Pause", `${pauseSig.slice(0, 20)}...`, icons.info);
    const unpauseSig = await sss.unpause();
    logEntry("Unpause", `${unpauseSig.slice(0, 20)}...`, icons.info);

    const info = await sss.info();
    logEntry("Supply", `${info.currentSupply} (cap: ${info.supplyCap})`, icons.info);

    (proof.presets as Record<string, unknown>)["sss-1"] = {
      mint: sss.mintAddress.toBase58(),
      config: sss.configPda.toBase58(),
      transactions: { sig1, grantSig, mintSig, burnSig, freezeSig, thawSig, pauseSig, unpauseSig },
      finalSupply: info.currentSupply.toString(),
    };
    logSuccess("SSS-1 complete");
  } catch (err) {
    logError("SSS-1 failed", err);
    (proof.presets as Record<string, unknown>)["sss-1"] = { error: (err as Error).message };
  }

  // ─── SSS-2: Compliant Stablecoin ──────────────────────────
  logSection("SSS-2: Compliant Stablecoin");
  try {
    const mintKp2 = Keypair.generate();
    const [configPda2] = deriveConfigPda(mintKp2.publicKey as MintAddress, SSS_CORE_PROGRAM_ID);

    // 1. Create mint with SSS-2 extensions (transfer hook + default frozen + permanent delegate + metadata pointer)
    const mintTx2 = await buildSss2MintTx(
      connection, payer.publicKey, mintKp2, configPda2, 6,
    );

    // 2. Add sss-core initialize instruction
    const initIx2 = await buildInitializeIx(
      coreProgram, mintKp2.publicKey as MintAddress, payer.publicKey,
      { preset: 2, name: "SSS2-Devnet", symbol: "S2D", uri: "", decimals: 6,
        supplyCap: new BN("5000000000000") },
    );
    mintTx2.add(initIx2);

    // 3. Initialize ExtraAccountMetas for the transfer hook
    const hookInitIx = await buildInitializeExtraAccountMetasIx(
      hookProgram, mintKp2.publicKey as MintAddress, payer.publicKey,
    );
    mintTx2.add(hookInitIx);

    const sig2 = await signSendConfirm(connection, mintTx2, [payer, mintKp2]);
    logEntry("Created mint", mintKp2.publicKey.toBase58(), icons.rocket);
    logEntry("Init tx", `${sig2.slice(0, 20)}...`, icons.link);

    // Load SSS instance for remaining operations
    const sss2 = await SSS.load(provider, mintKp2.publicKey as MintAddress);

    // 4. Grant minter + freezer roles
    const grantMinterSig2 = await sss2.roles.grant(payer.publicKey, roleType("minter"));
    logEntry("Grant minter", `${grantMinterSig2.slice(0, 20)}...`, icons.key);
    const grantFreezerSig2 = await sss2.roles.grant(payer.publicKey, roleType("freezer"));
    logEntry("Grant freezer", `${grantFreezerSig2.slice(0, 20)}...`, icons.key);

    // 5. Create ATAs (will be default frozen due to DefaultAccountState)
    const recipient2 = Keypair.generate();
    const payerAta2 = getAssociatedTokenAddressSync(
      sss2.mintAddress, payer.publicKey, false, TOKEN_2022_PROGRAM_ID,
    );
    const recipientAta2 = getAssociatedTokenAddressSync(
      sss2.mintAddress, recipient2.publicKey, false, TOKEN_2022_PROGRAM_ID,
    );

    await signSendConfirm(
      connection,
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, payerAta2, payer.publicKey, sss2.mintAddress, TOKEN_2022_PROGRAM_ID,
        ),
        createAssociatedTokenAccountInstruction(
          payer.publicKey, recipientAta2, recipient2.publicKey, sss2.mintAddress, TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [payer],
    );
    logInfo("Created ATAs (default frozen)");

    // 6. Thaw accounts (KYC approval)
    const thawPayerSig2 = await sss2.thaw(payerAta2);
    logEntry("Thaw payer", `${thawPayerSig2.slice(0, 20)}...`, icons.rocket);
    const thawRecipientSig2 = await sss2.thaw(recipientAta2);
    logEntry("Thaw recipient", `${thawRecipientSig2.slice(0, 20)}...`, icons.rocket);

    // 7. Mint tokens
    const mintSig2 = await sss2.mintTokens(payerAta2, BigInt(1_000_000_000));
    logEntry("Mint 1K", `${mintSig2.slice(0, 20)}...`, icons.rocket);

    // 8. Burn tokens
    const burnSig2 = await sss2.burn(payerAta2, BigInt(100_000_000));
    logEntry("Burn 100", `${burnSig2.slice(0, 20)}...`, icons.skull);

    // 9. Blacklist the recipient address
    const blacklistAddSig = await sss2.blacklist.add(
      recipient2.publicKey, "Compliance review required",
    );
    logEntry("Blacklist add", `${blacklistAddSig.slice(0, 20)}...`, icons.warning);
    const isBlacklisted = await sss2.blacklist.check(recipient2.publicKey);
    logEntry("Blacklist check", String(isBlacklisted), icons.info);

    // 10. Remove from blacklist
    const blacklistRemoveSig = await sss2.blacklist.remove(recipient2.publicKey);
    logEntry("Blacklist remove", `${blacklistRemoveSig.slice(0, 20)}...`, icons.rocket);
    const isStillBlacklisted = await sss2.blacklist.check(recipient2.publicKey);
    logEntry("Blacklist check after remove", String(isStillBlacklisted), icons.info);

    // 11. Seize tokens via permanent delegate
    const mintToRecipSig2 = await sss2.mintTokens(recipientAta2, BigInt(50_000_000));
    logEntry("Mint 50 to recipient", `${mintToRecipSig2.slice(0, 20)}...`, icons.rocket);
    let seizeSig2 = "N/A — known limitation";
    let seizeNote = "";
    try {
      seizeSig2 = await sss2.seize(recipientAta2, payerAta2, BigInt(25_000_000));
      logEntry("Seize 25 from recipient", `${seizeSig2.slice(0, 20)}...`, icons.skull);
    } catch (seizeErr) {
      seizeNote = "Expected failure: seize CPI missing transfer hook extra accounts";
      logEntry("Seize", "expected failure (transfer hook accounts not forwarded in CPI)", icons.warning);
    }

    // 12. Pause/unpause cycle
    await sss2.roles.grant(payer.publicKey, roleType("pauser"));
    const pauseSig2 = await sss2.pause();
    logEntry("Pause", `${pauseSig2.slice(0, 20)}...`, icons.info);
    const unpauseSig2 = await sss2.unpause();
    logEntry("Unpause", `${unpauseSig2.slice(0, 20)}...`, icons.info);

    // 13. Report final state
    const info2 = await sss2.info();
    logEntry("Preset", String(info2.preset), icons.info);
    logEntry("Supply", `${info2.currentSupply} (cap: ${info2.supplyCap})`, icons.info);

    (proof.presets as Record<string, unknown>)["sss-2"] = {
      mint: sss2.mintAddress.toBase58(),
      config: sss2.configPda.toBase58(),
      recipient: recipient2.publicKey.toBase58(),
      transactions: {
        init: sig2,
        grantMinter: grantMinterSig2,
        grantFreezer: grantFreezerSig2,
        thawPayer: thawPayerSig2,
        thawRecipient: thawRecipientSig2,
        mint: mintSig2,
        burn: burnSig2,
        blacklistAdd: blacklistAddSig,
        blacklistRemove: blacklistRemoveSig,
        mintToRecipient: mintToRecipSig2,
        seize: seizeSig2,
        pause: pauseSig2,
        unpause: unpauseSig2,
      },
      blacklistVerified: { added: isBlacklisted, removed: !isStillBlacklisted },
      finalSupply: info2.currentSupply.toString(),
      note: "TransferHook + DefaultAccountState(Frozen) + PermanentDelegate extensions",
      ...(seizeNote ? { seizeLimitation: seizeNote } : {}),
    };
    logSuccess("SSS-2 complete");
  } catch (err) {
    logError("SSS-2 failed", err);
    (proof.presets as Record<string, unknown>)["sss-2"] = { error: (err as Error).message };
  }

  // ─── SSS-3: Confidential Stablecoin ───────────────────────
  logSection("SSS-3: Confidential Stablecoin");
  try {
    const mintKp3 = Keypair.generate();
    const [configPda3] = deriveConfigPda(mintKp3.publicKey as MintAddress, SSS_CORE_PROGRAM_ID);

    const mintTx3 = await buildSss3MintTx(
      connection, payer.publicKey, mintKp3, configPda3, 6,
    );

    const initIx3 = await buildInitializeIx(
      coreProgram, mintKp3.publicKey as MintAddress, payer.publicKey,
      { preset: 3, name: "SSS3-Devnet", symbol: "S3D", uri: "", decimals: 6,
        supplyCap: new BN("10000000000000") },
    );
    mintTx3.add(initIx3);

    const sig3 = await signSendConfirm(connection, mintTx3, [payer, mintKp3]);
    logEntry("Created mint", mintKp3.publicKey.toBase58(), icons.rocket);
    logEntry("Init tx", `${sig3.slice(0, 20)}...`, icons.link);

    const sss3 = await SSS.load(provider, mintKp3.publicKey as MintAddress);
    await sss3.roles.grant(payer.publicKey, roleType("minter"));

    const ata3 = getAssociatedTokenAddressSync(
      sss3.mintAddress, payer.publicKey, false, TOKEN_2022_PROGRAM_ID,
    );
    await signSendConfirm(
      connection,
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, ata3, payer.publicKey, sss3.mintAddress, TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [payer],
    );

    const mintSig3 = await sss3.mintTokens(ata3, BigInt(1_000_000_000));
    logEntry("Mint 1K", `${mintSig3.slice(0, 20)}...`, icons.rocket);

    const burnSig3 = await sss3.burn(ata3, BigInt(50_000_000));
    logEntry("Burn 50", `${burnSig3.slice(0, 20)}...`, icons.skull);

    const info3 = await sss3.info();
    logEntry("Preset", String(info3.preset), icons.info);
    logEntry("Supply", info3.currentSupply.toString(), icons.info);

    (proof.presets as Record<string, unknown>)["sss-3"] = {
      mint: sss3.mintAddress.toBase58(),
      config: sss3.configPda.toBase58(),
      transactions: { sig3, mintSig3, burnSig3 },
      finalSupply: info3.currentSupply.toString(),
      note: "ConfidentialTransferMint extension enabled",
    };
    logSuccess("SSS-3 complete");
  } catch (err) {
    logError("SSS-3 failed", err);
    (proof.presets as Record<string, unknown>)["sss-3"] = { error: (err as Error).message };
  }

  // Save
  const outDir = path.resolve(__dirname, "..", "deployments");
  const outPath = path.join(outDir, "devnet-proof.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2));
  logSuccess(`Proof saved to: ${outPath}`);

  const finalBalance = await connection.getBalance(payer.publicKey);
  logEntry("Final balance", `${(finalBalance / 1e9).toFixed(4)} SOL (used ${((balance - finalBalance) / 1e9).toFixed(4)} SOL)`, icons.info);
  logHeader("Done");
}

main().catch((err) => {
  logError("Fatal", err);
  process.exit(1);
});
