/**
 * Purpose:
 * Health check endpoint for the platform.
 * Used by Docker health checks, load balancers, and monitoring.
 *
 * Responsibilities:
 * - Return platform health status
 * - Verify database connectivity
 * - Verify Redis connectivity
 *
 * Dependencies:
 * - next/server
 * - @/lib/prisma
 * - @/lib/redis
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const checks: HealthStatus['checks'] = {
    database: 'error',
    redis: 'error',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
  }

  const allOk = checks.database === 'ok' && checks.redis === 'ok';
  const anyOk = checks.database === 'ok' || checks.redis === 'ok';

  const status: HealthStatus = {
    status: allOk ? 'healthy' : anyOk ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };

  return NextResponse.json(status, {
    status: allOk ? 200 : 503,
  });
}
