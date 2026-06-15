/**
 * Purpose:
 * Landing page API routes for per-step review & edit.
 * GET  /api/workflows/:id/landing — Fetch generated landing page
 * PUT  /api/workflows/:id/landing — Edit landing page before approving
 *
 * Dependencies:
 * - WorkflowService (to resolve productId from workflow)
 * - LandingPageRepository (direct read for GET)
 * - ProductService (for edit via PUT)
 * - api-helpers
 */

import type { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { productService } from '@/services/product.service';
import { landingPageRepository } from '@/repositories/landing-page.repository';
import { updateLandingSchema } from '@/schemas/product.schema';
import { success, handleError, parseBody } from '../../../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const workflow = await workflowService.getById(params.id);
    const landing = await landingPageRepository.findByProductId(workflow.productId);

    if (!landing) {
      return success(null);
    }

    return success(landing);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, updateLandingSchema);
    const workflow = await workflowService.getById(params.id);

    const updated = await productService.updateLanding(workflow.productId, body);

    logger.info({ workflowId: params.id, productId: workflow.productId }, 'Landing page edited via API');
    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
