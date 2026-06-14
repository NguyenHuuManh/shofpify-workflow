/**
 * Purpose:
 * Zod validation schemas for Approval service DTOs.
 * Validates review decisions.
 *
 * Responsibilities:
 * - Validate approval submission
 * - Validate approval decisions (approve/reject/changes)
 *
 * Dependencies:
 * - zod
 */

import { z } from 'zod';

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

export type SubmitForReviewInput = z.infer<typeof submitForReviewSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;
