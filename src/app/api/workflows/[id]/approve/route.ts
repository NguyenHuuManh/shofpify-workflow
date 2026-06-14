/**
 * Purpose:
 * Workflow approval API route.
 * POST /api/workflows/:id/approve — Approve a workflow
 *
 * Dependencies:
 * - ApprovalService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { approvalService } from '@/services/approval.service';
import { approveSchema, submitForReviewSchema } from '@/schemas/approval.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(
      request,
      submitForReviewSchema.extend({ comment: approveSchema.shape.comment }),
    );

    const approval = await approvalService.approve(
      params.id,
      body.reviewerId,
      body.comment ? { comment: body.comment } : {},
    );

    logger.info({ workflowId: params.id }, 'Workflow approved via API');
    return success(approval);
  } catch (error) {
    return handleError(error);
  }
}
