/**
 * Purpose:
 * Product Research candidate-level 1688 sourcing enrichment API route.
 * POST /api/product-research/candidates/:candidateId/sourcing
 */

import type { NextResponse } from 'next/server';
import { handleError, parseBody, success } from '../../../../api-helpers';
import { candidateSourcingRequestSchema } from '@/schemas/research.schema';
import { candidateSourcingService } from '@/services/candidate-sourcing.service';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { candidateId: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, candidateSourcingRequestSchema);
    const result = await candidateSourcingService.enrichCandidate(params.candidateId, body);

    logger.info(
      {
        candidateId: params.candidateId,
        sourceCount: result.summary.sourceCount,
        status: result.summary.status,
      },
      'Product research candidate sourcing completed via API',
    );

    return success({
      candidateId: result.candidate.id,
      status: result.summary.status,
      sourceCount: result.summary.sourceCount,
      selectedSourceId: result.summary.selectedSourceId,
      message: result.summary.message,
    });
  } catch (error) {
    return handleError(error);
  }
}
