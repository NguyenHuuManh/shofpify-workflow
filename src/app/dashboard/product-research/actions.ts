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
import { revalidatePath } from 'next/cache';
import { candidateSourcingService } from '@/services/candidate-sourcing.service';
import { sourcingVerificationService } from '@/services/sourcing-verification.service';
import { researchService } from '@/services/research.service';
import { discoveryJobService } from '@/services/discovery-job.service';
import { sourceMatchingService } from '@/services/source-matching.service';
import { enqueueProductDiscoveryJob } from '@/jobs/job-producer';

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
    excludedCategories: parseExcludedCategories(
      formData,
      'excludedCategories',
      'excludedCategoriesCustom',
    ),
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

export async function startDiscoveryJob(formData: FormData): Promise<void> {
  const seedQuery = String(formData.get('seedQuery') ?? '').trim();
  const priceMin = optionalNumber(formData.get('discoveryPriceMin'));
  const priceMax = optionalNumber(formData.get('discoveryPriceMax'));
  const maxMoq = optionalNumber(formData.get('discoveryMaxMoq'));
  const internationalFreightPerUnit = optionalNumber(
    formData.get('discoveryInternationalFreightPerUnit'),
  );
  const targetMarginPercent =
    optionalNumber(formData.get('discoveryTargetMarginPercent')) ?? 40;
  const maxQueries = optionalNumber(formData.get('maxQueries')) ?? 6;

  const result = await discoveryJobService.start({
    seedQuery: seedQuery || undefined,
    targetMarket: String(formData.get('discoveryTargetMarket') ?? 'US'),
    objective: 'autonomous_discovery',
    priceBand:
      priceMin !== undefined || priceMax !== undefined
        ? {
            min: priceMin ?? 0,
            max: priceMax ?? priceMin ?? 0,
          }
        : undefined,
    targetMarginPercent,
    riskTolerance: parseRiskTolerance(formData.get('discoveryRiskTolerance')),
    excludedCategories: parseExcludedCategories(
      formData,
      'discoveryExcludedCategories',
      'discoveryExcludedCategoriesCustom',
    ),
    maxQueries,
    sourcing: {
      targetSource: '1688',
      targetCurrency: 'USD',
      maxMoq,
      landedCostAssumptions: {
        agentFeePercent: optionalNumber(formData.get('discoveryAgentFeePercent')),
        internationalFreightPerUnit,
        customsDutyPercent: optionalNumber(formData.get('discoveryCustomsDutyPercent')),
        packagingPerUnit: optionalNumber(formData.get('discoveryPackagingPerUnit')),
        qcPerUnit: optionalNumber(formData.get('discoveryQcPerUnit')),
      },
    },
  });

  await enqueueProductDiscoveryJob(result.discoveryJob.id);

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

function parseExcludedCategories(
  formData: FormData,
  checkboxName: string,
  customName: string,
): string[] {
  const values = [
    ...formData.getAll(checkboxName).map((value) => String(value)),
    ...String(formData.get(customName) ?? '').split(/[,;\n]+/u),
  ];
  const seen = new Set<string>();
  const categories: string[] = [];

  for (const value of values) {
    const category = value.trim();
    const dedupeKey = category.toLowerCase();
    if (!category || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    categories.push(category);
  }

  return categories;
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

export async function runSourceMatchReview(formData: FormData): Promise<void> {
  const candidateId = String(formData.get('candidateId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  const sourceIds = formData
    .getAll('sourceIds')
    .map((value) => String(value))
    .filter(Boolean);

  await sourceMatchingService.reviewCandidateSources(candidateId, {
    sourceIds,
    reviewerMode: 'draft',
  });

  revalidatePath(`/dashboard/product-research/${projectId}`);
}

export async function decideSourceMatch(formData: FormData): Promise<void> {
  const candidateId = String(formData.get('candidateId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  const matchId = String(formData.get('matchId') ?? '');
  const decision = String(formData.get('decision') ?? '');

  if (
    decision !== 'CONFIRMED_MATCH' &&
    decision !== 'REJECTED_MATCH' &&
    decision !== 'NEEDS_BETTER_SOURCE'
  ) {
    return;
  }

  await sourceMatchingService.decideSourceMatch(candidateId, matchId, {
    decision,
    reviewerId: 'dashboard',
    comment: 'Reviewed from Product Research workspace',
  });

  revalidatePath(`/dashboard/product-research/${projectId}`);
}

export async function enrichCandidateSourcing(formData: FormData): Promise<void> {
  const candidateId = String(formData.get('candidateId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  const sourcingUrl = String(formData.get('sourcingUrl') ?? '').trim();
  const query = String(formData.get('sourcingQuery') ?? '').trim();
  const mode = sourcingUrl ? 'manual_url' : 'agent_search';

  await candidateSourcingService.enrichCandidate(candidateId, {
    mode,
    sourcingUrl: sourcingUrl || undefined,
    query: query || undefined,
  });

  revalidatePath(`/dashboard/product-research/${projectId}`);
}

export async function applySourcingVerification(formData: FormData): Promise<void> {
  const candidateId = String(formData.get('candidateId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  const status = String(formData.get('verificationStatus') ?? '');

  if (
    status !== 'VERIFIED' &&
    status !== 'REJECTED' &&
    status !== 'NEEDS_MORE_INFO' &&
    status !== 'PENDING_VERIFICATION'
  ) {
    return;
  }

  const notes = String(formData.get('notes') ?? '').trim() || undefined;

  await sourcingVerificationService.applyDecision(candidateId, {
    status,
    reviewerId: 'dashboard',
    notes,
    factoryExists: formData.get('factoryExists') === 'on',
    moqConfirmed: formData.get('moqConfirmed') === 'on',
    priceReasonable: formData.get('priceReasonable') === 'on',
    sampleAvailable: formData.get('sampleAvailable') === 'on',
    shippingFeasible: formData.get('shippingFeasible') === 'on',
    supplierResponsive: formData.get('supplierResponsive') === 'on',
  });

  revalidatePath(`/dashboard/product-research/${projectId}`);
}
