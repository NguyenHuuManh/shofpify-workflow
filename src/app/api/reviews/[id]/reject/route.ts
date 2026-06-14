/**
 * Purpose:
 * Review rejection API route.
 * POST /api/reviews/:id/reject — Reject a review with reason
 *
 * Dependencies:
 * - ApprovalService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { approvalService } from '@/services/approval.service';
import { rejectSchema } from '@/schemas/approval.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, rejectSchema);

    const approval = await approvalService.reject(
      params.id,
      'system',
      { comment: body.comment },
    );

    logger.warn({ workflowId: params.id }, 'Review rejected via API');
    return success(approval);
  } catch (error) {
    return handleError(error);
  }
}
