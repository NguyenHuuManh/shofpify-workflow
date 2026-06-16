/**
 * Purpose:
 * Research candidate detail API route.
 * GET /api/workflows/:id/research/candidates/:candidateId
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { success, handleError } from '../../../../../api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; candidateId: string } },
): Promise<NextResponse> {
  try {
    const detail = await researchService.getCandidateDetail(params.candidateId);
    return success(detail);
  } catch (error) {
    return handleError(error);
  }
}
