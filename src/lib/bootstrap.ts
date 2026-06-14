/**
 * Purpose:
 * Bootstrap script that validates environment and starts the platform.
 * Called at application startup to ensure all prerequisites are met.
 *
 * Responsibilities:
 * - Load and validate environment variables
 * - Verify database connectivity
 * - Verify Redis connectivity
 * - Log startup status
 *
 * Dependencies:
 * - @/lib/env
 * - @/lib/logger
 * - @/lib/prisma
 * - @/lib/redis
 */

import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function bootstrap(): Promise<void> {
  logger.info('Bootstrapping Shopify Autonomous Store Platform...');

  // Step 1: Validate environment
  try {
    const env = loadEnv();
    logger.info({ env: env.NODE_ENV, appName: env.APP_NAME }, 'Environment loaded');
  } catch (error) {
    logger.fatal({ error }, 'Environment validation failed');
    throw error;
  }

  // Step 2: Verify database connection
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected');
  } catch (error) {
    logger.fatal({ error }, 'Database connection failed');
    throw error;
  }

  // Step 3: Verify Redis connection
  try {
    await redis.ping();
    logger.info('Redis connected');
  } catch (error) {
    logger.fatal({ error }, 'Redis connection failed');
    throw error;
  }

  logger.info('Bootstrap complete - platform ready');
}
