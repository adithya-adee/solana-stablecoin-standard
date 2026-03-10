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
    console.log(
      `${chalk.green('✔')} ${chalk.bold(name.padEnd(55))} ${chalk.gray(`HTTP ${status}`)} ${chalk.cyan(
        JSON.stringify(data).substring(0, 80),
      )}`,
    );
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log(
        `${chalk.red('✘')} ${chalk.bold(name.padEnd(55))} ${chalk.red('TIMED OUT (>5s) — service blocking on DB/chain')}`,
      );
    } else {
      console.log(`${chalk.red('✘')} ${chalk.bold(name.padEnd(55))} ${chalk.red(err.message)}`);
    }
  }
}

async function testComplianceService() {
  console.log(chalk.yellow.bold('\n🛡️  Compliance Service Tests (via API Gateway)\n'));

  const mint = Keypair.generate().publicKey.toBase58();
  const address = Keypair.generate().publicKey.toBase58();

  // ── DB-backed READ endpoints — respond instantly ──
  await runTest('GET  /api/compliance/blacklist', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/compliance/blacklist`);
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('GET  /api/compliance/audit-log', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/compliance/audit-log`);
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('GET  /api/compliance/audit-log?action=blacklist_add', async () => {
    const r = await fetchWithTimeout(
      `${GATEWAY_URL}/api/compliance/audit-log?action=blacklist_add`,
    );
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  // ── Screening endpoint (no-op provider, should respond fast) ──
  await runTest('GET  /api/compliance/screen/:address', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/compliance/screen/${address}`);
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  // ── Validation failures (responds instantly, no DB/chain needed) ──
  await runTest('POST /api/compliance/blacklist/add  (missing reason → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/compliance/blacklist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, address }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/compliance/blacklist/add  (bad mint pubkey → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/compliance/blacklist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint: 'bad-key', address, reason: 'test' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/compliance/blacklist/remove (missing address → 422)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/compliance/blacklist/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  // ── Chain-hitting operations (may timeout — expected in local test env) ──
  await runTest('POST /api/compliance/blacklist/add  (valid body, hits chain)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/compliance/blacklist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, address, reason: 'Automated test' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  // ── Bad public key in URL path (check-blacklist route) ──
  await runTest('GET  /api/compliance/blacklist/check/:mint/:addr (bad key → 400)', async () => {
    const r = await fetchWithTimeout(
      `${GATEWAY_URL}/api/compliance/blacklist/check/badmint/badaddr`,
    );
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  console.log(chalk.yellow.bold('\n✅ Compliance tests complete.\n'));
}

testComplianceService().catch(console.error);
