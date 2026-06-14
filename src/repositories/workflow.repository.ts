/**
 * Purpose:
 * Data access layer for Workflow entities.
 * Tracks the full lifecycle of product creation workflows.
 *
 * Responsibilities:
 * - CRUD operations for Workflow
 * - Status transitions
 * - Relationship queries (steps, approvals, agent runs)
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { Workflow, WorkflowStatus, WorkflowStepType, Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class WorkflowRepository extends BaseRepository {
  private readonly fullInclude = {
    steps: true,
    approvals: true,
    agentRuns: true,
    user: true,
  } satisfies Prisma.WorkflowInclude;

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async findById(
    id: string,
    opts?: { includeRelated?: boolean },
    tx?: TransactionClient,
  ): Promise<Workflow | null> {
    const client = tx ?? this.db;
    return client.workflow.findUnique({
      where: { id },
      include: opts?.includeRelated ? this.fullInclude : undefined,
    });
  }

  async findByIdOrThrow(
    id: string,
    opts?: { includeRelated?: boolean },
    tx?: TransactionClient,
  ): Promise<Workflow> {
    const workflow = await this.findById(id, opts, tx);
    if (!workflow) {
      throw new AppError({
        code: ErrorCodes.WORKFLOW_NOT_FOUND,
        message: `Workflow with id '${id}' not found`,
        statusCode: 404,
      });
    }
    return workflow;
  }

  async findByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<Workflow | null> {
    const client = tx ?? this.db;
    return client.workflow.findFirst({
      where: { productId },
      include: this.fullInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMany(
    filter?: {
      status?: WorkflowStatus;
      currentStep?: WorkflowStepType;
      userId?: string;
      skip?: number;
      take?: number;
    },
    tx?: TransactionClient,
  ): Promise<Workflow[]> {
    const client = tx ?? this.db;
    const where: Prisma.WorkflowWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.currentStep) {
      where.currentStep = filter.currentStep;
    }
    if (filter?.userId) {
      where.userId = filter.userId;
    }

    return client.workflow.findMany({
      where,
      include: this.fullInclude,
      orderBy: { createdAt: 'desc' },
      skip: filter?.skip ?? 0,
      take: filter?.take ?? 20,
    });
  }

  async count(
    filter?: { status?: WorkflowStatus; userId?: string },
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const where: Prisma.WorkflowWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.userId) {
      where.userId = filter.userId;
    }

    return client.workflow.count({ where });
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  async create(
    data: {
      productId: string;
      currentStep: WorkflowStepType;
      userId?: string;
    },
    tx?: TransactionClient,
  ): Promise<Workflow> {
    const client = tx ?? this.db;
    return client.workflow.create({
      data: {
        productId: data.productId,
        currentStep: data.currentStep,
        status: 'PENDING',
        startedAt: new Date(),
        ...(data.userId ? { userId: data.userId } : {}),
      },
    });
  }

  async updateStatus(
    id: string,
    status: WorkflowStatus,
    tx?: TransactionClient,
  ): Promise<Workflow> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, {}, tx);

    const data: Prisma.WorkflowUpdateInput = { status };

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      data.completedAt = new Date();
    }

    return client.workflow.update({ where: { id }, data });
  }

  async updateCurrentStep(
    id: string,
    currentStep: WorkflowStepType,
    tx?: TransactionClient,
  ): Promise<Workflow> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, {}, tx);

    return client.workflow.update({
      where: { id },
      data: { currentStep, status: 'RUNNING' },
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<Workflow> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, {}, tx);

    return client.workflow.delete({ where: { id } });
  }
}

export const workflowRepository = new WorkflowRepository();
