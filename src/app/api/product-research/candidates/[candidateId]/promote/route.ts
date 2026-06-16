/**
 * Purpose:
 * Product Research candidate promotion API route.
 * POST /api/product-research/candidates/:candidateId/promote
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
    const result = await researchService.promoteCandidate(
      params.candidateId,
      body.reviewerId,
      body.comment,
    );

    logger.info(
      {
        candidateId: params.candidateId,
        productId: result.productId,
        workflowId: result.workflowId,
      },
      'Product research candidate promoted via API',
    );

    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
