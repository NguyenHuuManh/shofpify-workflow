/**
 * Purpose:
 * Aggregate marketplace evidence into product groups before candidate creation.
 *
 * Responsibilities:
 * - Group provider-backed marketplace listings with AI when available
 * - Fall back to deterministic deduplication when AI output is unavailable or invalid
 * - Merge source metrics without fabricating product facts
 *
 * Dependencies:
 * - AIProvider interface
 * - Product aggregation schemas
 * - logger
 */

import { logger } from '@/lib/logger';
import { validate } from '@/lib/validate';
import {
  productAggregationAiOutputSchema,
  productAggregationGroupSchema,
  productAggregationSourceSchema,
} from '@/schemas/research.schema';
import type { AIProvider } from '@/types/ai-provider.interface';
import type {
  NormalizedResearchSourceInput,
  ProductAggregationGroup,
  ProductAggregationMergedMetrics,
  ProductAggregationSource,
  ProviderEvidenceMetrics,
} from '@/schemas/research.schema';
import type { ProductAggregationInput, ProductAggregationResult } from '@/types/research.types';

export class ProductAggregationService {
  async aggregate(
    input: ProductAggregationInput,
    aiProvider?: AIProvider,
  ): Promise<ProductAggregationResult> {
    const sources = this.prepareMarketplaceSources(input.sources);
    if (sources.length === 0) {
      return { groups: [], sources: [], method: 'deterministic_dedup' };
    }

    if (aiProvider && sources.length > 1) {
      const aiGroups = await this.tryAiGrouping(input.productIdea, sources, input.maxGroups, aiProvider);
      if (aiGroups.length > 0) {
        return {
          groups: aiGroups.slice(0, input.maxGroups),
          sources,
          method: 'ai_grouping',
        };
      }
    }

    return {
      groups: this.deterministicGroups(sources).slice(0, input.maxGroups),
      sources,
      method: 'deterministic_dedup',
    };
  }

  sourceKey(source: NormalizedResearchSourceInput, index = 0): string {
    return [
      source.type,
      source.provider,
      source.externalId,
      source.url,
      source.title,
      index,
    ]
      .filter((value) => value !== undefined && value !== null && String(value).length > 0)
      .map(String)
      .join('|');
  }

  private prepareMarketplaceSources(
    sources: NormalizedResearchSourceInput[],
  ): ProductAggregationSource[] {
    return sources
      .filter((source) => source.type === 'MARKETPLACE')
      .filter((source) => source.title || source.externalId || source.url)
      .map((source, index) =>
        validate(productAggregationSourceSchema, {
          ...source,
          sourceKey: this.sourceKey(source, index),
        }),
      );
  }

  private async tryAiGrouping(
    productIdea: string,
    sources: ProductAggregationSource[],
    maxGroups: number,
    aiProvider: AIProvider,
  ): Promise<ProductAggregationGroup[]> {
    try {
      const output = await aiProvider.generateText({
        systemPrompt: this.buildSystemPrompt(),
        prompt: this.buildUserPrompt(productIdea, sources, maxGroups),
        temperature: 0.1,
        maxTokens: 3000,
      });
      const parsed = productAggregationAiOutputSchema.safeParse(this.parseJsonObject(output.text));
      if (!parsed.success) {
        logger.warn(
          { provider: aiProvider.providerName, validationErrors: parsed.error.flatten() },
          'Product aggregation AI output failed validation; falling back to deterministic grouping',
        );
        return [];
      }

      return this.normalizeAiGroups(parsed.data.groups, sources);
    } catch (error) {
      logger.warn(
        { provider: aiProvider.providerName, error },
        'Product aggregation AI grouping failed; falling back to deterministic grouping',
      );
      return [];
    }
  }

