/**
 * Purpose:
 * Select provider-backed discovery queries before marketplace collection.
 *
 * Responsibilities:
 * - Extract keyword candidates from normalized TREND, KEYWORD, and SEARCH evidence
 * - Rank, deduplicate, and cap derived queries without inventing new terms
 * - Preserve seed query and query provenance for downstream providers
 *
 * Dependencies:
 * - Research schemas
 * - Research service types
 */

import {
  queryIntelligenceCandidateSchema,
  queryIntelligenceResultSchema,
} from '@/schemas/research.schema';
import type {
  NormalizedResearchSourceInput,
  QueryIntelligenceCandidate,
  QueryIntelligenceResult,
  QueryIntelligenceSourceType,
  SelectedDiscoveryQuery,
} from '@/schemas/research.schema';
import type { QueryIntelligenceInput } from '@/types/research.types';

const BUYER_INTENT_TERMS = [
  'best',
  'buy',
  'deal',
  'portable',
  'cordless',
  'rechargeable',
  'mini',
  'travel',
  'wireless',
  'electric',
  'automatic',
  'smart',
  'kit',
  'set',
  'organizer',
  'replacement',
  'reviews',
  'for',
];

const RISK_TERMS = [
  'medical',
  'supplement',
  'baby',
  'weapon',
  'trademark',
  'disney',
  'nike',
  'apple',
  'patented',
  'regulated',
];

interface QueryAccumulator {
  query: string;
  sourceTypes: Set<QueryIntelligenceSourceType>;
  providers: Set<string>;
  searchVolume?: number;
  trendScore?: number;
  cpc?: number;
  competitionScore?: number;
  snippets: string[];
}

export class QueryIntelligenceService {
  selectQueries(input: QueryIntelligenceInput): QueryIntelligenceResult {
    const seedQuery = this.cleanQuery(input.productIdea);
    const accumulators = new Map<string, QueryAccumulator>();

    for (const source of input.sources) {
      if (!this.isQueryIntelligenceSource(source)) {
        continue;
      }

      const sourceType = source.type as QueryIntelligenceSourceType;
      const metrics = this.extractMetrics(source);
      for (const query of this.extractQueriesFromSource(source, seedQuery)) {
        const clean = this.cleanQuery(query);
        if (!this.isUsableDerivedQuery(clean, seedQuery, input.config.excludedCategories)) {
          continue;
        }

        const key = this.normalizeKey(clean);
        const existing = accumulators.get(key) ?? {
          query: clean,
          sourceTypes: new Set<QueryIntelligenceSourceType>(),
          providers: new Set<string>(),
          snippets: [],
        };
        existing.sourceTypes.add(sourceType);
        existing.providers.add(source.provider);
        existing.searchVolume = this.max(existing.searchVolume, metrics.searchVolume);
        existing.trendScore = this.max(existing.trendScore, metrics.trendSignal);
        existing.cpc = this.max(existing.cpc, metrics.cpc);
        existing.competitionScore = this.max(existing.competitionScore, metrics.competitionSignal);
        existing.snippets.push(source.extractedSignal);
        accumulators.set(key, existing);
      }
    }

    const candidateQueries = Array.from(accumulators.values())
      .map((accumulator) => this.scoreCandidate(accumulator, seedQuery))
      .filter((candidate) => candidate.relevanceScore >= 25 && (candidate.riskScore ?? 0) < 80)
      .sort((a, b) => b.score - a.score)
      .map((candidate) => queryIntelligenceCandidateSchema.parse(candidate));

    const selectedQueries: SelectedDiscoveryQuery[] = [
      {
        query: seedQuery,
        source: 'SEED_QUERY',
        sourceTypes: [],
        score: 100,
        reason: 'Original product idea is always preserved as the primary discovery query.',
      },
      ...candidateQueries.slice(0, input.config.maxDerivedQueries).map((candidate) => ({
        query: candidate.query,
        source: 'QUERY_INTELLIGENCE' as const,
        sourceTypes: candidate.sourceTypes,
        score: candidate.score,
        reason: candidate.reason,
      })),
    ];

    return queryIntelligenceResultSchema.parse({
      seedQuery,
      selectedQueries,
      candidateQueries,
    });
  }

  private isQueryIntelligenceSource(source: NormalizedResearchSourceInput): boolean {
    return source.type === 'TREND' || source.type === 'KEYWORD' || source.type === 'SEARCH';
  }

