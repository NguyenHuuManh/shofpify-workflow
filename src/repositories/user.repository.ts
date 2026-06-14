/**
 * Purpose:
 * Data access layer for User entities.
 * Handles all database reads and writes for platform users.
 *
 * Responsibilities:
 * - CRUD operations for User records
 * - Lookup by email
 * - Role-based queries
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/errors
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { User, Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class UserRepository extends BaseRepository {
  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async findById(id: string, tx?: TransactionClient): Promise<User | null> {
    const client = tx ?? this.db;
    return client.user.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string, tx?: TransactionClient): Promise<User> {
    const user = await this.findById(id, tx);
    if (!user) {
      throw new AppError({
        code: ErrorCodes.USER_NOT_FOUND,
        message: `User with id '${id}' not found`,
        statusCode: 404,
      });
    }
    return user;
  }

  async findByEmail(email: string, tx?: TransactionClient): Promise<User | null> {
    const client = tx ?? this.db;
    return client.user.findUnique({ where: { email } });
  }

  async findMany(
    filter?: { role?: User['role']; search?: string },
    tx?: TransactionClient,
  ): Promise<User[]> {
    const client = tx ?? this.db;
    const where: Prisma.UserWhereInput = {};

    if (filter?.role) {
      where.role = filter.role;
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return client.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  async create(
    data: Pick<User, 'email' | 'name' | 'role'>,
    tx?: TransactionClient,
  ): Promise<User> {
    const client = tx ?? this.db;

    const existing = await client.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `User with email '${data.email}' already exists`,
        statusCode: 409,
      });
    }

    return client.user.create({ data });
  }

  async update(
    id: string,
    data: Partial<Pick<User, 'name' | 'role'>>,
    tx?: TransactionClient,
  ): Promise<User> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, tx);

    return client.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<User> {
    const client = tx ?? this.db;

    await this.findByIdOrThrow(id, tx);

    return client.user.delete({ where: { id } });
  }
}

export const userRepository = new UserRepository();
