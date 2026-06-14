/**
 * Purpose:
 * Structured JSON logging using Pino.
 * All logs must use this logger. Never use console.log.
 *
 * Responsibilities:
 * - Provide a configured Pino logger instance
 * - Standardize log format across the platform
 * - Support log level configuration via environment variables
 *
 * Dependencies:
 * - pino
 * - pino-pretty (development only)
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  name: process.env.APP_NAME ?? 'shopify-autonomous-store',
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

export type Logger = typeof logger;
