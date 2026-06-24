/**
 * Purpose:
 * Zod schemas for Research Product Intelligence DTOs.
 *
 * Responsibilities:
 * - Validate research run configuration
 * - Validate normalized source evidence
 * - Validate candidate scoring payloads and candidate selection
 *
 * Dependencies:
 * - zod
 */

import { z } from 'zod';

export const researchRiskToleranceSchema = z.enum(['low', 'medium', 'high']);

export const supplementalProviderSchema = z.enum([
  'search',
  'marketplace',
  'sourcing',
  'trend',
  'keyword',
  'adsSignal',
  'supplier',
  'social',
]);

export const researchRunConfigSchema = z.object({
  targetMarket: z.string().min(2).max(80).default('US'),
  priceBand: z
    .object({
      min: z.coerce.number().nonnegative(),
      max: z.coerce.number().positive(),
    })
    .refine((value) => value.max >= value.min, {
      message: 'priceBand.max must be greater than or equal to priceBand.min',
    })
    .optional(),
  targetMarginPercent: z.coerce.number().min(0).max(95).default(40),
  riskTolerance: researchRiskToleranceSchema.default('medium'),
  excludedCategories: z.array(z.string().min(1)).default([]),
  objective: z.string().min(1).max(120).default('find_winning_product'),
  maxCandidates: z.coerce.number().int().min(1).max(20).default(5),
  maxDerivedQueries: z.coerce.number().int().min(0).max(10).default(5),
  sourcing: z
    .object({
      targetSource: z.enum(['1688']).default('1688'),
      targetCurrency: z.string().min(3).max(3).default('USD'),
      maxMoq: z.coerce.number().int().positive().optional(),
      landedCostAssumptions: z
        .object({
          agentFeePercent: z.coerce.number().min(0).max(100).optional(),
          internationalFreightPerUnit: z.coerce.number().nonnegative().optional(),
          customsDutyPercent: z.coerce.number().min(0).max(100).optional(),
          packagingPerUnit: z.coerce.number().nonnegative().optional(),
          qcPerUnit: z.coerce.number().nonnegative().optional(),
        })
        .default({}),
    })
    .default({
      targetSource: '1688',
      targetCurrency: 'USD',
      landedCostAssumptions: {},
    }),
  supplementalProviders: z
    .array(supplementalProviderSchema)
    .default([
      'marketplace',
      'trend',
      'keyword',
      'adsSignal',
      'social',
    ]),
});

export const candidateScorePayloadSchema = z.object({
  demandScore: z.coerce.number().min(0).max(100).optional(),
  trendScore: z.coerce.number().min(0).max(100).optional(),
  competitionScore: z.coerce.number().min(0).max(100).optional(),
  marginScore: z.coerce.number().min(0).max(100).optional(),
  supplierScore: z.coerce.number().min(0).max(100).optional(),
  sourcingScore: z.coerce.number().min(0).max(100).optional(),
  factoryCostScore: z.coerce.number().min(0).max(100).optional(),
  logisticsScore: z.coerce.number().min(0).max(100).optional(),
  creativePotentialScore: z.coerce.number().min(0).max(100).optional(),
  riskScore: z.coerce.number().min(0).max(100).optional(),
  recommendedPrice: z.coerce.number().positive().optional(),
  estimatedCOGS: z.coerce.number().nonnegative().optional(),
  estimatedShipping: z.coerce.number().nonnegative().optional(),
  landedCost: z.coerce.number().nonnegative().optional(),
});

export const normalizedResearchSourceSchema = z.object({
  type: z.enum([
    'SEARCH',
    'MARKETPLACE',
    'SOURCING',
    'TREND',
    'KEYWORD',
    'ADS_SIGNAL',
    'SUPPLIER',
    'SOCIAL',
    'AI_ESTIMATE',
  ]),
  provider: z.string().min(1).max(120),
  url: z.string().url().optional(),
  externalId: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  extractedSignal: z.string().min(1).max(2000),
  rawData: z.record(z.unknown()).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  capturedAt: z.coerce.date().default(() => new Date()),
});

