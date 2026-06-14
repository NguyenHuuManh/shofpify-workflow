/**
 * Purpose:
 * Workflow Dashboard — list all workflows, start new ones.
 * Server Component — fetches data directly from service layer.
 */

import { Card, Table, Badge, Button } from '@/components/ui';
import { workflowService } from '@/services/workflow.service';
import type { WorkflowStatus } from '@prisma/client';

const statusBadgeVariant: Record<WorkflowStatus, 'warning' | 'info' | 'danger' | 'success' | 'default'> = {
  PENDING: 'warning',
  RUNNING: 'info',
  FAILED: 'danger',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

export default async function WorkflowsPage(): Promise<React.ReactElement> {
  const { workflows, total } = await workflowService.list({ page: 1, limit: 50 });

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            ⚡ Workflows
          </h2>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
            {total} total workflows
          </p>
        </div>
        <a href="/dashboard/workflows/new">
          <Button>+ New Workflow</Button>
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] as WorkflowStatus[]).map((status) => (
          <Card key={status} style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
              {status.replace('_', ' ')}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
              {workflows.filter((w) => w.status === status).length}
            </div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Product', 'Status', 'Current Step', 'Started', 'Actions']}
          rows={workflows.map((wf) => [
            <a
              key="product"
              href={`/dashboard/workflows/${wf.id}`}
              style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}
            >
              {wf.id}
            </a>,
            <Badge key="status" variant={statusBadgeVariant[wf.status]}>
              {wf.status}
            </Badge>,
            <span key="step" style={{ color: '#475569' }}>
              {wf.currentStep}
            </span>,
            <span key="date" style={{ color: '#94a3b8', fontSize: '13px' }}>
              {new Date(wf.startedAt).toLocaleDateString()}
            </span>,
            <a
              key="actions"
              href={`/dashboard/workflows/${wf.id}`}
              style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none' }}
            >
              View →
            </a>,
          ])}
        />
      </Card>
    </div>
  );
}
