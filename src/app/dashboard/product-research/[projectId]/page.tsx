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
  const runInput = parseResearchRunInput(detail.latestRun?.input);
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

      {runInput && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
            Research Brief
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            <DataPoint label="Market" value={runInput.targetMarket ?? 'US'} />
            <DataPoint label="Objective" value={runInput.objective ?? 'find_winning_product'} />
            <DataPoint label="Price Band" value={runInput.priceBand ?? 'N/A'} />
            <DataPoint label="Target Margin" value={runInput.targetMargin ?? '40%'} />
            <DataPoint label="Max MOQ" value={runInput.maxMoq ?? 'N/A'} />
            <DataPoint label="Risk" value={runInput.riskTolerance ?? 'medium'} />
          </div>
          {runInput.excludedCategories && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {runInput.excludedCategories.map((category) => (
                <Badge key={category} variant="default">
                  Exclude {category}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

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

      {detail.candidates.length > 1 && (
        <CompareSnapshot
          candidates={detail.candidates.slice(0, 5)}
          sources={detail.sources}
          selectedCandidateId={detail.project.selectedCandidateId}
        />
      )}

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
  const primarySource = findPrimarySource(candidate, sources);
  const marketplaceSource = primarySource?.type === 'MARKETPLACE' ? primarySource : null;
  const sourcingSource = primarySource?.type === 'SOURCING' ? primarySource : null;

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
            <EvidenceSummary sources={sources} />
            {(marketplaceSource?.url || sourcingSource?.url) && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {marketplaceSource?.url && (
                  <ExternalSourceLink href={marketplaceSource.url} label="View on Store" />
                )}
                {sourcingSource?.url && (
                  <ExternalSourceLink href={sourcingSource.url} label="View on 1688" accent />
                )}
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

function CompareSnapshot({
  candidates,
  sources,
  selectedCandidateId,
}: {
  candidates: ProductCandidate[];
  sources: ResearchSource[];
  selectedCandidateId: string | null;
}): React.ReactElement {
  return (
    <Card style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ color: '#0f172a', fontSize: '16px', fontWeight: 700 }}>
          Candidate Compare
        </div>
      </div>
      <Table
        headers={['Candidate', 'Score', 'Economics', 'Sourcing', 'Evidence']}
        rows={candidates.map((candidate) => {
          const candidateSources = sources.filter((source) => source.candidateId === candidate.id);
          const evidence = summarizeEvidence(candidateSources);

          return [
            <div key="candidate">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{candidate.name}</span>
                {candidate.id === selectedCandidateId && <Badge variant="success">Selected</Badge>}
              </div>
              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '3px' }}>
                {candidate.status} · {candidate.confidence ?? 'low'} confidence
              </div>
            </div>,
            <span key="score" style={{ color: '#0f172a', fontWeight: 700 }}>
              {candidate.winningScore ?? 'N/A'}
            </span>,
            <div key="economics" style={{ color: '#334155', fontSize: '13px', lineHeight: '20px' }}>
              Price {formatMoney(candidate.recommendedPrice)}
              <br />
              Landed {formatMoney(candidate.landedCost)}
              <br />
              Margin {formatPercent(candidate.grossMarginPercent)}
            </div>,
            <div key="sourcing" style={{ color: '#334155', fontSize: '13px', lineHeight: '20px' }}>
              Factory {formatMoney(candidate.factoryUnitCost)}
              <br />
              MOQ {candidate.moq?.toString() ?? 'N/A'}
              <br />
              Logistics {candidate.logisticsScore ?? 'N/A'}
            </div>,
            <div key="evidence" style={{ color: '#334155', fontSize: '13px', lineHeight: '20px' }}>
              {evidence.count} sources
              <br />
              {evidence.types || 'No linked types'}
              <br />
              Avg confidence {evidence.averageConfidence}
            </div>,
          ];
        })}
      />
    </Card>
  );
}

function EvidenceSummary({ sources }: { sources: ResearchSource[] }): React.ReactElement {
  const evidence = summarizeEvidence(sources);

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
      <Badge variant={evidence.count > 0 ? 'success' : 'default'}>
        {evidence.count} source{evidence.count === 1 ? '' : 's'}
      </Badge>
      {evidence.types && <Badge variant="default">{evidence.types}</Badge>}
      <Badge variant="default">Confidence {evidence.averageConfidence}</Badge>
    </div>
  );
}

function ExternalSourceLink({
  href,
  label,
  accent = false,
}: {
  href: string;
  label: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '8px',
        border: accent ? '1px solid #f97316' : '1px solid #e2e8f0',
        background: accent ? '#fff7ed' : '#fff',
        color: accent ? '#c2410c' : '#0f172a',
        fontSize: '13px',
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      {label}
    </a>
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

function findPrimarySource(
  candidate: ProductCandidate,
  sources: ResearchSource[],
): ResearchSource | null {
  const sourceType = metadataString(candidate.metadata, 'sourceType');
  const sourceProvider = metadataString(candidate.metadata, 'sourceProvider');
  const sourceUrl = metadataString(candidate.metadata, 'sourceUrl');
  const sourceExternalId = metadataString(candidate.metadata, 'sourceExternalId');

  if (!sourceType) {
    return sources[0] ?? null;
  }

  return (
    sources.find((source) => {
      if (source.type !== sourceType) {
        return false;
      }

      if (sourceProvider && source.provider !== sourceProvider) {
        return false;
      }

      if (sourceExternalId && source.externalId === sourceExternalId) {
        return true;
      }

      if (sourceUrl && source.url === sourceUrl) {
        return true;
      }

      return !sourceExternalId && !sourceUrl;
    }) ?? null
  );
}

function metadataString(metadata: ProductCandidate['metadata'], key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function summarizeEvidence(sources: ResearchSource[]): {
  count: number;
  types: string;
  averageConfidence: string;
} {
  const types = Array.from(new Set(sources.map((source) => source.type))).join(', ');
  const confidences = sources
    .map((source) => source.confidence)
    .filter((confidence): confidence is number => confidence !== null);
  const averageConfidence =
    confidences.length === 0
      ? 'N/A'
      : `${Math.round(
          (confidences.reduce((sum, confidence) => sum + confidence, 0) /
            confidences.length) *
            100,
        )}%`;

  return {
    count: sources.length,
    types,
    averageConfidence,
  };
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

function parseResearchRunInput(input: unknown): {
  targetMarket?: string;
  objective?: string;
  priceBand?: string;
  targetMargin?: string;
  maxMoq?: string;
  riskTolerance?: string;
  excludedCategories?: string[];
} | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const root = input as Record<string, unknown>;
  const config =
    root.config && typeof root.config === 'object'
      ? (root.config as Record<string, unknown>)
      : {};
  const sourcing =
    config.sourcing && typeof config.sourcing === 'object'
      ? (config.sourcing as Record<string, unknown>)
      : {};
  const priceBand =
    config.priceBand && typeof config.priceBand === 'object'
      ? (config.priceBand as Record<string, unknown>)
      : undefined;
  const excludedCategories = Array.isArray(config.excludedCategories)
    ? config.excludedCategories
        .map((category) => String(category))
        .filter(Boolean)
    : undefined;

  return {
    targetMarket: typeof config.targetMarket === 'string' ? config.targetMarket : undefined,
    objective: typeof config.objective === 'string' ? config.objective : undefined,
    priceBand: priceBand
      ? `$${String(priceBand.min ?? 0)}-$${String(priceBand.max ?? 0)}`
      : undefined,
    targetMargin:
      config.targetMarginPercent === undefined
        ? undefined
        : `${String(config.targetMarginPercent)}%`,
    maxMoq: sourcing.maxMoq === undefined ? undefined : String(sourcing.maxMoq),
    riskTolerance:
      typeof config.riskTolerance === 'string' ? config.riskTolerance : undefined,
    excludedCategories,
  };
}
