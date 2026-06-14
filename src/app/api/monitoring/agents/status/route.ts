/**
 * Purpose:
 * Agent status monitoring API.
 * GET /api/monitoring/agents/status — Get agent execution status summary
 *
 * Dependencies:
 * - AgentRunRepository
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { agentRunRepository } from '@/repositories/agent-run.repository';
import { success, handleError } from '../../../api-helpers';

export async function GET(): Promise<NextResponse> {
  try {
    const recent = await agentRunRepository.findMany({ limit: 50 });

    const summary = {
      total: recent.length,
      running: recent.filter((r) => r.status === 'RUNNING').length,
      succeeded: recent.filter((r) => r.status === 'SUCCESS').length,
      failed: recent.filter((r) => r.status === 'FAILED').length,
      recentRuns: recent.slice(0, 10).map((r) => ({
        id: r.id,
        agentName: r.agentName,
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      })),
    };

    return success(summary);
  } catch (error) {
    return handleError(error);
  }
}
