/**
 * Purpose:
 * Product Research workspace.
 * Server Component — lists independent research projects and candidate actions.
 */

import { Badge, Button, Card, Table } from '@/components/ui';
import { researchService } from '@/services/research.service';
import type { ProductCandidate, ResearchProjectStatus } from '@prisma/client';
import {
  createResearchProject,
  promoteCandidate,
  selectCandidate,
} from './actions';

const statusBadgeVariant: Record<ResearchProjectStatus, 'warning' | 'info' | 'danger' | 'success' | 'default'> = {
  ACTIVE: 'info',
  SELECTED: 'warning',
  PROMOTED: 'success',
  ARCHIVED: 'default',
};

export default async function ProductResearchPage(): Promise<React.ReactElement> {
  const projects = await researchService.listProjects();
  const selectedCount = projects.filter((item) => item.project.status === 'SELECTED').length;
  const promotedCount = projects.filter((item) => item.project.status === 'PROMOTED').length;
  const candidateCount = projects.reduce((sum, item) => sum + item.candidates.length, 0);

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
            Discover, compare, and promote winning products before starting production.
          </p>
        </div>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <form
          action={createResearchProject}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 120px auto',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label
              htmlFor="query"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
            >
              Product idea or niche
            </label>
            <input
              id="query"
              name="query"
              required
              placeholder="portable kitchen gadgets, pet travel accessories..."
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="targetMarket"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
            >
              Market
            </label>
            <input
              id="targetMarket"
              name="targetMarket"
              defaultValue="US"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <Button type="submit">Run Research</Button>
        </form>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <MetricCard label="Projects" value={projects.length} />
        <MetricCard label="Candidates" value={candidateCount} />
        <MetricCard label="Selected" value={selectedCount} />
        <MetricCard label="Promoted" value={promotedCount} />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Research Project', 'Status', 'Candidates', 'Top Candidate', 'Actions']}
          rows={projects.map((item) => {
            const topCandidate = item.selectedCandidate ?? item.candidates[0];

            return [
              <div key="project">
                <div style={{ color: '#0f172a', fontWeight: 600 }}>
                  {item.project.query}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                  {item.project.id}
                </div>
              </div>,
              <Badge key="status" variant={statusBadgeVariant[item.project.status]}>
                {item.project.status}
              </Badge>,
              <span key="candidate-count" style={{ color: '#0f172a', fontWeight: 600 }}>
                {item.candidates.length}
              </span>,
              <CandidateSummary key="candidate" candidate={topCandidate} />,
              <CandidateActions
                key="actions"
                projectId={item.project.id}
                candidate={topCandidate}
                isSelected={Boolean(item.selectedCandidate)}
                isPromoted={item.project.status === 'PROMOTED'}
              />,
            ];
          })}
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

function CandidateActions({
  projectId,
  candidate,
  isSelected,
  isPromoted,
}: {
  projectId: string;
  candidate?: ProductCandidate;
  isSelected: boolean;
  isPromoted: boolean;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <a
        href={`/dashboard/product-research/${projectId}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          color: '#0f172a',
          fontSize: '13px',
          fontWeight: 600,
          textDecoration: 'none',
          lineHeight: '20px',
        }}
      >
        Details
      </a>
      {!candidate && (
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Run research first</span>
      )}
      {candidate && !isSelected && (
        <form action={selectCandidate}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <Button type="submit" size="sm" variant="secondary">
            Select
          </Button>
        </form>
      )}
      {candidate && !isPromoted && (
        <form action={promoteCandidate}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <Button type="submit" size="sm">
            Promote
          </Button>
        </form>
      )}
      {isPromoted && <Badge variant="success">Workflow started</Badge>}
    </div>
  );
}
