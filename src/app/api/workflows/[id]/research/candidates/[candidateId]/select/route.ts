/**
 * Purpose:
 * Research candidate selection API route.
 * POST /api/workflows/:id/research/candidates/:candidateId/select
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { selectResearchCandidateSchema } from '@/schemas/research.schema';
import { success, handleError, parseBody } from '../../../../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string; candidateId: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, selectResearchCandidateSchema);
    const result = await researchService.selectCandidate(
      params.id,
      params.candidateId,
      body.reviewerId,
      body.comment,
    );

    logger.info(
      { workflowId: params.id, candidateId: params.candidateId },
      'Research candidate selected via API',
    );

    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
