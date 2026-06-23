/**
 * Purpose:
 * Product Research AI-assisted source match review API route.
 * POST /api/product-research/candidates/:candidateId/source-matches/review
 */

import type { NextResponse } from 'next/server';
import { handleError, parseBody, success } from '../../../../../api-helpers';
import { sourceMatchReviewRequestSchema } from '@/schemas/research.schema';
import { sourceMatchingService } from '@/services/source-matching.service';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { candidateId: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, sourceMatchReviewRequestSchema);
    const result = await sourceMatchingService.reviewCandidateSources(params.candidateId, body);

    logger.info(
      { candidateId: params.candidateId, matchCount: result.matches.length },
      'Product research source match review completed via API',
    );

    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
