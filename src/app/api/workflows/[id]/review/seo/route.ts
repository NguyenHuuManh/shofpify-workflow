/**
 * Purpose:
 * SEO review API route.
 * POST /api/workflows/:id/review/seo — Approve or reject the SEO step
 *
 * Dependencies:
 * - ApprovalService
 * - WorkflowService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { approvalService } from '@/services/approval.service';
import { workflowService } from '@/services/workflow.service';
import { stepReviewSchema } from '@/schemas/approval.schema';
import { success, handleError, parseBody } from '../../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, stepReviewSchema);

    const approval = await approvalService.reviewStep(
      params.id,
      'SEO_REVIEW',
      body.reviewerId,
      body.decision,
      body.comment,
    );

    await workflowService.reviewStep(
      params.id,
      'SEO_REVIEW',
      body.decision,
      body.reviewerId,
      body.comment,
    );

    logger.info(
      { workflowId: params.id, decision: body.decision },
      'SEO review completed via API',
    );

    return success({ approval, decision: body.decision });
  } catch (error) {
    return handleError(error);
  }
}
