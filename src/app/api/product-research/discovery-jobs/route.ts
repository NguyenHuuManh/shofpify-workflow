/**
 * Purpose:
 * Product Research autonomous discovery job API routes.
 *
 * Responsibilities:
 * - List recent discovery jobs
 * - Create and enqueue autonomous discovery jobs
 *
 * Dependencies:
 * - DiscoveryJobService
 * - BullMQ job producer
 * - Product Research schemas
 * - API helpers
 */

import type { NextResponse } from 'next/server';
import { discoveryJobService } from '@/services/discovery-job.service';
import { autonomousDiscoveryJobSchema } from '@/schemas/research.schema';
import { enqueueProductDiscoveryJob } from '@/jobs/job-producer';
import { created, handleError, parseBody, success } from '../../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {
  try {
    const jobs = await discoveryJobService.list({ take: 25 });
    return success({ jobs });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseBody(request, autonomousDiscoveryJobSchema);
    const result = await discoveryJobService.start(body);
    await enqueueProductDiscoveryJob(result.discoveryJob.id);

    logger.info(
      {
        discoveryJobId: result.discoveryJob.id,
        researchProjectId: result.researchProject.id,
      },
      'Autonomous discovery job created via API',
    );

    return created({
      researchProjectId: result.researchProject.id,
      discoveryJobId: result.discoveryJob.id,
      status: result.discoveryJob.status,
    });
  } catch (error) {
    return handleError(error);
  }
}
