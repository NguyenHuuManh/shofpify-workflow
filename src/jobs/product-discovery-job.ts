/**
 * Purpose:
 * BullMQ job processor for autonomous Product Research discovery jobs.
 *
 * Responsibilities:
 * - Load discovery job payloads from the research queue
 * - Delegate execution to DiscoveryJobService
 * - Let BullMQ retry failed discovery jobs
 *
 * Dependencies:
 * - DiscoveryJobService
 * - logger
 */

import { discoveryJobService } from '@/services/discovery-job.service';
import { logger } from '@/lib/logger';
import type { ProductDiscoveryJobData } from '@/types/research.types';

export const PRODUCT_DISCOVERY_JOB_NAME = 'product-discovery-job';

export async function processProductDiscoveryJob(job: {
  data: ProductDiscoveryJobData;
}): Promise<void> {
  const { discoveryJobId } = job.data;

  logger.info(
    { discoveryJobId },
    'Processing autonomous product discovery job',
  );

  await discoveryJobService.runJob(discoveryJobId);
}
