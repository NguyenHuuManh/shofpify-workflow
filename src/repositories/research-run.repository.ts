/**
 * Purpose:
 * Data access layer for ResearchRun entities.
 *
 * Responsibilities:
 * - Create and update research runs
 * - Fetch latest run by workflow or product
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { Prisma, ResearchRun } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ResearchRunRepository extends BaseRepository {
  async create(
    data: {
      researchProjectId?: string;
      productId?: string;
      workflowId?: string;
      input: Prisma.InputJsonValue;
      startedAt?: Date;
    },
    tx?: TransactionClient,
  ): Promise<ResearchRun> {
    const client = tx ?? this.db;
    return client.researchRun.create({
      data: {
        researchProjectId: data.researchProjectId,
        productId: data.productId,
        workflowId: data.workflowId,
        input: data.input,
        startedAt: data.startedAt ?? new Date(),
      },
    });
  }

  async findById(id: string, tx?: TransactionClient): Promise<ResearchRun | null> {
    const client = tx ?? this.db;
    return client.researchRun.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string, tx?: TransactionClient): Promise<ResearchRun> {
    const run = await this.findById(id, tx);
    if (!run) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Research run '${id}' not found`,
        statusCode: 404,
      });
    }
    return run;
  }

  async findLatestByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<ResearchRun | null> {
    const client = tx ?? this.db;
    return client.researchRun.findFirst({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestByResearchProjectId(
    researchProjectId: string,
    tx?: TransactionClient,
  ): Promise<ResearchRun | null> {
    const client = tx ?? this.db;
    return client.researchRun.findFirst({
      where: { researchProjectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestByProductId(
    productId: string,
    tx?: TransactionClient,
  ): Promise<ResearchRun | null> {
    const client = tx ?? this.db;
    return client.researchRun.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCompleted(
    id: string,
    data: {
      summary: string;
      recommendation?: Prisma.InputJsonValue;
      providerCosts?: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<ResearchRun> {
    const client = tx ?? this.db;
    return client.researchRun.update({
      where: { id },
      data: {
        summary: data.summary,
        recommendation: data.recommendation,
        providerCosts: data.providerCosts,
        completedAt: new Date(),
      },
    });
  }

  async deleteByResearchProjectId(
    researchProjectId: string,
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const result = await client.researchRun.deleteMany({
      where: { researchProjectId },
    });
    return result.count;
  }
}

export const researchRunRepository = new ResearchRunRepository();
