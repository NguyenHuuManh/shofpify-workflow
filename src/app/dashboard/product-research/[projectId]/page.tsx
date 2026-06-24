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
  decideSourceMatch,
  enrichCandidateSourcing,
  promoteCandidate,
  runSourceMatchReview,
  selectCandidate,
  applySourcingVerification,
} from '../actions';
import { sourceMatchResultSchema } from '@/schemas/research.schema';
import type { SourceMatchReviewResult } from '@/types/research.types';
import type {
  ProductCandidate,
  ResearchCandidateStatus,
  ResearchProjectStatus,
  ResearchSource,
} from '@prisma/client';

interface Props {
  params: { projectId: string };
  searchParams?: { candidateId?: string };
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
  searchParams,
}: Props): Promise<React.ReactElement> {
  let detail: Awaited<ReturnType<typeof researchService.getProjectDetail>>;

  try {
    detail = await researchService.getProjectDetail(params.projectId);
  } catch {
    notFound();
  }

  const selectedCandidate = detail.selectedCandidate;
  const topCandidate = selectedCandidate ?? detail.candidates[0];
  const detailCandidate =
    detail.candidates.find((candidate) => candidate.id === searchParams?.candidateId) ??
    topCandidate;
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {detail.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            projectId={detail.project.id}
            candidate={candidate}
            sources={detail.sources.filter((source) => source.candidateId === candidate.id)}
            isSelected={candidate.id === detail.project.selectedCandidateId}
            isPromoted={detail.project.status === 'PROMOTED' && candidate.productId === detail.project.promotedProductId}
            isOpen={candidate.id === detailCandidate?.id}
          />
        ))}
      </div>

      {detailCandidate && (
        <CandidateDetailPanel
          projectId={detail.project.id}
          candidate={detailCandidate}
          sources={detail.sources.filter((source) => source.candidateId === detailCandidate.id)}
          allSources={detail.sources}
          isSelected={detailCandidate.id === detail.project.selectedCandidateId}
          isPromoted={detail.project.status === 'PROMOTED' && detailCandidate.productId === detail.project.promotedProductId}
        />
      )}

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

