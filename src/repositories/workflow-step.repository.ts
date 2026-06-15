/**
 * Purpose:
 * Data access layer for WorkflowStep entities.
 * Tracks individual step execution within a workflow.
 *
 * Responsibilities:
 * - CRUD operations for WorkflowStep
 * - Step status transitions
 * - Error tracking per step
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { WorkflowStep, StepStatus, WorkflowStepType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class WorkflowStepRepository extends BaseRepository {
  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<WorkflowStep | null> {
    const client = tx ?? this.db;
    return client.workflowStep.findUnique({ where: { id } });
  }

  async findByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<WorkflowStep[]> {
    const client = tx ?? this.db;
    return client.workflowStep.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'asc' },
    });
  }

  async findCurrentStep(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<WorkflowStep | null> {
    const client = tx ?? this.db;
    return client.workflowStep.findFirst({
      where: {
        workflowId,
        status: { in: ['PENDING', 'RUNNING'] as StepStatus[] },
      },
      orderBy: { startedAt: 'asc' },
    });
  }

  async create(
    data: {
      workflowId: string;
      step: WorkflowStepType;
      metadata?: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<WorkflowStep> {
    const client = tx ?? this.db;
    return client.workflowStep.create({
      data: {
        workflowId: data.workflowId,
        step: data.step,
        status: 'PENDING',
        startedAt: new Date(),
        metadata: data.metadata ?? Prisma.DbNull,
      },
    });
  }

  async updateStatus(
    id: string,
    status: StepStatus,
    opts?: { errorMessage?: string },
    tx?: TransactionClient,
  ): Promise<WorkflowStep> {
    const client = tx ?? this.db;

    return client.workflowStep.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined,
        errorMessage: opts?.errorMessage ?? null,
      },
    });
  }

  async markRunning(id: string, tx?: TransactionClient): Promise<WorkflowStep> {
    const client = tx ?? this.db;
    return client.workflowStep.update({
      where: { id },
      data: { status: 'RUNNING' },
    });
  }

  async markCompleted(id: string, tx?: TransactionClient): Promise<WorkflowStep> {
    const client = tx ?? this.db;
    return client.workflowStep.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async markFailed(
    id: string,
    errorMessage: string,
    tx?: TransactionClient,
  ): Promise<WorkflowStep> {
    const client = tx ?? this.db;
    return client.workflowStep.update({
      where: { id },
      data: { status: 'FAILED', completedAt: new Date(), errorMessage },
    });
  }

  /**
   * Reset a step to PENDING for rework.
   * Increments the rework counter in metadata.
   */
  async resetToPending(
    id: string,
    reworkCount: number,
    tx?: TransactionClient,
  ): Promise<WorkflowStep> {
    const client = tx ?? this.db;
    return client.workflowStep.update({
      where: { id },
      data: {
        status: 'PENDING',
        completedAt: null,
        errorMessage: null,
        metadata: { reworkCount },
      },
    });
  }

  async deleteByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const client = tx ?? this.db;
    return client.workflowStep.deleteMany({ where: { workflowId } });
  }
}

export const workflowStepRepository = new WorkflowStepRepository();
