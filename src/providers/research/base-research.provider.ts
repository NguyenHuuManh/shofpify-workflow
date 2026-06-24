/**
 * Purpose:
 * Shared HTTP helper base for supplemental research providers.
 *
 * Responsibilities:
 * - Keep external API calls inside provider layer
 * - Normalize provider failures into empty evidence lists
 * - Log missing configuration without fabricating source data
 *
 * Dependencies:
 * - ResearchProvider types
 * - logger
 */

import { logger } from '@/lib/logger';
import type {
  NormalizedResearchSourceInput,
  SupplementalProviderName,
} from '@/schemas/research.schema';
import type {
  ResearchProvider,
  ResearchProviderCollectInput,
} from '@/types/research.types';

export interface ResearchHttpRequest {
  url: string;
  init?: RequestInit;
  metadata?: Record<string, unknown>;
}

export abstract class HttpResearchProvider implements ResearchProvider {
  abstract readonly name: string;
  abstract readonly providerType: SupplementalProviderName;

  async collect(
    input: ResearchProviderCollectInput,
  ): Promise<NormalizedResearchSourceInput[]> {
    if (!this.isEnabled(input)) {
      return [];
    }

    if (!this.hasCredentials()) {
      logger.warn(
        { provider: this.name, missingConfiguration: this.missingConfigurationKey() },
        'Research provider skipped because credentials are not configured',
      );
      return [];
    }

    try {
      const requests = this.buildRequests(input);
      const responses = await Promise.all(
        requests.map(async (request) => {
          const response = await fetch(request.url, request.init);
          if (!response.ok) {
            const responseBody = await this.safeErrorBody(response);
            logger.warn(
              { provider: this.name, status: response.status, responseBody },
              'Research provider request failed',
            );
            return undefined;
          }
          const body = await response.json() as unknown;
          return { body, metadata: request.metadata };
        }),
      );

      return responses
        .filter((response): response is { body: unknown; metadata: Record<string, unknown> | undefined } =>
          response !== undefined,
        )
        .flatMap((response) => this.normalizeResponse(response.body, input, response.metadata));
    } catch (error) {
      logger.warn(
        { provider: this.name, error },
        'Research provider returned no evidence after request error',
      );
      return [];
    }
  }

  protected isEnabled(input: ResearchProviderCollectInput): boolean {
    return input.config.supplementalProviders.includes(this.providerType);
  }

  protected abstract hasCredentials(): boolean;

  protected abstract missingConfigurationKey(): string;

  protected abstract buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[];

  protected abstract normalizeResponse(
    response: unknown,
    input: ResearchProviderCollectInput,
    metadata?: Record<string, unknown>,
  ): NormalizedResearchSourceInput[];

  protected truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
  }

  protected asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  protected numberOrUndefined(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  protected stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private async safeErrorBody(response: Response): Promise<string | undefined> {
    try {
      const body = await response.text();
      if (!body) {
        return undefined;
      }
      return this.truncate(
        body.replace(/authorization["']?\s*[:=]\s*["']?[^"',}\s]+/gi, 'authorization:[redacted]'),
        500,
      );
    } catch {
      return undefined;
    }
  }
}
