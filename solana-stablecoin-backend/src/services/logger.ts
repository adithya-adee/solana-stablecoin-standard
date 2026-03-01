import pino from 'pino';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'sss-backend' },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Provide a Winston-compatible interface so we don't have to rewrite the codebase
export const logger = {
  info: (msg: string, meta?: any) => (meta ? pinoLogger.info(meta, msg) : pinoLogger.info(msg)),
  error: (msg: string, meta?: any) => (meta ? pinoLogger.error(meta, msg) : pinoLogger.error(msg)),
  warn: (msg: string, meta?: any) => (meta ? pinoLogger.warn(meta, msg) : pinoLogger.warn(msg)),
  debug: (msg: string, meta?: any) => (meta ? pinoLogger.debug(meta, msg) : pinoLogger.debug(msg)),
};
