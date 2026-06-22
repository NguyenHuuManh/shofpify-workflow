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
      'search',
      'marketplace',
      'sourcing',
      'trend',
      'keyword',
      'adsSignal',
      'supplier',
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

export const researchGenerationSchema = z.object({
  summary: z.string().min(1).max(4000),
  candidates: z.array(researchCandidateDraftSchema).min(1).max(10),
});

export const startResearchRunSchema = researchRunConfigSchema.partial();

export const createResearchProjectSchema = researchRunConfigSchema.partial().extend({
  query: z.string().min(1, 'Research query is required').max(255).trim(),
});

export const selectResearchCandidateSchema = z.object({
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  comment: z.string().max(2000).optional(),
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
export type ProviderEvidenceMetrics = z.infer<typeof providerEvidenceMetricsSchema>;
export type ResearchCandidateDraft = z.infer<typeof researchCandidateDraftSchema>;
export type ResearchGeneration = z.infer<typeof researchGenerationSchema>;
export type StartResearchRunInput = z.input<typeof startResearchRunSchema>;
export type CreateResearchProjectInput = z.input<typeof createResearchProjectSchema>;
export type SelectResearchCandidateInput = z.infer<typeof selectResearchCandidateSchema>;
