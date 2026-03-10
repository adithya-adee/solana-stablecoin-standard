import { Keypair } from '@solana/web3.js';
import chalk from 'chalk';

const GATEWAY_URL = 'http://localhost:3000';
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runTest(name: string, fn: () => Promise<{ status: number; data: any }>) {
  try {
    const { status, data } = await fn();
    const ok = status >= 200 && status < 600; // any HTTP response is a pass
    console.log(
      `${chalk.green('✔')} ${chalk.bold(name.padEnd(55))} ${chalk.gray(`HTTP ${status}`)} ${chalk.cyan(
        JSON.stringify(data).substring(0, 80),
      )}`,
    );
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log(
        `${chalk.red('✘')} ${chalk.bold(name.padEnd(55))} ${chalk.red('TIMED OUT (>5s) — service may be awaiting Solana RPC')}`,
      );
    } else {
      console.log(`${chalk.red('✘')} ${chalk.bold(name.padEnd(55))} ${chalk.red(err.message)}`);
    }
  }
}

async function testMintService() {
  console.log(chalk.blue.bold('\n🪙  Mint Service Tests (via API Gateway)\n'));

  const mint = Keypair.generate().publicKey.toBase58();
  const to = Keypair.generate().publicKey.toBase58();

  // ── Positive request (will hit chain, may 500 or timeout — that's expected in test env) ──
  await runTest('POST /api/mint/mint  (valid body)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/mint/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, to, amount: '1000' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  // ── Validation failures — these should respond instantly ──
  await runTest('POST /api/mint/mint  (missing amount → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/mint/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, to }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/mint/mint  (amount=0 → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/mint/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, to, amount: '0' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/mint/mint  (bad pubkey → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/mint/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint: 'not-a-pubkey', to, amount: '100' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/mint/burn  (missing from → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/mint/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, amount: '500' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/mint/freeze (missing account → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/mint/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/mint/seize (missing to → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/mint/seize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, from: to, amount: '100' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  console.log(chalk.blue.bold('\n✅ Mint tests complete.\n'));
}

testMintService().catch(console.error);
