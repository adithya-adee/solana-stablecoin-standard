import { Router, Request, Response } from 'express';
import { appLogger } from '../services/logger';
import { getChainConnector } from '../services/solana';

const router = Router();

const startTime = Date.now();

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
router.get('/', async (_req: Request, res: Response) => {
  let solanaStatus: 'connected' | 'disconnected' = 'disconnected';
  let slot: number | undefined;

  try {
    const solana = getChainConnector();
    slot = await solana.connection.getSlot();
    solanaStatus = 'connected';
  } catch (err) {
    appLogger.warn('Health check: Solana connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  res.json({
    status: 'ok',
    solana: solanaStatus,
    slot,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

export { router as statusRouter };
