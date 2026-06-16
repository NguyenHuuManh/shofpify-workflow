/**
 * Purpose:
 * Product Research dashboard hub.
 * Server Component — fetches workflow research state through service layer.
 */

import { Badge, Button, Card, Table } from '@/components/ui';
import { workflowService } from '@/services/workflow.service';
import { productService } from '@/services/product.service';
import { researchService } from '@/services/research.service';
import type { ProductCandidate, Workflow, WorkflowStatus } from '@prisma/client';

const researchSteps = new Set([
  'RESEARCH',
  'RESEARCH_REVIEW',
  'CONTENT',
  'CONTENT_REVIEW',
  'SEO',
  'SEO_REVIEW',
  'LANDING',
  'LANDING_REVIEW',
  'IMAGE',
  'SHOPIFY',
  'FINAL_REVIEW',
  'PUBLISH',
]);

const statusBadgeVariant: Record<WorkflowStatus, 'warning' | 'info' | 'danger' | 'success' | 'default'> = {
  PENDING: 'warning',
  RUNNING: 'info',
  FAILED: 'danger',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

interface ResearchWorkflowRow {
  workflow: Workflow;
  productTitle: string;
  candidateCount: number;
  selectedCandidate?: ProductCandidate;
  topCandidate?: ProductCandidate;
}

export default async function ProductResearchPage(): Promise<React.ReactElement> {
  const { workflows } = await workflowService.list({ page: 1, limit: 50 });
  const researchWorkflows = workflows.filter((workflow) =>
    researchSteps.has(workflow.currentStep),
  );

  const rows = await Promise.all(
    researchWorkflows.map(async (workflow): Promise<ResearchWorkflowRow> => {
      const [product, candidatesResult] = await Promise.all([
        productService.getById(workflow.productId),
        researchService.getLatestCandidates(workflow.id),
      ]);

      const candidates = candidatesResult.candidates;
      const selectedCandidate = candidates.find((candidate) => candidate.status === 'APPROVED');

      return {
        workflow,
        productTitle: product.title,
        candidateCount: candidates.length,
        selectedCandidate,
        topCandidate: selectedCandidate ?? candidates[0],
      };
    }),
  );

  const waitingForReview = rows.filter(
    (row) => row.workflow.currentStep === 'RESEARCH_REVIEW',
  ).length;
  const withCandidates = rows.filter((row) => row.candidateCount > 0).length;
  const withSelectedCandidate = rows.filter((row) => row.selectedCandidate).length;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Product Research
          </h2>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
            Research workbench for candidate discovery and review
          </p>
        </div>
        <a href="/dashboard/workflows/new">
          <Button>New Workflow</Button>
        </a>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <MetricCard label="Research Workflows" value={rows.length} />
        <MetricCard label="Awaiting Review" value={waitingForReview} />
        <MetricCard label="With Candidates" value={withCandidates} />
        <MetricCard label="Selected" value={withSelectedCandidate} />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Product', 'Workflow', 'Research State', 'Candidates', 'Recommended Candidate', 'Actions']}
          rows={rows.map((row) => [
            <div key="product">
              <a
                href={`/dashboard/workflows/${row.workflow.id}/research`}
                style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}
              >
                {row.productTitle}
              </a>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                {row.workflow.productId}
              </div>
            </div>,
            <a
              key="workflow"
              href={`/dashboard/workflows/${row.workflow.id}`}
              style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none' }}
            >
              {row.workflow.id}
            </a>,
            <div key="state" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Badge variant={statusBadgeVariant[row.workflow.status]}>
                {row.workflow.status}
              </Badge>
              <span style={{ color: '#475569', fontSize: '13px' }}>
                {row.workflow.currentStep}
              </span>
            </div>,
            <span key="candidate-count" style={{ color: '#0f172a', fontWeight: 600 }}>
              {row.candidateCount}
            </span>,
            <CandidateSummary key="candidate" candidate={row.topCandidate} />,
            <div key="actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <a href={`/dashboard/workflows/${row.workflow.id}/research`}>
                <Button size="sm" variant="secondary">
                  Open Research
                </Button>
              </a>
              <a
                href={`/dashboard/workflows/${row.workflow.id}`}
                style={{ color: '#64748b', fontWeight: 500, textDecoration: 'none', fontSize: '13px' }}
              >
                Workflow
              </a>
            </div>,
          ])}
        />
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.ReactElement {
  return (
    <Card style={{ padding: '20px' }}>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
        {value}
      </div>
    </Card>
  );
}

function CandidateSummary({
  candidate,
}: {
  candidate?: ProductCandidate;
}): React.ReactElement {
  if (!candidate) {
    return <span style={{ color: '#94a3b8' }}>No candidates yet</span>;
  }

  return (
    <div>
      <div style={{ color: '#0f172a', fontWeight: 600 }}>
        {candidate.name}
      </div>
      <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
        Score {candidate.winningScore ?? 'N/A'} · {candidate.status}
      </div>
    </div>
  );
}
