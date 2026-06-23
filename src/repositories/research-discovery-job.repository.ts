/**
 * Purpose:
 * Data access layer for autonomous Product Research discovery jobs.
 *
 * Responsibilities:
 * - Create and list discovery jobs
 * - Persist job status, query plans, results, and failure messages
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type {
  Prisma,
  ResearchDiscoveryJob,
  ResearchDiscoveryJobStatus,
} from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ResearchDiscoveryJobRepository extends BaseRepository {
  async create(
    data: {
      researchProjectId: string;
      input: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<ResearchDiscoveryJob> {
    const client = tx ?? this.db;
    return client.researchDiscoveryJob.create({
      data: {
        researchProjectId: data.researchProjectId,
        input: data.input,
      },
    });
  }

  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<ResearchDiscoveryJob | null> {
    const client = tx ?? this.db;
    return client.researchDiscoveryJob.findUnique({ where: { id } });
  }

  async findByIdOrThrow(
    id: string,
    tx?: TransactionClient,
  ): Promise<ResearchDiscoveryJob> {
    const job = await this.findById(id, tx);
    if (!job) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Research discovery job '${id}' not found`,
        statusCode: 404,
      });
    }

    return job;
  }

  async findMany(
    filter?: {
      status?: ResearchDiscoveryJobStatus;
      researchProjectId?: string;
      skip?: number;
      take?: number;
    },
    tx?: TransactionClient,
  ): Promise<ResearchDiscoveryJob[]> {
    const client = tx ?? this.db;
    return client.researchDiscoveryJob.findMany({
      where: {
        status: filter?.status,
        researchProjectId: filter?.researchProjectId,
      },
      orderBy: { createdAt: 'desc' },
      skip: filter?.skip ?? 0,
      take: filter?.take ?? 25,
    });
  }

  async markRunning(
    id: string,
    queryPlan: Prisma.InputJsonValue,
    tx?: TransactionClient,
  ): Promise<ResearchDiscoveryJob> {
    const client = tx ?? this.db;
    return client.researchDiscoveryJob.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        queryPlan,
        errorMessage: null,
      },
    });
  }

  async markCompleted(
    id: string,
    result: Prisma.InputJsonValue,
    tx?: TransactionClient,
  ): Promise<ResearchDiscoveryJob> {
    const client = tx ?? this.db;
    return client.researchDiscoveryJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        result,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async markFailed(
    id: string,
    errorMessage: string,
    tx?: TransactionClient,
  ): Promise<ResearchDiscoveryJob> {
    const client = tx ?? this.db;
    return client.researchDiscoveryJob.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Delete all discovery jobs for a research project.
   * Returns the count of deleted records.
   * Must be called before deleting the parent ResearchProject.
   */
  async deleteByResearchProjectId(
    projectId: string,
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const result = await client.researchDiscoveryJob.deleteMany({
      where: { researchProjectId: projectId },
    });
    return result.count;
  }
}

export const researchDiscoveryJobRepository = new ResearchDiscoveryJobRepository();
