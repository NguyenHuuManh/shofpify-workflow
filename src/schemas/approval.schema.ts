/**
 * Purpose:
 * Zod validation schemas for Approval service DTOs and per-step review operations.
 * All review inputs are validated before processing.
 *
 * Responsibilities:
 * - Validate approval submission
 * - Validate approval decisions (approve/reject/changes)
 * - Validate per-step review decisions (research, content, seo, landing, final)
 *
 * Dependencies:
 * - zod
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Full Workflow Review
// -----------------------------------------------------------------------------

export const submitForReviewSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
});

export const approveSchema = z.object({
  comment: z.string().max(1000, 'Comment must be 1000 characters or less').optional(),
});

export const rejectSchema = z.object({
  comment: z
    .string()
    .min(1, 'Rejection reason is required')
    .max(1000, 'Comment must be 1000 characters or less'),
});

export const requestChangesSchema = z.object({
  comment: z
    .string()
    .min(1, 'Changes description is required')
    .max(1000, 'Comment must be 1000 characters or less'),
});

// -----------------------------------------------------------------------------
// Per-Step Review Schemas
// -----------------------------------------------------------------------------

/**
 * Base schema for per-step review (approve or reject).
 * Used by all intermediate review gates: research, content, seo, landing, final.
 */
export const stepReviewSchema = z.object({
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(1000).optional(),
}).refine(
  (data) => data.decision === 'APPROVED' || (data.decision === 'REJECTED' && data.comment && data.comment.length > 0),
  { message: 'Comment is required when rejecting', path: ['comment'] },
);

export const reviewResearchSchema = stepReviewSchema;
export const reviewContentSchema = stepReviewSchema;
export const reviewSeoSchema = stepReviewSchema;
export const reviewLandingSchema = stepReviewSchema;
export const reviewFinalSchema = stepReviewSchema;

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type SubmitForReviewInput = z.infer<typeof submitForReviewSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;
export type StepReviewInput = z.infer<typeof stepReviewSchema>;
