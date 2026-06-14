/**
 * Purpose:
 * Data access layer for Approval entities.
 * Stores human review decisions for workflows.
 *
 * Responsibilities:
 * - CRUD operations for Approval
 * - Reviewer assignment
 * - Approval history queries
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { Approval, ApprovalStatus } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ApprovalRepository extends BaseRepository {
  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<Approval | null> {
    const client = tx ?? this.db;
    return client.approval.findUnique({
      where: { id },
      include: { reviewer: true },
    });
  }

  async findByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<Approval[]> {
    const client = tx ?? this.db;
    return client.approval.findMany({
      where: { workflowId },
      include: { reviewer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<Approval | null> {
    const client = tx ?? this.db;
    return client.approval.findFirst({
      where: { workflowId },
      include: { reviewer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    data: {
      workflowId: string;
      reviewerId: string;
      status: ApprovalStatus;
      comment?: string;
    },
    tx?: TransactionClient,
  ): Promise<Approval> {
    const client = tx ?? this.db;
    return client.approval.create({
      data: {
        workflowId: data.workflowId,
        reviewerId: data.reviewerId,
        status: data.status,
        comment: data.comment ?? null,
      },
      include: { reviewer: true },
    });
  }

  async deleteByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.approval.deleteMany({ where: { workflowId } });
  }
}

export const approvalRepository = new ApprovalRepository();
