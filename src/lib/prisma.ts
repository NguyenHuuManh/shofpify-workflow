/**
 * Purpose:
 * Prisma client singleton for database access.
 * Ensures only one Prisma client instance exists in the application.
 *
 * Responsibilities:
 * - Create and cache Prisma client instance
 * - Handle hot-reload in development (Next.js)
 *
 * Dependencies:
 * - @prisma/client
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: { query: string; params: string; duration: number }) => {
      logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Prisma query');
    });
  }

  client.$on('error', (e: { message: string }) => {
    logger.error({ error: e.message }, 'Prisma error');
  });

  return client;
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
