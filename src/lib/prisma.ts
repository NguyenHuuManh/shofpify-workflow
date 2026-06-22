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

  // Log query shape and timing in development. Parameters may contain secrets
  // or large provider payloads (for example SerpAPI raw responses), so they
  // must never be written to application logs.
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: { query: string; duration: number }) => {
      logger.debug({ query: e.query, duration: e.duration }, 'Prisma query');
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
