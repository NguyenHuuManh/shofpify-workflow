/**
 * Purpose:
 * Central barrel export for the BullMQ Jobs layer.
 *
 * Dependencies:
 * - All job modules
 */

export {
  QUEUE_NAMES,
  getQueues,
  getQueue,
  closeQueues,
} from './queue-registry';
export type { QueueName } from './queue-registry';

export { enqueueWorkflow, enqueueNextStep, enqueueProductDiscoveryJob } from './job-producer';
export type { WorkflowJobData } from './job-producer';

export { processWorkflowStep } from './workflow-job';
export { processProductDiscoveryJob, PRODUCT_DISCOVERY_JOB_NAME } from './product-discovery-job';
export { startWorker } from './worker';
