/**
 * Purpose:
 * Review approval API route.
 * POST /api/reviews/:id/approve — Approve a review
 *
 * Dependencies:
 * - ApprovalService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { approvalService } from '@/services/approval.service';
import { approveSchema } from '@/schemas/approval.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, approveSchema);

    // The :id here is the workflow ID
    const approval = await approvalService.approve(
      params.id,
      'system', // Default reviewer when not specified
      body.comment ? { comment: body.comment } : {},
    );

    logger.info({ workflowId: params.id }, 'Review approved via API');
    return success(approval);
  } catch (error) {
    return handleError(error);
  }
}
