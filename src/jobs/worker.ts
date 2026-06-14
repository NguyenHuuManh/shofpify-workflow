/**
 * Purpose:
 * BullMQ Worker entrypoint for background job processing.
 * Starts a worker that listens to all 5 workflow queues.
 *
 * Usage:
 *   npx tsx src/jobs/worker.ts
 *
 * Responsibilities:
 * - Create BullMQ workers for all queues
 * - Route jobs to the workflow job processor
 * - Handle graceful shutdown
 * - Log worker lifecycle events
 *
 * Dependencies:
 * - bullmq
 * - redis (via lib/redis)
 * - queue-registry
 * - workflow-job
 * - env
 */

import { Worker } from 'bullmq';
import { getQueues, QUEUE_NAMES } from './queue-registry';
import { processWorkflowStep } from './workflow-job';
import { logger } from '@/lib/logger';
import { loadEnv } from '@/lib/env';
import type { QueueName } from './queue-registry';

// Load and validate environment
const env = loadEnv();

/**
 * Create a BullMQ worker for a specific queue.
 */
function createWorker(queueName: QueueName): Worker {
  const env = loadEnv();
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.debug(
        { queue: queueName, jobId: job.id, attempt: job.attemptsMade },
        'Worker processing job',
      );
      await processWorkflowStep(job as { data: Parameters<typeof processWorkflowStep>[0]['data'] });
    },
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: env.WORKER_CONCURRENCY,
      autorun: true,
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      { queue: queueName, jobId: job?.id },
      'Job completed successfully',
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      {
        queue: queueName,
        jobId: job?.id,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      },
      'Job failed',
    );
  });

  worker.on('error', (error) => {
    logger.error({ queue: queueName, error: error.message }, 'Worker error');
  });

  worker.on('drained', () => {
    logger.debug({ queue: queueName }, 'Queue drained');
  });

  return worker;
}

/**
 * Start all workers. Call this once at application startup.
 */
export async function startWorker(): Promise<void> {
  logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'Starting BullMQ workers');

  // Initialize queues (creates them if needed)
  const queues = getQueues();

  // Create workers for all queues
  const workers: Worker[] = [];

  for (const queueName of Object.values(QUEUE_NAMES)) {
    workers.push(createWorker(queueName));
  }

  logger.info(
    { queues: Object.values(QUEUE_NAMES), workerCount: workers.length },
    'BullMQ workers started',
  );

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down BullMQ workers...');
    for (const worker of workers) {
      await worker.close();
    }
    for (const queue of Object.values(queues)) {
      await queue.close();
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Auto-start when run directly
if (require.main === module || process.argv[1]?.includes('worker')) {
  startWorker().catch((error) => {
    logger.fatal({ error: error instanceof Error ? error.message : 'Unknown' }, 'Worker failed to start');
    process.exit(1);
  });
}
