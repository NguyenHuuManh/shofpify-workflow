/**
 * Purpose:
 * Zod validation schemas for Product service DTOs.
 * Validates all inputs before reaching business logic.
 *
 * Responsibilities:
 * - Validate product creation input
 * - Validate product update input
 * - Validate status transitions
 *
 * Dependencies:
 * - zod
 */

import { z } from 'zod';

export const createProductSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be 255 characters or less')
    .trim(),
});

export const updateProductSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be 255 characters or less')
    .trim()
    .optional(),
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'])
    .optional(),
  workflowId: z.string().optional(),
});

export const productFilterSchema = z.object({
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'])
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilter = z.infer<typeof productFilterSchema>;

// -----------------------------------------------------------------------------
// Per-Step Content Edit Schemas
// -----------------------------------------------------------------------------

/**
 * Schema for editing AI-generated research data.
 * All fields are optional — only provided fields are updated.
 */
export const updateResearchSchema = z.object({
  targetAudience: z.array(z.record(z.unknown())).optional(),
  competitors: z.array(z.record(z.unknown())).optional(),
  painPoints: z.array(z.record(z.unknown())).optional(),
  usp: z.array(z.record(z.unknown())).optional(),
  marketSummary: z.string().max(2000).optional(),
});

/**
 * Schema for editing AI-generated product content.
 */
export const updateContentSchema = z.object({
  headline: z.string().min(1).max(255).optional(),
  subHeadline: z.string().max(255).optional().nullable(),
  description: z.string().min(1).max(5000).optional(),
  benefits: z.array(z.record(z.unknown())).optional(),
  features: z.array(z.record(z.unknown())).optional(),
  faq: z.array(z.record(z.unknown())).optional(),
});

/**
 * Schema for editing AI-generated SEO metadata.
 */
export const updateSeoSchema = z.object({
  metaTitle: z.string().min(1).max(70).optional(),
  metaDescription: z.string().min(1).max(160).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  keywords: z.array(z.string()).optional(),
});

/**
 * Schema for editing AI-generated landing page sections.
 */
export const updateLandingSchema = z.object({
  sections: z.union([
    z.array(
      z.object({
        type: z.enum(['hero', 'benefits', 'features', 'testimonials', 'faq', 'cta']),
        title: z.string().optional(),
        content: z.record(z.unknown()).optional(),
      }),
    ),
    z.record(z.unknown()),
  ]).optional(),
});

export type UpdateResearchInput = z.infer<typeof updateResearchSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type UpdateSEOInput = z.infer<typeof updateSeoSchema>;
export type UpdateLandingInput = z.infer<typeof updateLandingSchema>;
