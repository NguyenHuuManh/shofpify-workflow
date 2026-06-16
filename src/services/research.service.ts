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
import { workflowRepository } from '@/repositories/workflow.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { productService, type ProductService } from './product.service';
import { workflowService, type WorkflowService } from './workflow.service';
import { CandidateScoringService, candidateScoringService } from './candidate-scoring.service';
import { createDefaultProvider } from '@/providers/provider.factory';
import { createDefaultResearchProviders } from '@/providers/research';
import { AppError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import {
  normalizedResearchSourceSchema,
  researchGenerationSchema,
  researchRunConfigSchema,
  createResearchProjectSchema,
} from '@/schemas/research.schema';
import type { AIProvider } from '@/types/ai-provider.interface';
import type {
  NormalizedResearchSourceInput,
  ResearchCandidateDraft,
  CreateResearchProjectInput,
  ResearchRunConfigInput,
} from '@/schemas/research.schema';
import type {
  ResearchProvider,
  RunResearchInput,
  RunResearchResult,
  ResearchProjectSummary,
} from '@/types/research.types';
import type { Prisma, ProductCandidate, ResearchProject, ResearchSource } from '@prisma/client';
import type { ProductResearchRepository } from '@/repositories/product-research.repository';
import type { ResearchProjectRepository } from '@/repositories/research-project.repository';
import type { ProductCandidateRepository } from '@/repositories/product-candidate.repository';
import type { ResearchRunRepository } from '@/repositories/research-run.repository';
import type { ResearchSourceRepository } from '@/repositories/research-source.repository';
import type { WorkflowRepository } from '@/repositories/workflow.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

const SYSTEM_PROMPT = `You are an expert ecommerce product research strategist.
Return ONLY valid JSON in the requested format. Mark uncertain data as estimates.`;

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
    private readonly aiProvider?: AIProvider,
    private readonly productSvc: ProductService = productService,
    private readonly workflowSvc: WorkflowService = workflowService,
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
    aiProvider: AIProvider = this.aiProvider ?? createDefaultProvider(),
  ): Promise<RunResearchResult> {
    const config = validate(researchRunConfigSchema, input.config ?? {});
    const researchRun = await this.runRepo.create({
      researchProjectId: input.researchProjectId,
      productId: input.productId,
      workflowId: input.workflowId,
      input: {
        productIdea: input.productIdea,
        config,
      },
    });

    logger.info(
      { researchRunId: researchRun.id, workflowId: input.workflowId },
      'Research intelligence run started',
    );

    const generation = await this.generateCandidates(
      input.productIdea,
      config,
      aiProvider,
    );
    const providerSources = await this.collectProviderSources(
      input.productIdea,
      config,
      generation.candidates,
    );

    const candidates: ProductCandidate[] = [];
    const sources: ResearchSource[] = [];

    for (const draft of generation.candidates) {
      const score = this.scoring.score({
        ...draft.scores,
        recommendedPrice: draft.recommendedPrice,
        estimatedCOGS: draft.estimatedCOGS,
        estimatedShipping: draft.estimatedShipping,
      });

      const candidate = await this.candidateRepo.create({
        researchRunId: researchRun.id,
        researchProjectId: input.researchProjectId,
        productId: input.productId,
        name: draft.name,
        positioning: draft.positioning,
        targetMarket: draft.targetMarket ?? config.targetMarket,
        sellingAngle: draft.sellingAngle,
        recommendedPrice: draft.recommendedPrice,
        estimatedCOGS: draft.estimatedCOGS,
        estimatedShipping: draft.estimatedShipping,
        estimatedGrossProfit: score.estimatedGrossProfit,
        grossMarginPercent: score.grossMarginPercent,
        breakEvenRoas: score.breakEvenRoas,
        demandScore: score.demandScore,
        trendScore: score.trendScore,
        competitionScore: score.competitionScore,
        marginScore: score.marginScore,
        supplierScore: score.supplierScore,
        creativePotentialScore: score.creativePotentialScore,
        riskScore: score.riskScore,
        winningScore: score.winningScore,
        confidence: draft.confidence,
        status: score.winningScore >= 70 ? 'SHORTLISTED' : 'DISCOVERED',
        risks: draft.risks as Prisma.InputJsonValue,
        metadata: (draft.metadata ?? {}) as Prisma.InputJsonValue,
      });

      candidates.push(candidate);
      sources.push(
        await this.sourceRepo.create({
          researchRunId: researchRun.id,
          candidateId: candidate.id,
          type: 'AI_ESTIMATE',
          provider: aiProvider.providerName,
          title: `${draft.name} hypothesis`,
          extractedSignal:
            'AI-generated product candidate hypothesis. Treat as estimate unless corroborated by external sources.',
          rawData: draft as Prisma.InputJsonValue,
          confidence: draft.confidence === 'high' ? 0.55 : draft.confidence === 'medium' ? 0.4 : 0.25,
          capturedAt: new Date(),
        }),
      );
    }

    for (const source of providerSources) {
      sources.push(
        await this.sourceRepo.create({
          researchRunId: researchRun.id,
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

    const completedRun = await this.runRepo.updateCompleted(researchRun.id, {
      summary: generation.summary,
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
        marketSummary: generation.summary,
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
      summary: generation.summary,
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
      sources: await this.sourceRepo.findByCandidateId(candidateId),
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
      sources: await this.sourceRepo.findByResearchRunId(run.id),
    };
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
    await this.candidateRepo.markOthersRejected(workflow.productId, candidateId);

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
    reviewerId: string,
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

  private async collectProviderSources(
    productIdea: string,
    config: ResearchRunConfigInput,
    candidates: ResearchCandidateDraft[],
  ): Promise<NormalizedResearchSourceInput[]> {
    const parsedConfig = validate(researchRunConfigSchema, config);
    const results = await Promise.all(
      this.providers.map((provider) =>
        provider.collect({ productIdea, config: parsedConfig, candidates }),
      ),
    );

    return results
      .flat()
      .map((source) => validate(normalizedResearchSourceSchema, source));
  }

  private async generateCandidates(
    productIdea: string,
    config: ResearchRunConfigInput,
    aiProvider: AIProvider,
  ) {
    const prompt = this.buildCandidatePrompt(productIdea, config);
    const output = await aiProvider.generateText({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.6,
      maxTokens: 4096,
    });

    try {
      return validate(researchGenerationSchema, JSON.parse(this.cleanJson(output.text)));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        code: ErrorCodes.AI_PROVIDER_ERROR,
        message: 'Research AI response was not valid candidate JSON',
        statusCode: 502,
        details: { rawText: output.text.slice(0, 500) },
      });
    }
  }

  private buildCandidatePrompt(
    productIdea: string,
    config: ResearchRunConfigInput,
  ): string {
    const parsed = validate(researchRunConfigSchema, config);
    return `Generate 3 to 5 ecommerce product candidates for this idea or niche: ${productIdea}

Configuration:
${JSON.stringify(parsed, null, 2)}

Return JSON exactly in this shape:
{
  "summary": "market summary",
  "candidates": [
    {
      "name": "candidate name",
      "positioning": "why this product should win",
      "targetMarket": "US",
      "sellingAngle": "primary ad/content angle",
      "recommendedPrice": 89.99,
      "estimatedCOGS": 30,
      "estimatedShipping": 8,
      "scores": {
        "demandScore": 80,
        "trendScore": 70,
        "competitionScore": 60,
        "supplierScore": 75,
        "creativePotentialScore": 85,
        "riskScore": 35
      },
      "confidence": "low|medium|high",
      "risks": ["risk flag"],
      "metadata": { "evidenceNote": "what is estimated vs supported" }
    }
  ]
}`;
  }

  private cleanJson(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
  }
}

export const researchService = new ResearchService();