  private extractQueriesFromSource(
    source: NormalizedResearchSourceInput,
    seedQuery: string,
  ): string[] {
    const rawData = source.rawData ?? {};
    if (source.type === 'KEYWORD') {
      return [
        source.externalId,
        source.title?.replace(/\s+keyword signal$/iu, ''),
        this.stringFromRecord(rawData, 'keyword'),
        ...this.stringArrayFromKnownKeys(rawData),
      ].filter((value): value is string => Boolean(value));
    }

    if (source.type === 'TREND') {
      return [
        this.stringFromRecord(rawData, 'query'),
        ...this.stringArrayFromKnownKeys(rawData),
        ...this.extractTrendQueries(rawData.response),
      ].filter((value): value is string => Boolean(value));
    }

    return this.extractSearchPhrases(source, seedQuery);
  }

  private extractSearchPhrases(
    source: NormalizedResearchSourceInput,
    seedQuery: string,
  ): string[] {
    const phrases = [source.title, source.extractedSignal]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => this.phrasesFromText(value));
    const seedTerms = this.tokenize(seedQuery);

    return phrases.filter((phrase) => {
      const phraseTerms = this.tokenize(phrase);
      return phraseTerms.some((term) => seedTerms.includes(term)) ||
        seedTerms.some((term) => phraseTerms.includes(term));
    });
  }

  private extractTrendQueries(value: unknown, depth = 0): string[] {
    if (depth > 4) {
      return [];
    }

    if (typeof value === 'string') {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.extractTrendQueries(item, depth + 1));
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const record = value as Record<string, unknown>;
    const direct = [
      this.stringFromRecord(record, 'query'),
      this.stringFromRecord(record, 'keyword'),
      this.stringFromRecord(record, 'title'),
      this.stringFromRecord(record, 'value'),
    ].filter((item): item is string => Boolean(item));
    const nested = [
      record.related_queries,
      record.relatedQueries,
      record.rising_queries,
      record.risingQueries,
      record.top_queries,
      record.topQueries,
      record.items,
      record.data,
      record.results,
    ].flatMap((item) => this.extractTrendQueries(item, depth + 1));

    return [...direct, ...nested];
  }

  private stringArrayFromKnownKeys(record: Record<string, unknown>): string[] {
    return [
      record.relatedKeywords,
      record.related_keywords,
      record.relatedQueries,
      record.related_queries,
      record.risingQueries,
      record.rising_queries,
      record.suggestions,
    ].flatMap((value) => this.toStringArray(value));
  }

  private toStringArray(value: unknown): string[] {
    if (typeof value === 'string') {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        if (typeof item === 'string') {
          return [item];
        }
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return [
            this.stringFromRecord(record, 'query'),
            this.stringFromRecord(record, 'keyword'),
            this.stringFromRecord(record, 'title'),
            this.stringFromRecord(record, 'value'),
          ].filter((entry): entry is string => Boolean(entry));
        }
        return [];
      });
    }
    return [];
  }

  private scoreCandidate(
    accumulator: QueryAccumulator,
    seedQuery: string,
  ): QueryIntelligenceCandidate {
    const relevanceScore = this.relevanceScore(accumulator.query, seedQuery);
    const buyerIntentScore = this.buyerIntentScore(accumulator.query);
    const searchVolumeScore = this.volumeScore(accumulator.searchVolume);
    const trendScore = accumulator.trendScore;
    const cpcScore = accumulator.cpc === undefined
      ? undefined
      : Math.min(100, Math.round(accumulator.cpc * 12));
    const competitionPenalty = accumulator.competitionScore === undefined
      ? 0
      : Math.round(accumulator.competitionScore * 0.18);
    const riskScore = this.riskScore(accumulator.query);
    const evidenceBoost = Math.min(10, accumulator.sourceTypes.size * 5);
    const score = this.clampScore(
      relevanceScore * 0.36 +
        buyerIntentScore * 0.2 +
        (searchVolumeScore ?? 50) * 0.16 +
        (trendScore ?? 50) * 0.14 +
        (cpcScore ?? 45) * 0.06 +
        evidenceBoost -
        competitionPenalty -
        riskScore * 0.2,
    );

    return {
      query: accumulator.query,
      sourceTypes: Array.from(accumulator.sourceTypes),
      providers: Array.from(accumulator.providers),
      searchVolume: accumulator.searchVolume,
      trendScore,
      cpc: accumulator.cpc,
      competitionScore: accumulator.competitionScore,
      buyerIntentScore,
      relevanceScore,
      riskScore,
      score,
      reason: this.buildReason(accumulator, score),
    };
  }

  private buildReason(accumulator: QueryAccumulator, score: number): string {
    const parts = [
      `provider-backed score ${score}`,
      accumulator.searchVolume !== undefined ? `volume ${accumulator.searchVolume}` : undefined,
      accumulator.trendScore !== undefined ? `trend ${accumulator.trendScore}` : undefined,
      accumulator.sourceTypes.size > 1
        ? `confirmed by ${accumulator.sourceTypes.size} source types`
        : undefined,
    ].filter(Boolean);

    return parts.join(', ');
  }

  private extractMetrics(source: NormalizedResearchSourceInput) {
    const rawData = source.rawData ?? {};
    const metrics =
      rawData.metrics && typeof rawData.metrics === 'object' && !Array.isArray(rawData.metrics)
        ? (rawData.metrics as Record<string, unknown>)
        : {};

    return {
      searchVolume: this.numberFrom(metrics.searchVolume),
      trendSignal:
        this.numberFrom(metrics.trendSignal) ??
        this.numberFrom(rawData.recentInterestAverage),
      cpc: this.numberFrom(metrics.cpc),
      competitionSignal: this.numberFrom(metrics.competitionSignal),
    };
  }

  private isUsableDerivedQuery(
    query: string,
    seedQuery: string,
    excludedCategories: string[],
  ): boolean {
    if (!query || this.normalizeKey(query) === this.normalizeKey(seedQuery)) {
      return false;
    }

    const terms = this.tokenize(query);
    if (terms.length < 2 || terms.length > 8) {
      return false;
    }

    const lower = query.toLowerCase();
    return !excludedCategories.some((category) => lower.includes(category.toLowerCase()));
  }

  private relevanceScore(query: string, seedQuery: string): number {
    const queryTerms = this.tokenize(query);
    const seedTerms = this.tokenize(seedQuery);
    if (queryTerms.length === 0 || seedTerms.length === 0) {
      return 0;
    }

    const overlap = queryTerms.filter((term) => seedTerms.includes(term)).length;
    const partialOverlap = queryTerms.filter((term) =>
      seedTerms.some((seedTerm) => term.includes(seedTerm) || seedTerm.includes(term)),
    ).length;
    return this.clampScore((overlap / seedTerms.length) * 70 + partialOverlap * 10);
  }

  private buyerIntentScore(query: string): number {
    const terms = this.tokenize(query);
    const matches = terms.filter((term) => BUYER_INTENT_TERMS.includes(term)).length;
    return this.clampScore(35 + matches * 18 + Math.min(15, terms.length * 2));
  }

  private riskScore(query: string): number {
    const lower = query.toLowerCase();
    return RISK_TERMS.some((term) => lower.includes(term)) ? 75 : 10;
  }

  private volumeScore(volume: number | undefined): number | undefined {
    if (volume === undefined) {
      return undefined;
    }
    if (volume >= 50_000) {
      return 95;
    }
    if (volume >= 10_000) {
      return 85;
    }
    if (volume >= 3_000) {
      return 75;
    }
    if (volume >= 1_000) {
      return 65;
    }
    return 45;
  }

  private phrasesFromText(value: string): string[] {
    return value
      .split(/[|:;,.!?()[\]{}]/u)
      .map((part) => this.cleanQuery(part))
      .filter((part) => this.tokenize(part).length >= 2);
  }

  private tokenize(value: string): string[] {
    return this.cleanQuery(value)
      .toLowerCase()
      .split(/\s+/u)
      .map((term) => term.replace(/[^a-z0-9-]/giu, ''))
      .filter((term) => term.length > 2);
  }

  private cleanQuery(value: string): string {
    return value
      .replace(/\s+/gu, ' ')
      .replace(/\s+(keyword signal|trend signal)$/iu, '')
      .trim()
      .slice(0, 255);
  }

  private normalizeKey(value: string): string {
    return this.tokenize(value).join(' ');
  }

  private max(a: number | undefined, b: number | undefined): number | undefined {
    if (a === undefined) {
      return b;
    }
    if (b === undefined) {
      return a;
    }
    return Math.max(a, b);
  }

  private numberFrom(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private stringFromRecord(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}

export const queryIntelligenceService = new QueryIntelligenceService();
