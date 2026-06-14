/**
 * Purpose:
 * Asset detail API route.
 * GET /api/assets/:id — Get asset by ID
 *
 * Dependencies:
 * - AssetService
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { success, handleError } from '../../api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const asset = await assetService.getById(params.id);
    return success(asset);
  } catch (error) {
    return handleError(error);
  }
}
