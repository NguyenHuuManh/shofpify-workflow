/**
 * Purpose:
 * Base repository class providing common Prisma operations.
 * All repositories must extend this class.
 *
 * Responsibilities:
 * - Provide transactional support
 * - Enforce repository pattern constraints
 * - No business logic allowed
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/prisma
 */

import { prisma } from '@/lib/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

export abstract class BaseRepository {
  protected get db(): PrismaClient | TransactionClient {
    return prisma;
  }

  /**
   * Execute operations within a transaction.
   * Use when multiple writes must succeed or fail together.
   * Public so services can coordinate multi-repository transactions.
   */
  async withTransaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(fn);
  }

  /**
   * Static transaction runner for service-layer use.
   * Does not require a repository instance.
   */
  static async transaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(fn);
  }
}
