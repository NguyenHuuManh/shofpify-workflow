/**
 * Purpose:
 * Agent logs monitoring API.
 * GET /api/monitoring/agents/logs — Get recent agent execution logs
 *
 * Dependencies:
 * - AgentRunRepository
 * - api-helpers
 */

import { NextResponse } from 'next/server';
import { agentRunRepository } from '@/repositories/agent-run.repository';
import { success, handleError } from '../../../api-helpers';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const agentName = searchParams.get('agentName') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const runs = await agentRunRepository.findMany({
      agentName,
      limit: Math.min(limit, 100),
    });

    return success(runs);
  } catch (error) {
    return handleError(error);
  }
}
