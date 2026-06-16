/**
 * Purpose:
 * Product Research project candidates API route.
 * GET /api/product-research/:projectId/candidates
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { handleError, success } from '../../../api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
): Promise<NextResponse> {
  try {
    const result = await researchService.getProjectCandidates(params.projectId);
    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
