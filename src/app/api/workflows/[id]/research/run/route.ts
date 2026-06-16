/**
 * Purpose:
 * Research Product Intelligence run API route.
 * POST /api/workflows/:id/research/run
 */

import type { NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow.service';
import { productService } from '@/services/product.service';
import { researchService } from '@/services/research.service';
import { startResearchRunSchema } from '@/schemas/research.schema';
import { success, handleError, parseBody } from '../../../../api-helpers';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await parseBody(request, startResearchRunSchema);
    const workflow = await workflowService.getById(params.id);
    const product = await productService.getById(workflow.productId);

    const result = await researchService.run({
      workflowId: workflow.id,
      productId: workflow.productId,
      productIdea: product.title,
      config: body,
    });

    logger.info(
      { workflowId: params.id, researchRunId: result.researchRun.id },
      'Research run started via API',
    );

    return success({
      researchRunId: result.researchRun.id,
      status: result.researchRun.completedAt ? 'COMPLETED' : 'RUNNING',
      candidateCount: result.candidates.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
