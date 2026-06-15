'use client';

/**
 * Purpose:
 * Research Review & Edit page — view, edit, approve, or reject AI-generated research.
 * Route: /dashboard/workflows/:id/research
 *
 * Dependencies:
 * - /api/workflows/:id/research (GET, PUT)
 * - /api/workflows/:id/review/research (POST approve/reject)
 * - UI components (Card, Button, Badge)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Badge } from '@/components/ui';

interface ResearchData {
  id: string;
  productId: string;
  targetAudience: Record<string, unknown>[];
  competitors: Record<string, unknown>[];
  painPoints: Record<string, unknown>[];
  usp: Record<string, unknown>[];
  marketSummary: string;
  generatedAt: string;
}

interface WorkflowData {
  id: string;
  currentStep: string;
  status: string;
  productId: string;
}

const DEFAULT_REVIEWER_ID = 'cmqezshl80004109842n6fb15';

export default function ResearchReviewPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workflowId = params.id;

  const [research, setResearch] = useState<ResearchData | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable form state
  const [marketSummary, setMarketSummary] = useState('');
  const [targetAudienceJson, setTargetAudienceJson] = useState('');
  const [competitorsJson, setCompetitorsJson] = useState('');
  const [painPointsJson, setPainPointsJson] = useState('');
  const [uspJson, setUspJson] = useState('');

  // Rejection comment
  const [rejectComment, setRejectComment] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [researchRes, workflowRes] = await Promise.all([
        fetch(`/api/workflows/${workflowId}/research`),
        fetch(`/api/workflows/${workflowId}`),
      ]);

      const researchJson = await researchRes.json();
      const workflowJson = await workflowRes.json();

      if (researchJson.success && researchJson.data) {
        const r: ResearchData = researchJson.data;
        setResearch(r);
        setMarketSummary(r.marketSummary || '');
        setTargetAudienceJson(JSON.stringify(r.targetAudience, null, 2));
        setCompetitorsJson(JSON.stringify(r.competitors, null, 2));
        setPainPointsJson(JSON.stringify(r.painPoints, null, 2));
        setUspJson(JSON.stringify(r.usp, null, 2));
      }

      if (workflowJson.success) {
        setWorkflow(workflowJson.data as WorkflowData);
      }
    } catch {
      setError('Failed to load research data');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      // Parse JSON fields
      let targetAudience: unknown[];
      let competitors: unknown[];
      let painPoints: unknown[];
      let usp: unknown[];

      try {
        targetAudience = JSON.parse(targetAudienceJson);
        competitors = JSON.parse(competitorsJson);
        painPoints = JSON.parse(painPointsJson);
        usp = JSON.parse(uspJson);
      } catch {
        setError('Invalid JSON in one or more fields. Please check your input.');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/workflows/${workflowId}/research`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketSummary,
          targetAudience,
          competitors,
          painPoints,
          usp,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to save');
        return;
      }

      setSuccessMsg('Research saved successfully');
    } catch {
      setError('Failed to save research');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/workflows/${workflowId}/review/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: DEFAULT_REVIEWER_ID,
          decision,
          comment: decision === 'REJECTED' ? rejectComment : undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || `Failed to ${decision.toLowerCase()}`);
        return;
      }

      if (decision === 'APPROVED') {
        // Trigger the next agent (Content) automatically
        try {
          await fetch(`/api/workflows/${workflowId}`, { method: 'POST' });
        } catch {
          // Agent trigger failure is non-fatal — user can trigger manually
        }
        router.push(`/dashboard/workflows/${workflowId}`);
      } else {
        setSuccessMsg('Rejected — content will be regenerated');
        setRejectComment('');
      }
    } catch {
      setError('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        Loading research data...
      </div>
    );
  }

  if (!research) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3 style={{ color: '#64748b' }}>No research data found</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          The Research Agent may not have completed yet.
        </p>
        <Button variant="secondary" onClick={() => router.push(`/dashboard/workflows/${workflowId}`)}>
          ← Back to Workflow
        </Button>
      </div>
    );
  }

  const isReviewStep = workflow?.currentStep === 'RESEARCH_REVIEW';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/workflows/${workflowId}`)}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '13px',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '8px',
          }}
        >
          ← Back to Workflow
        </button>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
          🔬 Research Review & Edit
        </h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
          Review and edit the AI-generated market research before approving
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          background: '#fef2f2', color: '#991b1b', padding: '12px 16px',
          borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
        }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          background: '#f0fdf4', color: '#166534', padding: '12px 16px',
          borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
        }}>
          {successMsg}
        </div>
      )}

      {/* Market Summary */}
      <Card style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px', color: '#0f172a' }}>
          Market Summary
        </h3>
        <textarea
          value={marketSummary}
          onChange={(e) => setMarketSummary(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'inherit',
            resize: 'vertical',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* Target Audience */}
      <Card style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px', color: '#0f172a' }}>
          Target Audience
        </h3>
        <textarea
          value={targetAudienceJson}
          onChange={(e) => setTargetAudienceJson(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            resize: 'vertical',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* Competitors */}
      <Card style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px', color: '#0f172a' }}>
          Competitors
        </h3>
        <textarea
          value={competitorsJson}
          onChange={(e) => setCompetitorsJson(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            resize: 'vertical',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* Pain Points */}
      <Card style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px', color: '#0f172a' }}>
          Pain Points
        </h3>
        <textarea
          value={painPointsJson}
          onChange={(e) => setPainPointsJson(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            resize: 'vertical',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* USPs */}
      <Card style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px', color: '#0f172a' }}>
          Unique Selling Propositions (USPs)
        </h3>
        <textarea
          value={uspJson}
          onChange={(e) => setUspJson(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            resize: 'vertical',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* Actions */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Save */}
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? '💾 Saving...' : '💾 Save Changes'}
          </Button>

          {/* Review actions — only show when at review step */}
          {isReviewStep && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div>
                <input
                  type="text"
                  placeholder="Rejection reason (required)"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    width: '220px',
                    color: '#0f172a',
                  }}
                />
              </div>
              <Button
                variant="danger"
                onClick={() => handleReview('REJECTED')}
                disabled={submitting || !rejectComment.trim()}
              >
                {submitting ? '...' : '✗ Reject'}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleReview('APPROVED')}
                disabled={submitting}
              >
                {submitting ? '...' : '✓ Approve'}
              </Button>
            </div>
          )}

          {!isReviewStep && workflow && (
            <Badge variant="warning">
              Review available at RESEARCH_REVIEW step (current: {workflow.currentStep})
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
