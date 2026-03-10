import express from 'express';
import { PublicKey } from '@solana/web3.js';
import { getChainConnector } from './services/solana';
import { appLogger } from './services/logger';
import { publicKeySchema } from './utils/validation';
import { z } from 'zod';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Validation Schemas
const mintToSchema = z.object({
  mint: publicKeySchema,
  to: publicKeySchema,
  amount: z
    .string()
    .regex(/^\d+$/, 'Amount must be a numeric string')
    .refine((v) => BigInt(v) > 0n, 'Amount must be positive'),
});

const burnSchema = z.object({
  mint: publicKeySchema,
  from: publicKeySchema,
  amount: z
    .string()
    .regex(/^\d+$/, 'Amount must be a numeric string')
    .refine((v) => BigInt(v) > 0n, 'Amount must be positive'),
});

const accountActionSchema = z.object({
  mint: publicKeySchema,
  account: publicKeySchema,
});

const mintOnlySchema = z.object({
  mint: publicKeySchema,
});

const seizeSchema = z.object({
  mint: publicKeySchema,
  from: publicKeySchema,
  to: publicKeySchema,
  amount: z
    .string()
    .regex(/^\d+$/, 'Amount must be a numeric string')
    .refine((v) => BigInt(v) > 0n, 'Amount must be positive'),
});

// Helper for error handling
function handleRouteError(res: express.Response, err: unknown, operation: string) {
  const message = err instanceof Error ? err.message : String(err);
  const isClientError =
    message.includes('Account does not exist') ||
    message.includes('Invalid') ||
    message.includes('Unauthorized') ||
    message.includes('already exists');
  const status = isClientError ? 400 : 500;
  appLogger.error(`${operation} failed`, { error: message, status });
  res.status(status).json({ error: isClientError ? message : 'Internal server error' });
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'mint-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'mint-service',
    scope: 'api',
    timestamp: new Date().toISOString(),
  });
});

// Mint request endpoint
app.post('/api/mint', async (req, res) => {
  const parsed = mintToSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const { mint, to, amount } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));
    const signature = await sss.mint({
      recipient: new PublicKey(to),
      amount: BigInt(amount),
    });

    appLogger.info('Mint operation completed', { mint, to, amount, signature });
    res.json({ success: true, signature });
  } catch (err) {
    handleRouteError(res, err, 'Mint');
  }
});

// Burn request endpoint
app.post('/api/burn', async (req, res) => {
  const parsed = burnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const { mint, from, amount } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));
    const signature = await sss.burn(new PublicKey(from), BigInt(amount));

    appLogger.info('Burn operation completed', { mint, from, amount, signature });
    res.json({ success: true, signature });
  } catch (err) {
    handleRouteError(res, err, 'Burn');
  }
});

// Account management
app.post('/api/freeze', async (req, res) => {
  const parsed = accountActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten().fieldErrors });
  try {
    const { mint, account } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));
    const signature = await sss.freeze(new PublicKey(account));
    res.json({ success: true, signature });
  } catch (err) {
    handleRouteError(res, err, 'Freeze');
  }
});

app.post('/api/thaw', async (req, res) => {
  const parsed = accountActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten().fieldErrors });
  try {
    const { mint, account } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));
    const signature = await sss.thaw(new PublicKey(account));
    res.json({ success: true, signature });
  } catch (err) {
    handleRouteError(res, err, 'Thaw');
  }
});

app.post('/api/pause', async (req, res) => {
  const parsed = mintOnlySchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten().fieldErrors });
  try {
    const { mint } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));
    const signature = await sss.pause();
    res.json({ success: true, signature });
  } catch (err) {
    handleRouteError(res, err, 'Pause');
  }
});

app.post('/api/unpause', async (req, res) => {
  const parsed = mintOnlySchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten().fieldErrors });
  try {
    const { mint } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));
    const signature = await sss.unpause();
    res.json({ success: true, signature });
  } catch (err) {
    handleRouteError(res, err, 'Unpause');
  }
});

app.post('/api/seize', async (req, res) => {
  const parsed = seizeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten().fieldErrors });
  try {
    const { mint, from, to, amount } = parsed.data;
    const connector = getChainConnector();
    const sss = await connector.getStablecoinHandle(new PublicKey(mint));
    const signature = await sss.seize(new PublicKey(from), new PublicKey(to), BigInt(amount));
    res.json({ success: true, signature });
  } catch (err) {
    handleRouteError(res, err, 'Seize');
  }
});

app.listen(PORT, () => {
  appLogger.info(`Mint service listening on port ${PORT}`);
});
