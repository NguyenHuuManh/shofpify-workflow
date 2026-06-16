/**
 * Purpose:
 * Product Research project API routes.
 * GET /api/product-research
 * POST /api/product-research
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { createResearchProjectSchema } from '@/schemas/research.schema';
import { created, handleError, parseBody, success } from '../api-helpers';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {
  try {
    const projects = await researchService.listProjects();
    return success({ projects });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await parseBody(request, createResearchProjectSchema);
    const result = await researchService.createProjectAndRun(body);

    logger.info(
      {
        researchProjectId: result.researchProject.id,
        researchRunId: result.researchRun.id,
      },
      'Product research project created via API',
    );

    return created({
      researchProjectId: result.researchProject.id,
      researchRunId: result.researchRun.id,
      status: result.researchRun.completedAt ? 'COMPLETED' : 'RUNNING',
      candidateCount: result.candidates.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
