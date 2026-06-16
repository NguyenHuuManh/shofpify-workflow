/**
 * Purpose:
 * Product Research candidate selection API route.
 * POST /api/product-research/candidates/:candidateId/select
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { selectResearchCandidateSchema } from '@/schemas/research.schema';
import { handleError, parseBody, success } from '../../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { candidateId: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, selectResearchCandidateSchema);
    const result = await researchService.selectProjectCandidate(
      params.candidateId,
      body.reviewerId,
      body.comment,
    );

    logger.info(
      { candidateId: params.candidateId, researchProjectId: result.researchProjectId },
      'Product research candidate selected via API',
    );

    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
