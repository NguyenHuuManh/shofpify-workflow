'use client';

/**
 * Purpose:
 * Landing Page Review & Edit page — view, edit, approve, or reject AI-generated landing page.
 * Route: /dashboard/workflows/:id/landing
 *
 * Dependencies:
 * - /api/workflows/:id/landing (GET, PUT)
 * - /api/workflows/:id/review/landing (POST approve/reject)
 * - UI components (Card, Button, Badge)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Badge } from '@/components/ui';

interface LandingSection {
  type: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta';
  title?: string;
  content?: Record<string, unknown>;
}

interface LandingData {
  id: string;
  productId: string;
  sections: LandingSection[];
}

interface WorkflowData {
  id: string;
  currentStep: string;
  status: string;
}

export default function LandingReviewPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workflowId = params.id;

  const [landing, setLanding] = useState<LandingData | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [sectionsJson, setSectionsJson] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [landingRes, workflowRes] = await Promise.all([
        fetch(`/api/workflows/${workflowId}/landing`),
        fetch(`/api/workflows/${workflowId}`),
      ]);

      const landingJson = await landingRes.json();
      const workflowJson = await workflowRes.json();

      if (landingJson.success && landingJson.data) {
        const l: LandingData = landingJson.data;
        setLanding(l);
        setSectionsJson(JSON.stringify(l.sections, null, 2));
      }

      if (workflowJson.success) {
        setWorkflow(workflowJson.data as WorkflowData);
      }
    } catch {
      setError('Failed to load landing page data');
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

      let sections: LandingSection[];

      try {
        sections = JSON.parse(sectionsJson);
      } catch {
        setError('Invalid JSON in sections. Please check your input.');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/workflows/${workflowId}/landing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to save');
        return;
      }

      setSuccessMsg('Landing page saved successfully');
    } catch {
      setError('Failed to save landing page');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/workflows/${workflowId}/review/landing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: 'cmqezshl80004109842n6fb15',
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
        // Trigger the next agent (Image/Shopify) automatically
        try {
          await fetch(`/api/workflows/${workflowId}`, { method: 'POST' });
        } catch {
          // Agent trigger failure is non-fatal
        }
        router.push(`/dashboard/workflows/${workflowId}`);
      } else {
        setSuccessMsg('Rejected — landing page will be regenerated');
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
        Loading landing page...
      </div>
    );
  }

  if (!landing) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3 style={{ color: '#64748b' }}>No landing page data found</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          The Landing Agent may not have completed yet.
        </p>
        <Button variant="secondary" onClick={() => router.push(`/dashboard/workflows/${workflowId}`)}>
          ← Back to Workflow
        </Button>
      </div>
    );
  }

  const isReviewStep = workflow?.currentStep === 'LANDING_REVIEW';

  // Render sections preview as cards — normalize object → array if needed
  const sections: LandingSection[] = (() => {
    try {
      const raw = JSON.parse(sectionsJson);
      if (Array.isArray(raw)) return raw;
      // Agent returns object {hero: {...}, benefits: {...}} — convert to array
      return Object.entries(raw).map(([type, content]) => ({
        type: type as LandingSection['type'],
        content: content as Record<string, unknown>,
      }));
    } catch {
      const raw = landing.sections as unknown;
      if (Array.isArray(raw)) return raw as LandingSection[];
      if (raw && typeof raw === 'object') {
        return Object.entries(raw as Record<string, unknown>).map(([type, content]) => ({
          type: type as LandingSection['type'],
          content: content as Record<string, unknown>,
        }));
      }
      return [];
    }
  })();

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
          🏠 Landing Page Review & Edit
        </h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
          Review and edit the AI-generated landing page sections before approving
        </p>
      </div>

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

      {/* Section Previews */}
      <Card style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: '#64748b' }}>
          📐 Section Structure ({sections.length} sections)
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {sections.map((section, i) => (
            <div
              key={`${section.type}-${i}`}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#3b82f6',
              }} />
              {section.type}
              {section.title && <span style={{ color: '#94a3b8' }}>— {section.title}</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Raw JSON Editor */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="landing-sections" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          Sections (JSON) — edit the full structure
        </label>
        <textarea
          id="landing-sections"
          value={sectionsJson}
          onChange={(e) => setSectionsJson(e.target.value)}
          rows={20}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            resize: 'vertical',
            color: '#0f172a',
            lineHeight: '1.5',
          }}
        />
      </Card>

      {/* Actions */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? '💾 Saving...' : '💾 Save Changes'}
          </Button>

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
              Review available at LANDING_REVIEW step (current: {workflow.currentStep})
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
