/**
 * Purpose:
 * Business logic for the Research Product Intelligence Module.
 *
 * Responsibilities:
 * - Generate product candidate hypotheses through AIProvider interface
 * - Collect normalized evidence through research provider interfaces
 * - Persist research runs, candidates, source evidence, and selected candidate
 * - Coordinate candidate scoring and recommendation
 *
 * Dependencies:
 * - Research repositories
 * - ProductResearchRepository
 * - CandidateScoringService
 * - Research provider interfaces
 * - AIProvider interface
 */

import { productResearchRepository } from '@/repositories/product-research.repository';
import { researchProjectRepository } from '@/repositories/research-project.repository';
import { productCandidateRepository } from '@/repositories/product-candidate.repository';
import { researchRunRepository } from '@/repositories/research-run.repository';
import { researchSourceRepository } from '@/repositories/research-source.repository';
import { researchDiscoveryJobRepository } from '@/repositories/research-discovery-job.repository';
import { sourcingVerificationRepository } from '@/repositories/sourcing-verification.repository';
import { workflowRepository } from '@/repositories/workflow.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { BaseRepository } from '@/repositories/base.repository';
import { productService, type ProductService } from './product.service';
import { workflowService, type WorkflowService } from './workflow.service';
import { CandidateScoringService, candidateScoringService } from './candidate-scoring.service';
import { ProductAggregationService, productAggregationService } from './product-aggregation.service';
import { QueryIntelligenceService, queryIntelligenceService } from './query-intelligence.service';
import { createDefaultResearchProviders } from '@/providers/research';
import { AppError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import {
  normalizedResearchSourceSchema,
  researchRunConfigSchema,
  createResearchProjectSchema,
} from '@/schemas/research.schema';
import type { AIProvider } from '@/types/ai-provider.interface';
import type {
  NormalizedResearchSourceInput,
  ProviderEvidenceMetrics,
  ProductAggregationGroup,
  ResearchCandidateDraft,
  ResearchRunConfig,
  CreateResearchProjectInput,
  ResearchRunConfigInput,
  SupplementalProviderName,
} from '@/schemas/research.schema';
import type {
  ResearchProvider,
  RunResearchInput,
  RunResearchResult,
  ResearchProjectSummary,
  ResearchCollectionContext,
} from '@/types/research.types';
import type { Prisma, ProductCandidate, ResearchProject, ResearchSource } from '@prisma/client';
import type { ProductResearchRepository } from '@/repositories/product-research.repository';
import type { ResearchProjectRepository } from '@/repositories/research-project.repository';
import type { ProductCandidateRepository } from '@/repositories/product-candidate.repository';
import type { ResearchRunRepository } from '@/repositories/research-run.repository';
import type { ResearchSourceRepository } from '@/repositories/research-source.repository';
import type { ResearchDiscoveryJobRepository } from '@/repositories/research-discovery-job.repository';
import type { SourcingVerificationRepository } from '@/repositories/sourcing-verification.repository';
import type { WorkflowRepository } from '@/repositories/workflow.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

export class ResearchService {
  constructor(
    private readonly runRepo: ResearchRunRepository = researchRunRepository,
    private readonly projectRepo: ResearchProjectRepository = researchProjectRepository,
    private readonly candidateRepo: ProductCandidateRepository = productCandidateRepository,
    private readonly sourceRepo: ResearchSourceRepository = researchSourceRepository,
    private readonly researchRepo: ProductResearchRepository = productResearchRepository,
    private readonly workflowRepo: WorkflowRepository = workflowRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
    private readonly scoring: CandidateScoringService = candidateScoringService,
    private readonly providers: ResearchProvider[] = createDefaultResearchProviders(),
    private readonly defaultAiProvider?: AIProvider,
    private readonly productSvc: ProductService = productService,
    private readonly workflowSvc: WorkflowService = workflowService,
    private readonly discoveryJobRepo: ResearchDiscoveryJobRepository = researchDiscoveryJobRepository,
    private readonly verificationRepo: SourcingVerificationRepository = sourcingVerificationRepository,
    private readonly aggregation: ProductAggregationService = productAggregationService,
    private readonly queryIntelligence: QueryIntelligenceService = queryIntelligenceService,
  ) {}

  async createProjectAndRun(
    input: CreateResearchProjectInput,
    aiProvider?: AIProvider,
  ): Promise<RunResearchResult & { researchProject: ResearchProject }> {
    const parsed = validate(createResearchProjectSchema, input);
    const project = await this.projectRepo.create({ query: parsed.query });

    const result = await this.run(
      {
        researchProjectId: project.id,
        productIdea: parsed.query,
        config: parsed,
      },
      aiProvider,
    );

    const updatedProject = await this.projectRepo.updateSummary(
      project.id,
      result.summary,
    );

    return {
      ...result,
      researchProject: updatedProject,
    };
  }

  async run(
    input: RunResearchInput,
    aiProvider?: AIProvider,
  ): Promise<RunResearchResult> {
    const config = validate(researchRunConfigSchema, input.config ?? {});
    const querySources = await this.collectProviderSources(
      input.productIdea,
      config,
      [],
      {
        providerTypes: ['trend', 'keyword', 'search'],
        collectionContext: {
          stage: 'query_intelligence',
          queries: [input.productIdea],
        },
      },
    );
    const queryIntelligenceResult = this.queryIntelligence.selectQueries({
      productIdea: input.productIdea,
      config,
      sources: querySources,
    });
    const selectedDiscoveryQueries = queryIntelligenceResult.selectedQueries;
    const queryMetadata = Object.fromEntries(
      selectedDiscoveryQueries.map((query) => [query.query, query]),
    );
    const candidateDiscoverySources = await this.collectProviderSources(
      input.productIdea,
      config,
      [],
      {
        providerTypes: ['marketplace'],
        collectionContext: {
          stage: 'candidate_discovery',
          queries: selectedDiscoveryQueries.map((query) => query.query),
          selectedQueries: selectedDiscoveryQueries,
          queryMetadata,
          priorSources: querySources,
        },
      },
    );
    const providerSources = [...querySources, ...candidateDiscoverySources];

    const researchRun = await this.runRepo.create({
      researchProjectId: input.researchProjectId,
      productId: input.productId,
      workflowId: input.workflowId,
      input: {
        productIdea: input.productIdea,
        config,
        queryIntelligence: queryIntelligenceResult,
      },
    });

    logger.info(
      { researchRunId: researchRun.id, workflowId: input.workflowId },
      'Research intelligence run started',
    );

    const aggregationResult = await this.aggregation.aggregate(
      {
        productIdea: input.productIdea,
        sources: candidateDiscoverySources,
        maxGroups: config.maxCandidates,
      },
      aiProvider ?? this.defaultAiProvider,
    );
    const candidateDrafts = this.buildCandidatesFromAggregatedGroups(
      input.productIdea,
      config,
      aggregationResult.groups,
      aggregationResult.sources,
    ).filter((candidate) => this.candidateMatchesResearchBrief(candidate, config));

    const candidates: ProductCandidate[] = [];
    const sources: ResearchSource[] = [];

    for (const draft of candidateDrafts) {
      const evidenceSources = this.sourcesForCandidate(providerSources, draft);
      const evidenceAdjustedScoreInput = this.applyEvidenceToScorePayload(
        {
          ...draft.scores,
          recommendedPrice: draft.recommendedPrice,
          estimatedCOGS: draft.estimatedCOGS,
          estimatedShipping: draft.estimatedShipping,
          factoryUnitCost: draft.factoryUnitCost,
          moq: draft.moq,
          landedCost: draft.landedCost,
          landedCostBreakdown: draft.landedCostBreakdown,
        },
        evidenceSources,
      );
      const score = this.scoring.scoreDiscovery({
        ...evidenceAdjustedScoreInput,
      });

      const candidate = await this.candidateRepo.create({
        researchRunId: researchRun.id,
        researchProjectId: input.researchProjectId,
        productId: input.productId,
        name: draft.name,
        positioning: draft.positioning,
        targetMarket: draft.targetMarket ?? config.targetMarket,
        sellingAngle: draft.sellingAngle,
        recommendedPrice: evidenceAdjustedScoreInput.recommendedPrice,
        estimatedCOGS: evidenceAdjustedScoreInput.estimatedCOGS,
        estimatedShipping: evidenceAdjustedScoreInput.estimatedShipping,
        factoryUnitCost: evidenceAdjustedScoreInput.factoryUnitCost,
        moq: evidenceAdjustedScoreInput.moq,
        landedCost: evidenceAdjustedScoreInput.landedCost,
        landedCostBreakdown: evidenceAdjustedScoreInput.landedCostBreakdown as Prisma.InputJsonValue | undefined,
        estimatedGrossProfit: score.estimatedGrossProfit,
        grossMarginPercent: score.grossMarginPercent,
        breakEvenRoas: score.breakEvenRoas,
        demandScore: score.demandScore,
        trendScore: score.trendScore,
        competitionScore: score.competitionScore,
        marginScore: score.marginScore,
        supplierScore: score.supplierScore,
        sourcingScore: score.sourcingScore,
        factoryCostScore: score.factoryCostScore,
        logisticsScore: score.logisticsScore,
        creativePotentialScore: score.creativePotentialScore,
        riskScore: score.riskScore,
        winningScore: score.winningScore,
        confidence: this.resolveCandidateConfidence(draft.confidence, evidenceSources),
        status: score.winningScore >= 70 ? 'SHORTLISTED' : 'DISCOVERED',
        risks: draft.risks as Prisma.InputJsonValue,
        metadata: {
          ...(draft.metadata ?? {}),
          evidence: {
            sourceCount: evidenceSources.length,
            sourceTypes: Array.from(new Set(evidenceSources.map((source) => source.type))),
            backedByExternalEvidence: evidenceSources.length > 0,
          },
          scoringPhase: 'DISCOVERY',
        } as Prisma.InputJsonValue,
      });

      candidates.push(candidate);
    }

    for (const source of providerSources) {
      const linkedCandidate = this.findCandidateForSource(source, candidates);
      sources.push(
        await this.sourceRepo.create({
          researchRunId: researchRun.id,
          candidateId: linkedCandidate?.id,
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

    const ranked = [...candidates].sort(
      (a, b) => (b.winningScore ?? 0) - (a.winningScore ?? 0),
    );
    const bestCandidate = ranked[0];
    const recommendation = {
      bestCandidateId: bestCandidate?.id,
      reason: bestCandidate
        ? `${bestCandidate.name} has the strongest weighted score for ${config.targetMarket}.`
        : 'No candidate met the recommendation threshold.',
    };

    const summary = this.buildExternalEvidenceSummary(
      input.productIdea,
      config,
      providerSources,
      candidates,
    );
    const completedRun = await this.runRepo.updateCompleted(researchRun.id, {
      summary,
      recommendation,
      providerCosts: { estimatedUsd: 0, currency: 'USD' },
    });

    if (input.productId) {
      await this.researchRepo.upsert(input.productId, {
        targetAudience: {
          targetMarket: config.targetMarket,
          source: 'Research Product Intelligence Module',
        },
        competitors: {},
        painPoints: {},
        usp: bestCandidate
          ? {
              primary: bestCandidate.positioning,
              sellingAngle: bestCandidate.sellingAngle,
            }
          : {},
        marketSummary: completedRun.summary ?? summary,
        selectedCandidateId: null,
      });
    }

    await this.auditRepo.create({
      entityType: 'ResearchRun',
      entityId: completedRun.id,
      action: 'RESEARCH_RUN_COMPLETED',
      metadata: {
        productId: input.productId,
        researchProjectId: input.researchProjectId,
        workflowId: input.workflowId,
        candidateCount: candidates.length,
        aggregationMethod: aggregationResult.method,
        queryIntelligence: {
          selectedQueries: selectedDiscoveryQueries.map((query) => query.query),
          candidateQueryCount: queryIntelligenceResult.candidateQueries.length,
        },
      },
    });

    logger.info(
      { researchRunId: completedRun.id, candidateCount: candidates.length },
      'Research intelligence run completed',
    );

    return {
      researchRun: completedRun,
      candidates: ranked,
      sources,
      summary,
      recommendation,
    };
  }

  async listProjects(): Promise<ResearchProjectSummary[]> {
    const projects = await this.projectRepo.findMany({ take: 50 });

    return Promise.all(
      projects.map(async (project) => {
        const latestRun = await this.runRepo.findLatestByResearchProjectId(project.id);
        const candidates = await this.candidateRepo.findByResearchProjectId(project.id);
        const selectedCandidate = candidates.find(
          (candidate) => candidate.id === project.selectedCandidateId,
        );

        return {
          project,
          latestRunId: latestRun?.id ?? null,
          candidates,
          selectedCandidate,
        };
      }),
    );
  }

  async getProjectDetail(projectId: string): Promise<{
    project: ResearchProject;
    latestRun: Awaited<ReturnType<ResearchRunRepository['findLatestByResearchProjectId']>>;
    candidates: ProductCandidate[];
    selectedCandidate?: ProductCandidate;
    sources: ResearchSource[];
    promotedWorkflow: Awaited<ReturnType<WorkflowRepository['findByProductId']>>;
  }> {
    const project = await this.projectRepo.findByIdOrThrow(projectId);
    const latestRun = await this.runRepo.findLatestByResearchProjectId(projectId);
    const candidates = await this.candidateRepo.findByResearchProjectId(projectId);
    const selectedCandidate = candidates.find(
      (candidate) => candidate.id === project.selectedCandidateId,
    );
    const sources = latestRun
      ? this.externalSourcesOnly(await this.sourceRepo.findByResearchRunId(latestRun.id))
      : [];
    const promotedWorkflow = project.promotedProductId
      ? await this.workflowRepo.findByProductId(project.promotedProductId)
      : null;

    return {
      project,
      latestRun,
      candidates,
      selectedCandidate,
      sources,
      promotedWorkflow,
    };
  }

  async getProjectCandidates(projectId: string): Promise<{
    researchProjectId: string;
    researchRunId: string | null;
    candidates: ProductCandidate[];
  }> {
    await this.projectRepo.findByIdOrThrow(projectId);
    const latestRun = await this.runRepo.findLatestByResearchProjectId(projectId);

    return {
      researchProjectId: projectId,
      researchRunId: latestRun?.id ?? null,
      candidates: await this.candidateRepo.findByResearchProjectId(projectId),
    };
  }

  async getLatestCandidates(workflowId: string): Promise<{
    researchRunId: string | null;
    candidates: ProductCandidate[];
  }> {
    const run = await this.runRepo.findLatestByWorkflowId(workflowId);
    if (!run) {
      return { researchRunId: null, candidates: [] };
    }

    return {
      researchRunId: run.id,
      candidates: await this.candidateRepo.findByResearchRunId(run.id),
    };
  }

  async getCandidateDetail(candidateId: string): Promise<{
    candidate: ProductCandidate;
    sources: ResearchSource[];
  }> {
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);
    return {
      candidate,
      sources: this.externalSourcesOnly(await this.sourceRepo.findByCandidateId(candidateId)),
    };
  }

  async getLatestSources(workflowId: string): Promise<{
    researchRunId: string | null;
    sources: ResearchSource[];
  }> {
    const run = await this.runRepo.findLatestByWorkflowId(workflowId);
    if (!run) {
      return { researchRunId: null, sources: [] };
    }

    return {
      researchRunId: run.id,
      sources: this.externalSourcesOnly(await this.sourceRepo.findByResearchRunId(run.id)),
    };
  }

  async getProjectSources(projectId: string): Promise<{
    researchProjectId: string;
    researchRunId: string | null;
    sources: ResearchSource[];
  }> {
    await this.projectRepo.findByIdOrThrow(projectId);
    const run = await this.runRepo.findLatestByResearchProjectId(projectId);
    if (!run) {
      return { researchProjectId: projectId, researchRunId: null, sources: [] };
    }

    return {
      researchProjectId: projectId,
      researchRunId: run.id,
      sources: this.externalSourcesOnly(await this.sourceRepo.findByResearchRunId(run.id)),
    };
  }

  async deleteProject(
    projectId: string,
    actorId?: string,
  ): Promise<{
    project: ResearchProject;
    deletedRuns: number;
    deletedCandidates: number;
    deletedSources: number;
    deletedDiscoveryJobs: number;
    deletedVerifications: number;
  }> {
    const project = await this.projectRepo.findByIdOrThrow(projectId);

    const deleted = await BaseRepository.transaction(async (tx) => {
      // 1. Delete discovery jobs first (they have a required FK to project)
      const deletedDiscoveryJobs = await this.discoveryJobRepo.deleteByResearchProjectId(projectId, tx);

      // 2. Delete sourcing verifications (they reference candidates via FK)
      const deletedVerifications = await this.verificationRepo.deleteByResearchProjectId(projectId, tx);

      // 3. Delete sources, candidates, runs
      const deletedSources = await this.sourceRepo.deleteByResearchProjectId(projectId, tx);
      const deletedCandidates = await this.candidateRepo.deleteByResearchProjectId(projectId, tx);
      const deletedRuns = await this.runRepo.deleteByResearchProjectId(projectId, tx);

      // 4. Delete the project itself
      const deletedProject = await this.projectRepo.delete(projectId, tx);

      return {
        project: deletedProject,
        deletedRuns,
        deletedCandidates,
        deletedSources,
        deletedDiscoveryJobs,
        deletedVerifications,
      };
    });

    await this.auditRepo.create({
      entityType: 'ResearchProject',
      entityId: projectId,
      action: 'RESEARCH_PROJECT_DELETED',
      actorId,
      metadata: {
        query: project.query,
        status: project.status,
        promotedProductId: project.promotedProductId,
        deletedRuns: deleted.deletedRuns,
        deletedCandidates: deleted.deletedCandidates,
        deletedSources: deleted.deletedSources,
        deletedDiscoveryJobs: deleted.deletedDiscoveryJobs,
        deletedVerifications: deleted.deletedVerifications,
      },
    });

    logger.info(
      {
        researchProjectId: projectId,
        deletedRuns: deleted.deletedRuns,
        deletedCandidates: deleted.deletedCandidates,
        deletedSources: deleted.deletedSources,
        deletedDiscoveryJobs: deleted.deletedDiscoveryJobs,
        deletedVerifications: deleted.deletedVerifications,
      },
      'Research project deleted',
    );

    return deleted;
  }

  private externalSourcesOnly(sources: ResearchSource[]): ResearchSource[] {
    return sources.filter((source) => source.type !== 'AI_ESTIMATE');
  }

  async selectCandidate(
    workflowId: string,
    candidateId: string,
    reviewerId: string,
    comment?: string,
  ): Promise<{ selectedCandidateId: string }> {
    const workflow = await this.workflowRepo.findByIdOrThrow(workflowId);
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);

    if (candidate.productId !== workflow.productId) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Candidate does not belong to this workflow product',
        statusCode: 400,
      });
    }

    await this.candidateRepo.updateStatus(candidateId, 'APPROVED');
    await this.candidateRepo.markOthersRejected(
      { productId: workflow.productId },
      candidateId,
    );

    const existingResearch = await this.researchRepo.findByProductId(workflow.productId);
    await this.researchRepo.upsert(workflow.productId, {
      targetAudience: existingResearch?.targetAudience ?? {},
      competitors: existingResearch?.competitors ?? {},
      painPoints: existingResearch?.painPoints ?? {},
      usp: existingResearch?.usp ?? {},
      marketSummary:
        existingResearch?.marketSummary ??
        `${candidate.name} selected for content generation.`,
      selectedCandidateId: candidateId,
    });

    await this.auditRepo.create({
      entityType: 'ProductCandidate',
      entityId: candidateId,
      action: 'RESEARCH_CANDIDATE_SELECTED',
      actorId: reviewerId,
      metadata: {
        workflowId,
        productId: workflow.productId,
        comment,
      },
    });

    logger.info(
      { workflowId, candidateId, reviewerId },
      'Research candidate selected',
    );

    return { selectedCandidateId: candidateId };
  }

  async selectProjectCandidate(
    candidateId: string,
    reviewerId?: string,
    comment?: string,
  ): Promise<{ selectedCandidateId: string; researchProjectId: string }> {
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);

    if (!candidate.researchProjectId) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Candidate is not attached to a research project',
        statusCode: 400,
      });
    }

    await this.projectRepo.findByIdOrThrow(candidate.researchProjectId);
    await this.candidateRepo.updateStatus(candidateId, 'APPROVED');
    await this.candidateRepo.markOthersRejected(
      { researchProjectId: candidate.researchProjectId },
      candidateId,
    );
    await this.projectRepo.updateSelectedCandidate(candidate.researchProjectId, candidateId);

    await this.auditRepo.create({
      entityType: 'ProductCandidate',
      entityId: candidateId,
      action: 'RESEARCH_PROJECT_CANDIDATE_SELECTED',
      actorId: reviewerId,
      metadata: {
        researchProjectId: candidate.researchProjectId,
        comment,
      },
    });

    return {
      selectedCandidateId: candidateId,
      researchProjectId: candidate.researchProjectId,
    };
  }

  async promoteCandidate(
    candidateId: string,
    reviewerId?: string,
    comment?: string,
  ): Promise<{ productId: string; workflowId: string }> {
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);

    if (!candidate.researchProjectId) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Candidate is not attached to a research project',
        statusCode: 400,
      });
    }

    const project = await this.projectRepo.findByIdOrThrow(candidate.researchProjectId);
    const selectedCandidateId = project.selectedCandidateId ?? candidateId;

    if (selectedCandidateId !== candidateId) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Only the selected candidate can be promoted',
        statusCode: 400,
      });
    }

    if (!project.selectedCandidateId) {
      await this.candidateRepo.updateStatus(candidateId, 'APPROVED');
      await this.candidateRepo.markOthersRejected(
        { researchProjectId: candidate.researchProjectId },
        candidateId,
      );
      await this.projectRepo.updateSelectedCandidate(project.id, candidateId);
    }

    const product = await this.productSvc.create({ title: candidate.name }, reviewerId);
    await this.researchRepo.upsert(product.id, {
      targetAudience: {
        targetMarket: candidate.targetMarket,
        source: 'Product Research',
      },
      competitors: {},
      painPoints: {},
      usp: {
        primary: candidate.positioning,
        sellingAngle: candidate.sellingAngle,
      },
      marketSummary: project.summary ?? `${candidate.name} selected for production workflow.`,
      selectedCandidateId: candidate.id,
    });
    await this.candidateRepo.attachProduct(candidate.id, product.id);
    await this.projectRepo.updatePromotedProduct(project.id, product.id);

    const workflow = await this.workflowSvc.start({ productId: product.id }, reviewerId);

    await this.auditRepo.create({
      entityType: 'ProductCandidate',
      entityId: candidate.id,
      action: 'RESEARCH_CANDIDATE_PROMOTED',
      actorId: reviewerId,
      metadata: {
        researchProjectId: project.id,
        productId: product.id,
        workflowId: workflow.id,
        comment,
      },
    });

    return {
      productId: product.id,
      workflowId: workflow.id,
    };
  }

  async ensureCandidateSelected(workflowId: string): Promise<string> {
    const workflow = await this.workflowRepo.findByIdOrThrow(workflowId);
    const research = await this.researchRepo.findByProductId(workflow.productId);

    if (!research?.selectedCandidateId) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Select a research candidate before approving Research Review',
        statusCode: 400,
      });
    }

    return research.selectedCandidateId;
  }

  private buildCandidatesFromAggregatedGroups(
    productIdea: string,
    config: ResearchRunConfigInput,
    groups: ProductAggregationGroup[],
    aggregationSources: Array<NormalizedResearchSourceInput & { sourceKey: string }>,
  ): ResearchCandidateDraft[] {
    const parsedConfig = validate(researchRunConfigSchema, config);
    const sourcesByKey = new Map(aggregationSources.map((source) => [source.sourceKey, source]));
    const candidates: ResearchCandidateDraft[] = [];

    for (const group of groups) {
      const groupSources = group.sourceKeys
        .map((sourceKey) => sourcesByKey.get(sourceKey))
        .filter((source): source is NormalizedResearchSourceInput & { sourceKey: string } => Boolean(source));
      if (groupSources.length === 0) {
        continue;
      }

      const name = this.normalizeCandidateName(group.name || groupSources[0]?.title || productIdea);
      const metrics = this.metricsFromAggregationGroup(group);
      candidates.push({
        name,
        positioning: this.truncate(
          group.rationale ||
            `${name} appeared in ${group.mergedMetrics.sourceCount} marketplace listings for ${productIdea}.`,
          1000,
        ),
        targetMarket: parsedConfig.targetMarket,
        sellingAngle: this.truncate(
          `${name} showed aggregated marketplace evidence from ${Array.from(
            new Set(groupSources.map((source) => source.provider)),
          ).join(', ')}.`,
          1000,
        ),
        recommendedPrice: metrics.price,
        scores: {
          demandScore:
            metrics.demandSignal ??
            this.volumeToDemandScore(metrics.searchVolume) ??
            this.reviewCountToDemandScore(metrics.reviewCount),
          trendScore: metrics.trendSignal,
          competitionScore: metrics.competitionSignal,
          supplierScore: metrics.supplierSignal,
          sourcingScore: metrics.sourcingSignal,
          factoryCostScore: metrics.factoryCostSignal,
          logisticsScore: metrics.logisticsSignal,
          creativePotentialScore: metrics.creativeSignal,
          riskScore: metrics.riskSignal,
        },
        confidence: 'low',
        risks: [],
        metadata: {
          generatedFrom: 'product_aggregation',
          sourceType: 'MARKETPLACE',
          sourceProvider:
            groupSources.length === 1 ? groupSources[0]?.provider : 'aggregated_marketplace',
          sourceUrl: groupSources[0]?.url,
          sourceExternalId: groupSources[0]?.externalId,
          aggregation: {
            groupId: group.groupId,
            method: group.method,
            sourceKeys: group.sourceKeys,
            sourceUrls: groupSources.map((source) => source.url).filter(Boolean),
            sourceExternalIds: groupSources.map((source) => source.externalId).filter(Boolean),
            sourceTitles: groupSources.map((source) => source.title).filter(Boolean),
            providers: Array.from(new Set(groupSources.map((source) => source.provider))),
            actorIds: Array.from(
              new Set(
                groupSources
                  .map((source) => this.rawDataString(source, 'apifyActorId'))
                  .filter((value): value is string => Boolean(value)),
              ),
            ),
            mergedMetrics: group.mergedMetrics,
          },
        },
      });
    }

    return candidates;
  }

  private metricsFromAggregationGroup(group: ProductAggregationGroup): ProviderEvidenceMetrics {
    return {
      demandSignal: group.mergedMetrics.demandSignal,
      price: group.mergedMetrics.medianPrice,
      reviewCount: group.mergedMetrics.reviewCountTotal,
      rating: group.mergedMetrics.ratingAverage,
    };
  }

  private normalizeCandidateName(value: string): string {
    return this.truncate(
      value
        .replace(/\s+/g, ' ')
        .replace(/\s[-|:]\s.*$/u, '')
        .trim(),
      255,
    );
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private buildExternalEvidenceSummary(
    productIdea: string,
    config: ResearchRunConfig,
    sources: NormalizedResearchSourceInput[],
    candidates: ProductCandidate[],
  ): string {
    const constraints = this.describeResearchConstraints(config);

    if (sources.length === 0) {
      return `No external provider evidence was collected for "${productIdea}". Product Research returned no AI-generated candidates.${constraints}`;
    }

    const sourceTypes = Array.from(new Set(sources.map((source) => source.type))).join(', ');
    return `Collected ${sources.length} external source signals (${sourceTypes}) for "${productIdea}" and produced ${candidates.length} provider-backed product candidates.${constraints}`;
  }

  private describeResearchConstraints(config: ResearchRunConfig): string {
    const parts = [
      config.targetMarket ? `target market ${config.targetMarket}` : undefined,
      config.priceBand
        ? `price band $${config.priceBand.min}-$${config.priceBand.max}`
        : undefined,
      `target margin ${config.targetMarginPercent}%`,
      `risk tolerance ${config.riskTolerance}`,
      config.sourcing.maxMoq ? `max MOQ ${config.sourcing.maxMoq}` : undefined,
      config.excludedCategories.length > 0
        ? `excluded ${config.excludedCategories.join(', ')}`
        : undefined,
    ].filter(Boolean);

    return parts.length > 0 ? ` Constraints: ${parts.join('; ')}.` : '';
  }

  private candidateMatchesResearchBrief(
    candidate: ResearchCandidateDraft,
    config: ResearchRunConfig,
  ): boolean {
    const riskText = [
      candidate.name,
      candidate.positioning,
      candidate.sellingAngle,
      ...candidate.risks,
      JSON.stringify(candidate.metadata ?? {}),
    ]
      .join(' ')
      .toLowerCase();

    const hasExcludedCategory = config.excludedCategories.some((category) =>
      riskText.includes(category.toLowerCase()),
    );

    if (hasExcludedCategory) {
      return false;
    }

    if (config.sourcing.maxMoq && candidate.moq && candidate.moq > config.sourcing.maxMoq) {
      return false;
    }

    if (config.priceBand && candidate.recommendedPrice) {
      return (
        candidate.recommendedPrice >= config.priceBand.min &&
        candidate.recommendedPrice <= config.priceBand.max
      );
    }

    return true;
  }

  private async collectProviderSources(
    productIdea: string,
    config: ResearchRunConfigInput,
    candidates: ResearchCandidateDraft[],
    options?: {
      providerTypes?: SupplementalProviderName[];
      collectionContext?: ResearchCollectionContext;
    },
  ): Promise<NormalizedResearchSourceInput[]> {
    const parsedConfig = validate(researchRunConfigSchema, config);
    const enabledProviders = new Set(parsedConfig.supplementalProviders);
    const allowedProviderTypes = options?.providerTypes
      ? new Set(options.providerTypes)
      : undefined;
    const results = await Promise.all(
      this.providers
        .filter((provider) => {
          if (provider.providerType) {
            return enabledProviders.has(provider.providerType) &&
              (!allowedProviderTypes || allowedProviderTypes.has(provider.providerType));
          }

          if (options?.collectionContext?.stage === 'query_intelligence') {
            return false;
          }

          return !allowedProviderTypes ||
            Array.from(allowedProviderTypes).some((providerType) =>
              enabledProviders.has(providerType),
            );
        })
        .map((provider) =>
          provider.collect({
            productIdea,
            config: parsedConfig,
            candidates,
            collectionContext: options?.collectionContext,
          }),
        ),
    );

    return results
      .flat()
      .map((source) => validate(normalizedResearchSourceSchema, source));
  }

  private sourcesForCandidate(
    sources: NormalizedResearchSourceInput[],
    candidate: ResearchCandidateDraft,
  ): NormalizedResearchSourceInput[] {
    const exactSources = sources.filter((source) =>
      this.sourceMatchesCandidatePrimaryEvidence(source, candidate.metadata),
    );
    const supportingSources = sources.filter(
      (source) =>
        source.type !== 'SOURCING' &&
        !exactSources.includes(source) &&
        this.sourceMatchesCandidate(source, candidate.name),
    );

    if (exactSources.length > 0) {
      return [...exactSources, ...supportingSources];
    }

    return supportingSources;
  }

  private sourceMatchesCandidatePrimaryEvidence(
    source: NormalizedResearchSourceInput,
    metadata: ResearchCandidateDraft['metadata'] | ProductCandidate['metadata'],
  ): boolean {
    const candidateSourceType = this.metadataString(metadata, 'sourceType');
    const candidateSourceProvider = this.metadataString(metadata, 'sourceProvider');
    const candidateSourceUrl = this.metadataString(metadata, 'sourceUrl');
    const candidateSourceExternalId = this.metadataString(metadata, 'sourceExternalId');
    const aggregation = this.metadataRecord(metadata, 'aggregation');

    if (!candidateSourceType || source.type !== candidateSourceType) {
      return false;
    }

    if (
      candidateSourceProvider &&
      candidateSourceProvider !== 'aggregated_marketplace' &&
      source.provider !== candidateSourceProvider
    ) {
      return false;
    }

    if (candidateSourceExternalId && source.externalId === candidateSourceExternalId) {
      return true;
    }

    if (candidateSourceUrl && source.url === candidateSourceUrl) {
      return true;
    }

    if (aggregation) {
      const sourceUrls = this.recordStringArray(aggregation, 'sourceUrls');
      const sourceExternalIds = this.recordStringArray(aggregation, 'sourceExternalIds');
      const sourceTitles = this.recordStringArray(aggregation, 'sourceTitles');

      if (source.url && sourceUrls.includes(source.url)) {
        return true;
      }

      if (source.externalId && sourceExternalIds.includes(source.externalId)) {
        return true;
      }

      if (source.title && sourceTitles.includes(source.title)) {
        return true;
      }

      return false;
    }

    return !candidateSourceExternalId && !candidateSourceUrl;
  }

  private sourceMatchesCandidate(
    source: NormalizedResearchSourceInput,
    candidateName: string,
  ): boolean {
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

    const candidateTerms = candidateName
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 3);

    return candidateTerms.some((term) => haystack.includes(term));
  }

  private findCandidateForSource(
    source: NormalizedResearchSourceInput,
    candidates: ProductCandidate[],
  ): ProductCandidate | undefined {
    return candidates.find((candidate) =>
      this.sourceMatchesCandidatePrimaryEvidence(source, candidate.metadata),
    ) ?? (source.type === 'SOURCING'
      ? undefined
      : candidates.find((candidate) => this.sourceMatchesCandidate(source, candidate.name)));
  }

  private metadataRecord(
    metadata: ResearchCandidateDraft['metadata'] | ProductCandidate['metadata'],
    key: string,
  ): Record<string, unknown> | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    const value = (metadata as Record<string, unknown>)[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private metadataString(
    metadata: ResearchCandidateDraft['metadata'] | ProductCandidate['metadata'],
    key: string,
  ): string | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private recordStringArray(record: Record<string, unknown>, key: string): string[] {
    const value = record[key];
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  }

  private rawDataString(source: NormalizedResearchSourceInput, key: string): string | undefined {
    const rawData = source.rawData ?? {};
    const value = rawData[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private applyEvidenceToScorePayload(
    base: Partial<ProviderEvidenceMetrics> & {
      demandScore?: number;
      trendScore?: number;
      competitionScore?: number;
      marginScore?: number;
      supplierScore?: number;
      sourcingScore?: number;
      factoryCostScore?: number;
      logisticsScore?: number;
      creativePotentialScore?: number;
      riskScore?: number;
      recommendedPrice?: number;
      estimatedCOGS?: number;
      estimatedShipping?: number;
      factoryUnitCost?: number;
      moq?: number;
      landedCost?: number;
      landedCostBreakdown?: Record<string, unknown>;
    },
    sources: NormalizedResearchSourceInput[],
  ) {
    const metrics = sources.map((source) => this.extractEvidenceMetrics(source));
    const average = (values: Array<number | undefined>): number | undefined => {
      const present = values.filter((value): value is number => value !== undefined);
      if (present.length === 0) {
        return undefined;
      }
      return Math.round(present.reduce((sum, value) => sum + value, 0) / present.length);
    };
    const first = (values: Array<number | undefined>): number | undefined =>
      values.find((value) => value !== undefined);

    return {
      demandScore: average([
        base.demandScore,
        average(metrics.map((metric) => metric.demandSignal)),
        average(metrics.map((metric) => metric.searchVolume).map((volume) => this.volumeToDemandScore(volume))),
        average(metrics.map((metric) => metric.reviewCount).map((count) => this.reviewCountToDemandScore(count))),
      ]),
      trendScore: average([
        base.trendScore,
        average(metrics.map((metric) => metric.trendSignal)),
      ]),
      competitionScore: average([
        base.competitionScore,
        average(metrics.map((metric) => metric.competitionSignal)),
      ]),
      supplierScore: average([
        base.supplierScore,
        average(metrics.map((metric) => metric.supplierSignal)),
      ]),
      sourcingScore: average([
        base.sourcingScore,
        average(metrics.map((metric) => metric.sourcingSignal)),
      ]),
      factoryCostScore: average([
        base.factoryCostScore,
        average(metrics.map((metric) => metric.factoryCostSignal)),
      ]),
      logisticsScore: average([
        base.logisticsScore,
        average(metrics.map((metric) => metric.logisticsSignal)),
      ]),
      creativePotentialScore: average([
        base.creativePotentialScore,
        average(metrics.map((metric) => metric.creativeSignal)),
      ]),
      riskScore: average([
        base.riskScore,
        average(metrics.map((metric) => metric.riskSignal)),
      ]),
      recommendedPrice: base.recommendedPrice ?? first(metrics.map((metric) => metric.price)),
      estimatedCOGS: base.estimatedCOGS ?? first(metrics.map((metric) => metric.landedCost ?? metric.productCost)),
      estimatedShipping: base.estimatedShipping ?? first(metrics.map((metric) => metric.shippingCost)),
      factoryUnitCost: base.factoryUnitCost ?? first(metrics.map((metric) => metric.factoryUnitCost ?? metric.productCost)),
      moq: base.moq ?? first(metrics.map((metric) => metric.moq)),
      landedCost: base.landedCost ?? first(metrics.map((metric) => metric.landedCost)),
      landedCostBreakdown: base.landedCostBreakdown,
    };
  }

  private extractEvidenceMetrics(source: NormalizedResearchSourceInput): ProviderEvidenceMetrics {
    const rawData = source.rawData ?? {};
    const metrics =
      rawData.metrics && typeof rawData.metrics === 'object' && !Array.isArray(rawData.metrics)
        ? (rawData.metrics as ProviderEvidenceMetrics)
        : {};

    if (source.type === 'TREND' && typeof rawData.recentInterestAverage === 'number') {
      return {
        ...metrics,
        trendSignal: rawData.recentInterestAverage,
      };
    }

    return metrics;
  }

  private volumeToDemandScore(volume: number | undefined): number | undefined {
    if (volume === undefined) {
      return undefined;
    }
    if (volume >= 50000) {
      return 90;
    }
    if (volume >= 10000) {
      return 80;
    }
    if (volume >= 3000) {
      return 70;
    }
    if (volume >= 1000) {
      return 60;
    }
    return 45;
  }

  private reviewCountToDemandScore(count: number | undefined): number | undefined {
    if (count === undefined) {
      return undefined;
    }
    if (count >= 5000) {
      return 85;
    }
    if (count >= 1000) {
      return 75;
    }
    if (count >= 250) {
      return 65;
    }
    if (count >= 50) {
      return 55;
    }
    return 40;
  }

  private resolveCandidateConfidence(
    baseConfidence: ResearchCandidateDraft['confidence'],
    evidenceSources: NormalizedResearchSourceInput[],
  ): ResearchCandidateDraft['confidence'] {
    const sourceTypes = new Set(evidenceSources.map((source) => source.type));
    const highConfidenceEvidence = evidenceSources.filter(
      (source) => (source.confidence ?? 0) >= 0.7,
    );

    if (sourceTypes.size >= 3 && highConfidenceEvidence.length >= 2) {
      return 'high';
    }

    if (sourceTypes.size >= 1) {
      return baseConfidence === 'low' ? 'medium' : baseConfidence;
    }

    return 'low';
  }
}

export const researchService = new ResearchService();
