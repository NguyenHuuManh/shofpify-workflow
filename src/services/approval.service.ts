/**
 * Purpose:
 * Business logic for the approval/review workflow.
 * Enforces the human-approval requirement before publishing.
 *
 * Responsibilities:
 * - Submit workflows for review
 * - Approve workflows (enables publishing)
 * - Reject workflows (returns to draft)
 * - Request changes on workflows
 * - Track all review decisions
 *
 * Dependencies:
 * - ApprovalRepository
 * - WorkflowRepository, WorkflowStepRepository
 * - ProductRepository
 * - AuditLogRepository
 * - Zod schemas (approval.schema)
 * - AppError, logger
 */

import { approvalRepository } from '@/repositories/approval.repository';
import { workflowRepository } from '@/repositories/workflow.repository';
import { productRepository } from '@/repositories/product.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';
import { validate } from '@/lib/validate';
import {
  submitForReviewSchema,
  approveSchema,
  rejectSchema,
  requestChangesSchema,
} from '@/schemas/approval.schema';
import type {
  SubmitForReviewInput,
  ApproveInput,
  RejectInput,
  RequestChangesInput,
} from '@/schemas/approval.schema';
import type { Approval } from '@prisma/client';
import type { ApprovalRepository } from '@/repositories/approval.repository';
import type { WorkflowRepository } from '@/repositories/workflow.repository';
import type { ProductRepository } from '@/repositories/product.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

export class ApprovalService {
  constructor(
    private readonly approvalRepo: ApprovalRepository = approvalRepository,
    private readonly workflowRepo: WorkflowRepository = workflowRepository,
    private readonly productRepo: ProductRepository = productRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Approval> {
    const approval = await this.approvalRepo.findById(id);
    if (!approval) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Approval '${id}' not found`,
        statusCode: 404,
      });
    }
    return approval;
  }

  async getByWorkflowId(workflowId: string): Promise<Approval[]> {
    return this.approvalRepo.findByWorkflowId(workflowId);
  }

  async getLatestDecision(workflowId: string): Promise<Approval | null> {
    return this.approvalRepo.findLatestByWorkflowId(workflowId);
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  /**
   * Submit a workflow for human review.
   * Validates workflow is in the REVIEW step.
   */
  async submitForReview(input: SubmitForReviewInput): Promise<Approval> {
    const parsed = validate(submitForReviewSchema, input);

    // Verify workflow exists and is at REVIEW step
    const workflow = await this.workflowRepo.findByIdOrThrow(parsed.workflowId);

    if (workflow.currentStep !== 'REVIEW') {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `Workflow is at step '${workflow.currentStep}', not REVIEW`,
        statusCode: 400,
      });
    }

    if (workflow.status !== 'RUNNING') {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `Workflow status is '${workflow.status}', not RUNNING`,
        statusCode: 400,
      });
    }

    // Update product to PENDING_REVIEW
    await this.productRepo.updateStatus(workflow.productId, 'PENDING_REVIEW');

    const approval = await this.approvalRepo.create({
      workflowId: parsed.workflowId,
      reviewerId: parsed.reviewerId,
      status: 'CHANGES_REQUESTED', // Initial state before decision
      comment: 'Submitted for review',
    });

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: parsed.workflowId,
      action: 'WORKFLOW_SUBMITTED_FOR_REVIEW',
      actorId: parsed.reviewerId,
    });

    logger.info({ workflowId: parsed.workflowId, reviewerId: parsed.reviewerId }, 'Workflow submitted for review');
    return approval;
  }

  /**
   * Approve a workflow.
   * Sets product to APPROVED, enabling publishing.
   */
  async approve(
    workflowId: string,
    reviewerId: string,
    input: ApproveInput = {},
  ): Promise<Approval> {
    const parsed = validate(approveSchema, input);

    // Verify workflow exists
    const workflow = await this.workflowRepo.findByIdOrThrow(workflowId);

    if (workflow.status !== 'RUNNING') {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `Cannot approve a workflow with status '${workflow.status}'`,
        statusCode: 400,
      });
    }

    const approval = await this.approvalRepo.create({
      workflowId,
      reviewerId,
      status: 'APPROVED',
      comment: parsed.comment,
    });

    // Update product to APPROVED
    await this.productRepo.updateStatus(workflow.productId, 'APPROVED');

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: 'REVIEW_APPROVED',
      actorId: reviewerId,
      metadata: { comment: parsed.comment },
    });

    logger.info({ workflowId, reviewerId }, 'Workflow approved');
    return approval;
  }

  /**
   * Reject a workflow.
   * Returns product to DRAFT. Reviewer must provide a reason.
   */
  async reject(
    workflowId: string,
    reviewerId: string,
    input: RejectInput,
  ): Promise<Approval> {
    const parsed = validate(rejectSchema, input);

    const workflow = await this.workflowRepo.findByIdOrThrow(workflowId);

    if (workflow.status !== 'RUNNING') {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `Cannot reject a workflow with status '${workflow.status}'`,
        statusCode: 400,
      });
    }

    const approval = await this.approvalRepo.create({
      workflowId,
      reviewerId,
      status: 'REJECTED',
      comment: parsed.comment,
    });

    // Return product to DRAFT
    await this.productRepo.updateStatus(workflow.productId, 'DRAFT');

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: 'REVIEW_REJECTED',
      actorId: reviewerId,
      metadata: { comment: parsed.comment },
    });

    logger.warn({ workflowId, reviewerId, reason: parsed.comment }, 'Workflow rejected');
    return approval;
  }

  /**
   * Request changes on a workflow.
   * Keeps product in PENDING_REVIEW.
   */
  async requestChanges(
    workflowId: string,
    reviewerId: string,
    input: RequestChangesInput,
  ): Promise<Approval> {
    const parsed = validate(requestChangesSchema, input);

    const workflow = await this.workflowRepo.findByIdOrThrow(workflowId);

    if (workflow.status !== 'RUNNING') {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `Cannot request changes on a workflow with status '${workflow.status}'`,
        statusCode: 400,
      });
    }

    const approval = await this.approvalRepo.create({
      workflowId,
      reviewerId,
      status: 'CHANGES_REQUESTED',
      comment: parsed.comment,
    });

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: 'REVIEW_CHANGES_REQUESTED',
      actorId: reviewerId,
      metadata: { comment: parsed.comment },
    });

    logger.info({ workflowId, reviewerId }, 'Changes requested on workflow');
    return approval;
  }
}

export const approvalService = new ApprovalService();
