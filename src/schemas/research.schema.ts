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
});

export const candidateScorePayloadSchema = z.object({
  demandScore: z.coerce.number().min(0).max(100).optional(),
  trendScore: z.coerce.number().min(0).max(100).optional(),
  competitionScore: z.coerce.number().min(0).max(100).optional(),
  marginScore: z.coerce.number().min(0).max(100).optional(),
  supplierScore: z.coerce.number().min(0).max(100).optional(),
  creativePotentialScore: z.coerce.number().min(0).max(100).optional(),
  riskScore: z.coerce.number().min(0).max(100).optional(),
  recommendedPrice: z.coerce.number().positive().optional(),
  estimatedCOGS: z.coerce.number().nonnegative().optional(),
  estimatedShipping: z.coerce.number().nonnegative().optional(),
});

export const normalizedResearchSourceSchema = z.object({
  type: z.enum([
    'SEARCH',
    'MARKETPLACE',
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

export const researchCandidateDraftSchema = z.object({
  name: z.string().min(1).max(255),
  positioning: z.string().min(1).max(1000),
  targetMarket: z.string().min(1).max(80).optional(),
  sellingAngle: z.string().min(1).max(1000).optional(),
  recommendedPrice: z.coerce.number().positive().optional(),
  estimatedCOGS: z.coerce.number().nonnegative().optional(),
  estimatedShipping: z.coerce.number().nonnegative().optional(),
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

export type ResearchRunConfigInput = z.input<typeof researchRunConfigSchema>;
export type ResearchRunConfig = z.output<typeof researchRunConfigSchema>;
export type CandidateScorePayload = z.infer<typeof candidateScorePayloadSchema>;
export type NormalizedResearchSourceInput = z.infer<typeof normalizedResearchSourceSchema>;
export type ResearchCandidateDraft = z.infer<typeof researchCandidateDraftSchema>;
export type ResearchGeneration = z.infer<typeof researchGenerationSchema>;
export type StartResearchRunInput = z.infer<typeof startResearchRunSchema>;
export type CreateResearchProjectInput = z.infer<typeof createResearchProjectSchema>;
export type SelectResearchCandidateInput = z.infer<typeof selectResearchCandidateSchema>;
