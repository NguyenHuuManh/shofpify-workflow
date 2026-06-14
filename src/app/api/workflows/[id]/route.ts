/**
 * Purpose:
 * Workflow detail API routes.
 * GET /api/workflows/:id — Get workflow with all steps and related data
 *
 * Dependencies:
 * - WorkflowService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { success, handleError } from '../../api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.getById(params.id);
    return success(workflow);
  } catch (error) {
    return handleError(error);
  }
}
