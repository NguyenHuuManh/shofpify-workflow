/**
 * Purpose:
 * Server actions for the independent Product Research workspace.
 *
 * Responsibilities:
 * - Create research projects
 * - Select and promote candidates
 *
 * Dependencies:
 * - ResearchService
 * - next/navigation
 */

'use server';

import { redirect } from 'next/navigation';
import { researchService } from '@/services/research.service';

export async function createResearchProject(formData: FormData): Promise<void> {
  const query = String(formData.get('query') ?? '').trim();

  await researchService.createProjectAndRun({
    query,
    targetMarket: String(formData.get('targetMarket') ?? 'US'),
    objective: 'find_winning_product',
  });

  redirect('/dashboard/product-research');
}

export async function selectCandidate(formData: FormData): Promise<void> {
  const candidateId = String(formData.get('candidateId') ?? '');

  await researchService.selectProjectCandidate(
    candidateId,
    undefined,
    'Selected from Product Research workspace',
  );

  redirect('/dashboard/product-research');
}

export async function promoteCandidate(formData: FormData): Promise<void> {
  const candidateId = String(formData.get('candidateId') ?? '');

  const result = await researchService.promoteCandidate(
    candidateId,
    undefined,
    'Promoted from Product Research workspace',
  );

  redirect(`/dashboard/workflows/${result.workflowId}`);
}
