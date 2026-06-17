/**
 * Purpose:
 * Re-export all shared library modules from a single entry point.
 *
 * Responsibilities:
 * - Simplify imports across the application
 *
 * Dependencies:
 * - ./errors
 * - ./logger
 * - ./env
 * - ./prisma
 * - ./redis
 */

export { AppError, ErrorCodes } from './errors';
export type { AppErrorPayload, ErrorCode } from './errors';

export { logger } from './logger';
export type { Logger } from './logger';

export { loadEnv, getEnv } from './env';
export type { Env } from './env';

export { prisma } from './prisma';
export { redis } from './redis';
export { bootstrap } from './bootstrap';
export { validate } from './validate';

export {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  toSafeUser,
} from './auth';
