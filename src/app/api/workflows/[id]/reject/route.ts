/**
 * Purpose:
 * Workflow rejection API route.
 * POST /api/workflows/:id/reject — Reject a workflow with reason
 *
 * Dependencies:
 * - ApprovalService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { approvalService } from '@/services/approval.service';
import { rejectSchema, submitForReviewSchema } from '@/schemas/approval.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(
      request,
      submitForReviewSchema.extend({ comment: rejectSchema.shape.comment }),
    );

    const approval = await approvalService.reject(
      params.id,
      body.reviewerId,
      { comment: body.comment ?? 'Rejected without comment' },
    );

    logger.warn({ workflowId: params.id }, 'Workflow rejected via API');
    return success(approval);
  } catch (error) {
    return handleError(error);
  }
}