export const apifyCandidateSourceTypeSchema = z.enum([
  'MARKETPLACE',
  'SEARCH',
  'TREND',
  'ADS_SIGNAL',
]);

export const apifyCandidateProviderTypeSchema = z.enum([
  'marketplace',
  'search',
  'trend',
  'adsSignal',
]);

export const apifyCandidateActorConfigSchema = z.object({
  actorId: z.string().min(1),
  label: z.string().min(1).max(120).optional(),
  sourceType: apifyCandidateSourceTypeSchema.default('MARKETPLACE'),
  providerType: apifyCandidateProviderTypeSchema.optional(),
  input: z.record(z.unknown()).optional(),
  maxItems: z.coerce.number().int().min(1).max(25).default(10),
});

export const apifyCandidateActorConfigsSchema = z
  .array(apifyCandidateActorConfigSchema)
  .default([]);

export const providerEvidenceMetricsSchema = z.object({
  demandSignal: z.coerce.number().min(0).max(100).optional(),
  trendSignal: z.coerce.number().min(0).max(100).optional(),
  competitionSignal: z.coerce.number().min(0).max(100).optional(),
  supplierSignal: z.coerce.number().min(0).max(100).optional(),
  sourcingSignal: z.coerce.number().min(0).max(100).optional(),
  factoryCostSignal: z.coerce.number().min(0).max(100).optional(),
  logisticsSignal: z.coerce.number().min(0).max(100).optional(),
  creativeSignal: z.coerce.number().min(0).max(100).optional(),
  riskSignal: z.coerce.number().min(0).max(100).optional(),
  price: z.coerce.number().positive().optional(),
  productCost: z.coerce.number().nonnegative().optional(),
  shippingCost: z.coerce.number().nonnegative().optional(),
  factoryUnitCost: z.coerce.number().nonnegative().optional(),
  landedCost: z.coerce.number().nonnegative().optional(),
  moq: z.coerce.number().int().positive().optional(),
  reviewCount: z.coerce.number().int().nonnegative().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  searchVolume: z.coerce.number().int().nonnegative().optional(),
  cpc: z.coerce.number().nonnegative().optional(),
});

export const researchCollectionStageSchema = z.enum([
  'query_intelligence',
  'candidate_discovery',
  'candidate_enrichment',
  'sourcing',
]);

export const queryIntelligenceSourceTypeSchema = z.enum(['TREND', 'KEYWORD', 'SEARCH']);

export const queryIntelligenceCandidateSchema = z.object({
  query: z.string().min(1).max(255),
  sourceTypes: z.array(queryIntelligenceSourceTypeSchema).min(1),
  providers: z.array(z.string().min(1)).min(1),
  searchVolume: z.coerce.number().int().nonnegative().optional(),
  trendScore: z.coerce.number().min(0).max(100).optional(),
  cpc: z.coerce.number().nonnegative().optional(),
  competitionScore: z.coerce.number().min(0).max(100).optional(),
  buyerIntentScore: z.coerce.number().min(0).max(100),
  relevanceScore: z.coerce.number().min(0).max(100),
  riskScore: z.coerce.number().min(0).max(100).optional(),
  score: z.coerce.number().min(0).max(100),
  reason: z.string().min(1).max(500),
});

export const selectedDiscoveryQuerySchema = z.object({
  query: z.string().min(1).max(255),
  source: z.enum(['SEED_QUERY', 'QUERY_INTELLIGENCE']),
  sourceTypes: z.array(queryIntelligenceSourceTypeSchema).default([]),
  score: z.coerce.number().min(0).max(100),
  reason: z.string().min(1).max(500),
});

export const queryIntelligenceResultSchema = z.object({
  seedQuery: z.string().min(1).max(255),
  selectedQueries: z.array(selectedDiscoveryQuerySchema).min(1),
  candidateQueries: z.array(queryIntelligenceCandidateSchema).default([]),
});

