/**
 * Purpose:
 * Product Research project detail API routes.
 *
 * Responsibilities:
 * - Delete a research project workspace and its research records
 *
 * Dependencies:
 * - ResearchService
 * - api-helpers
 */

import type { NextResponse } from 'next/server';
import { researchService } from '@/services/research.service';
import { handleError, success } from '../../api-helpers';

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string } },
): Promise<NextResponse> {
  try {
    const result = await researchService.deleteProject(params.projectId);

    return success({
      researchProjectId: result.project.id,
      deletedRuns: result.deletedRuns,
      deletedCandidates: result.deletedCandidates,
      deletedSources: result.deletedSources,
      message: 'Research project deleted',
    });
  } catch (error) {
    return handleError(error);
  }
}
