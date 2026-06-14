/**
 * Purpose:
 * Job producer for enqueuing workflow step jobs.
 * Provides helpers to push workflow steps onto the appropriate BullMQ queues.
 *
 * Responsibilities:
 * - Enqueue a workflow for full execution
 * - Enqueue individual step jobs
 * - Map workflow steps to their corresponding queues
 *
 * Dependencies:
 * - bullmq
 * - queue-registry
 * - workflow-state
 */

import { getQueue } from './queue-registry';
import { QUEUE_NAMES } from './queue-registry';
import type { QueueName } from './queue-registry';
import { logger } from '@/lib/logger';
import type { WorkflowStepType } from '@prisma/client';

/**
 * Maps each workflow step to its corresponding BullMQ queue.
 */
const STEP_QUEUE_MAP: Partial<Record<WorkflowStepType, QueueName>> = {
  RESEARCH: QUEUE_NAMES.RESEARCH,
  CONTENT: QUEUE_NAMES.CONTENT,
  SEO: QUEUE_NAMES.SEO,
  LANDING: QUEUE_NAMES.LANDING,
  IMAGE: QUEUE_NAMES.LANDING, // Images go through the landing queue
  SHOPIFY: QUEUE_NAMES.PUBLISH,
  REVIEW: QUEUE_NAMES.PUBLISH,
  PUBLISH: QUEUE_NAMES.PUBLISH,
};

export interface WorkflowJobData {
  workflowId: string;
  productId: string;
  productIdea: string;
  step: WorkflowStepType;
}

/**
 * Enqueue the first step (RESEARCH) to start a new workflow.
 */
export async function enqueueWorkflow(
  workflowId: string,
  productId: string,
  productIdea: string,
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.RESEARCH);

  const job = await queue.add('workflow-start', {
    workflowId,
    productId,
    productIdea,
    step: 'RESEARCH' as WorkflowStepType,
  } satisfies WorkflowJobData);

  logger.info(
    { workflowId, jobId: job.id, queue: QUEUE_NAMES.RESEARCH },
    'Workflow enqueued for execution',
  );
}

/**
 * Enqueue the next step after a step completes.
 */
export async function enqueueNextStep(
  workflowId: string,
  productId: string,
  productIdea: string,
  step: WorkflowStepType,
): Promise<void> {
  const queueName = STEP_QUEUE_MAP[step];

  if (!queueName) {
    logger.warn({ step }, 'No queue mapped for step, skipping enqueue');
    return;
  }

  const queue = getQueue(queueName);

  const job = await queue.add(`workflow-step-${step}`, {
    workflowId,
    productId,
    productIdea,
    step,
  } satisfies WorkflowJobData);

  logger.info(
    { workflowId, step, jobId: job.id, queue: queueName },
    'Next workflow step enqueued',
  );
}
