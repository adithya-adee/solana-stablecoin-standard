import express from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { Pool } from 'pg';
import axios from 'axios';
import { appLogger as logger } from './services/logger';

const app = express();
const PORT = process.env.PORT || 3002;

// Environment variables
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
// Use the standardised env var names that match docker-compose.yml
const CORE_PROGRAM_ID = new PublicKey(
  process.env.SSS_CORE_PROGRAM_ID || 'SSSCFmmtaU1oToJ9eMqzTtPbK9EAyoXdivUG4irBHVP',
);
const HOOK_PROGRAM_ID = new PublicKey(
  process.env.SSS_HOOK_PROGRAM_ID || 'HookFvKFaoF9KL8TUXUnQK5r2mJoMYdBENu549seRyXW',
);
const DATABASE_URL = process.env.DATABASE_URL;
const WEBHOOK_SERVICE_URL = process.env.WEBHOOK_SERVICE_URL;

if (!DATABASE_URL) {
  logger.error('DATABASE_URL is required — exiting');
  process.exit(1);
}

// Database connection
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Solana connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Known event tags
const LEDGER_EVENT_TAGS = [
  'Initialized',
  'TokensMinted',
  'TokensBurned',
  'AccountFrozen',
  'AccountThawed',
  'Paused',
  'Unpaused',
  'Seized',
  'RoleGranted',
  'RoleRevoked',
  'SupplyCapUpdated',
];
const HOOK_EVENT_TAGS = ['BlacklistAdded', 'BlacklistRemoved', 'TransferChecked'];

// Store event in database
async function storeEvent(type: string, signature: string, data: any): Promise<number | null> {
  try {
    const result = await pool.query(
      'INSERT INTO events (type, signature, timestamp, data) VALUES ($1, $2, $3, $4) RETURNING id',
      [type, signature, new Date(), JSON.stringify(data)],
    );
    logger.info('Event stored', { type, signature });
    return result.rows[0].id;
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique violation
      logger.debug('Event already indexed', { signature });
      return null;
    }
    logger.error('Failed to store event', { error: error.message });
    return null;
  }
}

// Notify webhook service
async function notifyWebhook(event: any): Promise<void> {
  if (!WEBHOOK_SERVICE_URL) return;
  try {
    await axios.post(`${WEBHOOK_SERVICE_URL}/api/webhooks/process`, event);
    logger.info('Webhook notification sent', { signature: event.signature });
  } catch (error: any) {
    logger.warn('Failed to notify webhook service', { error: error.message });
  }
}

// Parse event payload helper
function parseEventPayload(message: string): Record<string, string> {
  const data: Record<string, string> = {};
  const kvPairs = message.match(/(\w+)=([^\s,]+)/g);
  if (kvPairs) {
    for (const pair of kvPairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) data[pair.substring(0, eqIndex)] = pair.substring(eqIndex + 1);
    }
  }
  if (Object.keys(data).length === 0) data.raw = message;
  return data;
}

// Process log entry
async function processLogs(logs: any, source: string, tags: string[]) {
  if (logs.err) return;
  for (const log of logs.logs) {
    if (!log.startsWith('Program log:') && !log.startsWith('Program data:')) continue;
    const message = log.replace(/^Program (log|data): /, '');
    for (const tag of tags) {
      if (message.includes(tag)) {
        const data = parseEventPayload(message);
        const eventId = await storeEvent(tag, logs.signature, data);
        if (eventId) {
          await notifyWebhook({
            id: eventId,
            type: tag,
            signature: logs.signature,
            data,
            timestamp: new Date(),
          });
        }
        break;
      }
    }
  }
}

// Start listener
async function startListener() {
  logger.info('Starting event listener microservice');

  connection.onLogs(
    CORE_PROGRAM_ID,
    (logs) => processLogs(logs, 'sss-core', LEDGER_EVENT_TAGS),
    'confirmed',
  );
  connection.onLogs(
    HOOK_PROGRAM_ID,
    (logs) => processLogs(logs, 'sss-transfer-hook', HOOK_EVENT_TAGS),
    'confirmed',
  );

  logger.info('Subscriptions active', {
    core: CORE_PROGRAM_ID.toBase58(),
    hook: HOOK_PROGRAM_ID.toBase58(),
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'event-listener', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT}`);
  startListener().catch((err) => {
    logger.error('Failed to start listener', { error: err.message });
    process.exit(1);
  });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});