  private normalizeAiGroups(
    groups: Array<{ name: string; sourceKeys: string[]; rationale?: string }>,
    sources: ProductAggregationSource[],
  ): ProductAggregationGroup[] {
    const sourceByKey = new Map(sources.map((source) => [source.sourceKey, source]));
    const assigned = new Set<string>();
    const normalized: ProductAggregationGroup[] = [];

    for (const group of groups) {
      const uniqueKeys = Array.from(new Set(group.sourceKeys));
      if (uniqueKeys.length === 0 || uniqueKeys.some((key) => !sourceByKey.has(key) || assigned.has(key))) {
        return [];
      }

      uniqueKeys.forEach((key) => assigned.add(key));
      const groupSources = uniqueKeys.map((key) => sourceByKey.get(key)!);
      normalized.push(
        validate(productAggregationGroupSchema, {
          groupId: this.groupId('ai', groupSources),
          name: this.representativeName(group.name, groupSources),
          sourceKeys: uniqueKeys,
          method: 'ai_grouping',
          rationale: group.rationale,
          mergedMetrics: this.mergeMetrics(groupSources),
        }),
      );
    }

    if (assigned.size !== sources.length) {
      return [];
    }

    return normalized;
  }

  private deterministicGroups(sources: ProductAggregationSource[]): ProductAggregationGroup[] {
    const grouped = new Map<string, ProductAggregationSource[]>();
    for (const source of sources) {
      const key = this.deterministicGroupKey(source);
      grouped.set(key, [...(grouped.get(key) ?? []), source]);
    }

    return Array.from(grouped.values())
      .map((groupSources) =>
        validate(productAggregationGroupSchema, {
          groupId: this.groupId('det', groupSources),
          name: this.representativeName(groupSources[0]?.title ?? groupSources[0]?.externalId, groupSources),
          sourceKeys: groupSources.map((source) => source.sourceKey),
          method: 'deterministic_dedup',
          rationale: 'Grouped by normalized title and price cluster.',
          mergedMetrics: this.mergeMetrics(groupSources),
        }),
      )
      .sort((a, b) => {
        const demandDelta = (b.mergedMetrics.demandSignal ?? 0) - (a.mergedMetrics.demandSignal ?? 0);
        return demandDelta !== 0 ? demandDelta : b.mergedMetrics.sourceCount - a.mergedMetrics.sourceCount;
      });
  }

  private deterministicGroupKey(source: ProductAggregationSource): string {
    const name = this.normalizeName(source.title ?? source.externalId ?? source.url ?? 'marketplace listing');
    const price = this.extractEvidenceMetrics(source).price;
    const priceCluster = price === undefined ? 'unknown' : String(Math.round(price / 10) * 10);
    return `${name}:${priceCluster}`;
  }

  private mergeMetrics(sources: ProductAggregationSource[]): ProductAggregationMergedMetrics {
    const metrics = sources.map((source) => this.extractEvidenceMetrics(source));
    const prices = metrics.map((metric) => metric.price).filter((value): value is number => value !== undefined);
    const ratings = metrics.map((metric) => metric.rating).filter((value): value is number => value !== undefined);
    const reviewCounts = metrics
      .map((metric) => metric.reviewCount)
      .filter((value): value is number => value !== undefined);
    const orderCounts = metrics
      .map((metric) => this.metricNumber(metric, 'orderCount'))
      .filter((value): value is number => value !== undefined);
    const demandSignals = metrics
      .map((metric) => metric.demandSignal)
      .filter((value): value is number => value !== undefined);

    return {
      demandSignal:
        this.max(demandSignals) ??
        this.volumeToDemandScore(this.sum(orderCounts)) ??
        this.reviewCountToDemandScore(this.sum(reviewCounts)),
      medianPrice: this.median(prices),
      minPrice: this.min(prices),
      maxPrice: this.max(prices),
      ratingAverage: this.average(ratings),
      reviewCountTotal: this.sum(reviewCounts),
      orderCountTotal: this.sum(orderCounts),
      sourceCount: sources.length,
    };
  }

