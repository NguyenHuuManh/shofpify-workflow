/**
 * Purpose:
 * Agent Monitoring Dashboard — shows agent execution status and AI usage.
 * Server Component.
 */

import { Card, Table, Badge } from '@/components/ui';
import { agentRunRepository } from '@/repositories/agent-run.repository';
import { aiUsageLogRepository } from '@/repositories/ai-usage-log.repository';
import type { AgentRunStatus } from '@prisma/client';

const runStatusVariant: Record<AgentRunStatus, 'info' | 'success' | 'danger'> = {
  RUNNING: 'info',
  SUCCESS: 'success',
  FAILED: 'danger',
};

export default async function MonitoringPage(): Promise<React.ReactElement> {
  const [runs, totalCost] = await Promise.all([
    agentRunRepository.findMany({ limit: 50 }),
    aiUsageLogRepository.getTotalCost(),
  ]);

  const succeeded = runs.filter((r) => r.status === 'SUCCESS').length;
  const failed = runs.filter((r) => r.status === 'FAILED').length;
  const running = runs.filter((r) => r.status === 'RUNNING').length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          📊 Monitoring
        </h2>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
          Agent execution and AI usage tracking
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Runs', value: runs.length, color: '#0f172a' },
          { label: 'Succeeded', value: succeeded, color: '#22c55e' },
          { label: 'Failed', value: failed, color: '#ef4444' },
          { label: 'Running', value: running, color: '#3b82f6' },
        ].map((stat) => (
          <Card key={stat.label} style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </Card>
        ))}
      </div>

      {/* AI Usage Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px', color: '#0f172a' }}>
            AI Cost Summary
          </h3>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#0f172a' }}>
            ${totalCost.toFixed(4)}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Total estimated cost
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px', color: '#0f172a' }}>
            Success Rate
          </h3>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#22c55e' }}>
            {runs.length > 0 ? Math.round((succeeded / runs.length) * 100) : 0}%
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            {succeeded} of {runs.length} runs succeeded
          </div>
        </Card>
      </div>

      {/* Agent Runs Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#0f172a' }}>
            Recent Agent Runs
          </h3>
        </div>
        <Table
          headers={['Agent', 'Workflow', 'Status', 'Started', 'Duration']}
          rows={runs.slice(0, 20).map((run) => [
            <span key="agent" style={{ fontWeight: 600, color: '#0f172a' }}>
              {run.agentName}
            </span>,
            <span key="wf" style={{ color: '#64748b', fontSize: '13px' }}>
              {run.workflowId}
            </span>,
            <Badge key="status" variant={runStatusVariant[run.status]}>
              {run.status}
            </Badge>,
            <span key="date" style={{ color: '#94a3b8', fontSize: '13px' }}>
              {new Date(run.startedAt).toLocaleTimeString()}
            </span>,
            <span key="dur" style={{ color: '#64748b', fontSize: '13px' }}>
              {run.completedAt
                ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
                : '—'}
            </span>,
          ])}
        />
      </Card>
    </div>
  );
}
