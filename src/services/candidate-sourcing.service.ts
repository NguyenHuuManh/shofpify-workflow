/**
 * Purpose:
 * Candidate-level 1688 sourcing enrichment for Product Research.
 *
 * Responsibilities:
 * - Run sourcing only after a ProductCandidate already exists
 * - Persist normalized SOURCING evidence against that candidate
 * - Update factory cost, MOQ, landed cost, and sourcing score fields
 *
 * Dependencies:
 * - ProductCandidateRepository
 * - ResearchRunRepository
 * - ResearchSourceRepository
 * - CandidateScoringService
 * - Sourcing1688ResearchProvider
 */

import { auditLogRepository } from '@/repositories/audit-log.repository';
import { productCandidateRepository } from '@/repositories/product-candidate.repository';
import { researchRunRepository } from '@/repositories/research-run.repository';
import { researchSourceRepository } from '@/repositories/research-source.repository';
import { Sourcing1688ResearchProvider } from '@/providers/research';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import {
  candidateSourcingRequestSchema,
  normalizedResearchSourceSchema,
  researchRunConfigSchema,
} from '@/schemas/research.schema';
import { CandidateScoringService, candidateScoringService } from './candidate-scoring.service';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';
import type { ProductCandidateRepository } from '@/repositories/product-candidate.repository';
import type { ResearchRunRepository } from '@/repositories/research-run.repository';
import type { ResearchSourceRepository } from '@/repositories/research-source.repository';
import type {
  CandidateSourcingRequestInput,
  NormalizedResearchSourceInput,
  ProviderEvidenceMetrics,
  ResearchRunConfig,
} from '@/schemas/research.schema';
import type { ResearchProvider } from '@/types/research.types';
import type { Prisma, ProductCandidate, ResearchRun, ResearchSource } from '@prisma/client';

export interface CandidateSourcingResult {
  candidate: ProductCandidate;
  sources: ResearchSource[];
  summary: {
    status: 'ENRICHED' | 'NO_COST_EVIDENCE';
    sourceCount: number;
    selectedSourceId?: string;
    message: string;
  };
}

export class CandidateSourcingService {
  constructor(
    private readonly candidateRepo: ProductCandidateRepository = productCandidateRepository,
    private readonly runRepo: ResearchRunRepository = researchRunRepository,
    private readonly sourceRepo: ResearchSourceRepository = researchSourceRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
    private readonly scoring: CandidateScoringService = candidateScoringService,
    private readonly sourcingProvider: ResearchProvider = new Sourcing1688ResearchProvider(),
  ) {}

  async enrichCandidate(
    candidateId: string,
    input: CandidateSourcingRequestInput,
  ): Promise<CandidateSourcingResult> {
    const parsed = validate(candidateSourcingRequestSchema, input);
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);
    const run = await this.runRepo.findByIdOrThrow(candidate.researchRunId);
    const config = this.resolveSourcingConfig(run);
    const query = parsed.query || candidate.name;

    const providerSources = await this.collectSourcingSources(query, config);
    const sourcesToPersist = this.selectSourcesForCandidate(
      candidate,
      providerSources,
      parsed.sourcingUrl,
    );

    if (parsed.sourcingUrl) {
      sourcesToPersist.unshift(this.buildManualUrlSource(candidate, parsed.sourcingUrl));
    }

    const uniqueSources = this.dedupeSources(sourcesToPersist).slice(0, 5);
    const persistedSources: ResearchSource[] = [];

    for (const source of uniqueSources) {
      persistedSources.push(
        await this.sourceRepo.create({
          researchRunId: candidate.researchRunId,
          candidateId: candidate.id,
          type: source.type,
          provider: source.provider,
          url: source.url,
          externalId: source.externalId,
          title: source.title,
          extractedSignal: source.extractedSignal,
          rawData: source.rawData as Prisma.InputJsonValue | undefined,
          confidence: source.confidence,
          capturedAt: source.capturedAt,
        }),
      );
    }

