/**
 * Purpose:
 * Review Dashboard — shows workflows pending review and review history.
 * Server Component.
 */

import { Card, Table, Badge, Button } from '@/components/ui';
import { workflowService } from '@/services/workflow.service';

export default async function ReviewsPage(): Promise<React.ReactElement> {
  // Get workflows that are at the REVIEW step
  const { workflows } = await workflowService.list({
    currentStep: 'REVIEW',
    page: 1,
    limit: 50,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          ✅ Reviews
        </h2>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
          {workflows.length} workflows awaiting review
        </p>
      </div>

      {/* Pending Reviews */}
      <Card style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#0f172a' }}>
            Pending Review
          </h3>
        </div>
        <Table
          headers={['Workflow', 'Status', 'Started', 'Actions']}
          rows={workflows.map((wf) => [
            <a
              key="id"
              href={`/dashboard/workflows/${wf.id}`}
              style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}
            >
              {wf.id}
            </a>,
            <Badge key="status" variant="warning">PENDING_REVIEW</Badge>,
            <span key="date" style={{ color: '#94a3b8', fontSize: '13px' }}>
              {new Date(wf.startedAt).toLocaleDateString()}
            </span>,
            <div key="actions" style={{ display: 'flex', gap: '8px' }}>
              <a href={`/dashboard/workflows/${wf.id}`}>
                <Button size="sm" variant="primary">Review</Button>
              </a>
            </div>,
          ])}
        />
      </Card>

      {/* Review History Summary */}
      <Card>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#0f172a' }}>
            Review Statistics
          </h3>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            padding: '24px',
          }}
        >
          {[
            { label: 'Pending', value: workflows.length, color: '#eab308' },
            { label: 'Approved Today', value: 0, color: '#22c55e' },
            { label: 'Rejected Today', value: 0, color: '#ef4444' },
            { label: 'Avg Review Time', value: '—', color: '#3b82f6' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
