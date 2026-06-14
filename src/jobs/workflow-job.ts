/**
 * Purpose:
 * BullMQ job processor for workflow steps.
 * Processes individual workflow step jobs from the queues.
 *
 * Architecture: Job → WorkflowEngine → Agent Node → Service Layer
 *
 * Responsibilities:
 * - Process workflow step jobs from BullMQ
 * - Execute the appropriate agent via WorkflowEngine
 * - Handle job retry and failure
 * - Enqueue the next step on success
 *
 * Dependencies:
 * - bullmq
 * - WorkflowEngine
 * - JobProducer
 * - logger
 */

import { workflowEngine } from '@/workflows/workflow-engine';
import { enqueueNextStep } from './job-producer';
import { logger } from '@/lib/logger';
import type { WorkflowJobData } from './job-producer';
import type { WorkflowStepType } from '@prisma/client';

/**
 * Process a single workflow step job.
 * Called by the BullMQ worker for each job in the queues.
 */
export async function processWorkflowStep(job: {
  data: WorkflowJobData;
}): Promise<void> {
  const { workflowId, productId, productIdea, step } = job.data;

  logger.info(
    { workflowId, step, jobId: job.data },
    'Processing workflow step job',
  );

  try {
    // Execute the step via the workflow engine
    await workflowEngine.executeStep(workflowId, productId, productIdea, step);

    // Determine the next step
    const nextStep = getNextStep(step);
    if (nextStep) {
      // Enqueue the next step
      await enqueueNextStep(workflowId, productId, productIdea, nextStep);
    } else {
      // No next step — workflow complete
      logger.info({ workflowId }, 'Workflow complete — no more steps');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { workflowId, step, error: message, attempt: job.data },
      'Workflow step job failed',
    );
    throw error; // Let BullMQ handle retry
  }
}

/**
 * Determine the next step in the workflow sequence.
 */
function getNextStep(currentStep: WorkflowStepType): WorkflowStepType | null {
  const sequence: WorkflowStepType[] = [
    'RESEARCH',
    'CONTENT',
    'SEO',
    'LANDING',
    'IMAGE',
    'SHOPIFY',
    'REVIEW',
    'PUBLISH',
  ];

  const currentIndex = sequence.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
    return null;
  }

  return sequence[currentIndex + 1]!;
}