  private representativeName(value: string | undefined, sources: ProductAggregationSource[]): string {
    const existing = sources
      .map((source) => source.title ?? source.externalId)
      .find((title) => title && this.normalizeName(title) === this.normalizeName(value ?? ''));

    return this.truncate(existing ?? sources[0]?.title ?? sources[0]?.externalId ?? value ?? 'Marketplace product', 255);
  }

  private extractEvidenceMetrics(source: ProductAggregationSource): ProviderEvidenceMetrics {
    const rawData = source.rawData ?? {};
    return rawData.metrics && typeof rawData.metrics === 'object' && !Array.isArray(rawData.metrics)
      ? (rawData.metrics as ProviderEvidenceMetrics)
      : {};
  }

  private metricNumber(metrics: ProviderEvidenceMetrics, key: string): number | undefined {
    const value = (metrics as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private normalizeName(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gu, ' ')
      .replace(/\b(the|and|with|for|new|hot|best|sale|shop|official)\b/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  private groupId(prefix: string, sources: ProductAggregationSource[]): string {
    const base = sources
      .map((source) => source.sourceKey)
      .sort()
      .join('::');
    let hash = 0;
    for (let index = 0; index < base.length; index += 1) {
      hash = (hash * 31 + base.charCodeAt(index)) >>> 0;
    }
    return `${prefix}_${hash.toString(36)}`;
  }

  private buildSystemPrompt(): string {
    return [
      'You group marketplace product listings for Product Research.',
      'Use only the provided source records.',
      'Do not invent product names, prices, URLs, suppliers, costs, MOQ, or source evidence.',
      'Every sourceKey must appear in exactly one group.',
      'Put uncertain matches in separate groups.',
      'Return only strict JSON.',
    ].join('\n');
  }

  private buildUserPrompt(
    productIdea: string,
    sources: ProductAggregationSource[],
    maxGroups: number,
  ): string {
    return JSON.stringify({
      task: 'Group listings that describe the same real-world product.',
      productIdea,
      maxGroups,
      outputSchema: {
        groups: [
          {
            name: 'representative title copied from one source title',
            sourceKeys: ['sourceKey assigned exactly once'],
            rationale: 'short evidence-backed grouping rationale',
          },
        ],
      },
      sources: sources.map((source) => ({
        sourceKey: source.sourceKey,
        provider: source.provider,
        url: source.url,
        externalId: source.externalId,
        title: source.title,
        extractedSignal: source.extractedSignal,
        confidence: source.confidence,
        metrics: this.extractEvidenceMetrics(source),
      })),
    });
  }

  private parseJsonObject(text: string): unknown {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }

    throw new Error('Product aggregation AI did not return JSON');
  }

  private median(values: number[]): number | undefined {
    if (values.length === 0) {
      return undefined;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const value =
      sorted.length % 2 === 0
        ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
        : sorted[middle];
    return value === undefined ? undefined : Math.round(value * 100) / 100;
  }

  private average(values: number[]): number | undefined {
    if (values.length === 0) {
      return undefined;
    }
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
  }

  private sum(values: number[]): number | undefined {
    if (values.length === 0) {
      return undefined;
    }
    return values.reduce((sum, value) => sum + value, 0);
  }

  private min(values: number[]): number | undefined {
    return values.length === 0 ? undefined : Math.min(...values);
  }

  private max(values: number[]): number | undefined {
    return values.length === 0 ? undefined : Math.max(...values);
  }

  private volumeToDemandScore(volume: number | undefined): number | undefined {
    if (volume === undefined) {
      return undefined;
    }
    return Math.min(96, Math.max(25, Math.round(Math.log10(volume + 1) * 22)));
  }

  private reviewCountToDemandScore(count: number | undefined): number | undefined {
    if (count === undefined) {
      return undefined;
    }
    return Math.min(95, Math.max(20, Math.round(Math.log10(count + 1) * 24)));
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }
}

export const productAggregationService = new ProductAggregationService();
