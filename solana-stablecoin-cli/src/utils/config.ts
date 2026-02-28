import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function loadProvider(): AnchorProvider {
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ?? process.env.RPC_URL ?? 'https://api.devnet.solana.com';

  const walletPath =
    process.env.ANCHOR_WALLET ??
    process.env.WALLET_PATH ??
    path.join(os.homedir(), '.config', 'solana', 'id.json');

  const connection = new Connection(rpcUrl, 'confirmed');

  let keypair: Keypair;
  if (fs.existsSync(walletPath)) {
    const rawData = fs.readFileSync(walletPath, 'utf-8');
    const secretKey = Uint8Array.from(JSON.parse(rawData));
    keypair = Keypair.fromSecretKey(secretKey);
  } else {
    console.warn(`[warn] Wallet not found at ${walletPath}. Using ephemeral keypair (read-only).`);
    keypair = Keypair.generate();
  }

  const wallet = new Wallet(keypair);
  return new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
}

export function parseMint(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new Error(`Invalid mint address: "${address}"`);
  }
}

export function parseAddress(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new Error(`Invalid address: "${address}"`);
  }
}

export function parseAmount(amount: string, decimals = 6): bigint {
  const n = parseFloat(amount);
  if (isNaN(n) || n < 0) throw new Error(`Invalid amount: "${amount}"`);
  return BigInt(Math.round(n * 10 ** decimals));
}

export function formatAmount(raw: bigint, decimals = 6): string {
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
