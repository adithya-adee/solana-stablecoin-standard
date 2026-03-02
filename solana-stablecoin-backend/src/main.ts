import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { appLogger } from './services/logger';
import { tokenOpsRouter } from './routes/operations';
import { enforcementRouter } from './routes/compliance';
import { statusRouter } from './routes/health';
import { requireApiKey } from './middleware/auth';
import { buildRateLimiter } from './middleware/rate-limit';
import { ProgramEventMonitor } from './services/event-listener';
import { getChainConnector } from './services/solana';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : false,
  }),
);
app.use(express.json());

// Public routes
app.use('/health', statusRouter);

// Protected routes
app.use('/operations', requireApiKey, buildRateLimiter(), tokenOpsRouter);
app.use('/compliance', requireApiKey, buildRateLimiter(), enforcementRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  appLogger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: 'Internal server error' });
});

let monitorRef: ProgramEventMonitor | null = null;

const server = app.listen(port, () => {
  appLogger.info(`SSS Backend listening on port ${port}`);

  // Start event monitor if WebSocket URL is configured
  const wsUrl = process.env.SOLANA_WS_URL;
  if (wsUrl) {
    try {
      const connector = getChainConnector();
      const monitor = new ProgramEventMonitor(
        connector.connection,
        connector.coreProgramId,
        connector.hookProgramId,
      );
      monitor.activate();
      monitorRef = monitor;
      appLogger.info('Event monitor started');
    } catch (err) {
      appLogger.warn('Event monitor not started — Solana connection unavailable', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  appLogger.info(`Received ${signal}, shutting down gracefully`);
  if (monitorRef) {
    await monitorRef.deactivate();
    appLogger.info('Event monitor stopped');
  }
  server.close(() => {
    appLogger.info('Server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => {
    appLogger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
