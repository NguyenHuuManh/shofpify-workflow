/**
 * Purpose:
 * Research content API routes for per-step review & edit.
 * GET  /api/workflows/:id/research — Fetch generated research data
 * PUT  /api/workflows/:id/research — Edit research data before approving
 *
 * Dependencies:
 * - WorkflowService (to resolve productId from workflow)
 * - ProductResearchRepository (direct read for GET)
 * - ProductService (for edit via PUT)
 * - api-helpers
 */

import type { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { productService } from '@/services/product.service';
import { productResearchRepository } from '@/repositories/product-research.repository';
import { updateResearchSchema } from '@/schemas/product.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.getById(params.id);
    const research = await productResearchRepository.findByProductId(workflow.productId);

    if (!research) {
      return success(null);
    }

    return success(research);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, updateResearchSchema);
    const workflow = await workflowService.getById(params.id);

    const updated = await productService.updateResearch(workflow.productId, body);

    logger.info({ workflowId: params.id, productId: workflow.productId }, 'Research edited via API');
    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