    const selectedSource = this.selectCostSource(uniqueSources);
    const selectedMetrics = selectedSource ? this.extractEvidenceMetrics(selectedSource) : {};
    const landedCost = this.calculateLandedCost(selectedMetrics, config);
    const hasCostEvidence = Boolean(
      selectedMetrics.factoryUnitCost !== undefined ||
        selectedMetrics.productCost !== undefined ||
        selectedMetrics.moq !== undefined ||
        landedCost.landedCost !== undefined,
    );
    const updatedCandidate = await this.updateCandidateSourcing(
      candidate,
      uniqueSources,
      selectedMetrics,
      landedCost,
      parsed,
      query,
      hasCostEvidence,
    );

    await this.auditRepo.create({
      entityType: 'ProductCandidate',
      entityId: candidate.id,
      action: 'RESEARCH_CANDIDATE_SOURCING_ENRICHED',
      metadata: {
        mode: parsed.mode,
        sourcingUrl: parsed.sourcingUrl,
        query,
        sourceCount: persistedSources.length,
        hasCostEvidence,
      },
    });

    logger.info(
      {
        candidateId: candidate.id,
        mode: parsed.mode,
        sourceCount: persistedSources.length,
        hasCostEvidence,
      },
      'Candidate sourcing enrichment completed',
    );

