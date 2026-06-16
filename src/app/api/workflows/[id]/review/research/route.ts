/**
 * Purpose:
 * Research review API route.
 * POST /api/workflows/:id/review/research — Approve or reject the Research step
 *
 * Dependencies:
 * - ApprovalService
 * - WorkflowService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { approvalService } from '@/services/approval.service';
import { workflowService } from '@/services/workflow.service';
import { researchService } from '@/services/research.service';
import { stepReviewSchema } from '@/schemas/approval.schema';
import { success, handleError, parseBody } from '../../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, stepReviewSchema);

    if (body.decision === 'APPROVED') {
      await researchService.ensureCandidateSelected(params.id);
    }

    const approval = await approvalService.reviewStep(
      params.id,
      'RESEARCH_REVIEW',
      body.reviewerId,
      body.decision,
      body.comment,
    );

    await workflowService.reviewStep(
      params.id,
      'RESEARCH_REVIEW',
      body.decision,
      body.reviewerId,
      body.comment,
    );

    logger.info(
      { workflowId: params.id, decision: body.decision },
      'Research review completed via API',
    );

    return success({ approval, decision: body.decision });
  } catch (error) {
    return handleError(error);
  }
}
