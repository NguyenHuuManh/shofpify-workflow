/**
 * Purpose:
 * BullMQ queue registry for the product creation workflow.
 * Defines all 5 queues matching the SDD architecture:
 * research, content, seo, landing, publish.
 *
 * Responsibilities:
 * - Create and configure BullMQ queues
 * - Provide queue instances to job producers and workers
 * - Standardize queue naming and connection settings
 *
 * Dependencies:
 * - bullmq
 * - ioredis (via lib/redis)
 */

import { Queue } from 'bullmq';
import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export const QUEUE_NAMES = {
  RESEARCH: 'research-queue',
  CONTENT: 'content-queue',
  SEO: 'seo-queue',
  LANDING: 'landing-queue',
  PUBLISH: 'publish-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Default job options with retry strategy from SDD:
 * 3 retries, exponential backoff: 5s → 15s → 45s
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 7 * 24 * 3600, // Keep completed jobs for 7 days
    count: 1000,
  },
  removeOnFail: {
    age: 30 * 24 * 3600, // Keep failed jobs for 30 days
  },
};

// Lazy-initialized queue instances
let _queues: Record<QueueName, Queue> | null = null;

function createQueue(name: QueueName): Queue {
  logger.info({ queue: name }, 'Creating BullMQ queue');
  const env = loadEnv();
  return new Queue(name, {
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    },
    defaultJobOptions,
  });
}

/**
 * Get all queue instances. Creates them on first call.
 */
export function getQueues(): Record<QueueName, Queue> {
  if (!_queues) {
    _queues = {
      [QUEUE_NAMES.RESEARCH]: createQueue(QUEUE_NAMES.RESEARCH),
      [QUEUE_NAMES.CONTENT]: createQueue(QUEUE_NAMES.CONTENT),
      [QUEUE_NAMES.SEO]: createQueue(QUEUE_NAMES.SEO),
      [QUEUE_NAMES.LANDING]: createQueue(QUEUE_NAMES.LANDING),
      [QUEUE_NAMES.PUBLISH]: createQueue(QUEUE_NAMES.PUBLISH),
    };
  }
  return _queues;
}

/**
 * Get a specific queue by name.
 */
export function getQueue(name: QueueName): Queue {
  return getQueues()[name];
}

/**
 * Clean up all queue connections. Call on graceful shutdown.
 */
export async function closeQueues(): Promise<void> {
  if (!_queues) return;

  logger.info('Closing all BullMQ queues');
  for (const queue of Object.values(_queues)) {
    await queue.close();
  }
  _queues = null;
}
