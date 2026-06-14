/**
 * Purpose:
 * Data access layer for Setting entities.
 * Key-value store for platform configuration.
 *
 * Responsibilities:
 * - Read/write application settings
 * - Typed setting access
 * - Configuration defaults
 *
 * Dependencies:
 * - @prisma/client
 * - ./base.repository
 */

import { BaseRepository } from './base.repository';
import type { Setting } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TransactionClient } from './base.repository';

export class SettingRepository extends BaseRepository {
  async findByKey(
    key: string,
    tx?: TransactionClient,
  ): Promise<Setting | null> {
    const client = tx ?? this.db;
    return client.setting.findUnique({ where: { key } });
  }

  async getValue<T = Record<string, unknown>>(
    key: string,
    tx?: TransactionClient,
  ): Promise<T | null> {
    const setting = await this.findByKey(key, tx);
    if (!setting) {
      return null;
    }
    return setting.value as T;
  }

  async getValueOrDefault<T = Record<string, unknown>>(
    key: string,
    defaultValue: T,
    tx?: TransactionClient,
  ): Promise<T> {
    const value = await this.getValue<T>(key, tx);
    return value ?? defaultValue;
  }

  async setValue(
    key: string,
    value: Prisma.InputJsonValue,
    tx?: TransactionClient,
  ): Promise<Setting> {
    const client = tx ?? this.db;
    return client.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async getAll(tx?: TransactionClient): Promise<Setting[]> {
    const client = tx ?? this.db;
    return client.setting.findMany({ orderBy: { key: 'asc' } });
  }

  async delete(key: string, tx?: TransactionClient): Promise<void> {
    const client = tx ?? this.db;
    await client.setting.delete({ where: { key } });
  }
}

export const settingRepository = new SettingRepository();
