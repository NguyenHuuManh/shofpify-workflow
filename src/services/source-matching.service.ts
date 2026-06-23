/**
 * Purpose:
 * AI-assisted reviewer for matching persisted demand/store evidence with
 * persisted sourcing evidence.
 *
 * Responsibilities:
 * - Build source matching bundles from existing ResearchSource records
 * - Call the AI provider through the provider interface only
 * - Persist auditable match reviews in ProductCandidate.metadata
 * - Persist human reviewer decisions for source match results
 *
 * Dependencies:
 * - ProductCandidateRepository
 * - ResearchSourceRepository
 * - AIProvider interface
 * - Zod source match schemas
 */

import { randomUUID } from 'crypto';
import type { ProductCandidate, ResearchSource } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AppError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createDefaultProvider } from '@/providers/provider.factory';
import type { AIProvider } from '@/types/ai-provider.interface';
import {
  productCandidateRepository,
  ProductCandidateRepository,
  researchSourceRepository,
  ResearchSourceRepository,
} from '@/repositories';
import {
  sourceMatchAiOutputSchema,
  sourceMatchDecisionSchema,
  sourceMatchResultSchema,
  sourceMatchReviewRequestSchema,
  type SourceMatchDecisionInput,
  type SourceMatchReviewRequestInput,
} from '@/schemas/research.schema';
import type { SourceMatchReviewResult } from '@/types/research.types';
import { validate } from '@/lib/validate';

interface CandidateMetadata {
  [key: string]: unknown;
  sourceMatches?: SourceMatchReviewResult[];
}

interface SourceMatchingServiceDeps {
  candidateRepo?: ProductCandidateRepository;
  sourceRepo?: ResearchSourceRepository;
  aiProvider?: AIProvider;
}

export class SourceMatchingService {
  private readonly candidateRepo: ProductCandidateRepository;
  private readonly sourceRepo: ResearchSourceRepository;
  private readonly aiProvider?: AIProvider;

  constructor(deps: SourceMatchingServiceDeps = {}) {
    this.candidateRepo = deps.candidateRepo ?? productCandidateRepository;
    this.sourceRepo = deps.sourceRepo ?? researchSourceRepository;
    this.aiProvider = deps.aiProvider;
  }

  async reviewCandidateSources(
    candidateId: string,
    input: SourceMatchReviewRequestInput,
  ): Promise<{ matches: SourceMatchReviewResult[] }> {
    const body = validate(sourceMatchReviewRequestSchema, input);
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);
    const sources = await this.loadScopedSources(candidateId, body.sourceIds);
    const pairs = this.buildReviewPairs(sources);

