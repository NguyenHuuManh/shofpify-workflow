/**
 * Purpose:
 * Business logic for workflow orchestration.
 * Manages the lifecycle of product creation workflows.
 *
 * Responsibilities:
 * - Start new workflows
 * - Advance workflow through agent steps
 * - Complete or fail workflows
 * - Track workflow state transitions
 *
 * Dependencies:
 * - WorkflowRepository, WorkflowStepRepository
 * - ProductRepository
 * - AuditLogRepository
 * - Zod schemas (workflow.schema)
 * - AppError, logger
 */

import { workflowRepository } from '@/repositories/workflow.repository';
import { workflowStepRepository } from '@/repositories/workflow-step.repository';
import { productRepository } from '@/repositories/product.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { BaseRepository } from '@/repositories/base.repository';
import { logger } from '@/lib/logger';
import { AppError, ErrorCodes } from '@/lib/errors';
import { validate } from '@/lib/validate';
import { startWorkflowSchema, workflowFilterSchema } from '@/schemas/workflow.schema';
import type { StartWorkflowInput, WorkflowFilter } from '@/schemas/workflow.schema';
import type {
  Workflow,
  WorkflowStep,
  WorkflowStepType,
} from '@prisma/client';
import type { WorkflowRepository } from '@/repositories/workflow.repository';
import type { WorkflowStepRepository } from '@/repositories/workflow-step.repository';
import type { ProductRepository } from '@/repositories/product.repository';
import type { AuditLogRepository } from '@/repositories/audit-log.repository';

/**
 * Ordered sequence of workflow steps matching the product creation pipeline
 * with intermediate review gates after each generation step.
 */
const WORKFLOW_STEP_SEQUENCE: WorkflowStepType[] = [
  'RESEARCH',
  'RESEARCH_REVIEW',
  'CONTENT',
  'CONTENT_REVIEW',
  'SEO',
  'SEO_REVIEW',
  'LANDING',
  'LANDING_REVIEW',
  'IMAGE',
  'SHOPIFY',
  'FINAL_REVIEW',
  'PUBLISH',
];

export class WorkflowService {
  constructor(
    private readonly workflowRepo: WorkflowRepository = workflowRepository,
    private readonly stepRepo: WorkflowStepRepository = workflowStepRepository,
    private readonly productRepo: ProductRepository = productRepository,
    private readonly auditRepo: AuditLogRepository = auditLogRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Workflow> {
    return this.workflowRepo.findByIdOrThrow(id, { includeRelated: true });
  }

  async getByProductId(productId: string): Promise<Workflow | null> {
    return this.workflowRepo.findByProductId(productId);
  }

  async list(
    filter: WorkflowFilter,
  ): Promise<{ workflows: Workflow[]; total: number }> {
    const parsed = validate(workflowFilterSchema, filter);
    const skip = (parsed.page - 1) * parsed.limit;

    const [workflows, total] = await Promise.all([
      this.workflowRepo.findMany({
        status: parsed.status,
        currentStep: parsed.currentStep,
        skip,
        take: parsed.limit,
      }),
      this.workflowRepo.count({ status: parsed.status }),
    ]);

    return { workflows, total };
  }

  async getSteps(workflowId: string): Promise<WorkflowStep[]> {
    // Verify workflow exists
    await this.workflowRepo.findByIdOrThrow(workflowId);
    return this.stepRepo.findByWorkflowId(workflowId);
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  /**
   * Start a new workflow for a product.
   * Creates the workflow and all steps in sequence.
   */
  async start(input: StartWorkflowInput, actorId?: string): Promise<Workflow> {
    const parsed = validate(startWorkflowSchema, input);

    // Verify product exists and is in DRAFT status
    const product = await this.productRepo.findByIdOrThrow(parsed.productId);

    // Check no active workflow exists for this product
    const existing = await this.workflowRepo.findByProductId(parsed.productId);
    if (existing && (existing.status === 'PENDING' || existing.status === 'RUNNING')) {
      throw new AppError({
        code: ErrorCodes.WORKFLOW_ALREADY_RUNNING,
        message: `An active workflow already exists for product '${product.title}'`,
        statusCode: 409,
      });
    }

    // Create workflow and all steps in a transaction
    const workflow = await BaseRepository.transaction(async (tx) => {
      const wf = await this.workflowRepo.create(
        {
          productId: parsed.productId,
          currentStep: 'RESEARCH',
          userId: actorId,
        },
        tx,
      );

      // Create all steps upfront
      for (const stepType of WORKFLOW_STEP_SEQUENCE) {
        await this.stepRepo.create(
          {
            workflowId: wf.id,
            step: stepType,
          },
          tx,
        );
      }

      // Update product status to IN_PROGRESS
      await this.productRepo.updateStatus(parsed.productId, 'IN_PROGRESS', tx);

      return wf;
    });

    // Mark first step as running
    await this.advanceToNextStep(workflow.id);

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflow.id,
      action: 'WORKFLOW_STARTED',
      actorId,
      metadata: { productId: parsed.productId },
    });

    logger.info({ workflowId: workflow.id, productId: parsed.productId }, 'Workflow started');
    return this.workflowRepo.findByIdOrThrow(workflow.id, { includeRelated: true });
  }

