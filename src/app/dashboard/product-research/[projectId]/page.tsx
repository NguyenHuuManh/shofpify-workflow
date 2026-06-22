/**
 * Purpose:
 * Product Research project detail page.
 * Server Component for reviewing candidates, scores, economics, risks, and sources.
 */

import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, Table } from '@/components/ui';
import { researchService } from '@/services/research.service';
import {
  promoteCandidate,
  selectCandidate,
} from '../actions';
import type {
  ProductCandidate,
  ResearchCandidateStatus,
  ResearchProjectStatus,
  ResearchSource,
} from '@prisma/client';

interface Props {
  params: { projectId: string };
}

const projectStatusVariant: Record<ResearchProjectStatus, 'warning' | 'info' | 'danger' | 'success' | 'default'> = {
  ACTIVE: 'info',
  SELECTED: 'warning',
  PROMOTED: 'success',
  ARCHIVED: 'default',
};

const candidateStatusVariant: Record<ResearchCandidateStatus, 'warning' | 'info' | 'danger' | 'success' | 'default'> = {
  DISCOVERED: 'info',
  SHORTLISTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export default async function ProductResearchDetailPage({
  params,
}: Props): Promise<React.ReactElement> {
  let detail: Awaited<ReturnType<typeof researchService.getProjectDetail>>;

  try {
    detail = await researchService.getProjectDetail(params.projectId);
  } catch {
    notFound();
  }

  const selectedCandidate = detail.selectedCandidate;
  const topCandidate = selectedCandidate ?? detail.candidates[0];
  const promotedWorkflowUrl = detail.promotedWorkflow
    ? `/dashboard/workflows/${detail.promotedWorkflow.id}`
    : null;

  return (
    <div>
      <a
        href="/dashboard/product-research"
        style={{
          color: '#64748b',
          fontSize: '13px',
          fontWeight: 600,
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: '12px',
        }}
      >
        ← Back to Product Research
      </a>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            {detail.project.query}
          </h2>
          <Badge variant={projectStatusVariant[detail.project.status]}>
            {detail.project.status}
          </Badge>
        </div>
        <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: '14px', lineHeight: '22px' }}>
          {detail.project.summary ?? 'Research project details and candidate evidence.'}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <MetricCard label="Candidates" value={detail.candidates.length} />
        <MetricCard label="Top Score" value={String(topCandidate?.winningScore ?? 'N/A')} />
        <MetricCard label="Sources" value={detail.sources.length} />
        <MetricCard label="Latest Run" value={detail.latestRun?.id.slice(-8) ?? 'N/A'} />
      </div>

      {selectedCandidate && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                Selected Candidate
              </div>
              <div style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>
                {selectedCandidate.name}
              </div>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                {selectedCandidate.positioning}
              </div>
            </div>
            <CandidateActions
              candidate={selectedCandidate}
              isSelected
              isPromoted={detail.project.status === 'PROMOTED'}
            />
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: '20px' }}>
        {detail.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            sources={detail.sources.filter((source) => source.candidateId === candidate.id)}
            isSelected={candidate.id === detail.project.selectedCandidateId}
            isPromoted={detail.project.status === 'PROMOTED' && candidate.productId === detail.project.promotedProductId}
          />
        ))}
      </div>

      {detail.candidates.length === 0 && (
        <Card>
          <div style={{ color: '#64748b', fontSize: '14px' }}>
            No candidates were generated for this project.
          </div>
        </Card>
      )}

      <Card style={{ marginTop: '24px', padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Source', 'Type', 'Signal', 'Confidence']}
          rows={detail.sources.map((source) => [
            <SourceTitle key="source" source={source} />,
            <Badge key="type" variant="default">{source.type}</Badge>,
            <span key="signal" style={{ color: '#334155' }}>{source.extractedSignal}</span>,
            <span key="confidence" style={{ color: '#0f172a', fontWeight: 600 }}>
              {source.confidence === null ? 'N/A' : `${Math.round((source.confidence ?? 0) * 100)}%`}
            </span>,
          ])}
        />
      </Card>

      {promotedWorkflowUrl && (
        <div style={{ marginTop: '16px' }}>
          <a
            href={promotedWorkflowUrl}
            style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            Open promoted workflow
          </a>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): React.ReactElement {
  return (
    <Card style={{ padding: '18px' }}>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
        {value}
      </div>
    </Card>
  );
}

function CandidateCard({
  candidate,
  sources,
  isSelected,
  isPromoted,
}: {
  candidate: ProductCandidate;
  sources: ResearchSource[];
  isSelected: boolean;
  isPromoted: boolean;
}): React.ReactElement {
  const productImage = extractProductImage(sources);
  const productUrl = extractProductUrl(sources);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1 }}>
          {productImage && (
            <div
              style={{
                width: '120px',
                height: '120px',
                flexShrink: 0,
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <Image
                src={productImage}
                alt={candidate.name}
                width={120}
                height={120}
                unoptimized
                style={{
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <h3 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {candidate.name}
              </h3>
              <Badge variant={candidateStatusVariant[candidate.status]}>
                {candidate.status}
              </Badge>
              {isSelected && <Badge variant="success">Selected</Badge>}
              {isPromoted && <Badge variant="success">Promoted</Badge>}
            </div>
            <p style={{ color: '#334155', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
              {candidate.positioning}
            </p>
            {candidate.sellingAngle && (
              <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '20px', margin: '8px 0 0' }}>
                {candidate.sellingAngle}
              </p>
            )}
            {productUrl && (
              <div style={{ marginTop: '10px' }}>
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <title>External link</title>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View Product
                </a>
              </div>
            )}
          </div>
        </div>
        <CandidateActions
          candidate={candidate}
          isSelected={isSelected}
          isPromoted={isPromoted}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <DataPoint label="Market" value={candidate.targetMarket ?? 'N/A'} />
        <DataPoint label="Price" value={formatMoney(candidate.recommendedPrice)} />
        <DataPoint label="COGS" value={formatMoney(candidate.estimatedCOGS)} />
        <DataPoint label="Factory Cost" value={formatMoney(candidate.factoryUnitCost)} />
        <DataPoint label="MOQ" value={candidate.moq?.toString() ?? 'N/A'} />
        <DataPoint label="Landed Cost" value={formatMoney(candidate.landedCost)} />
        <DataPoint label="Gross Margin" value={formatPercent(candidate.grossMarginPercent)} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <Score label="Winning" value={candidate.winningScore} />
        <Score label="Demand" value={candidate.demandScore} />
        <Score label="Trend" value={candidate.trendScore} />
        <Score label="Competition" value={candidate.competitionScore} invert />
        <Score label="Margin" value={candidate.marginScore} />
        <Score label="Supplier" value={candidate.supplierScore} />
        <Score label="Sourcing" value={candidate.sourcingScore} />
        <Score label="Factory Cost" value={candidate.factoryCostScore} />
        <Score label="Logistics" value={candidate.logisticsScore} />
        <Score label="Creative" value={candidate.creativePotentialScore} />
        <Score label="Risk" value={candidate.riskScore} invert />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <DetailBlock title="Risks" value={candidate.risks} empty="No explicit risks captured." />
        <DetailBlock title="Metadata" value={candidate.metadata} empty="No metadata captured." />
      </div>

      {sources.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            Candidate Sources
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function CandidateActions({
  candidate,
  isSelected,
  isPromoted,
}: {
  candidate: ProductCandidate;
  isSelected: boolean;
  isPromoted: boolean;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
      {!isSelected && (
        <form action={selectCandidate}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <Button type="submit" size="sm" variant="secondary">
            Select
          </Button>
        </form>
      )}
      {!isPromoted && (
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

function DataPoint({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '12px' }}>
      <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ color: '#0f172a', fontSize: '15px', fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

function Score({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number | null;
  invert?: boolean;
}): React.ReactElement {
  const score = value ?? 0;
  const displayScore = value === null ? 'N/A' : String(score);
  const tone = invert ? 100 - score : score;
  const color = tone >= 70 ? '#16a34a' : tone >= 45 ? '#ca8a04' : '#dc2626';

  return (
    <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#0f172a', fontSize: '12px', fontWeight: 700 }}>{displayScore}</span>
      </div>
      <div style={{ height: '6px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
        <div
          style={{
            width: `${value === null ? 0 : Math.max(0, Math.min(100, score))}%`,
            height: '100%',
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function DetailBlock({
  title,
  value,
  empty,
}: {
  title: string;
  value: unknown;
  empty: string;
}): React.ReactElement {
  const text = formatJsonValue(value);

  return (
    <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '12px' }}>
      <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
        {title}
      </div>
      <pre
        style={{
          color: text ? '#334155' : '#94a3b8',
          fontSize: '12px',
          lineHeight: '18px',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        }}
      >
        {text || empty}
      </pre>
    </div>
  );
}

function SourceRow({ source }: { source: ResearchSource }): React.ReactElement {
  return (
    <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Badge variant="default">{source.type}</Badge>
        <span style={{ color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>
          {source.title ?? source.provider}
        </span>
      </div>
      <div style={{ color: '#64748b', fontSize: '13px', lineHeight: '20px' }}>
        {source.extractedSignal}
      </div>
    </div>
  );
}

function SourceTitle({ source }: { source: ResearchSource }): React.ReactElement {
  if (!source.url) {
    return (
      <div>
        <div style={{ color: '#0f172a', fontWeight: 600 }}>{source.title ?? source.provider}</div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{source.provider}</div>
      </div>
    );
  }

  return (
    <div>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}
      >
        {source.title ?? source.provider}
      </a>
      <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{source.provider}</div>
    </div>
  );
}

function extractProductImage(sources: ResearchSource[]): string | null {
  for (const source of sources) {
    const raw = source.rawData as Record<string, unknown> | null;
    if (!raw) continue;

    // Check for single image from keyword search
    if (typeof raw.imageUrl === 'string' && raw.imageUrl.length > 0) {
      return raw.imageUrl;
    }

    // Check for image array from product detail
    if (Array.isArray(raw.images) && raw.images.length > 0) {
      const img = raw.images[0];
      if (typeof img === 'string' && img.length > 0) return img;
    }
  }
  return null;
}

function extractProductUrl(sources: ResearchSource[]): string | null {
  for (const source of sources) {
    if (source.url && source.url.length > 0) {
      return source.url;
    }
  }
  return null;
}

function formatMoney(value: ProductCandidate['recommendedPrice']): string {
  if (value === null) {
    return 'N/A';
  }

  return `$${Number(value).toFixed(2)}`;
}

function formatPercent(value: ProductCandidate['grossMarginPercent']): string {
  if (value === null) {
    return 'N/A';
  }

  return `${Number(value).toFixed(1)}%`;
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value) && value.length === 0) {
    return '';
  }

  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return '';
  }

  return JSON.stringify(value, null, 2);
}
