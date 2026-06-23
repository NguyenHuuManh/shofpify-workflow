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
  const objective = String(formData.get('objective') ?? 'find_winning_product');
  const priceMin = optionalNumber(formData.get('priceMin'));
  const priceMax = optionalNumber(formData.get('priceMax'));
  const maxMoq = optionalNumber(formData.get('maxMoq'));
  const internationalFreightPerUnit = optionalNumber(formData.get('internationalFreightPerUnit'));
  const targetMarginPercent = optionalNumber(formData.get('targetMarginPercent')) ?? 40;

  await researchService.createProjectAndRun({
    query,
    targetMarket: String(formData.get('targetMarket') ?? 'US'),
    objective,
    priceBand:
      priceMin !== undefined || priceMax !== undefined
        ? {
            min: priceMin ?? 0,
            max: priceMax ?? priceMin ?? 0,
          }
        : undefined,
    targetMarginPercent,
    riskTolerance: parseRiskTolerance(formData.get('riskTolerance')),
    excludedCategories: formData
      .getAll('excludedCategories')
      .map((value) => String(value).trim())
      .filter(Boolean),
    sourcing: {
      targetSource: '1688',
      targetCurrency: 'USD',
      maxMoq,
      landedCostAssumptions: {
        agentFeePercent: optionalNumber(formData.get('agentFeePercent')),
        internationalFreightPerUnit,
        customsDutyPercent: optionalNumber(formData.get('customsDutyPercent')),
        packagingPerUnit: optionalNumber(formData.get('packagingPerUnit')),
        qcPerUnit: optionalNumber(formData.get('qcPerUnit')),
      },
    },
  });

  redirect('/dashboard/product-research');
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const text = String(value).trim();
  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRiskTolerance(
  value: FormDataEntryValue | null,
): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  return 'medium';
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