export const researchCandidateDraftSchema = z.object({
  name: z.string().min(1).max(255),
  positioning: z.string().min(1).max(1000),
  targetMarket: z.string().min(1).max(80).optional(),
  sellingAngle: z.string().min(1).max(1000).optional(),
  recommendedPrice: z.coerce.number().positive().optional(),
  estimatedCOGS: z.coerce.number().nonnegative().optional(),
  estimatedShipping: z.coerce.number().nonnegative().optional(),
  factoryUnitCost: z.coerce.number().nonnegative().optional(),
  moq: z.coerce.number().int().positive().optional(),
  landedCost: z.coerce.number().nonnegative().optional(),
  landedCostBreakdown: z.record(z.unknown()).optional(),
  scores: candidateScorePayloadSchema.partial().optional(),
  confidence: z.enum(['low', 'medium', 'high']).default('low'),
  risks: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export const productAggregationSourceSchema = normalizedResearchSourceSchema.extend({
  sourceKey: z.string().min(1).max(500),
});

export const productAggregationMergedMetricsSchema = z.object({
  demandSignal: z.coerce.number().min(0).max(100).optional(),
  medianPrice: z.coerce.number().positive().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  ratingAverage: z.coerce.number().min(0).max(5).optional(),
  reviewCountTotal: z.coerce.number().int().nonnegative().optional(),
  orderCountTotal: z.coerce.number().int().nonnegative().optional(),
  sourceCount: z.coerce.number().int().positive(),
});

export const productAggregationGroupSchema = z.object({
  groupId: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  sourceKeys: z.array(z.string().min(1)).min(1),
  method: z.enum(['ai_grouping', 'deterministic_dedup']),
  rationale: z.string().max(1000).optional(),
  mergedMetrics: productAggregationMergedMetricsSchema,
});

export const productAggregationAiOutputSchema = z.object({
  groups: z.array(
    z.object({
      name: z.string().min(1).max(255),
      sourceKeys: z.array(z.string().min(1)).min(1),
      rationale: z.string().max(1000).optional(),
    }),
  ),
});

export const researchGenerationSchema = z.object({
  summary: z.string().min(1).max(4000),
  candidates: z.array(researchCandidateDraftSchema).min(1).max(10),
});

export const startResearchRunSchema = researchRunConfigSchema.partial();

export const createResearchProjectSchema = researchRunConfigSchema.partial().extend({
  query: z.string().min(1, 'Research query is required').max(255).trim(),
});

export const discoveryQueryPlanItemSchema = z.object({
  query: z.string().min(2).max(120),
  angle: z.string().min(1).max(240),
  rationale: z.string().min(1).max(500),
});

export const discoveryQueryPlanSchema = z.object({
  queries: z.array(discoveryQueryPlanItemSchema).min(1).max(12),
});

export const autonomousDiscoveryJobSchema = researchRunConfigSchema.extend({
  seedQuery: z.string().trim().min(2).max(255).optional(),
  maxQueries: z.coerce.number().int().min(1).max(12).default(6),
});

export const discoveryJobResultSchema = z.object({
  queryCount: z.number().int().nonnegative(),
  runCount: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  sourceCount: z.number().int().nonnegative(),
  topCandidates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        winningScore: z.number().int().nullable(),
        researchRunId: z.string(),
      }),
    )
    .default([]),
});

export const selectResearchCandidateSchema = z.object({
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  comment: z.string().max(2000).optional(),
});

export const sourceMatchStatusSchema = z.enum([
  'LIKELY_MATCH',
  'POTENTIAL_MATCH',
  'WEAK_MATCH',
  'NOT_A_MATCH',
  'INSUFFICIENT_EVIDENCE',
]);

export const sourceMatchRecommendedActionSchema = z.enum([
  'LINK_AS_SOURCING_MATCH',
  'REVIEW_BEFORE_LINKING',
  'KEEP_SEPARATE',
  'FIND_BETTER_SOURCING_MATCH',
]);

export const sourceMatchReviewerDecisionSchema = z.enum([
  'CONFIRMED_MATCH',
  'REJECTED_MATCH',
  'NEEDS_BETTER_SOURCE',
]);

export const sourceMatchReviewRequestSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(2).max(8),
  reviewerMode: z.enum(['draft', 'final']).default('draft'),
});