  /**
   * Advance the workflow to the next step in the sequence.
   */
  async advanceToNextStep(workflowId: string): Promise<WorkflowStep | null> {
    await this.workflowRepo.findByIdOrThrow(workflowId);
    const steps = await this.stepRepo.findByWorkflowId(workflowId);

    // Find current running/pending step
    const currentStep = steps.find((s) => s.status === 'RUNNING');
    if (currentStep) {
      return currentStep;
    }

    // Find next pending step
    const nextStep = steps.find((s) => s.status === 'PENDING');
    if (!nextStep) {
      // No more steps - workflow is complete
      await this.complete(workflowId);
      return null;
    }

    // Mark next step as running
    const activated = await this.stepRepo.markRunning(nextStep.id);

    // Update workflow current step
    await this.workflowRepo.updateCurrentStep(workflowId, nextStep.step);

    logger.info(
      { workflowId, step: nextStep.step },
      'Workflow advanced to next step',
    );
    return activated;
  }

  /**
   * Mark the current step as completed and advance.
   */
  async completeCurrentStep(workflowId: string): Promise<WorkflowStep | null> {
    await this.workflowRepo.findByIdOrThrow(workflowId);
    const steps = await this.stepRepo.findByWorkflowId(workflowId);

    const currentStep = steps.find((s) => s.status === 'RUNNING');
    if (!currentStep) {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `No running step found for workflow '${workflowId}'`,
        statusCode: 400,
      });
    }

    // Complete current step
    await this.stepRepo.markCompleted(currentStep.id);

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: `WORKFLOW_STEP_COMPLETED_${currentStep.step}`,
      metadata: { step: currentStep.step },
    });

    logger.info(
      { workflowId, step: currentStep.step },
      'Workflow step completed',
    );

    // Advance to next
    return this.advanceToNextStep(workflowId);
  }

  /**
   * Mark the current step as failed.
   */
  async failCurrentStep(
    workflowId: string,
    errorMessage: string,
  ): Promise<WorkflowStep> {
    await this.workflowRepo.findByIdOrThrow(workflowId);
    const steps = await this.stepRepo.findByWorkflowId(workflowId);

    const currentStep = steps.find((s) => s.status === 'RUNNING');
    if (!currentStep) {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `No running step found for workflow '${workflowId}'`,
        statusCode: 400,
      });
    }

    const failed = await this.stepRepo.markFailed(currentStep.id, errorMessage);

    await this.workflowRepo.updateStatus(workflowId, 'FAILED');

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: `WORKFLOW_STEP_FAILED_${currentStep.step}`,
      metadata: { step: currentStep.step, error: errorMessage },
    });

    logger.error(
      { workflowId, step: currentStep.step, error: errorMessage },
      'Workflow step failed',
    );

    return failed;
  }

  /**
   * Mark the workflow as completed successfully.
   */
  async complete(workflowId: string): Promise<Workflow> {
    const workflow = await this.workflowRepo.updateStatus(workflowId, 'COMPLETED');

    // Update product status
    await this.productRepo.updateStatus(workflow.productId, 'PUBLISHED');

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: 'WORKFLOW_COMPLETED',
      metadata: { productId: workflow.productId },
    });

    logger.info({ workflowId }, 'Workflow completed');
    return workflow;
  }

  /**
   * Record a per-step review decision (approve or reject).
   * Called by the API after a human reviews a specific step.
   *
   * On approve: advances to the next step in the sequence.
   * On reject:  returns to the preceding generating step for rework,
   *             or rejects the entire workflow if max reworks exceeded.
   */
  async reviewStep(
    workflowId: string,
    reviewStep: WorkflowStepType,
    decision: 'APPROVED' | 'REJECTED',
    reviewerId: string,
    comment?: string,
  ): Promise<{ nextStep: WorkflowStepType | null; reworkCount: number }> {
    await this.workflowRepo.findByIdOrThrow(workflowId);
    const steps = await this.stepRepo.findByWorkflowId(workflowId);

    const currentStep = steps.find((s) => s.step === reviewStep);
    if (!currentStep) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Review step '${reviewStep}' not found in workflow '${workflowId}'`,
        statusCode: 404,
      });
    }

    const reworkCount = (currentStep.metadata as Record<string, unknown> | null)?.reworkCount as number ?? 0;

    if (decision === 'APPROVED') {
      // Complete the review step
      await this.stepRepo.markCompleted(currentStep.id);

      await this.auditRepo.create({
        entityType: 'Workflow',
        entityId: workflowId,
        action: `STEP_REVIEW_APPROVED_${reviewStep}`,
        actorId: reviewerId,
        metadata: { step: reviewStep, comment },
      });

      // Advance to next step
      const next = await this.advanceToNextStep(workflowId);
      logger.info({ workflowId, reviewStep, nextStep: next?.step }, 'Step review approved, advancing');

      return { nextStep: next?.step ?? null, reworkCount };
    }

    // REJECTED — determine rework or final rejection
    const MAX_REWORKS = 3;
    const newReworkCount = reworkCount + 1;

    if (newReworkCount >= MAX_REWORKS) {
      // Max reworks exceeded — reject entire workflow
      await this.stepRepo.markFailed(currentStep.id, `Rejected after ${newReworkCount} reworks`);
      await this.workflowRepo.updateStatus(workflowId, 'FAILED');

      await this.auditRepo.create({
        entityType: 'Workflow',
        entityId: workflowId,
        action: `STEP_REVIEW_MAX_REWORKS_${reviewStep}`,
        actorId: reviewerId,
        metadata: { step: reviewStep, reworkCount: newReworkCount, comment },
      });

      logger.warn({ workflowId, reviewStep, reworkCount: newReworkCount }, 'Max reworks exceeded — workflow rejected');
      return { nextStep: null, reworkCount: newReworkCount };
    }

    // Rework — reset to the preceding generating step
    const generatingStep = this.getGeneratingStepForReview(reviewStep);
    if (!generatingStep) {
      throw new AppError({
        code: ErrorCodes.INVALID_WORKFLOW_TRANSITION,
        message: `No generating step found for review step '${reviewStep}'`,
        statusCode: 400,
      });
    }

    // Reset the generating step to PENDING so it runs again
    const genStepRecord = steps.find((s) => s.step === generatingStep);
    if (genStepRecord) {
      await this.stepRepo.resetToPending(genStepRecord.id, newReworkCount);
    }

    // Mark review step for rework
    await this.stepRepo.markFailed(currentStep.id, `Rejected — reworking (attempt ${newReworkCount}/${MAX_REWORKS})`);

    // Reset the review step for next attempt
    await this.stepRepo.resetToPending(currentStep.id, newReworkCount);

    // Update workflow current step back to the generating step
    await this.workflowRepo.updateCurrentStep(workflowId, generatingStep);

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: `STEP_REVIEW_REJECTED_${reviewStep}`,
      actorId: reviewerId,
      metadata: { step: reviewStep, reworkCount: newReworkCount, comment },
    });

    logger.info({ workflowId, reviewStep, reworkCount: newReworkCount, returningTo: generatingStep }, 'Step rejected — reworking');

    return { nextStep: generatingStep, reworkCount: newReworkCount };
  }

  /**
   * Map a review step to its preceding generating step (for rework loops).
   */
  private getGeneratingStepForReview(reviewStep: WorkflowStepType): WorkflowStepType | null {
    const map: Partial<Record<WorkflowStepType, WorkflowStepType>> = {
      RESEARCH_REVIEW: 'RESEARCH',
      CONTENT_REVIEW: 'CONTENT',
      SEO_REVIEW: 'SEO',
      LANDING_REVIEW: 'LANDING',
      FINAL_REVIEW: 'SHOPIFY',
    };
    return map[reviewStep] ?? null;
  }

  /**
   * Cancel the workflow.
   */
  async cancel(workflowId: string, actorId?: string): Promise<Workflow> {
    const workflow = await this.workflowRepo.updateStatus(workflowId, 'CANCELLED');

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: 'WORKFLOW_CANCELLED',
      actorId,
    });

    logger.info({ workflowId }, 'Workflow cancelled');
    return workflow;
  }

  /**
   * Delete the workflow and all related records.
   */
  async delete(workflowId: string, actorId?: string): Promise<Workflow> {
    const workflow = await this.workflowRepo.findByIdOrThrow(workflowId);

    // Delete in transaction: child records → workflow
    const deleted = await BaseRepository.transaction(async (tx) => {
      // Delete all related child records first (no cascade in Prisma schema)
      await tx.$executeRaw`DELETE FROM "WorkflowStep" WHERE "workflowId" = ${workflowId}`;
      await tx.$executeRaw`DELETE FROM "Approval" WHERE "workflowId" = ${workflowId}`;
      await tx.$executeRaw`DELETE FROM "AgentRun" WHERE "workflowId" = ${workflowId}`;
      await tx.$executeRaw`DELETE FROM "AIUsageLog" WHERE "workflowId" = ${workflowId}`;
      await tx.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${workflowId} AND "entityType" = 'Workflow'`;

      // Delete the workflow
      return this.workflowRepo.delete(workflowId, tx);
    });

    await this.auditRepo.create({
      entityType: 'Workflow',
      entityId: workflowId,
      action: 'WORKFLOW_DELETED',
      actorId,
      metadata: { productId: workflow.productId, status: workflow.status },
    });

    // Reset product to DRAFT
    await this.productRepo.updateStatus(workflow.productId, 'DRAFT');

    logger.info({ workflowId, productId: workflow.productId }, 'Workflow deleted');
    return deleted;
  }
}

export const workflowService = new WorkflowService();