function CompactData({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div
      style={{
        border: '1px solid #f1f5f9',
        borderRadius: '8px',
        padding: '9px 10px',
        minWidth: 0,
      }}
    >
      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, marginBottom: '3px' }}>
        {label}
      </div>
      <div
        style={{
          color: '#0f172a',
          fontSize: '14px',
          fontWeight: 800,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CandidateCard({
  projectId,
  candidate,
  sources,
  isSelected,
  isPromoted,
  isOpen,
}: {
  projectId: string;
  candidate: ProductCandidate;
  sources: ResearchSource[];
  isSelected: boolean;
  isPromoted: boolean;
  isOpen: boolean;
}): React.ReactElement {
  const productImage = extractProductImage(sources);
  const marketplaceSource = findSourceByType(sources, 'MARKETPLACE');
  const sourcingSource = findSourceByType(sources, 'SOURCING');
  const storeSourceUrl = getCandidateSourceUrl(candidate.metadata) ?? marketplaceSource?.url;
  const storePrice = extractStorePrice(sources) ?? candidate.recommendedPrice;

  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: isOpen ? '#0f172a' : '#e2e8f0',
        boxShadow: isOpen ? '0 0 0 1px #0f172a' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          aspectRatio: '4 / 3',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {productImage ? (
          <Image
            src={productImage}
            alt={candidate.name}
            width={420}
            height={315}
            unoptimized
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
            No image
          </div>
        )}
      </div>

      <div style={{ padding: '16px', display: 'grid', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <Badge variant={candidateStatusVariant[candidate.status]}>
              {candidate.status}
            </Badge>
            {isSelected && <Badge variant="success">Selected</Badge>}
            {isPromoted && <Badge variant="success">Promoted</Badge>}
            {!sourcingSource && <Badge variant="warning">Needs supplier</Badge>}
          </div>
          <h3
            style={{
              color: '#0f172a',
              fontSize: '16px',
              lineHeight: '22px',
              fontWeight: 700,
              margin: 0,
            }}
          >
            {candidate.name}
          </h3>
          <p
            style={{
              color: '#64748b',
              fontSize: '13px',
              lineHeight: '19px',
              margin: '6px 0 0',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {candidate.positioning}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '8px',
          }}
        >
          <CompactData label="Store Price" value={formatMoney(storePrice)} />
          <CompactData label="Score" value={candidate.winningScore?.toString() ?? 'N/A'} />
          <CompactData label="Landed" value={formatMoney(candidate.landedCost)} />
          <CompactData label="MOQ" value={candidate.moq?.toString() ?? 'N/A'} />
        </div>

        <EvidenceSummary sources={sources} />

        {(storeSourceUrl || sourcingSource?.url) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {storeSourceUrl && (
              <ExternalSourceLink href={storeSourceUrl} label="Open on Store" />
            )}
            {sourcingSource?.url && (
              <ExternalSourceLink href={sourcingSource.url} label="View on 1688" accent />
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
          <a
            href={`/dashboard/product-research/${projectId}?candidateId=${candidate.id}#candidate-detail`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 12px',
              border: '1px solid #0f172a',
              borderRadius: '8px',
              color: '#fff',
              background: '#0f172a',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            View Detail
          </a>
          <CandidateActions
            candidate={candidate}
            isSelected={isSelected}
            isPromoted={isPromoted}
          />
        </div>
      </div>
    </Card>
  );
}

function CandidateDetailPanel({
  projectId,
  candidate,
  sources,
  allSources,
  isSelected,
  isPromoted,
}: {
  projectId: string;
  candidate: ProductCandidate;
  sources: ResearchSource[];
  allSources: ResearchSource[];
  isSelected: boolean;
  isPromoted: boolean;
}): React.ReactElement {
  const marketplaceSource = findSourceByType(sources, 'MARKETPLACE');
  const sourcingSource = findSourceByType(sources, 'SOURCING');
  const storeSourceUrl = getCandidateSourceUrl(candidate.metadata) ?? marketplaceSource?.url;

  return (
    <div id="candidate-detail">
    <Card style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ color: '#0f172a', fontSize: '20px', fontWeight: 700, margin: 0 }}>
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
          {(storeSourceUrl || sourcingSource?.url) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {storeSourceUrl && (
                <ExternalSourceLink href={storeSourceUrl} label="Open on Store" />
              )}
              {sourcingSource?.url && (
                <ExternalSourceLink href={sourcingSource.url} label="View on 1688" accent />
              )}
            </div>
          )}
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

      <SourcingEnrichmentPanel
        projectId={projectId}
        candidate={candidate}
        sourcingSource={sourcingSource}
      />

      <SourcingVerificationPanel
        projectId={projectId}
        candidate={candidate}
        sourcingSource={sourcingSource}
      />

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

      <SourceMatchPanel
        projectId={projectId}
        candidate={candidate}
        sources={getSourceMatchReviewSources(candidate, sources, allSources)}
      />
    </Card>
    </div>
  );
}

function SourcingEnrichmentPanel({
  projectId,
  candidate,
  sourcingSource,
}: {
  projectId: string;
  candidate: ProductCandidate;
  sourcingSource: ResearchSource | null;
}): React.ReactElement {
  const enrichment = getSourcingEnrichment(candidate.metadata);

  return (
    <div style={{ marginTop: '20px', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <div style={{ color: '#0f172a', fontSize: '15px', fontWeight: 700 }}>
            Supplier / 1688 Sourcing
          </div>
          <div style={{ color: '#64748b', fontSize: '13px', lineHeight: '20px', marginTop: '3px' }}>
            Run sourcing only for this candidate after the product opportunity looks worth checking.
          </div>
        </div>
        <Badge variant={sourcingSource ? 'success' : 'warning'}>
          {sourcingSource ? 'Sourcing evidence saved' : 'Not sourced yet'}
        </Badge>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        <CompactData label="Factory Cost" value={formatMoney(candidate.factoryUnitCost)} />
        <CompactData label="MOQ" value={candidate.moq?.toString() ?? 'N/A'} />
        <CompactData label="Landed Cost" value={formatMoney(candidate.landedCost)} />
        <CompactData label="Sourcing Score" value={candidate.sourcingScore?.toString() ?? 'N/A'} />
      </div>

      {enrichment && (
        <div style={{ color: '#64748b', fontSize: '12px', lineHeight: '18px', marginBottom: '14px' }}>
          Last run: {enrichment.status ?? 'UNKNOWN'} · {enrichment.mode ?? 'agent_search'} · {enrichment.sourceCount ?? 0} source{enrichment.sourceCount === 1 ? '' : 's'}
        </div>
      )}

      <form action={enrichCandidateSourcing} style={{ display: 'grid', gap: '10px' }}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="candidateId" value={candidate.id} />
        <input
          name="sourcingUrl"
          type="url"
          placeholder="https://detail.1688.com/offer/..."
          defaultValue={enrichment?.sourcingUrl ?? ''}
          style={{
            width: '100%',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '9px 10px',
            color: '#0f172a',
            fontSize: '13px',
          }}
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            name="sourcingQuery"
            type="text"
            placeholder={candidate.name}
            style={{
              flex: '1 1 220px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '9px 10px',
              color: '#0f172a',
              fontSize: '13px',
            }}
          />
          <Button type="submit" size="sm" variant="secondary">
            Find Supplier
          </Button>
        </div>
      </form>
    </div>
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

function SourceMatchPanel({
  projectId,
  candidate,
  sources,
}: {
  projectId: string;
  candidate: ProductCandidate;
  sources: ResearchSource[];
}): React.ReactElement {
  const matches = getSourceMatches(candidate.metadata);
  const demandSources = sources.filter((source) => source.type !== 'SOURCING');
  const sourcingSources = sources.filter((source) => source.type === 'SOURCING');
  const canReview = demandSources.length > 0 && sourcingSources.length > 0;

  return (
    <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ color: '#0f172a', fontSize: '15px', fontWeight: 700 }}>
            Source Match Review
          </div>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '3px' }}>
            {demandSources.length} demand/store source{demandSources.length === 1 ? '' : 's'} · {sourcingSources.length} sourcing source{sourcingSources.length === 1 ? '' : 's'}
          </div>
        </div>
        <form action={runSourceMatchReview}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <input type="hidden" name="projectId" value={projectId} />
          {sources.map((source) => (
            <input key={source.id} type="hidden" name="sourceIds" value={source.id} />
          ))}
          <Button type="submit" size="sm" variant="secondary" disabled={!canReview}>
            Review Match
          </Button>
        </form>
      </div>

      {!canReview && (
        <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '20px' }}>
          Needs at least one persisted demand/store source and one sourcing source.
        </div>
      )}

      {matches.length > 0 && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {matches.map((match) => (
            <SourceMatchRow
              key={match.id}
              projectId={projectId}
              candidateId={candidate.id}
              match={match}
              sources={sources}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceMatchRow({
  projectId,
  candidateId,
  match,
  sources,
}: {
  projectId: string;
  candidateId: string;
  match: SourceMatchReviewResult;
  sources: ResearchSource[];
}): React.ReactElement {
  const source = sources.find((item) => item.id === match.sourceId);
  const matchedSource = sources.find((item) => item.id === match.matchedSourceId);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Badge variant={sourceMatchVariant(match.matchStatus)}>{match.matchStatus}</Badge>
            <span style={{ color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>
              {match.confidenceScore}% confidence
            </span>
            {match.reviewerDecision && (
              <Badge variant="success">{match.reviewerDecision}</Badge>
            )}
          </div>
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '6px', lineHeight: '18px' }}>
            {source?.title ?? match.sourceId} → {matchedSource?.title ?? match.matchedSourceId}
          </div>
        </div>
        {!match.reviewerDecision && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <SourceMatchDecisionButton
              projectId={projectId}
              candidateId={candidateId}
              matchId={match.id}
              decision="CONFIRMED_MATCH"
              label="Confirm"
            />
            <SourceMatchDecisionButton
              projectId={projectId}
              candidateId={candidateId}
              matchId={match.id}
              decision="REJECTED_MATCH"
              label="Reject"
            />
            <SourceMatchDecisionButton
              projectId={projectId}
              candidateId={candidateId}
              matchId={match.id}
              decision="NEEDS_BETTER_SOURCE"
              label="Better Source"
            />
          </div>
        )}
      </div>
      {match.reasons.length > 0 && (
        <div style={{ color: '#334155', fontSize: '13px', lineHeight: '20px', marginTop: '10px' }}>
          {match.reasons.join(' · ')}
        </div>
      )}
      {match.warnings.length > 0 && (
        <div style={{ color: '#92400e', fontSize: '13px', lineHeight: '20px', marginTop: '8px' }}>
          {match.warnings.join(' · ')}
        </div>
      )}
      <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
        Action: {match.recommendedAction}
      </div>
    </div>
  );
}

function SourceMatchDecisionButton({
  projectId,
  candidateId,
  matchId,
  decision,
  label,
}: {
  projectId: string;
  candidateId: string;
  matchId: string;
  decision: 'CONFIRMED_MATCH' | 'REJECTED_MATCH' | 'NEEDS_BETTER_SOURCE';
  label: string;
}): React.ReactElement {
  return (
    <form action={decideSourceMatch}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" size="sm" variant="secondary">
        {label}
      </Button>
    </form>
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

    for (const key of ['image', 'image_url', 'thumbnail', 'thumbnailUrl']) {
      const value = raw[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    // Check for image array from product detail
    if (Array.isArray(raw.images) && raw.images.length > 0) {
      const img = raw.images[0];
      if (typeof img === 'string' && img.length > 0) return img;
    }
  }
  return null;
}

function findSourceByType(
  sources: ResearchSource[],
  type: ResearchSource['type'],
): ResearchSource | null {
  return sources.find((source) => source.type === type && Boolean(source.url)) ??
    sources.find((source) => source.type === type) ??
    null;
}

function getCandidateSourceUrl(metadata: ProductCandidate['metadata']): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const sourceUrl = (metadata as Record<string, unknown>).sourceUrl;
  if (typeof sourceUrl !== 'string') {
    return null;
  }

  const trimmed = sourceUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractStorePrice(sources: ResearchSource[]): number | null {
  for (const source of sources) {
    if (source.type !== 'MARKETPLACE') {
      continue;
    }

    const raw = source.rawData as Record<string, unknown> | null;
    if (!raw) {
      continue;
    }

    const metrics =
      raw.metrics && typeof raw.metrics === 'object' && !Array.isArray(raw.metrics)
        ? (raw.metrics as Record<string, unknown>)
        : {};
    const price =
      parseNumber(metrics.price) ??
      parseNumber(raw.price) ??
      parseNumber(raw.listingPrice) ??
      parseNumber(raw.salePrice);

    if (price !== null) {
      return price;
    }
  }

  return null;
}

function getSourceMatchReviewSources(
  candidate: ProductCandidate,
  candidateSources: ResearchSource[],
  allSources: ResearchSource[],
): ResearchSource[] {
  const scopedSources = allSources.filter(
    (source) => source.candidateId === candidate.id || source.candidateId === null,
  );
  const sourceMap = new Map<string, ResearchSource>();

  for (const source of [...candidateSources, ...scopedSources]) {
    sourceMap.set(source.id, source);
  }

  return Array.from(sourceMap.values());
}

function getSourceMatches(metadata: ProductCandidate['metadata']): SourceMatchReviewResult[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [];
  }

  const sourceMatches = (metadata as Record<string, unknown>).sourceMatches;
  if (!Array.isArray(sourceMatches)) {
    return [];
  }

  return sourceMatches
    .map((match) => sourceMatchResultSchema.safeParse(match))
    .filter((result) => result.success)
    .map((result) => result.data);
}

function getSourcingEnrichment(metadata: ProductCandidate['metadata']): {
  mode?: string;
  sourcingUrl?: string;
  status?: string;
  sourceCount?: number;
} | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const enrichment = (metadata as Record<string, unknown>).sourcingEnrichment;
  if (!enrichment || typeof enrichment !== 'object' || Array.isArray(enrichment)) {
    return null;
  }

  const record = enrichment as Record<string, unknown>;
  return {
    mode: typeof record.mode === 'string' ? record.mode : undefined,
    sourcingUrl: typeof record.sourcingUrl === 'string' ? record.sourcingUrl : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    sourceCount: typeof record.sourceCount === 'number' ? record.sourceCount : undefined,
  };
}

function sourceMatchVariant(
  status: SourceMatchReviewResult['matchStatus'],
): 'warning' | 'info' | 'danger' | 'success' | 'default' {
  if (status === 'LIKELY_MATCH') {
    return 'success';
  }
  if (status === 'POTENTIAL_MATCH') {
    return 'warning';
  }
  if (status === 'WEAK_MATCH') {
    return 'info';
  }
  if (status === 'NOT_A_MATCH') {
    return 'danger';
  }

  return 'default';
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

function formatMoney(value: unknown): string {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return 'N/A';
  }

  return `$${parsed.toFixed(2)}`;
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

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[$,\s]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (
    value &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function SourcingVerificationPanel({
  projectId,
  candidate,
  sourcingSource: _sourcingSource,
}: {
  projectId: string;
  candidate: ProductCandidate;
  sourcingSource: ResearchSource | null;
}): React.ReactElement {
  const verification = getVerificationFromMetadata(candidate.metadata);

  return (
    <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ color: '#0f172a', fontSize: '15px', fontWeight: 700 }}>
            Supplier Verification
          </div>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '3px' }}>
            Confirm supplier legitimacy before making purchase decisions.
          </div>
        </div>
        {verification ? (
          <Badge variant={verificationStatusBadge(verification.status)}>
            {verification.status}
          </Badge>
        ) : (
          <Badge variant="warning">UNVERIFIED</Badge>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '8px',
          marginBottom: '14px',
        }}
      >
        <CheckItem label="Factory exists" checked={verification?.factoryExists ?? false} />
        <CheckItem label="MOQ confirmed" checked={verification?.moqConfirmed ?? false} />
        <CheckItem label="Price reasonable" checked={verification?.priceReasonable ?? false} />
        <CheckItem label="Samples available" checked={verification?.sampleAvailable ?? false} />
        <CheckItem label="Shipping feasible" checked={verification?.shippingFeasible ?? false} />
        <CheckItem label="Supplier responsive" checked={verification?.supplierResponsive ?? false} />
      </div>

      {verification?.notes && (
        <div style={{ color: '#334155', fontSize: '13px', lineHeight: '20px', marginBottom: '12px', fontStyle: 'italic' }}>
          &ldquo;{verification.notes}&rdquo;
        </div>
      )}

      {verification?.verifiedAt && (
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px' }}>
          Verified at {new Date(verification.verifiedAt).toLocaleDateString()}
        </div>
      )}

      {(!verification || verification.status !== 'VERIFIED') && (
        <form action={applySourcingVerification} style={{ display: 'grid', gap: '10px' }}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <input type="hidden" name="projectId" value={projectId} />

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Status:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#0f172a' }}>
              <input type="radio" name="verificationStatus" value="VERIFIED" defaultChecked />
              Verify
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#0f172a' }}>
              <input type="radio" name="verificationStatus" value="REJECTED" />
              Reject
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#0f172a' }}>
              <input type="radio" name="verificationStatus" value="NEEDS_MORE_INFO" />
              More Info
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#0f172a' }}>
              <input type="radio" name="verificationStatus" value="PENDING_VERIFICATION" />
              Pending
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '8px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
              <input type="checkbox" name="factoryExists" />
              Factory exists
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
              <input type="checkbox" name="moqConfirmed" />
              MOQ confirmed
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
              <input type="checkbox" name="priceReasonable" />
              Price reasonable
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
              <input type="checkbox" name="sampleAvailable" />
              Samples available
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
              <input type="checkbox" name="shippingFeasible" />
              Shipping feasible
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
              <input type="checkbox" name="supplierResponsive" />
              Supplier responsive
            </label>
          </div>

          <input
            name="notes"
            type="text"
            placeholder="Verification notes (optional)"
            style={{
              width: '100%',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '9px 10px',
              color: '#0f172a',
              fontSize: '13px',
            }}
          />

          <Button type="submit" size="sm">
            Apply Verification
          </Button>
        </form>
      )}

      {verification?.status === 'VERIFIED' && (
        <div style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
          ✓ Supplier sourcing evidence has been verified by a human reviewer.
        </div>
      )}
    </div>
  );
}

function CheckItem({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        color: checked ? '#16a34a' : '#94a3b8',
        padding: '6px 8px',
        border: `1px solid ${checked ? '#dcfce7' : '#f1f5f9'}`,
        borderRadius: '6px',
      }}
    >
      <span>{checked ? '✓' : '○'}</span>
      <span>{label}</span>
    </div>
  );
}

function verificationStatusBadge(
  status: string,
): 'warning' | 'info' | 'danger' | 'success' | 'default' {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'NEEDS_MORE_INFO':
      return 'warning';
    case 'PENDING_VERIFICATION':
      return 'info';
    default:
      return 'default';
  }
}

function getVerificationFromMetadata(metadata: ProductCandidate['metadata']): {
  status: string;
  verifiedAt: string | null;
  factoryExists: boolean;
  moqConfirmed: boolean;
  priceReasonable: boolean;
  sampleAvailable: boolean;
  shippingFeasible: boolean;
  supplierResponsive: boolean;
  notes?: string;
} | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const verificationData = (metadata as Record<string, unknown>).sourcingVerification;
  if (!verificationData || typeof verificationData !== 'object' || Array.isArray(verificationData)) {
    return null;
  }

  const v = verificationData as Record<string, unknown>;
  return {
    status: typeof v.status === 'string' ? v.status : 'UNVERIFIED',
    verifiedAt: typeof v.verifiedAt === 'string' ? v.verifiedAt : null,
    factoryExists: Boolean(v.factoryExists),
    moqConfirmed: Boolean(v.moqConfirmed),
    priceReasonable: Boolean(v.priceReasonable),
    sampleAvailable: Boolean(v.sampleAvailable),
    shippingFeasible: Boolean(v.shippingFeasible),
    supplierResponsive: Boolean(v.supplierResponsive),
    notes: typeof v.notes === 'string' ? v.notes : undefined,
  };
}
