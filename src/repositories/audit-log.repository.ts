/**
 * Purpose:
 * Data access layer for AuditLog entities.
 * Records all critical platform actions for compliance and debugging.
 *
 * Responsibilities:
 * - Append-only audit log creation
 * - Entity-scoped log queries
 * - Action-based filtering
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { AuditLog } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class AuditLogRepository extends BaseRepository {
  /**
   * Create an audit log entry. This is append-only — never update or delete.
   */
  async create(
    data: {
      entityType: string;
      entityId: string;
      action: string;
      actorId?: string;
      metadata?: Prisma.InputJsonValue;
    },
    tx?: TransactionClient,
  ): Promise<AuditLog> {
    const client = tx ?? this.db;
    return client.auditLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actorId: data.actorId ?? null,
        metadata: data.metadata ?? Prisma.DbNull,
      },
    });
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    opts?: { limit?: number },
    tx?: TransactionClient,
  ): Promise<AuditLog[]> {
    const client = tx ?? this.db;
    return client.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 100,
    });
  }

  async findByAction(
    action: string,
    opts?: { limit?: number; skip?: number },
    tx?: TransactionClient,
  ): Promise<AuditLog[]> {
    const client = tx ?? this.db;
    return client.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 100,
      skip: opts?.skip ?? 0,
    });
  }

  async findRecent(
    opts?: { limit?: number },
    tx?: TransactionClient,
  ): Promise<AuditLog[]> {
    const client = tx ?? this.db;
    return client.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