export const sourceMatchAiMatchSchema = z.object({
  sourceId: z.string().min(1),
  matchedSourceId: z.string().min(1),
  matchStatus: sourceMatchStatusSchema,
  confidenceScore: z.coerce.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1).max(500)).default([]),
  warnings: z.array(z.string().min(1).max(500)).default([]),
  recommendedAction: sourceMatchRecommendedActionSchema,
});

export const sourceMatchAiOutputSchema = z.object({
  matches: z.array(sourceMatchAiMatchSchema).default([]),
});

export const sourceMatchResultSchema = sourceMatchAiMatchSchema.extend({
  id: z.string().min(1),
  reviewerDecision: sourceMatchReviewerDecisionSchema.nullable().default(null),
  reviewerId: z.string().min(1).optional(),
  reviewerComment: z.string().max(2000).optional(),
  reviewedAt: z.string().datetime(),
  decidedAt: z.string().datetime().optional(),
});

export const sourceMatchDecisionSchema = z.object({
  decision: sourceMatchReviewerDecisionSchema,
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  comment: z.string().max(2000).optional(),
});

export const candidateSourcingModeSchema = z.enum(['agent_search', 'manual_url']);

export const candidateSourcingRequestSchema = z
  .object({
    mode: candidateSourcingModeSchema.default('agent_search'),
    sourcingUrl: z.string().url().optional(),
    query: z.string().trim().min(1).max(255).optional(),
  })
  .refine((value) => value.mode !== 'manual_url' || Boolean(value.sourcingUrl), {
    message: 'sourcingUrl is required when mode is manual_url',
    path: ['sourcingUrl'],
  })
  .refine(
    (value) =>
      !value.sourcingUrl ||
      /^https?:\/\/([^/]+\.)?1688\.com\/|^https?:\/\/detail\.1688\.com\//iu.test(
        value.sourcingUrl,
      ),
    {
      message: 'sourcingUrl must be a 1688 URL',
      path: ['sourcingUrl'],
    },
  );

// ---------------------------------------------------------------------------
// Sourcing Verification Workflow schemas
// ---------------------------------------------------------------------------

export const sourcingVerificationStatusSchema = z.enum([
  'UNVERIFIED',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'NEEDS_MORE_INFO',
]);

