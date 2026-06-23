/**
 * Purpose:
 * Product Research source match human decision API route.
 * POST /api/product-research/candidates/:candidateId/source-matches/:matchId/decision
 */

import type { NextResponse } from 'next/server';
import { handleError, parseBody, success } from '../../../../../../api-helpers';
import { sourceMatchDecisionSchema } from '@/schemas/research.schema';
import { sourceMatchingService } from '@/services/source-matching.service';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { candidateId: string; matchId: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, sourceMatchDecisionSchema);
    const result = await sourceMatchingService.decideSourceMatch(
      params.candidateId,
      params.matchId,
      body,
    );

    logger.info(
      {
        candidateId: params.candidateId,
        matchId: params.matchId,
        decision: result.reviewerDecision,
      },
      'Product research source match decision persisted via API',
    );

    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
