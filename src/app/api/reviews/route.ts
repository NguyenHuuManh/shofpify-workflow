/**
 * Purpose:
 * Review API routes.
 * GET /api/reviews — List all approvals/reviews
 *
 * Dependencies:
 * - ApprovalService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { approvalService } from '@/services/approval.service';
import { success, handleError } from '../api-helpers';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');

    if (workflowId) {
      const reviews = await approvalService.getByWorkflowId(workflowId);
      return success(reviews);
    }

    // Without workflowId, return latest decision for a default or empty
    return success([]);
  } catch (error) {
    return handleError(error);
  }
}
