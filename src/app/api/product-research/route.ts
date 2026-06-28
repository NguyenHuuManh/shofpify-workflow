/**
 * Purpose:
 * Product Research project API routes.
 * GET /api/product-research
 *
 * New research work must be started through
 * POST /api/product-research/discovery-jobs so the AI Discovery Job remains
 * the only public entrypoint for Product Research execution.
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { handleError, success } from '../api-helpers';

export async function GET(): Promise<NextResponse> {
  try {
    const projects = await researchService.listProjects();
    return success({ projects });
  } catch (error) {
    return handleError(error);
  }
}
