/**
 * Purpose:
 * Research source evidence API route.
 * GET /api/workflows/:id/research/sources
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { success, handleError } from '../../../../api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const result = await researchService.getLatestSources(params.id);
    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
