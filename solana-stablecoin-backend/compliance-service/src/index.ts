import express from 'express';
import { PublicKey } from '@solana/web3.js';
import { Pool } from 'pg';
import { getChainConnector } from './services/solana';
import { getRegulatoryGateway } from './services/compliance-provider';
import { appLogger } from './services/logger';
import { publicKeySchema } from './utils/validation';
import { z } from 'zod';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[compliance-service] DATABASE_URL is required — exiting');
  process.exit(1);
}

// Database connection
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Validation Schemas
const blacklistAddSchema = z.object({
  mint: publicKeySchema,
  address: publicKeySchema,
  reason: z
    .string()
    .min(1, 'Reason is required')
    .max(128, 'Reason must be 128 characters or fewer'),
});

const blacklistRemoveSchema = z.object({
  mint: publicKeySchema,
  address: publicKeySchema,
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'compliance-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'compliance-service',
    scope: 'api',
    timestamp: new Date().toISOString(),
  });
});

// Blacklist management
app.post('/api/blacklist/add', async (req, res) => {
  const parsed = blacklistAddSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten().fieldErrors });

  try {
    const { mint, address, reason } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));

    // 1. On-chain operation
    const signature = await sss.compliance.blacklistAdd(new PublicKey(address), reason);

    // 2. Database persistence
    await pool.query(
      `INSERT INTO blacklist (address, reason, blacklisted_by, blacklisted_at, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (address) DO UPDATE SET
         reason = $2,
         blacklisted_by = $3,
         blacklisted_at = $4,
         is_active = true,
         updated_at = CURRENT_TIMESTAMP`,
      [address, reason, connector.keypair.publicKey.toBase58(), new Date()],
    );

    // 3. Audit log
    await pool.query(
      `INSERT INTO audit_log (action, actor, target, details, signature, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'blacklist_add',
        connector.keypair.publicKey.toBase58(),
        address,
        JSON.stringify({ reason }),
        signature,
        new Date(),
      ],
    );

    appLogger.info('Blacklist add completed', { mint, address, signature });
    res.json({ success: true, signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/blacklist/remove', async (req, res) => {
  const parsed = blacklistRemoveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten().fieldErrors });

  try {
    const { mint, address } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));

    // 1. On-chain operation
    const signature = await sss.compliance.blacklistRemove(new PublicKey(address));

    // 2. Database update
    await pool.query(
      `UPDATE blacklist SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE address = $1`,
      [address],
    );

    // 3. Audit log
    await pool.query(
      `INSERT INTO audit_log (action, actor, target, signature, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      ['blacklist_remove', connector.keypair.publicKey.toBase58(), address, signature, new Date()],
    );

    appLogger.info('Blacklist remove completed', { mint, address, signature });
    res.json({ success: true, signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// On-chain check — validate params before passing to PublicKey
app.get('/api/blacklist/check/:mint/:address', async (req, res) => {
  try {
    const { mint, address } = req.params;
    // Validate both keys before hitting the chain
    let mintKey: import('@solana/web3.js').PublicKey;
    let addressKey: import('@solana/web3.js').PublicKey;
    try {
      mintKey = new PublicKey(mint);
      addressKey = new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'Invalid public key in path' });
    }
    const sss = await getChainConnector().getStablecoinHandle(mintKey);
    const blacklisted = await sss.compliance.blacklistCheck(addressKey);
    res.json({ address, blacklisted, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get all blacklisted addresses from DB
app.get('/api/blacklist', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM blacklist WHERE is_active = true ORDER BY blacklisted_at DESC',
    );
    res.json({ count: result.rows.length, addresses: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Export audit log from DB
app.get('/api/audit-log', async (req, res) => {
  try {
    const { action } = req.query;
    // Sanitize limit: coerce to integer, cap at 100, default 25
    const rawLimit = parseInt(String(req.query.limit ?? '25'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, 100) : 25;

    let query = 'SELECT * FROM audit_log';
    const params: (string | number)[] = [];
    if (action && typeof action === 'string') {
      query += ' WHERE action = $1';
      params.push(action);
    }
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await pool.query(query, params);
    res.json({ count: result.rows.length, logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Screening (using compliance provider)
app.get('/api/screen/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const gateway = getRegulatoryGateway();
    const result = await gateway.screenAddress(address);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  appLogger.info(`Compliance service listening on port ${PORT}`);
});
