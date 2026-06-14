/**
 * Purpose:
 * Data access layer for AgentRun entities.
 * Records every AI agent execution for auditing and monitoring.
 *
 * Responsibilities:
 * - CRUD operations for AgentRun
 * - Execution status tracking
 * - Input/output persistence
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { AgentRun, AgentRunStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class AgentRunRepository extends BaseRepository {
  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<AgentRun | null> {
    const client = tx ?? this.db;
    return client.agentRun.findUnique({ where: { id } });
  }

  async findByWorkflowId(
    workflowId: string,
    tx?: TransactionClient,
  ): Promise<AgentRun[]> {
    const client = tx ?? this.db;
    return client.agentRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'asc' },
    });
  }

  async findMany(
    filter?: { agentName?: string; status?: AgentRunStatus; limit?: number },
    tx?: TransactionClient,
  ): Promise<AgentRun[]> {
    const client = tx ?? this.db;
    const where: Prisma.AgentRunWhereInput = {};

    if (filter?.agentName) {
      where.agentName = filter.agentName;
    }
    if (filter?.status) {
      where.status = filter.status;
    }

    return client.agentRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: filter?.limit ?? 50,
    });
  }

  async create(
    data: {
      workflowId: string;
      agentName: string;
      input: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<AgentRun> {
    const client = tx ?? this.db;
    return client.agentRun.create({
      data: {
        workflowId: data.workflowId,
        agentName: data.agentName,
        status: 'RUNNING',
        startedAt: new Date(),
        input: data.input,
      },
    });
  }

  async markSuccess(
    id: string,
    output: Prisma.InputJsonValue,
    tx?: TransactionClient,
  ): Promise<AgentRun> {
    const client = tx ?? this.db;
    return client.agentRun.update({
      where: { id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        output,
      },
    });
  }

  async markFailed(
    id: string,
    errorMessage: string,
    tx?: TransactionClient,
  ): Promise<AgentRun> {
    const client = tx ?? this.db;
    return client.agentRun.update({
      where: { id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
      },
    });
  }
}

export const agentRunRepository = new AgentRunRepository();
