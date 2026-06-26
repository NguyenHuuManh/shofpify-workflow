/**
 * Purpose:
 * Business logic for autonomous Product Research discovery jobs.
 *
 * Responsibilities:
 * - Create discovery projects and jobs from broad research briefs
 * - Generate query plans through AI provider interfaces or deterministic fallback
 * - Execute provider-backed ResearchService runs for each planned query
 * - Persist job status, results, failures, and audit events
 *
 * Dependencies:
 * - ResearchProjectRepository
 * - ResearchDiscoveryJobRepository
 * - ProductCandidateRepository
 * - AuditLogRepository
 * - ResearchService
 * - AIProvider interface
 */

import { Prisma } from '@prisma/client';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { productCandidateRepository } from '@/repositories/product-candidate.repository';
import {
  researchDiscoveryJobRepository,
  ResearchDiscoveryJobRepository,
} from '@/repositories/research-discovery-job.repository';
import {
  researchProjectRepository,
  ResearchProjectRepository,
} from '@/repositories/research-project.repository';
import { BaseRepository } from '@/repositories/base.repository';
import { createDefaultResearchProviders } from '@/providers/research';
import { createDefaultProvider } from '@/providers/provider.factory';
import { getOptionalEnvValue } from '@/lib/env';
import { AppError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import { normalizedResearchSourceSchema } from '@/schemas/research.schema';
import {
  autonomousDiscoveryJobSchema,
  discoveryJobResultSchema,
  researchRunConfigSchema,
  type AutonomousDiscoveryJobConfig,
  type AutonomousDiscoveryJobInput,
  type DiscoveryJobResult,
  type QueryIntelligenceCandidate,
  type ResearchRunConfig,
  type ResearchRunConfigInput,
} from '@/schemas/research.schema';
import { researchService, ResearchService } from './research.service';
import { QueryIntelligenceService, queryIntelligenceService } from './query-intelligence.service';
import type { AIProvider } from '@/types/ai-provider.interface';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';
import type { ProductCandidateRepository } from '@/repositories/product-candidate.repository';
import type { ResearchProvider } from '@/types/research.types';
import type {
  DiscoveryJobRunResult,
  DiscoveryJobSummary,
  StartDiscoveryJobResult,
} from '@/types/research.types';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';

export class DiscoveryJobService {
  constructor(
    private readonly jobRepo: ResearchDiscoveryJobRepository = researchDiscoveryJobRepository,
    private readonly projectRepo: ResearchProjectRepository = researchProjectRepository,
    private readonly candidateRepo: ProductCandidateRepository = productCandidateRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
    private readonly researchSvc: ResearchService = researchService,
    private readonly queryIntel: QueryIntelligenceService = queryIntelligenceService,
    private readonly providers: ResearchProvider[] = createDefaultResearchProviders(),
    private readonly aiProvider?: AIProvider,
  ) {}

  async start(
    input: AutonomousDiscoveryJobInput,
    actorId?: string,
  ): Promise<StartDiscoveryJobResult> {
    const parsed = validate(autonomousDiscoveryJobSchema, input);
    const projectQuery = parsed.seedQuery || this.defaultProjectQuery(parsed);

    const created = await BaseRepository.transaction(async (tx) => {
      const researchProject = await this.projectRepo.create(
        { query: projectQuery },
        tx,
      );
      const discoveryJob = await this.jobRepo.create(
        {
          researchProjectId: researchProject.id,
          input: this.toJson(parsed),
        },
        tx,
      );

      return { researchProject, discoveryJob };
    });

    await this.auditRepo.create({
      entityType: 'ResearchDiscoveryJob',
      entityId: created.discoveryJob.id,
      action: 'RESEARCH_DISCOVERY_JOB_CREATED',
      actorId,
      metadata: {
        researchProjectId: created.researchProject.id,
        seedQuery: parsed.seedQuery,
        targetMarket: parsed.targetMarket,
        maxQueries: parsed.maxQueries,
      },
    });

    logger.info(
      {
        discoveryJobId: created.discoveryJob.id,
        researchProjectId: created.researchProject.id,
      },
      'Autonomous product discovery job created',
    );

    return created;
  }

  async list(filter?: { take?: number }): Promise<DiscoveryJobSummary[]> {
    const jobs = await this.jobRepo.findMany({ take: filter?.take ?? 25 });

    return Promise.all(
      jobs.map(async (job) => ({
        job,
        project: await this.projectRepo.findByIdOrThrow(job.researchProjectId),
      })),
    );
  }

  async runJob(discoveryJobId: string): Promise<DiscoveryJobRunResult> {
    const job = await this.jobRepo.findByIdOrThrow(discoveryJobId);

    if (job.status === 'COMPLETED') {
      const parsedResult = discoveryJobResultSchema.safeParse(job.result);
      if (!parsedResult.success) {
        throw new AppError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `Completed discovery job '${discoveryJobId}' has invalid result data`,
          statusCode: 500,
        });
      }

      return { job, result: parsedResult.data };
    }

    if (job.status === 'RUNNING') {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Discovery job '${discoveryJobId}' is already running`,
        statusCode: 409,
      });
    }

    try {
      const project = await this.projectRepo.findByIdOrThrow(job.researchProjectId);
      const config = validate(autonomousDiscoveryJobSchema, job.input);
      const discoveryQueries = await this.collectDiscoveryQueries(config);
      const queryPlan = {
        queries: discoveryQueries.map((q) => ({
          query: q,
          angle: 'Provider-backed keyword',
          rationale: '',
        })),
      };
      await this.jobRepo.markRunning(job.id, this.toJson(queryPlan));

      logger.info(
        {
          discoveryJobId: job.id,
          researchProjectId: project.id,
          queryCount: discoveryQueries.length,
        },
        'Autonomous product discovery job started',
      );

      let runCount = 0;
      let sourceCount = 0;
      const researchConfig = this.toResearchRunConfig(config);

      for (const query of discoveryQueries) {
        const result = await this.researchSvc.run({
          researchProjectId: project.id,
          productIdea: query,
          config: researchConfig,
        });
        runCount += 1;
        sourceCount += result.sources.length;
      }

      const candidates = await this.candidateRepo.findByResearchProjectId(project.id);
      const ranked = [...candidates].sort(
        (a, b) => (b.winningScore ?? 0) - (a.winningScore ?? 0),
      );
      const result = validate(discoveryJobResultSchema, {
        queryCount: discoveryQueries.length,
        runCount,
        candidateCount: candidates.length,
        sourceCount,
        topCandidates: ranked.slice(0, 5).map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          winningScore: candidate.winningScore,
          researchRunId: candidate.researchRunId,
        })),
      });

      const completedJob = await this.jobRepo.markCompleted(job.id, this.toJson(result));
      await this.projectRepo.updateSummary(project.id, this.buildProjectSummary(result));
      await this.auditRepo.create({
        entityType: 'ResearchDiscoveryJob',
        entityId: job.id,
        action: 'RESEARCH_DISCOVERY_JOB_COMPLETED',
        metadata: {
          researchProjectId: project.id,
          ...result,
        },
      });

      logger.info(
        {
          discoveryJobId: job.id,
          researchProjectId: project.id,
          candidateCount: result.candidateCount,
        },
        'Autonomous product discovery job completed',
      );

      return { job: completedJob, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown discovery job error';
      const failedJob = await this.jobRepo.markFailed(job.id, message);
      await this.auditRepo.create({
        entityType: 'ResearchDiscoveryJob',
        entityId: job.id,
        action: 'RESEARCH_DISCOVERY_JOB_FAILED',
        metadata: {
          researchProjectId: job.researchProjectId,
          errorMessage: message,
        },
      });

      logger.error(
        { discoveryJobId: job.id, researchProjectId: job.researchProjectId, error: message },
        'Autonomous product discovery job failed',
      );

      if (error instanceof AppError) {
        throw new AppError({
          code: error.code,
          message,
          statusCode: error.statusCode,
          details: { ...(error.details ?? {}), discoveryJobId: failedJob.id },
        });
      }

      throw new AppError({
        code: ErrorCodes.AI_PROVIDER_ERROR,
        message,
        statusCode: 502,
        details: { discoveryJobId: failedJob.id },
      });
    }
  }

  /**
   * Collect discovery queries from provider-backed keyword intelligence.
   *
   * Two paths:
   * - With seed query: QueryIntelligenceService filters keywords by relevance to seed
   * - Without seed query: query root-discovery providers that collect broad
   *   category/keyword evidence directly from DataForSEO, then cap keywords
   */
  private async collectDiscoveryQueries(
    config: AutonomousDiscoveryJobConfig,
  ): Promise<string[]> {
    const hasSeedQuery = Boolean(config.seedQuery?.trim());
    const seedQuery = (config.seedQuery ?? '').trim().replace(/\s+/g, ' ');
    const queryIntelConfig = validate(researchRunConfigSchema, config);

    if (!hasSeedQuery) {
      return this.collectTrendBasedDiscoveryQueries(queryIntelConfig, config);
    }

    // With seed query — collect keyword evidence and filter by relevance
    const keywordSources = await this.collectKeywordEvidence(seedQuery, queryIntelConfig);
    return this.selectDiscoveryQueriesWithSeed(seedQuery, keywordSources, config, queryIntelConfig);
  }

  /**
   * Without seed query: query DataForSEO Labs root-discovery evidence and use
   * only provider-backed category/keyword candidates.
   */
  private async collectTrendBasedDiscoveryQueries(
    config: ResearchRunConfig,
    discoveryConfig: AutonomousDiscoveryJobConfig,
  ): Promise<string[]> {
    const sources = await this.collectAutonomousDiscoveryEvidence(config);
    const candidates = this.keywordCandidatesFromRootSources(sources);
    const selected = this.selectDistinctKeywordCandidates(candidates, discoveryConfig.maxQueries);

    if (selected.length > 0) {
      const categories = this.distinctSourceCategories(sources);
      logger.info(
        {
          providerCategories: categories,
          providerKeywordCandidates: candidates.length,
          selected,
        },
        'Discovery queries selected from provider-backed DataForSEO category and keyword intelligence',
      );
      return selected;
    }

    logger.warn(
      { sourceCount: sources.length },
      'Autonomous discovery stopped because keyword providers returned no usable query evidence',
    );
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'No provider-backed discovery categories or keywords were found. Configure DataForSEO Labs or adjust discovery constraints.',
      statusCode: 422,
    });
  }

  private async collectAutonomousDiscoveryEvidence(
    config: ResearchRunConfig,
  ): Promise<NormalizedResearchSourceInput[]> {
    const enabledProviders = new Set(config.supplementalProviders);
    const results = await Promise.all(
      this.providers
        .filter((p) => p.discoveryRootProvider === true)
        .filter((p) => p.providerType && enabledProviders.has(p.providerType))
        .map((provider) =>
          provider.collect({
            productIdea: 'autonomous product discovery',
            config,
            collectionContext: {
              stage: 'query_intelligence',
              queries: [],
            },
          }),
        ),
    );

    return results.flat().map((source) => validate(normalizedResearchSourceSchema, source));
  }

  private distinctSourceCategories(sources: NormalizedResearchSourceInput[]): string[] {
    const categories = sources.flatMap((source) => {
      const rawData = source.rawData as Record<string, unknown> | undefined;
      const value = rawData?.categories;
      return Array.isArray(value) ? value.map(String) : [];
    });
    return [...new Set(categories)].slice(0, 12);
  }

  private keywordCandidatesFromRootSources(
    sources: NormalizedResearchSourceInput[],
  ): QueryIntelligenceCandidate[] {
    return sources
      .filter((source) => source.type === 'KEYWORD')
      .map((source) => {
        const rawData = source.rawData as Record<string, unknown> | undefined;
        const metrics = rawData?.metrics as Record<string, unknown> | undefined;
        const query = typeof rawData?.keyword === 'string'
          ? rawData.keyword
          : source.externalId ?? source.title?.replace(/\s+keyword signal$/iu, '') ?? '';
        const searchVolume = this.numberFromUnknown(metrics?.searchVolume);
        const cpc = this.numberFromUnknown(metrics?.cpc);
        const competitionScore = this.numberFromUnknown(metrics?.competitionSignal);
        const volumeScore = searchVolume
          ? Math.min(35, Math.log10(Math.max(searchVolume, 10)) * 8)
          : 0;
        const cpcScore = cpc ? Math.min(20, cpc * 4) : 0;
        const competitionPenalty = competitionScore !== undefined
          ? Math.min(25, competitionScore / 4)
          : 8;
        const score = Math.round(Math.max(1, volumeScore + cpcScore + 45 - competitionPenalty));

        return {
          query,
          score,
          reason: [
            `DataForSEO Labs provider-backed score ${score}`,
            searchVolume !== undefined ? `volume ${searchVolume}` : undefined,
          ].filter(Boolean).join(', '),
          sourceTypes: ['KEYWORD'],
          providers: [source.provider],
          searchVolume,
          cpc,
          competitionScore,
          buyerIntentScore: cpc ? Math.min(100, 50 + cpc * 8) : 50,
          relevanceScore: 100,
          riskScore: 10,
        };
      });
  }

  private numberFromUnknown(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private selectDistinctKeywordCandidates(
    candidates: QueryIntelligenceCandidate[],
    maxQueries: number,
  ): string[] {
    const seen = new Set<string>();
    return [...candidates]
      .sort((a, b) => b.score - a.score)
      .map((candidate) => candidate.query.trim().replace(/\s+/g, ' ').toLowerCase())
      .filter((query) => {
        if (query.length <= 3 || query.split(/\s+/).length < 2 || seen.has(query)) {
          return false;
        }
        seen.add(query);
        return true;
      })
      .slice(0, maxQueries);
  }

  private async selectDiscoveryQueriesWithSeed(
    seedQuery: string,
    sources: NormalizedResearchSourceInput[],
    config: AutonomousDiscoveryJobConfig,
    queryIntelConfig: ResearchRunConfig,
  ): Promise<string[]> {
    const queryIntelResult = this.queryIntel.selectQueries({
      productIdea: seedQuery,
      config: queryIntelConfig,
      sources,
    });

    // If AI available, rank/filter provider-backed keywords (no invention)
    const aiProvider = this.resolveAiProvider();
    if (aiProvider && queryIntelResult.candidateQueries.length > 0) {
      const aiRanked = await this.aiRankKeywords(
        seedQuery,
        queryIntelResult.candidateQueries.map((c) => c.query),
        config,
        aiProvider,
      );
      if (aiRanked.length > 0) {
        const queries = [seedQuery, ...aiRanked.slice(0, config.maxQueries - 1)];
        logger.info(
          { seedQuery, aiRankedCount: aiRanked.length, totalQueries: queries.length },
          'Discovery queries selected via AI ranking of provider-backed keywords',
        );
        return queries;
      }
    }

    // Fallback — use QueryIntelligenceService selected queries
    const fallback = queryIntelResult.selectedQueries
      .slice(0, config.maxQueries)
      .map((q) => q.query);
    logger.info(
      { seedQuery, queryCount: fallback.length },
      'Discovery queries selected via QueryIntelligenceService (provider-backed)',
    );
    return fallback;
  }

  /**
   * Collect TREND, KEYWORD, and SEARCH evidence from configured providers.
   * Returns empty array when providers are not configured (no AI fallback).
   */
  private async collectKeywordEvidence(
    seedQuery: string,
    config: ResearchRunConfig,
  ): Promise<NormalizedResearchSourceInput[]> {
    const enabledProviders = new Set(config.supplementalProviders);
    const results = await Promise.all(
      this.providers
        .filter((p) => {
          const pt = p.providerType;
          return pt === 'trend' || pt === 'keyword' || pt === 'search';
        })
        .filter((p) => p.providerType && enabledProviders.has(p.providerType))
        .map((provider) =>
          provider.collect({
            productIdea: seedQuery,
            config,
            collectionContext: {
              stage: 'query_intelligence',
              queries: [seedQuery],
            },
          }),
        ),
    );

    return results.flat().map((source) => validate(normalizedResearchSourceSchema, source));
  }

  /**
   * Use AI to rank/filter existing provider-backed keywords.
   * AI MUST NOT invent new keywords — only reorder/select from the provided list.
   */
  private async aiRankKeywords(
    seedQuery: string,
    keywordCandidates: string[],
    config: AutonomousDiscoveryJobConfig,
    aiProvider: AIProvider,
  ): Promise<string[]> {
    try {
      const prompt = JSON.stringify({
        task: 'Rank these provider-backed keyword candidates by relevance for e-commerce product discovery.',
        seedQuery,
        keywordCandidates,
        constraints: {
          targetMarket: config.targetMarket,
          priceBand: config.priceBand,
          excludedCategories: config.excludedCategories,
          maxToSelect: config.maxQueries - 1, // seed query is already #1
        },
        rules: [
          'Only select from the provided keywordCandidates list. DO NOT invent new keywords.',
          'Prioritize specific product-buyer keywords over generic category terms.',
          'Each selected keyword should target a distinct product category.',
          'Return JSON: {"selectedKeywords":["keyword1","keyword2",...]}',
        ],
      });

      const output = await aiProvider.generateText({
        systemPrompt: 'You rank e-commerce product discovery keywords. Only select from the provided list — never invent new keywords. Return JSON only.',
        prompt,
        maxTokens: 800,
        temperature: 0.2,
      });

      const parsed = this.parseJsonObject(output.text) as { selectedKeywords?: string[] };
      if (!Array.isArray(parsed?.selectedKeywords)) {
        return [];
      }

      // Validate all returned keywords exist in the input list
      const validSet = new Set(keywordCandidates.map((k) => k.toLowerCase()));
      return parsed.selectedKeywords.filter((k) => validSet.has(k.toLowerCase()));
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'AI keyword ranking failed; falling back to QueryIntelligenceService ordering',
      );
      return [];
    }
  }

  private resolveAiProvider(): AIProvider | undefined {
    if (this.aiProvider) {
      return this.aiProvider;
    }

    const hasProviderKey = Boolean(
      getOptionalEnvValue('ANTHROPIC_API_KEY') || getOptionalEnvValue('DEEPSEEK_API_KEY'),
    );

    if (!hasProviderKey) {
      return undefined;
    }

    try {
      return createDefaultProvider();
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'Default AI provider unavailable for discovery query planning',
      );
      return undefined;
    }
  }

  private toResearchRunConfig(
    config: AutonomousDiscoveryJobConfig,
  ): ResearchRunConfigInput {
    const { seedQuery: _seedQuery, maxQueries: _maxQueries, ...researchConfig } = config;
    return validate(researchRunConfigSchema, {
      ...researchConfig,
      objective: 'autonomous_discovery',
    });
  }

  private buildProjectSummary(result: DiscoveryJobResult): string {
    if (result.candidateCount === 0) {
      return `Autonomous discovery completed ${result.runCount} provider-backed research runs and found no usable candidates.`;
    }

    return `Autonomous discovery completed ${result.runCount} provider-backed research runs and found ${result.candidateCount} candidates.`;
  }

  private defaultProjectQuery(config: AutonomousDiscoveryJobConfig): string {
    return `Autonomous discovery for ${config.targetMarket} winning products`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private parseJsonObject(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced?.[1]?.trim() ?? trimmed;
    return JSON.parse(jsonText);
  }
}

export const discoveryJobService = new DiscoveryJobService();
