/**
 * Purpose:
 * Zod validation schemas for Workflow service DTOs.
 * Validates workflow creation, transitions, and queries.
 *
 * Responsibilities:
 * - Validate workflow start input
 * - Validate step advancement
 *
 * Dependencies:
 * - zod
 */

import { z } from 'zod';

export const startWorkflowSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

export const workflowFilterSchema = z.object({
  status: z
    .enum(['PENDING', 'RUNNING', 'FAILED', 'COMPLETED', 'CANCELLED'])
    .optional(),
  currentStep: z
    .enum([
      'RESEARCH', 'RESEARCH_REVIEW',
      'CONTENT', 'CONTENT_REVIEW',
      'SEO', 'SEO_REVIEW',
      'LANDING', 'LANDING_REVIEW',
      'IMAGE', 'SHOPIFY',
      'REVIEW', 'FINAL_REVIEW', 'PUBLISH',
    ])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StartWorkflowInput = z.infer<typeof startWorkflowSchema>;
export type WorkflowFilter = z.infer<typeof workflowFilterSchema>;
