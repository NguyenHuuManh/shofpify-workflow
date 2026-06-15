/**
 * Purpose:
 * Product content API routes for per-step review & edit.
 * GET  /api/workflows/:id/content — Fetch generated product content
 * PUT  /api/workflows/:id/content — Edit content before approving
 *
 * Dependencies:
 * - WorkflowService (to resolve productId from workflow)
 * - ProductContentRepository (direct read for GET)
 * - ProductService (for edit via PUT)
 * - api-helpers
 */

import type { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { productService } from '@/services/product.service';
import { productContentRepository } from '@/repositories/product-content.repository';
import { updateContentSchema } from '@/schemas/product.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.getById(params.id);
    const content = await productContentRepository.findByProductId(workflow.productId);

    if (!content) {
      return success(null);
    }

    return success(content);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, updateContentSchema);
    const workflow = await workflowService.getById(params.id);

    const updated = await productService.updateContent(workflow.productId, body);

    logger.info({ workflowId: params.id, productId: workflow.productId }, 'Content edited via API');
    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
