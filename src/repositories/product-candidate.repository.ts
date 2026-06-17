/**
 * Purpose:
 * Data access layer for ProductCandidate entities.
 *
 * Responsibilities:
 * - Persist candidate rows
 * - Fetch ranked candidates and candidate detail
 * - Update candidate review status
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type {
  Prisma,
  ProductCandidate,
  ResearchCandidateStatus,
} from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ProductCandidateRepository extends BaseRepository {
  async create(
    data: Prisma.ProductCandidateUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<ProductCandidate> {
    const client = tx ?? this.db;
    return client.productCandidate.create({ data });
  }

  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<ProductCandidate | null> {
    const client = tx ?? this.db;
    return client.productCandidate.findUnique({ where: { id } });
  }

  async findByIdOrThrow(
    id: string,
    tx?: TransactionClient,
  ): Promise<ProductCandidate> {
    const candidate = await this.findById(id, tx);
    if (!candidate) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Product candidate '${id}' not found`,
        statusCode: 404,
      });
    }
    return candidate;
  }

  async findByResearchRunId(
    researchRunId: string,
    tx?: TransactionClient,
  ): Promise<ProductCandidate[]> {
    const client = tx ?? this.db;
    return client.productCandidate.findMany({
      where: { researchRunId },
      orderBy: [{ winningScore: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findByResearchProjectId(
    researchProjectId: string,
    tx?: TransactionClient,
  ): Promise<ProductCandidate[]> {
    const client = tx ?? this.db;
    return client.productCandidate.findMany({
      where: { researchProjectId },
      orderBy: [{ winningScore: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async updateStatus(
    id: string,
    status: ResearchCandidateStatus,
    tx?: TransactionClient,
  ): Promise<ProductCandidate> {
    const client = tx ?? this.db;
    return client.productCandidate.update({ where: { id }, data: { status } });
  }

  async markOthersRejected(
    scope: { productId?: string; researchProjectId?: string },
    approvedCandidateId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.db;
    const whereScope = scope.researchProjectId
      ? { researchProjectId: scope.researchProjectId }
      : { productId: scope.productId };

    await client.productCandidate.updateMany({
      where: {
        ...whereScope,
        id: { not: approvedCandidateId },
        status: { not: 'REJECTED' },
      },
      data: { status: 'REJECTED' },
    });
  }

  async attachProduct(
    id: string,
    productId: string,
    tx?: TransactionClient,
  ): Promise<ProductCandidate> {
    const client = tx ?? this.db;
    return client.productCandidate.update({
      where: { id },
      data: { productId },
    });
  }

  async deleteByResearchProjectId(
    researchProjectId: string,
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const result = await client.productCandidate.deleteMany({
      where: { researchProjectId },
    });
    return result.count;
  }
}

export const productCandidateRepository = new ProductCandidateRepository();
