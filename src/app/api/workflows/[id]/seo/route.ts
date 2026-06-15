/**
 * Purpose:
 * SEO metadata API routes for per-step review & edit.
 * GET  /api/workflows/:id/seo — Fetch generated SEO metadata
 * PUT  /api/workflows/:id/seo — Edit SEO before approving
 *
 * Dependencies:
 * - WorkflowService (to resolve productId from workflow)
 * - ProductSEORepository (direct read for GET)
 * - ProductService (for edit via PUT)
 * - api-helpers
 */

import type { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { productService } from '@/services/product.service';
import { productSEORepository } from '@/repositories/product-seo.repository';
import { updateSeoSchema } from '@/schemas/product.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.getById(params.id);
    const seo = await productSEORepository.findByProductId(workflow.productId);

    if (!seo) {
      return success(null);
    }

    return success(seo);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, updateSeoSchema);
    const workflow = await workflowService.getById(params.id);

    const updated = await productService.updateSEO(workflow.productId, body);

    logger.info({ workflowId: params.id, productId: workflow.productId }, 'SEO edited via API');
    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