export const sourcingVerificationUpdateSchema = z.object({
  status: sourcingVerificationStatusSchema,
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  notes: z.string().max(2000).optional(),
  factoryExists: z.boolean().optional(),
  moqConfirmed: z.boolean().optional(),
  priceReasonable: z.boolean().optional(),
  sampleAvailable: z.boolean().optional(),
  shippingFeasible: z.boolean().optional(),
  supplierResponsive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// 1688 Sourcing Provider — vendor response schemas
// ---------------------------------------------------------------------------

export const dajiSaasKeywordSearchItemSchema = z
  .object({
    offerId: z.union([z.number(), z.string()]),
    imageUrl: z.string().optional(),
    subject: z.string().min(1),
    subjectTrans: z.string().optional(),
    isJxhy: z.boolean().optional(),
    priceInfo: z
      .object({
        price: z.union([z.number(), z.string()]),
        jxhyPrice: z.union([z.number(), z.string()]).nullish(),
        pfJxhyPrice: z.union([z.number(), z.string()]).nullish(),
        consignPrice: z.union([z.number(), z.string()]).nullish(),
      })
      .passthrough(),
    repurchaseRate: z.string().optional(),
    monthSold: z.number().int().nonnegative().optional(),
    traceInfo: z.string().optional(),
    isOnePsale: z.boolean().optional(),
    sellerIdentities: z.array(z.string()).optional(),
  })
  .passthrough();

export const dajiSaasSearchResponseSchema = z
  .object({
    code: z.number(),
    message: z.string(),
    data: z.object({
      totalRecords: z.number().int().nonnegative().optional(),
      totalPage: z.number().int().nonnegative().optional(),
      pageSize: z.number().int().positive().optional(),
      currentPage: z.number().int().positive().optional(),
      data: z.array(dajiSaasKeywordSearchItemSchema),
    }),
    timestamp: z.number().optional(),
    traceId: z.string().optional(),
  })
  .passthrough();

const dajiSaasPriceRangeSchema = z
  .object({
    startQuantity: z.union([z.number(), z.string()]),
    price: z.union([z.number(), z.string()]),
    promotionPrice: z.union([z.number(), z.string()]).nullish(),
  })
  .passthrough();

export const dajiSaasProductDetailSchema = z
  .object({
    code: z.number(),
    message: z.string(),
    data: z
      .object({
        offerId: z.union([z.number(), z.string()]),
        categoryId: z.union([z.number(), z.string()]).optional(),
        categoryName: z.string().nullish(),
        subject: z.string().optional(),
        subjectTrans: z.string().optional(),
        description: z.string().optional(),
        productImage: z
          .object({ images: z.array(z.string()) })
          .partial()
          .optional(),
        productAttribute: z.array(z.record(z.unknown())).optional(),
        productSkuInfos: z.array(z.record(z.unknown())).optional(),
        productSaleInfo: z
          .object({
            priceRangeList: z.array(dajiSaasPriceRangeSchema).optional(),
            amountOnSale: z.number().int().nonnegative().optional(),
            quoteType: z.number().int().optional(),
            consignPrice: z.union([z.number(), z.string()]).nullish(),
          })
          .passthrough()
          .optional(),
        productShippingInfo: z
          .object({
            sendGoodsAddressText: z.string().optional(),
            weight: z.union([z.number(), z.string()]).nullish(),
            width: z.union([z.number(), z.string()]).nullish(),
            height: z.union([z.number(), z.string()]).nullish(),
            length: z.union([z.number(), z.string()]).nullish(),
            shippingTimeGuarantee: z.string().optional(),
            skuShippingDetails: z.array(z.record(z.unknown())).optional(),
          })
          .passthrough()
          .optional(),
        minOrderQuantity: z.union([z.number(), z.string()]).optional(),
        sellerOpenId: z.string().optional(),
        tagInfoList: z.array(z.record(z.unknown())).optional(),
        sellerDataInfo: z.record(z.unknown()).optional(),
        soldOut: z.number().int().nonnegative().optional(),
        sellerIdentities: z.array(z.string()).optional(),
      })
      .passthrough(),
    timestamp: z.number().optional(),
    traceId: z.string().optional(),
  })
  .passthrough();

export const apify1688DatasetItemSchema = z
  .object({
    offerId: z.union([z.number(), z.string()]).optional(),
    offer_id: z.union([z.number(), z.string()]).optional(),
    id: z.union([z.number(), z.string()]).optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    subject: z.string().optional(),
    price: z
      .union([
        z.number(),
        z.string(),
        z
          .object({
            min: z.union([z.number(), z.string()]).optional(),
            max: z.union([z.number(), z.string()]).optional(),
            currency: z.string().optional(),
            priceType: z.string().optional(),
          })
          .passthrough(),
      ])
      .optional(),
    moq: z.union([z.number(), z.string()]).optional(),
    minOrderQuantity: z.union([z.number(), z.string()]).optional(),
    min_order_quantity: z.union([z.number(), z.string()]).optional(),
    url: z.string().optional(),
    productUrl: z.string().optional(),
    product_url: z.string().optional(),
    detailUrl: z.string().optional(),
    detail_url: z.string().optional(),
    shopName: z.string().optional(),
    shop_name: z.string().optional(),
    supplier: z
      .union([
        z.string(),
        z
          .object({
            companyName: z.string().optional(),
            legalCompanyName: z.string().optional(),
            shopUrl: z.string().optional(),
          })
          .passthrough(),
      ])
      .optional(),
    seller: z.string().optional(),
    location: z.string().optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    leadTime: z.string().optional(),
    lead_time: z.string().optional(),
    shippingCost: z.union([z.number(), z.string()]).optional(),
    domesticChinaShipping: z.union([z.number(), z.string()]).optional(),
    shipping: z
      .union([
        z.number(),
        z.string(),
        z
          .object({
            postFee: z.union([z.number(), z.string()]).optional(),
            deliveryDays: z.union([z.number(), z.string()]).optional(),
            deliveryHours: z.union([z.number(), z.string()]).optional(),
            location: z.string().optional(),
          })
          .passthrough(),
      ])
      .optional(),
    tieredPrices: z.array(z.record(z.unknown())).optional(),
    tiered_prices: z.array(z.record(z.unknown())).optional(),
    quantityPrices: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough()
  .refine(
    (item) =>
      Boolean(item.offerId ?? item.offer_id ?? item.id) &&
      Boolean(item.title ?? item.name ?? item.subject),
    { message: 'Apify item requires an external ID and title' },
  );

export type DajiSaasSearchItem = z.infer<typeof dajiSaasKeywordSearchItemSchema>;
export type DajiSaasSearchResponse = z.infer<typeof dajiSaasSearchResponseSchema>;
export type DajiSaasProductDetail = z.infer<typeof dajiSaasProductDetailSchema>;

export type ResearchRunConfigInput = z.input<typeof researchRunConfigSchema>;
export type ResearchRunConfig = z.output<typeof researchRunConfigSchema>;
export type SupplementalProviderName = z.infer<typeof supplementalProviderSchema>;
export type CandidateScorePayload = z.infer<typeof candidateScorePayloadSchema>;
export type NormalizedResearchSourceInput = z.infer<typeof normalizedResearchSourceSchema>;
export type ApifyCandidateSourceType = z.infer<typeof apifyCandidateSourceTypeSchema>;
export type ApifyCandidateActorConfig = z.infer<typeof apifyCandidateActorConfigSchema>;
export type ProviderEvidenceMetrics = z.infer<typeof providerEvidenceMetricsSchema>;
export type ResearchCollectionStage = z.infer<typeof researchCollectionStageSchema>;
export type QueryIntelligenceSourceType = z.infer<typeof queryIntelligenceSourceTypeSchema>;
export type QueryIntelligenceCandidate = z.infer<typeof queryIntelligenceCandidateSchema>;
export type SelectedDiscoveryQuery = z.infer<typeof selectedDiscoveryQuerySchema>;
export type QueryIntelligenceResult = z.infer<typeof queryIntelligenceResultSchema>;
export type ResearchCandidateDraft = z.infer<typeof researchCandidateDraftSchema>;
export type ProductAggregationSource = z.infer<typeof productAggregationSourceSchema>;
export type ProductAggregationMergedMetrics = z.infer<typeof productAggregationMergedMetricsSchema>;
export type ProductAggregationGroup = z.infer<typeof productAggregationGroupSchema>;
export type ProductAggregationAiOutput = z.infer<typeof productAggregationAiOutputSchema>;
export type ResearchGeneration = z.infer<typeof researchGenerationSchema>;
export type StartResearchRunInput = z.input<typeof startResearchRunSchema>;
export type CreateResearchProjectInput = z.input<typeof createResearchProjectSchema>;
export type DiscoveryQueryPlan = z.infer<typeof discoveryQueryPlanSchema>;
export type DiscoveryQueryPlanItem = z.infer<typeof discoveryQueryPlanItemSchema>;
export type AutonomousDiscoveryJobInput = z.input<typeof autonomousDiscoveryJobSchema>;
export type AutonomousDiscoveryJobConfig = z.output<typeof autonomousDiscoveryJobSchema>;
export type DiscoveryJobResult = z.infer<typeof discoveryJobResultSchema>;
export type SelectResearchCandidateInput = z.infer<typeof selectResearchCandidateSchema>;
export type SourceMatchReviewRequestInput = z.input<typeof sourceMatchReviewRequestSchema>;
export type SourceMatchAiOutput = z.infer<typeof sourceMatchAiOutputSchema>;
export type SourceMatchResult = z.infer<typeof sourceMatchResultSchema>;
export type SourceMatchDecisionInput = z.infer<typeof sourceMatchDecisionSchema>;
export type CandidateSourcingRequestInput = z.input<typeof candidateSourcingRequestSchema>;
export type CandidateSourcingRequest = z.output<typeof candidateSourcingRequestSchema>;
export type SourcingVerificationStatus = z.infer<typeof sourcingVerificationStatusSchema>;
export type SourcingVerificationUpdateInput = z.input<typeof sourcingVerificationUpdateSchema>;
export type SourcingVerificationUpdate = z.output<typeof sourcingVerificationUpdateSchema>;
