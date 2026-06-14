/**
 * Purpose:
 * Workflow API routes — start and list.
 * POST /api/workflows/start  — Start a new product workflow
 *
 * Dependencies:
 * - WorkflowService
 * - Zod schemas
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { startWorkflowSchema } from '@/schemas/workflow.schema';
import { created, handleError, parseBody } from '../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseBody(request, startWorkflowSchema);

    const workflow = await workflowService.start(body);

    logger.info({ workflowId: workflow.id }, 'Workflow started via API');
    return created(workflow);
  } catch (error) {
    return handleError(error);
  }
}
