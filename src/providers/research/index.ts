/**
 * Purpose:
 * Research provider registry for supplemental evidence collection.
 *
 * Responsibilities:
 * - Export approved research provider implementations
 * - Create the default supplemental provider list
 * - Avoid fake evidence when providers are not configured
 *
 * Dependencies:
 * - Research provider implementations
 */

import type { ResearchProvider, ResearchProviderCollectInput } from '@/types/research.types';
import { AdsSignalResearchProvider } from './ads-signal.provider';
import { ApifyCandidateDiscoveryProvider } from './apify-candidate-discovery.provider';
import { DataForSeoLabsDiscoveryProvider } from './dataforseo-labs-discovery.provider';
import { DataForSeoMerchantProvider } from './dataforseo-merchant.provider';
import { KeywordResearchProvider } from './keyword.provider';
import { SearchResearchProvider } from './search.provider';
import { Sourcing1688ResearchProvider } from './sourcing-1688.provider';
import { SupplierResearchProvider } from './supplier.provider';
import { TrendResearchProvider } from './trend.provider';

export { AdsSignalResearchProvider } from './ads-signal.provider';
export { Apify1688Provider } from './apify-1688.provider';
export { ApifyCandidateDiscoveryProvider } from './apify-candidate-discovery.provider';
export { DataForSeoLabsDiscoveryProvider } from './dataforseo-labs-discovery.provider';
export { DataForSeoMerchantProvider } from './dataforseo-merchant.provider';
export { DajiSaasProvider } from './dajisaas.provider';
export { KeywordResearchProvider } from './keyword.provider';
export { MarketplaceResearchProvider } from './marketplace.provider';
export { SearchResearchProvider } from './search.provider';
export { Sourcing1688ResearchProvider } from './sourcing-1688.provider';
export { SupplierResearchProvider } from './supplier.provider';
export { TrendResearchProvider } from './trend.provider';

export function createDefaultResearchProviders(): ResearchProvider[] {
  return [
    new SearchResearchProvider(),
    new DataForSeoMerchantProvider(),
    // ApifyCandidateDiscoveryProvider expands marketplace discovery after
    // DataForSEO Merchant with configured marketplace/ads actors.
    new ApifyCandidateDiscoveryProvider(),
    new Sourcing1688ResearchProvider(),
    new TrendResearchProvider(),
    new DataForSeoLabsDiscoveryProvider(),
    new KeywordResearchProvider(),
    new AdsSignalResearchProvider(),
    new SupplierResearchProvider(),
  ];
}

export type { ResearchProvider, ResearchProviderCollectInput };
