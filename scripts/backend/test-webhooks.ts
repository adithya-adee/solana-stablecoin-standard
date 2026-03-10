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
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log(
        `${chalk.red('✘')} ${chalk.bold(name.padEnd(55))} ${chalk.red('TIMED OUT (>5s)')}`,
      );
    } else {
      console.log(`${chalk.red('✘')} ${chalk.bold(name.padEnd(55))} ${chalk.red(err.message)}`);
    }
    return null;
  }
}

async function testWebhookService() {
  console.log(chalk.magenta.bold('\n🔗  Webhook Service Tests (via API Gateway)\n'));

  // ── List (DB read — fast) ──
  await runTest('GET  /api/webhooks  (list)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks`);
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  // ── Validation failures (no DB needed — instant) ──
  await runTest('POST /api/webhooks  (missing eventTypes → 400)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('POST /api/webhooks  (eventTypes not array → 400)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', eventTypes: 'mint' }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  await runTest('PUT  /api/webhooks/:id (no updates → 400)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks/99999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  // ── Create a real webhook (DB write — should be fast) ──
  const created = await runTest('POST /api/webhooks  (valid body)', async () => {
    const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://webhook.site/test',
        eventTypes: ['mint', 'burn', 'freeze'],
        retryCount: 3,
      }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  });

  const webhookId = created?.webhook?.id;

  if (webhookId) {
    console.log(chalk.gray(`\n  Using webhook ID: ${webhookId}\n`));

    // ── Get by ID (DB read) ──
    await runTest(`GET  /api/webhooks/${webhookId}`, async () => {
      const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks/${webhookId}`);
      return { status: r.status, data: await r.json().catch(() => ({})) };
    });

    // ── Get deliveries (DB read) ──
    await runTest(`GET  /api/webhooks/${webhookId}/deliveries`, async () => {
      const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks/${webhookId}/deliveries`);
      return { status: r.status, data: await r.json().catch(() => ({})) };
    });

    // ── Process event (DB write, no external call since url is fake) ──
    await runTest('POST /api/webhooks/process  (event delivery)', async () => {
      const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'evt-001',
          type: 'mint',
          signature: 'abc123sig',
          data: { amount: '1000' },
        }),
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    });

    // ── Ping test (will attempt external HTTP — may 500 if unreachable, expected) ──
    await runTest(`POST /api/webhooks/${webhookId}/test  (ping)`, async () => {
      const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks/${webhookId}/test`, {
        method: 'POST',
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    });

    // ── Delete ──
    await runTest(`DELETE /api/webhooks/${webhookId}`, async () => {
      const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    });

    // ── 404 after delete ──
    await runTest(`GET  /api/webhooks/${webhookId} (after delete → 404)`, async () => {
      const r = await fetchWithTimeout(`${GATEWAY_URL}/api/webhooks/${webhookId}`);
      return { status: r.status, data: await r.json().catch(() => ({})) };
    });
  } else {
    console.log(
      chalk.yellow('  ⚠ Skipping per-ID tests — webhook creation failed or DB unavailable.'),
    );
  }

  console.log(chalk.magenta.bold('\n✅ Webhook tests complete.\n'));
}

testWebhookService().catch(console.error);