    return {
      candidate: updatedCandidate,
      sources: persistedSources,
      summary: {
        status: hasCostEvidence ? 'ENRICHED' : 'NO_COST_EVIDENCE',
        sourceCount: persistedSources.length,
        selectedSourceId: persistedSources[0]?.id,
        message: hasCostEvidence
          ? '1688 sourcing evidence updated candidate factory cost and MOQ.'
          : '1688 sourcing evidence was saved, but no usable cost or MOQ metrics were found.',
      },
    };
  }

  private resolveSourcingConfig(run: ResearchRun): ResearchRunConfig {
    const input =
      run.input && typeof run.input === 'object' && !Array.isArray(run.input)
        ? (run.input as Record<string, unknown>)
        : {};
    const config =
      input.config && typeof input.config === 'object' && !Array.isArray(input.config)
        ? (input.config as Record<string, unknown>)
        : {};

    return validate(researchRunConfigSchema, {
      ...config,
      supplementalProviders: ['sourcing'],
    });
  }

  private async collectSourcingSources(
    productIdea: string,
    config: ResearchRunConfig,
  ): Promise<NormalizedResearchSourceInput[]> {
    const sources = await this.sourcingProvider.collect({
      productIdea,
      config,
      candidates: [],
    });

    return sources
      .map((source) => validate(normalizedResearchSourceSchema, source))
      .filter((source) => source.type === 'SOURCING');
  }

  private selectSourcesForCandidate(
    candidate: ProductCandidate,
    sources: NormalizedResearchSourceInput[],
    sourcingUrl?: string,
  ): NormalizedResearchSourceInput[] {
    const urlOfferId = sourcingUrl ? this.extract1688OfferId(sourcingUrl) : undefined;
    if (urlOfferId) {
      const exact = sources.filter((source) => source.externalId === urlOfferId);
      if (exact.length > 0) {
        return exact;
      }
    }

    const byName = sources.filter((source) => this.sourceMatchesCandidate(source, candidate.name));
    return byName.length > 0 ? byName : sources.slice(0, 3);
  }

  private buildManualUrlSource(
    candidate: ProductCandidate,
    sourcingUrl: string,
  ): NormalizedResearchSourceInput {
    return {
      type: 'SOURCING',
      provider: 'manual_1688_url',
      url: sourcingUrl,
      externalId: this.extract1688OfferId(sourcingUrl),
      title: candidate.name,
      extractedSignal:
        'User supplied 1688 sourcing URL for candidate-level supplier research.',
      rawData: {
        sourcePlatform: '1688',
        manualUrl: true,
        metrics: {},
      },
      confidence: 0.5,
      capturedAt: new Date(),
    };
  }

  private dedupeSources(
    sources: NormalizedResearchSourceInput[],
  ): NormalizedResearchSourceInput[] {
    const seen = new Set<string>();
    return sources.filter((source) => {
      const key = source.url ?? source.externalId ?? `${source.provider}:${source.title}`;
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private selectCostSource(
    sources: NormalizedResearchSourceInput[],
  ): NormalizedResearchSourceInput | undefined {
    return (
      sources.find((source) => {
        const metrics = this.extractEvidenceMetrics(source);
        return (
          metrics.factoryUnitCost !== undefined ||
          metrics.productCost !== undefined ||
          metrics.moq !== undefined ||
          metrics.landedCost !== undefined
        );
      }) ?? sources.find((source) => source.type === 'SOURCING')
    );
  }

  private async updateCandidateSourcing(
    candidate: ProductCandidate,
    sources: NormalizedResearchSourceInput[],
    metrics: ProviderEvidenceMetrics,
    landedCost: { landedCost?: number; breakdown?: Record<string, unknown> },
    input: ReturnType<typeof candidateSourcingRequestSchema.parse>,
    query: string,
    hasCostEvidence: boolean,
  ): Promise<ProductCandidate> {
    const factoryUnitCost = metrics.factoryUnitCost ?? metrics.productCost;
    const estimatedCOGS = landedCost.landedCost ?? factoryUnitCost ?? this.parseNumber(candidate.estimatedCOGS);
    const score = this.scoring.score({
      demandScore: this.nullableNumber(candidate.demandScore),
      trendScore: this.nullableNumber(candidate.trendScore),
      competitionScore: this.nullableNumber(candidate.competitionScore),
      marginScore: this.nullableNumber(candidate.marginScore),
      supplierScore: metrics.supplierSignal ?? this.nullableNumber(candidate.supplierScore),
      sourcingScore: metrics.sourcingSignal ?? this.nullableNumber(candidate.sourcingScore),
      factoryCostScore:
        metrics.factoryCostSignal ?? this.nullableNumber(candidate.factoryCostScore),
      logisticsScore: metrics.logisticsSignal ?? this.nullableNumber(candidate.logisticsScore),
      creativePotentialScore: this.nullableNumber(candidate.creativePotentialScore),
      riskScore: metrics.riskSignal ?? this.nullableNumber(candidate.riskScore),
      recommendedPrice: this.parseNumber(candidate.recommendedPrice) ?? undefined,
      estimatedCOGS,
      estimatedShipping:
        metrics.shippingCost ?? this.parseNumber(candidate.estimatedShipping) ?? undefined,
      landedCost: landedCost.landedCost ?? metrics.landedCost,
    });

    return this.candidateRepo.updateSourcingAnalysis(candidate.id, {
      estimatedCOGS,
      estimatedShipping:
        metrics.shippingCost ?? this.parseNumber(candidate.estimatedShipping) ?? undefined,
      factoryUnitCost,
      moq: metrics.moq,
      landedCost: landedCost.landedCost ?? metrics.landedCost,
      landedCostBreakdown: landedCost.breakdown as Prisma.InputJsonValue | undefined,
      estimatedGrossProfit: score.estimatedGrossProfit,
      grossMarginPercent: score.grossMarginPercent,
      breakEvenRoas: score.breakEvenRoas,
      supplierScore: score.supplierScore,
      sourcingScore: score.sourcingScore,
      factoryCostScore: score.factoryCostScore,
      logisticsScore: score.logisticsScore,
      marginScore: score.marginScore,
      riskScore: score.riskScore,
      winningScore: score.winningScore,
      metadata: this.mergeMetadata(candidate, sources, input, query, hasCostEvidence),
    });
  }

  private mergeMetadata(
    candidate: ProductCandidate,
    sources: NormalizedResearchSourceInput[],
    input: ReturnType<typeof candidateSourcingRequestSchema.parse>,
    query: string,
    hasCostEvidence: boolean,
  ): Prisma.InputJsonValue {
    const base =
      candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata)
        ? (candidate.metadata as Record<string, unknown>)
        : {};
    const evidence =
      base.evidence && typeof base.evidence === 'object' && !Array.isArray(base.evidence)
        ? (base.evidence as Record<string, unknown>)
        : {};
    const sourceTypes = Array.from(
      new Set([
        ...((Array.isArray(evidence.sourceTypes) ? evidence.sourceTypes : []) as unknown[]).map(String),
        'SOURCING',
      ]),
    );
    const selectedSource = this.selectCostSource(sources);

    return {
      ...base,
      evidence: {
        ...evidence,
        sourceCount: Number(evidence.sourceCount ?? 0) + sources.length,
        sourceTypes,
        backedByExternalEvidence: true,
      },
      sourcingEnrichment: {
        mode: input.mode,
        sourcingUrl: input.sourcingUrl,
        query,
        status: hasCostEvidence ? 'ENRICHED' : 'NO_COST_EVIDENCE',
        sourceCount: sources.length,
        enrichedAt: new Date().toISOString(),
        selectedSource: selectedSource
          ? {
              provider: selectedSource.provider,
              url: selectedSource.url,
              externalId: selectedSource.externalId,
              title: selectedSource.title,
            }
          : undefined,
      },
    } as Prisma.InputJsonValue;
  }

  private calculateLandedCost(
    metrics: ProviderEvidenceMetrics,
    config: ResearchRunConfig,
  ): { landedCost?: number; breakdown?: Record<string, unknown> } {
    const factoryUnitCost = metrics.factoryUnitCost ?? metrics.productCost;
    if (factoryUnitCost === undefined) {
      return {};
    }

    const assumptions = config.sourcing.landedCostAssumptions;
    const domesticChinaShipping = metrics.shippingCost ?? 0;
    const internationalFreightEstimate = assumptions.internationalFreightPerUnit ?? 0;
    const agentFeeEstimate = assumptions.agentFeePercent
      ? Math.round(factoryUnitCost * (assumptions.agentFeePercent / 100) * 100) / 100
      : 0;
    const customsDutyEstimate = assumptions.customsDutyPercent
      ? Math.round(factoryUnitCost * (assumptions.customsDutyPercent / 100) * 100) / 100
      : 0;
    const packagingEstimate = assumptions.packagingPerUnit ?? 0;
    const qcEstimate = assumptions.qcPerUnit ?? 0;
    const landedCost =
      Math.round(
        (
          factoryUnitCost +
          domesticChinaShipping +
          internationalFreightEstimate +
          agentFeeEstimate +
          customsDutyEstimate +
          packagingEstimate +
          qcEstimate
        ) *
          100,
      ) / 100;

    return {
      landedCost,
      breakdown: {
        factoryUnitCost,
        moq: metrics.moq,
        domesticChinaShipping,
        internationalFreightEstimate,
        agentFeeEstimate,
        customsDutyEstimate,
        packagingEstimate,
        qcEstimate,
        landedCost,
      },
    };
  }

  private extractEvidenceMetrics(source: NormalizedResearchSourceInput): ProviderEvidenceMetrics {
    const rawData = source.rawData ?? {};
    return rawData.metrics && typeof rawData.metrics === 'object' && !Array.isArray(rawData.metrics)
      ? (rawData.metrics as ProviderEvidenceMetrics)
      : {};
  }

  private sourceMatchesCandidate(source: NormalizedResearchSourceInput, candidateName: string): boolean {
    const haystack = [
      source.title,
      source.extractedSignal,
      source.url,
      source.externalId,
      JSON.stringify(source.rawData ?? {}),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const terms = candidateName
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 3);

    return terms.some((term) => haystack.includes(term));
  }

  private extract1688OfferId(url: string): string | undefined {
    const match = url.match(/offer\/(\d+)\.html/iu) ?? url.match(/[?&](?:offerId|id)=(\d+)/iu);
    return match?.[1];
  }

  private nullableNumber(value: number | null): number | undefined {
    return value === null ? undefined : value;
  }

  private parseNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (
      value &&
      typeof value === 'object' &&
      'toString' in value &&
      typeof value.toString === 'function'
    ) {
      const parsed = Number(value.toString());
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
}

export const candidateSourcingService = new CandidateSourcingService();
