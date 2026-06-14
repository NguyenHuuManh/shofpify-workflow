/**
 * Purpose:
 * Data access layer for AIUsageLog entities.
 * Tracks AI API usage and costs across all providers.
 *
 * Responsibilities:
 * - Record AI usage events
 * - Query usage by provider, model, workflow
 * - Cost aggregation queries
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { AIUsageLog, Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class AIUsageLogRepository extends BaseRepository {
  async create(
    data: {
      provider: string;
      model: string;
      workflowId?: string;
      agentRunId?: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCost: number;
    },
    tx?: TransactionClient,
  ): Promise<AIUsageLog> {
    const client = tx ?? this.db;
    return client.aIUsageLog.create({ data });
  }

  async findByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<AIUsageLog[]> {
    const client = tx ?? this.db;
    return client.aIUsageLog.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAgentRunId(
    agentRunId: string,
    tx?: TransactionClient,
  ): Promise<AIUsageLog[]> {
    const client = tx ?? this.db;
    return client.aIUsageLog.findMany({
      where: { agentRunId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTotalCost(
    filter?: { provider?: string; startDate?: Date; endDate?: Date },
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.db;
    const where: Prisma.AIUsageLogWhereInput = {};

    if (filter?.provider) {
      where.provider = filter.provider;
    }
    if (filter?.startDate || filter?.endDate) {
      where.createdAt = {
        ...(filter?.startDate ? { gte: filter.startDate } : {}),
        ...(filter?.endDate ? { lte: filter.endDate } : {}),
      };
    }

    const result = await client.aIUsageLog.aggregate({
      where,
      _sum: { estimatedCost: true, totalTokens: true },
    });

    return result._sum.estimatedCost ?? 0;
  }

  async getUsageStats(
    filter?: { provider?: string; startDate?: Date; endDate?: Date },
    tx?: TransactionClient,
  ): Promise<Array<{ provider: string; model: string; totalCost: number; totalTokens: number }>> {
    const client = tx ?? this.db;
    const where: Prisma.AIUsageLogWhereInput = {};

    if (filter?.provider) {
      where.provider = filter.provider;
    }
    if (filter?.startDate || filter?.endDate) {
      where.createdAt = {
        ...(filter?.startDate ? { gte: filter.startDate } : {}),
        ...(filter?.endDate ? { lte: filter.endDate } : {}),
      };
    }

    const results = await client.aIUsageLog.groupBy({
      by: ['provider', 'model'],
      where,
      _sum: { estimatedCost: true, totalTokens: true },
    });

    return results.map((r) => ({
      provider: r.provider,
      model: r.model,
      totalCost: r._sum.estimatedCost ?? 0,
      totalTokens: r._sum.totalTokens ?? 0,
    }));
  }
}

export const aiUsageLogRepository = new AIUsageLogRepository();
