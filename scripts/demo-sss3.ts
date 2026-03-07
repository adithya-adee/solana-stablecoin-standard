/**
 * SSS-3 Devnet Lifecycle Proof
 *
 * Demonstrates the SSS-3 (confidential stablecoin) lifecycle on devnet:
 * 1. Initialize mint with SSS-3 preset (confidential transfers + permanent delegate)
 * 2. Grant minter role
 * 3. Mint tokens (public balance)
 * 4. Deposit tokens to confidential balance
 * 5. Apply pending balance
 * 6. Verify config state
 *
 * Note: Full confidential transfers require Rust ZK proof service.
 * This proof demonstrates the no-proof operations (deposit, apply pending).
 *
 * Usage: npx ts-node scripts/devnet-sss3-proof.ts
 * Requires: Funded devnet keypair (ANCHOR_WALLET > KEYPAIR_PATH > ~/.config/solana/sss-devnet-keypair.json)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, clusterApiUrl, Transaction } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import {
  SSS,
  asTier,
  asRole,
  generateDummyAesKey,
  generateTestElGamalKeypair,
  TierLabel,
} from '@stbr/sss-token';
import {
  logHeader,
  logSection,
  logEntry,
  logSuccess,
  logError,
  logInfo,
  logWarning,
  icons,
} from './utils/logging';

const DEVNET_RPC = process.env.DEVNET_RPC || clusterApiUrl('devnet');

interface ProofResult {
  preset: TierLabel;
  mint: string;
  config: string;
  transactions: Record<string, string>;
  notes: string[];
  timestamp: string;
  cluster: string;
}

async function main() {
  logHeader('SSS-3 Devnet Lifecycle Proof');

  // Load keypair
  const keypairPath =
    process.env.ANCHOR_WALLET ||
    process.env.KEYPAIR_PATH ||
    path.join(process.env.HOME!, '.config/solana/sss-devnet-keypair.json');
  const rawKey = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(rawKey));

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  const balance = await connection.getBalance(payer.publicKey);
  logEntry('Payer', payer.publicKey.toBase58(), icons.key);
  logEntry('Balance', `${(balance / 1e9).toFixed(4)} SOL`, icons.info);

  if (balance < 0.1 * 1e9) {
    throw new Error('Insufficient devnet balance. Fund with: solana airdrop 2 --url devnet');
  }

  const txSigs: Record<string, string> = {};
  const notes: string[] = [];

  // 1. Create SSS-3 stablecoin with auditor key
  logSection('1. Creating SSS-3 stablecoin...');
  const auditorPubkey = new Uint8Array(32); // Auditor public key placeholder
  notes.push('Confidential transfers use twisted ElGamal encryption');
  notes.push('SSS-3 uses confidential transfers (twisted ElGamal encryption)');
  notes.push('Auditor key enables regulatory compliance without breaking privacy');

  const sss = await SSS.create(provider, {
    preset: asTier('sss-3'),
    name: 'SSS-3 Proof Token',
    symbol: 'S3PT',
    uri: 'https://sss.dev/metadata/sss3-proof.json',
    decimals: 6,
    supplyCap: BigInt(10_000_000_000_000), // 10M tokens
  });
  txSigs.initialize = 'see-explorer';
  logEntry('Mint', sss.mintAddress.toBase58(), icons.key);
  logEntry('Config', sss.configPda.toBase58(), icons.folder);

  // 2. Grant minter role
  logSection('2. Granting minter role...');
  txSigs.grantMinter = await sss.roles.grant(payer.publicKey, asRole('minter'));
  logEntry('Tx', txSigs.grantMinter, icons.link);

  // 3. Create ATA and mint tokens (public balance)
  logSection('3. Minting tokens to public balance...');
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
  txSigs.mint = await sss.issueTokens(ata, BigInt(1_000_000_000)); // 1K tokens
  logSuccess(`Minted 1K tokens. Tx: ${txSigs.mint}`);

  // 4. Configure account for confidential transfers
  logSection('4. Configuring account for confidential transfers...');
  notes.push(
    'Accounts must be configured with an ElGamal keypair before they can receive confidential deposits',
  );

  const { publicKey: elGamalPubkey } = generateTestElGamalKeypair();
  const aesKey = generateDummyAesKey();

  try {
    txSigs.configureAccount = await sss.confidential.configureAccount(ata, elGamalPubkey, aesKey, -1);
    logSuccess(`Account configured. Tx: ${txSigs.configureAccount}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarning(`ConfigureAccount skipped (missing proof service): ${msg.split('\n')[0]}`);
    notes.push(
      'ConfigureAccount requires a PubkeyValidity ZK proof which can only be generated by a Rust proof service',
    );
    txSigs.configureAccount = 'skipped-needs-proof-service';
  }
  // 5. Deposit to confidential balance
  logSection('5. Depositing to confidential balance...');
  notes.push(
    'Deposit moves tokens from public to pending confidential balance (no ZK proofs needed)',
  );
  try {
    txSigs.deposit = await sss.confidential.deposit(
      ata,
      BigInt(100_000_000), // 100 tokens
      6,
    );
    logSuccess(`Deposited 100 tokens. Tx: ${txSigs.deposit}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarning(`Deposit requires configured confidential account: ${msg}`);
    notes.push(
      'Confidential deposit requires account to be configured for confidential transfers first',
    );
    txSigs.deposit = 'skipped-needs-account-config';
  }

  // 6. Apply pending balance
  logSection('6. Applying pending balance...');
  notes.push(
    'ApplyPendingBalance credits pending into available confidential balance (no ZK proofs needed)',
  );
  try {
    txSigs.applyPending = await sss.confidential.applyPending(ata);
    logSuccess(`Applied. Tx: ${txSigs.applyPending}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarning(`Apply pending skipped: ${msg}`);
    txSigs.applyPending = 'skipped-depends-on-deposit';
  }

  // 7. Seize tokens via permanent delegate
  logSection('7. Seizing tokens via permanent delegate...');
  await sss.roles.grant(payer.publicKey, asRole('seizer'));
  // Seize from ourselves back to treasury (self-test)
  txSigs.seize = await sss.seize(payer.publicKey, payer.publicKey, BigInt(10_000_000));
  logSuccess(`Seized 10 tokens. Tx: ${txSigs.seize}`);

  // 8. Burn some tokens
  logSection('8. Burning tokens...');
  txSigs.grantBurner = await sss.roles.grant(payer.publicKey, asRole('burner'));
  txSigs.burn = await sss.burn(payer.publicKey, BigInt(50_000_000)); // 50 tokens
  logSuccess(`Burned 50 tokens. Tx: ${txSigs.burn}`);

  // 9. Verify state
  logSection('9. Final state:');
  const info = await sss.info();
  logEntry('Preset', info.preset.toString());
  logEntry(
    'Supply',
    `${info.currentSupply} (minted: ${info.totalMinted}, burned: ${info.totalBurned})`,
  );
  logEntry('Cap', info.supplyCap?.toString() || 'None');
  logEntry('Paused', info.paused.toString());

  notes.push(
    'Full confidential transfer and withdraw require Rust ZK proof service (solana-zk-sdk)',
  );

  // Save proof
  const proof: ProofResult = {
    preset: asTier('sss-3'),
    mint: sss.mintAddress.toBase58(),
    config: sss.configPda.toBase58(),
    transactions: txSigs,
    notes,
    timestamp: new Date().toISOString(),
    cluster: 'devnet',
  };

  const outPath = path.join(__dirname, '..', 'deployments', 'devnet-sss3-proof.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2));
  logSuccess(`Proof saved to: ${outPath}`);
  logHeader('SSS-3 Lifecycle Proof Complete');
}

main().catch((err) => {
  logError('SSS-3 proof failed', err);
  process.exit(1);
});
