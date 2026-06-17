/**
 * Purpose:
 * Supplier intelligence research provider.
 *
 * Responsibilities:
 * - Query an approved supplier intelligence endpoint for cost and shipping evidence
 * - Normalize supplier metrics into SUPPLIER ResearchSource payloads
 *
 * Dependencies:
 * - HttpResearchProvider
 * - optional supplier provider endpoint and API key
 */

import { getOptionalEnvValue } from '@/lib/env';
import type { NormalizedResearchSourceInput } from '@/schemas/research.schema';
import type { ResearchProviderCollectInput } from '@/types/research.types';
import { HttpResearchProvider, type ResearchHttpRequest } from './base-research.provider';

export class SupplierResearchProvider extends HttpResearchProvider {
  readonly name = 'SupplierResearchProvider';
  readonly providerType = 'supplier' as const;

  private readonly apiKey = getOptionalEnvValue('SUPPLIER_PROVIDER_API_KEY');
  private readonly endpoint = getOptionalEnvValue('SUPPLIER_PROVIDER_ENDPOINT');

  protected hasCredentials(): boolean {
    return Boolean(this.apiKey && this.endpoint);
  }

  protected missingConfigurationKey(): string {
    return 'SUPPLIER_PROVIDER_API_KEY and SUPPLIER_PROVIDER_ENDPOINT';
  }

  protected buildRequests(input: ResearchProviderCollectInput): ResearchHttpRequest[] {
    const url = new URL(this.endpoint ?? 'https://example.invalid/supplier-search');
    url.searchParams.set('q', input.productIdea);
    url.searchParams.set('market', input.config.targetMarket);
    return [
      {
        url: url.toString(),
        init: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
          },
        },
      },
    ];
  }

  protected normalizeResponse(response: unknown): NormalizedResearchSourceInput[] {
    const root = this.asRecord(response);
    const results = Array.isArray(root.results)
      ? root.results
      : Array.isArray(root.items)
        ? root.items
        : [];

    return results.slice(0, 10).map((item): NormalizedResearchSourceInput => {
      const record = this.asRecord(item);
      const title = this.stringOrUndefined(record.title) ?? this.stringOrUndefined(record.name) ?? 'Supplier listing';
      const cost = this.numberOrUndefined(record.productCost) ?? this.numberOrUndefined(record.cost);
      const shipping = this.numberOrUndefined(record.shippingCost) ?? this.numberOrUndefined(record.shipping);
      const processingTime = this.stringOrUndefined(record.processingTime) ?? this.stringOrUndefined(record.processing_time);
      const supplier = this.stringOrUndefined(record.supplier) ?? this.stringOrUndefined(record.seller);

      return {
        type: 'SUPPLIER',
        provider: 'Configured Supplier Provider',
        url: this.stringOrUndefined(record.url),
        externalId: this.stringOrUndefined(record.id),
        title: this.truncate(title, 255),
        extractedSignal: this.truncate(
          [
            `${title} supplier listing`,
            cost !== undefined ? `cost ${cost}` : undefined,
            shipping !== undefined ? `shipping ${shipping}` : undefined,
            processingTime ? `processing ${processingTime}` : undefined,
            supplier ? `supplier ${supplier}` : undefined,
          ]
            .filter(Boolean)
            .join(', '),
          2000,
        ),
        rawData: {
          ...record,
          metrics: { productCost: cost, shippingCost: shipping, supplierSignal: 70 },
        },
        confidence: 0.72,
        capturedAt: new Date(),
      };
    });
  }
}
