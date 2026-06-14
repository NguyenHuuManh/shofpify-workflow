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
