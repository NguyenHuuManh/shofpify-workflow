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
    lazyConnect: false,
    retryStrategy(times: number): number | void {
      if (times > 10) {
        logger.fatal('Redis connection failed after 10 retries');
        return;
      }
      const delay = Math.min(times * 200, 5000);
      logger.warn({ attempt: times, delay }, 'Redis reconnecting...');
      return delay;
    },
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  client.on('error', (error: Error) => {
    logger.error({ error: error.message }, 'Redis error');
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
