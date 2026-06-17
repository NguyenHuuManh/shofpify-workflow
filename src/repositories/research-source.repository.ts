/**
 * Purpose:
 * Data access layer for ResearchSource entities.
 *
 * Responsibilities:
 * - Persist normalized evidence
 * - Fetch sources by research run or candidate
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { Prisma, ResearchSource } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class ResearchSourceRepository extends BaseRepository {
  async create(
    data: Prisma.ResearchSourceUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<ResearchSource> {
    const client = tx ?? this.db;
    return client.researchSource.create({ data });
  }

  async findByResearchRunId(
    researchRunId: string,
    tx?: TransactionClient,
  ): Promise<ResearchSource[]> {
    const client = tx ?? this.db;
    return client.researchSource.findMany({
      where: { researchRunId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByCandidateId(
    candidateId: string,
    tx?: TransactionClient,
  ): Promise<ResearchSource[]> {
    const client = tx ?? this.db;
    return client.researchSource.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteByResearchProjectId(
    researchProjectId: string,
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const result = await client.researchSource.deleteMany({
      where: {
        researchRun: { researchProjectId },
      },
    });
    return result.count;
  }
}

export const researchSourceRepository = new ResearchSourceRepository();
