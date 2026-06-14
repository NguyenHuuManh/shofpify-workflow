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
 * Ordered sequence of workflow steps matching the product creation pipeline.
 */
const WORKFLOW_STEP_SEQUENCE: WorkflowStepType[] = [
  'RESEARCH',
  'CONTENT',
  'SEO',
  'LANDING',
  'IMAGE',
  'SHOPIFY',
  'REVIEW',
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
}

export const workflowService = new WorkflowService();
