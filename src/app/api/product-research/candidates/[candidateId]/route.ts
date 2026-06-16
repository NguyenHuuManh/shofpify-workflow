/**
 * Purpose:
 * Product Research candidate detail API route.
 * GET /api/product-research/candidates/:candidateId
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { handleError, success } from '../../../api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { candidateId: string } },
): Promise<NextResponse> {
  try {
    const detail = await researchService.getCandidateDetail(params.candidateId);
    return success(detail);
  } catch (error) {
    return handleError(error);
  }
}
