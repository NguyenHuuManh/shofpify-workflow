/**
 * Purpose:
 * Data access layer for independent Product Research projects.
 *
 * Responsibilities:
 * - Create and list research projects
 * - Track selected/promoted candidates
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { ResearchProject, ResearchProjectStatus } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ResearchProjectRepository extends BaseRepository {
  async create(
    data: { query: string; summary?: string },
    tx?: TransactionClient,
  ): Promise<ResearchProject> {
    const client = tx ?? this.db;
    return client.researchProject.create({
      data: {
        query: data.query,
        summary: data.summary,
      },
    });
  }

  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<ResearchProject | null> {
    const client = tx ?? this.db;
    return client.researchProject.findUnique({ where: { id } });
  }

  async findByIdOrThrow(
    id: string,
    tx?: TransactionClient,
  ): Promise<ResearchProject> {
    const project = await this.findById(id, tx);
    if (!project) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Research project '${id}' not found`,
        statusCode: 404,
      });
    }
    return project;
  }

  async findMany(
    filter?: { status?: ResearchProjectStatus; skip?: number; take?: number },
    tx?: TransactionClient,
  ): Promise<ResearchProject[]> {
    const client = tx ?? this.db;
    return client.researchProject.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: 'desc' },
      skip: filter?.skip ?? 0,
      take: filter?.take ?? 50,
    });
  }

  async updateSelectedCandidate(
    id: string,
    selectedCandidateId: string,
    tx?: TransactionClient,
  ): Promise<ResearchProject> {
    const client = tx ?? this.db;
    return client.researchProject.update({
      where: { id },
      data: {
        selectedCandidateId,
        status: 'SELECTED',
      },
    });
  }

  async updatePromotedProduct(
    id: string,
    promotedProductId: string,
    tx?: TransactionClient,
  ): Promise<ResearchProject> {
    const client = tx ?? this.db;
    return client.researchProject.update({
      where: { id },
      data: {
        promotedProductId,
        status: 'PROMOTED',
      },
    });
  }

  async updateSummary(
    id: string,
    summary: string,
    tx?: TransactionClient,
  ): Promise<ResearchProject> {
    const client = tx ?? this.db;
    return client.researchProject.update({
      where: { id },
      data: { summary },
    });
  }
}

export const researchProjectRepository = new ResearchProjectRepository();
