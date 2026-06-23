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
import { createDefaultProvider } from '@/providers/provider.factory';
import { getOptionalEnvValue } from '@/lib/env';
import { AppError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import {
  autonomousDiscoveryJobSchema,
  discoveryJobResultSchema,
  discoveryQueryPlanSchema,
  researchRunConfigSchema,
  type AutonomousDiscoveryJobConfig,
  type AutonomousDiscoveryJobInput,
  type DiscoveryJobResult,
  type DiscoveryQueryPlan,
  type DiscoveryQueryPlanItem,
  type ResearchRunConfigInput,
} from '@/schemas/research.schema';
import { researchService, ResearchService } from './research.service';
import type { AIProvider } from '@/types/ai-provider.interface';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';
import type { ProductCandidateRepository } from '@/repositories/product-candidate.repository';
import type {
  DiscoveryJobRunResult,
  DiscoveryJobSummary,
  StartDiscoveryJobResult,
} from '@/types/research.types';

export class DiscoveryJobService {
  constructor(
    private readonly jobRepo: ResearchDiscoveryJobRepository = researchDiscoveryJobRepository,
    private readonly projectRepo: ResearchProjectRepository = researchProjectRepository,
    private readonly candidateRepo: ProductCandidateRepository = productCandidateRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
    private readonly researchSvc: ResearchService = researchService,
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

    const project = await this.projectRepo.findByIdOrThrow(job.researchProjectId);
    const config = validate(autonomousDiscoveryJobSchema, job.input);
    const queryPlan = await this.buildQueryPlan(config);
    await this.jobRepo.markRunning(job.id, this.toJson(queryPlan));

    logger.info(
      {
        discoveryJobId: job.id,
        researchProjectId: project.id,
        queryCount: queryPlan.queries.length,
      },
      'Autonomous product discovery job started',
    );

    try {
      let runCount = 0;
      let sourceCount = 0;
      const researchConfig = this.toResearchRunConfig(config);

      for (const planItem of queryPlan.queries) {
        const result = await this.researchSvc.run({
          researchProjectId: project.id,
          productIdea: planItem.query,
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
        queryCount: queryPlan.queries.length,
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
          researchProjectId: project.id,
          errorMessage: message,
        },
      });

      logger.error(
        { discoveryJobId: job.id, researchProjectId: project.id, error: message },
        'Autonomous product discovery job failed',
      );

      throw new AppError({
        code: ErrorCodes.AI_PROVIDER_ERROR,
        message,
        statusCode: 502,
        details: { discoveryJobId: failedJob.id },
      });
    }
  }

  private async buildQueryPlan(
    config: AutonomousDiscoveryJobConfig,
  ): Promise<DiscoveryQueryPlan> {
    const aiProvider = this.resolveAiProvider();

    if (aiProvider) {
      try {
        const output = await aiProvider.generateText({
          systemPrompt: [
            'You plan product research queries for a Shopify Product Research system.',
            'Return JSON only. Do not include products, suppliers, URLs, prices, MOQ, or cost claims.',
            'Output shape: {"queries":[{"query":"...","angle":"...","rationale":"..."}]}',
          ].join(' '),
          prompt: this.buildPlannerPrompt(config),
          maxTokens: 1400,
          temperature: 0.4,
        });

        const parsed = discoveryQueryPlanSchema.parse(this.parseJsonObject(output.text));
        return this.limitQueryPlan(parsed, config);
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : 'Unknown' },
          'AI discovery query planning failed; using deterministic fallback plan',
        );
      }
    }

    return this.buildFallbackQueryPlan(config);
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

  private buildFallbackQueryPlan(
    config: AutonomousDiscoveryJobConfig,
  ): DiscoveryQueryPlan {
    const baseQueries = config.seedQuery
      ? [
          `${config.seedQuery} accessories`,
          `${config.seedQuery} problem solving products`,
          `${config.seedQuery} premium utility products`,
          `${config.seedQuery} viral product ideas`,
          `${config.seedQuery} 1688 factory products`,
          `${config.seedQuery} high margin products`,
        ]
      : [
          'pet travel accessories',
          'kitchen prep gadgets',
          'home organization tools',
          'fitness recovery products',
          'car interior organizers',
          'baby safety accessories',
          'personal comfort gadgets',
          'small space storage products',
        ];

    return {
      queries: baseQueries.slice(0, config.maxQueries).map((query) => ({
        query,
        angle: this.inferAngle(query),
        rationale: `Explore ${query} for ${config.targetMarket} buyers with provider-backed demand and 1688 sourcing evidence.`,
      })),
    };
  }

  private limitQueryPlan(
    plan: DiscoveryQueryPlan,
    config: AutonomousDiscoveryJobConfig,
  ): DiscoveryQueryPlan {
    const seen = new Set<string>();
    const queries: DiscoveryQueryPlanItem[] = [];

    for (const item of plan.queries) {
      const query = item.query.trim().replace(/\s+/g, ' ');
      const key = query.toLowerCase();
      if (!query || seen.has(key)) {
        continue;
      }

      seen.add(key);
      queries.push({
        query,
        angle: item.angle,
        rationale: item.rationale,
      });

      if (queries.length >= config.maxQueries) {
        break;
      }
    }

    return queries.length > 0 ? { queries } : this.buildFallbackQueryPlan(config);
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

  private buildPlannerPrompt(config: AutonomousDiscoveryJobConfig): string {
    return JSON.stringify({
      task: 'Generate provider research queries for finding winning products.',
      constraints: {
        seedQuery: config.seedQuery,
        targetMarket: config.targetMarket,
        priceBand: config.priceBand,
        targetMarginPercent: config.targetMarginPercent,
        riskTolerance: config.riskTolerance,
        excludedCategories: config.excludedCategories,
        maxMoq: config.sourcing.maxMoq,
        targetSource: config.sourcing.targetSource,
        maxQueries: config.maxQueries,
      },
      rules: [
        'Return query plan only.',
        'Do not invent products.',
        'Do not invent suppliers.',
        'Do not invent prices, costs, MOQ, URLs, or evidence.',
      ],
    });
  }

  private parseJsonObject(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced?.[1]?.trim() ?? trimmed;
    return JSON.parse(jsonText);
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

  private inferAngle(query: string): string {
    if (query.includes('1688') || query.includes('factory')) {
      return 'Factory sourcing and landed-cost feasibility';
    }
    if (query.includes('viral')) {
      return 'Creative potential and demand signal discovery';
    }
    if (query.includes('high margin')) {
      return 'Margin-first product opportunity discovery';
    }

    return 'Demand, sourcing, margin, and risk discovery';
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

export const discoveryJobService = new DiscoveryJobService();
