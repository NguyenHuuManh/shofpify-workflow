/**
 * Purpose:
 * Product detail API routes.
 * GET    /api/products/:id  — Get product by ID
 * PUT    /api/products/:id  — Update product
 * DELETE /api/products/:id  — Delete product
 *
 * Dependencies:
 * - ProductService
 * - Zod schemas
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { updateProductSchema } from '@/schemas/product.schema';
import { success, handleError, parseBody } from '../../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const product = await productService.getById(params.id);
    return success(product);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, updateProductSchema);
    const product = await productService.update(params.id, body);

    logger.info({ productId: params.id }, 'Product updated via API');
    return success(product);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const product = await productService.delete(params.id);

    logger.info({ productId: params.id }, 'Product deleted via API');
    return success(product);
  } catch (error) {
    return handleError(error);
  }
}
