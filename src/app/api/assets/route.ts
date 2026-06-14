/**
 * Purpose:
 * Asset API routes.
 * POST /api/assets/upload — Create a new asset reference
 *
 * Dependencies:
 * - AssetService
 * - Zod schemas
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { createAssetSchema } from '@/schemas/asset.schema';
import { created, handleError, parseBody } from '../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseBody(request, createAssetSchema);

    const asset = await assetService.create(body);

    logger.info({ assetId: asset.id }, 'Asset created via API');
    return created(asset);
  } catch (error) {
    return handleError(error);
  }
}