    if (pairs.length === 0) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'At least one persisted demand/store source and one sourcing source are required',
        statusCode: 422,
      });
    }

    const reviewedAt = new Date().toISOString();
    const aiMatches = await this.runAiReview(candidate, sources, pairs, reviewedAt);
    const persistedMatches = await this.persistMatches(candidate, aiMatches);

    logger.info(
      { candidateId, sourceCount: sources.length, matchCount: persistedMatches.length },
      'AI-assisted source match review completed',
    );

    return { matches: persistedMatches };
  }

  async decideSourceMatch(
    candidateId: string,
    matchId: string,
    input: SourceMatchDecisionInput,
  ): Promise<SourceMatchReviewResult> {
    const body = validate(sourceMatchDecisionSchema, input);
    const candidate = await this.candidateRepo.findByIdOrThrow(candidateId);
    const metadata = this.readMetadata(candidate);
    const matches = this.readSourceMatches(metadata);
    const matchIndex = matches.findIndex((match) => match.id === matchId);

    if (matchIndex === -1) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Source match '${matchId}' not found`,
        statusCode: 404,
      });
    }

    const updatedMatch: SourceMatchReviewResult = {
      ...matches[matchIndex]!,
      reviewerDecision: body.decision,
      reviewerId: body.reviewerId,
      reviewerComment: body.comment,
      decidedAt: new Date().toISOString(),
    };

    const nextMatches = [...matches];
    nextMatches[matchIndex] = updatedMatch;

    await this.candidateRepo.updateMetadata(
      candidateId,
      this.toJsonObject({
        ...metadata,
        sourceMatches: nextMatches,
      }),
    );

    logger.info(
      { candidateId, matchId, decision: body.decision },
      'Source match reviewer decision persisted',
    );

    return updatedMatch;
  }

  private async loadScopedSources(
    candidateId: string,
    sourceIds: string[],
  ): Promise<ResearchSource[]> {
    const uniqueSourceIds = Array.from(new Set(sourceIds));
    const sources = await this.sourceRepo.findByCandidateScope(candidateId, uniqueSourceIds);
    const foundIds = new Set(sources.map((source) => source.id));
    const missingIds = uniqueSourceIds.filter((sourceId) => !foundIds.has(sourceId));

    if (missingIds.length > 0) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'One or more sources were not found for this candidate',
        statusCode: 404,
        details: { missingSourceIds: missingIds },
      });
    }

    return sources;
  }

  private buildReviewPairs(
    sources: ResearchSource[],
  ): Array<{ sourceId: string; matchedSourceId: string }> {
    const demandSources = sources.filter((source) => source.type !== 'SOURCING');
    const sourcingSources = sources.filter((source) => source.type === 'SOURCING');
    const pairs: Array<{ sourceId: string; matchedSourceId: string }> = [];

    for (const demandSource of demandSources) {
      for (const sourcingSource of sourcingSources) {
        pairs.push({
          sourceId: demandSource.id,
          matchedSourceId: sourcingSource.id,
        });
      }
    }

    return pairs.slice(0, 12);
  }

  private async runAiReview(
    candidate: ProductCandidate,
    sources: ResearchSource[],
    pairs: Array<{ sourceId: string; matchedSourceId: string }>,
    reviewedAt: string,
  ): Promise<SourceMatchReviewResult[]> {
    try {
      const provider = this.aiProvider ?? createDefaultProvider();
      const output = await provider.generateText({
        systemPrompt: this.buildSystemPrompt(),
        prompt: this.buildUserPrompt(candidate, sources, pairs),
        maxTokens: 1800,
        temperature: 0.1,
      });
      const parsed = sourceMatchAiOutputSchema.parse(this.parseJsonObject(output.text));
      return this.normalizeAiMatches(parsed.matches, pairs, reviewedAt);
    } catch (error) {
      logger.warn(
        { candidateId: candidate.id, error },
        'Source match AI review failed; persisting insufficient-evidence result',
      );
      return pairs.map((pair) =>
        this.buildInsufficientEvidenceResult(
          pair.sourceId,
          pair.matchedSourceId,
          reviewedAt,
          'AI reviewer failed or returned invalid structured output',
        ),
      );
    }
  }

  private normalizeAiMatches(
    matches: Array<{
      sourceId: string;
      matchedSourceId: string;
      matchStatus: SourceMatchReviewResult['matchStatus'];
      confidenceScore: number;
      reasons: string[];
      warnings: string[];
      recommendedAction: SourceMatchReviewResult['recommendedAction'];
    }>,
    requestedPairs: Array<{ sourceId: string; matchedSourceId: string }>,
    reviewedAt: string,
  ): SourceMatchReviewResult[] {
    const allowedPairs = new Set(
      requestedPairs.map((pair) => `${pair.sourceId}:${pair.matchedSourceId}`),
    );
    const normalized = matches
      .filter((match) => allowedPairs.has(`${match.sourceId}:${match.matchedSourceId}`))
      .map((match) =>
        sourceMatchResultSchema.parse({
          ...match,
          id: randomUUID(),
          reviewerDecision: null,
          reviewedAt,
        }),
      );

    if (normalized.length > 0) {
      return normalized;
    }

    return requestedPairs.map((pair) =>
      this.buildInsufficientEvidenceResult(
        pair.sourceId,
        pair.matchedSourceId,
        reviewedAt,
        'AI reviewer returned no valid source pair results',
      ),
    );
  }

  private buildInsufficientEvidenceResult(
    sourceId: string,
    matchedSourceId: string,
    reviewedAt: string,
    warning: string,
  ): SourceMatchReviewResult {
    return sourceMatchResultSchema.parse({
      id: randomUUID(),
      sourceId,
      matchedSourceId,
      matchStatus: 'INSUFFICIENT_EVIDENCE',
      confidenceScore: 0,
      reasons: [],
      warnings: [warning],
      recommendedAction: 'FIND_BETTER_SOURCING_MATCH',
      reviewerDecision: null,
      reviewedAt,
    });
  }

  private async persistMatches(
    candidate: ProductCandidate,
    newMatches: SourceMatchReviewResult[],
  ): Promise<SourceMatchReviewResult[]> {
    const metadata = this.readMetadata(candidate);
    const existingMatches = this.readSourceMatches(metadata);
    const newPairKeys = new Set(
      newMatches.map((match) => `${match.sourceId}:${match.matchedSourceId}`),
    );
    const preservedMatches = existingMatches.filter(
      (match) => !newPairKeys.has(`${match.sourceId}:${match.matchedSourceId}`),
    );
    const nextMatches = [...preservedMatches, ...newMatches];

    await this.candidateRepo.updateMetadata(
      candidate.id,
      this.toJsonObject({
        ...metadata,
        sourceMatches: nextMatches,
      }),
    );

    return nextMatches;
  }

  private toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private readMetadata(candidate: ProductCandidate): CandidateMetadata {
    if (
      candidate.metadata &&
      typeof candidate.metadata === 'object' &&
      !Array.isArray(candidate.metadata)
    ) {
      return candidate.metadata as CandidateMetadata;
    }

    return {};
  }

  private readSourceMatches(metadata: CandidateMetadata): SourceMatchReviewResult[] {
    if (!Array.isArray(metadata.sourceMatches)) {
      return [];
    }

    return metadata.sourceMatches
      .map((match) => sourceMatchResultSchema.safeParse(match))
      .filter((result) => result.success)
      .map((result) => result.data);
  }

  private parseJsonObject(text: string): unknown {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }

    throw new AppError({
      code: ErrorCodes.AI_PROVIDER_ERROR,
      message: 'AI source match review did not return JSON',
      statusCode: 502,
    });
  }

  private buildSystemPrompt(): string {
    return [
      'You are an evidence reviewer for product research source matching.',
      'Compare only the persisted source records provided by the user.',
      'Do not invent product data, source URLs, prices, MOQ, suppliers, or missing facts.',
      'Return only strict JSON matching the requested schema.',
      'Use INSUFFICIENT_EVIDENCE when the provided records are too thin to decide.',
    ].join('\n');
  }

  private buildUserPrompt(
    candidate: ProductCandidate,
    sources: ResearchSource[],
    pairs: Array<{ sourceId: string; matchedSourceId: string }>,
  ): string {
    return JSON.stringify(
      {
        task: 'Review whether each sourceId and matchedSourceId describe the same underlying product.',
        outputSchema: {
          matches: [
            {
              sourceId: 'string',
              matchedSourceId: 'string',
              matchStatus:
                'LIKELY_MATCH | POTENTIAL_MATCH | WEAK_MATCH | NOT_A_MATCH | INSUFFICIENT_EVIDENCE',
              confidenceScore: 'integer 0-100',
              reasons: ['short evidence-backed reasons'],
              warnings: ['missing or conflicting evidence'],
              recommendedAction:
                'LINK_AS_SOURCING_MATCH | REVIEW_BEFORE_LINKING | KEEP_SEPARATE | FIND_BETTER_SOURCING_MATCH',
            },
          ],
        },
        decisionThresholds: {
          LIKELY_MATCH: '90-100',
          POTENTIAL_MATCH: '75-89',
          WEAK_MATCH: '50-74',
          NOT_A_MATCH: '0-49',
          INSUFFICIENT_EVIDENCE: 'not enough persisted evidence',
        },
        candidate: {
          id: candidate.id,
          name: candidate.name,
          positioning: candidate.positioning,
          recommendedPrice: candidate.recommendedPrice?.toString(),
          factoryUnitCost: candidate.factoryUnitCost?.toString(),
          moq: candidate.moq,
          metadata: candidate.metadata,
        },
        sources: sources.map((source) => ({
          id: source.id,
          type: source.type,
          provider: source.provider,
          url: source.url,
          externalId: source.externalId,
          title: source.title,
          extractedSignal: source.extractedSignal,
          confidence: source.confidence,
          rawData: source.rawData,
        })),
        pairs,
      },
      null,
      2,
    );
  }
}

export const sourceMatchingService = new SourceMatchingService();
