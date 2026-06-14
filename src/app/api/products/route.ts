/**
 * Purpose:
 * Product API routes.
 * GET  /api/products     — List products with optional filters
 * POST /api/products     — Create a new product
 *
 * Dependencies:
 * - ProductService
 * - Zod schemas
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { createProductSchema, productFilterSchema } from '@/schemas/product.schema';
import { success, created, handleError, parseBody } from '../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const filter = productFilterSchema.parse({
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? 1,
      limit: searchParams.get('limit') ?? 20,
    });

    const result = await productService.list(filter);

    return success(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseBody(request, createProductSchema);

    const product = await productService.create(body);

    logger.info({ productId: product.id }, 'Product created via API');
    return created(product);
  } catch (error) {
    return handleError(error);
  }
}
