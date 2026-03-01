/**
 * SSS-1 Devnet Lifecycle Proof
 *
 * Demonstrates the full SSS-1 (minimal stablecoin) lifecycle on devnet:
 * 1. Initialize mint with SSS-1 preset
 * 2. Grant minter role
 * 3. Mint tokens
 * 4. Burn tokens
 * 5. Freeze account
 * 6. Thaw account
 * 7. Pause operations
 * 8. Unpause operations
 *
 * Usage: npx ts-node scripts/devnet-sss1-proof.ts
 * Requires: Funded devnet keypair (ANCHOR_WALLET > KEYPAIR_PATH > ~/.config/solana/sss-devnet-keypair.json)
 */

import * as fs from "fs";
import * as path from "path";
import {
  Connection,
  Keypair,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import { SSS, preset, roleType, type Preset } from "../solana-stablecoin-sdk/src";
import { logHeader, logSection, logEntry, logSuccess, logError, icons } from "./utils/logging";

const DEVNET_RPC = process.env.DEVNET_RPC || clusterApiUrl("devnet");

interface ProofResult {
  preset: Preset;
  mint: string;
  config: string;
  transactions: Record<string, string>;
  timestamp: string;
  cluster: string;
}

async function main() {
  logHeader("SSS-1 Devnet Lifecycle Proof");

  // Load keypair
  const keypairPath = process.env.ANCHOR_WALLET
    || process.env.KEYPAIR_PATH
    || path.join(process.env.HOME!, ".config/solana/sss-devnet-keypair.json");
  const rawKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(rawKey));

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });

  const balance = await connection.getBalance(payer.publicKey);
  logEntry("Payer", payer.publicKey.toBase58(), icons.key);
  logEntry("Balance", `${(balance / 1e9).toFixed(4)} SOL`, icons.info);
  
  if (balance < 0.1 * 1e9) {
    throw new Error(
      "Insufficient devnet balance. Fund with: solana airdrop 2 --url devnet",
    );
  }

  const txSigs: Record<string, string> = {};

  // 1. Create SSS-1 stablecoin
  logSection("1. Creating SSS-1 stablecoin...");
  const mintKeypair = Keypair.generate();
  const sss = await SSS.create(provider, {
    preset: preset("sss-1"),
    mint: mintKeypair,
    name: "SSS-1 Proof Token",
    symbol: "S1PT",
    uri: "https://sss.dev/metadata/sss1-proof.json",
    decimals: 6,
    supplyCap: BigInt(1_000_000_000_000), // 1M tokens
  });
  txSigs.initialize = "see-explorer"; // Created in SSS.create
  logEntry("Mint", sss.mintAddress.toBase58(), icons.key);
  logEntry("Config", sss.configPda.toBase58(), icons.folder);

  // 2. Grant minter role
  logSection("2. Granting minter role...");
  txSigs.grantMinter = await sss.roles.grant(payer.publicKey, roleType("minter"));
  logEntry("Tx", txSigs.grantMinter, icons.link);

  // 3. Create ATA and mint tokens
  logSection("3. Minting tokens...");
  const ata = getAssociatedTokenAddressSync(
    sss.mintAddress,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      payer.publicKey,
      sss.mintAddress,
      TOKEN_2022_PROGRAM_ID,
    ),
  );
  await provider.sendAndConfirm(createAtaTx);
  txSigs.mint = await sss.mintTokens(ata, BigInt(500_000_000_000)); // 500K
  logSuccess(`Minted 500K tokens. Tx: ${txSigs.mint}`);

  // 4. Burn tokens
  logSection("4. Burning tokens...");
  txSigs.burn = await sss.burn(ata, BigInt(100_000_000_000)); // 100K
  logSuccess(`Burned 100K tokens. Tx: ${txSigs.burn}`);

  // 5. Grant freezer and freeze account
  logSection("5. Freezing account...");
  txSigs.grantFreezer = await sss.roles.grant(payer.publicKey, roleType("freezer"));
  txSigs.freeze = await sss.freeze(ata);
  logSuccess(`Frozen. Tx: ${txSigs.freeze}`);

  // 6. Thaw account
  logSection("6. Thawing account...");
  txSigs.thaw = await sss.thaw(ata);
  logSuccess(`Thawed. Tx: ${txSigs.thaw}`);

  // 7. Grant pauser and pause
  logSection("7. Pausing operations...");
  txSigs.grantPauser = await sss.roles.grant(payer.publicKey, roleType("pauser"));
  txSigs.pause = await sss.pause();
  logSuccess(`Paused. Tx: ${txSigs.pause}`);

  // 8. Unpause
  logSection("8. Unpausing operations...");
  txSigs.unpause = await sss.unpause();
  logSuccess(`Unpaused. Tx: ${txSigs.unpause}`);

  // 9. Fetch info
  logSection("9. Final state:");
  const info = await sss.info();
  logEntry("Preset", info.preset.toString());
  logEntry("Supply", `${info.currentSupply} (minted: ${info.totalMinted}, burned: ${info.totalBurned})`);
  logEntry("Cap", info.supplyCap?.toString() || "None");
  logEntry("Paused", info.paused.toString());

  // Save proof
  const proof: ProofResult = {
    preset: preset("sss-1"),
    mint: sss.mintAddress.toBase58(),
    config: sss.configPda.toBase58(),
    transactions: txSigs,
    timestamp: new Date().toISOString(),
    cluster: "devnet",
  };

  const outPath = path.join(__dirname, "..", "deployments", "devnet-sss1-proof.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2));
  logSuccess(`Proof saved to: ${outPath}`);
  logHeader("SSS-1 Lifecycle Proof Complete");
}

main().catch((err) => {
  logError("SSS-1 proof failed", err);
  process.exit(1);
});
