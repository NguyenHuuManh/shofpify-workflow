/**
 * Purpose:
 * Redis client singleton for BullMQ queues and caching.
 * Ensures only one Redis connection exists in the application.
 *
 * Responsibilities:
 * - Create and cache Redis client instance
 * - Configure connection from environment variables
 *
 * Dependencies:
 * - ioredis
 */

import { Redis } from 'ioredis';
import { logger } from './logger';
import { getEnv } from './env';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const env = getEnv();

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: true,
    lazyConnect: true, // Don't connect until first use (optional for dev without Redis)
    retryStrategy(times: number): number | undefined {
      if (times > 3) {
        logger.warn('Redis unavailable after 3 retries — running without queue');
        return; // Stop retrying
      }
      const delay = Math.min(times * 500, 3000);
      logger.warn({ attempt: times, delay }, 'Redis connecting...');
      return delay;
    },
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  client.on('error', (error: Error) => {
    logger.warn({ error: error.message }, 'Redis unavailable — queue features disabled');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return client;
}

export const redis: Redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
