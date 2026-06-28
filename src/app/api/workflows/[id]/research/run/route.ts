/**
 * Purpose:
 * Disabled legacy direct Research Product Intelligence run API route.
 * POST /api/workflows/:id/research/run
 *
 * Product Research execution now starts only through AI Discovery Jobs:
 * POST /api/product-research/discovery-jobs
 */

import { NextResponse } from 'next/server';

export async function POST(
  _request: Request,
  { params: _params }: { params: { id: string } },
): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message:
          'Direct workflow research runs are disabled. Start Product Research through /api/product-research/discovery-jobs.',
      },
    },
    {
      status: 405,
      headers: { Allow: 'GET' },
    },
  );
}
