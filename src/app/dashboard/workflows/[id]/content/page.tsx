'use client';

/**
 * Purpose:
 * Content Review & Edit page — view, edit, approve, or reject AI-generated product content.
 * Route: /dashboard/workflows/:id/content
 *
 * Dependencies:
 * - /api/workflows/:id/content (GET, PUT)
 * - /api/workflows/:id/review/content (POST approve/reject)
 * - UI components (Card, Button, Badge)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Badge } from '@/components/ui';

interface ContentData {
  id: string;
  productId: string;
  headline: string;
  subHeadline: string | null;
  description: string;
  benefits: Record<string, unknown>[];
  features: Record<string, unknown>[];
  faq: Record<string, unknown>[];
}

interface WorkflowData {
  id: string;
  currentStep: string;
  status: string;
}

export default function ContentReviewPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workflowId = params.id;

  const [content, setContent] = useState<ContentData | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [headline, setHeadline] = useState('');
  const [subHeadline, setSubHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [benefitsJson, setBenefitsJson] = useState('');
  const [featuresJson, setFeaturesJson] = useState('');
  const [faqJson, setFaqJson] = useState('');

  const [rejectComment, setRejectComment] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [contentRes, workflowRes] = await Promise.all([
        fetch(`/api/workflows/${workflowId}/content`),
        fetch(`/api/workflows/${workflowId}`),
      ]);

      const contentJson = await contentRes.json();
      const workflowJson = await workflowRes.json();

      if (contentJson.success && contentJson.data) {
        const c: ContentData = contentJson.data;
        setContent(c);
        setHeadline(c.headline || '');
        setSubHeadline(c.subHeadline || '');
        setDescription(c.description || '');
        setBenefitsJson(JSON.stringify(c.benefits, null, 2));
        setFeaturesJson(JSON.stringify(c.features, null, 2));
        setFaqJson(JSON.stringify(c.faq, null, 2));
      }

      if (workflowJson.success) {
        setWorkflow(workflowJson.data as WorkflowData);
      }
    } catch {
      setError('Failed to load content data');
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

      let benefits: unknown[];
      let features: unknown[];
      let faq: unknown[];

      try {
        benefits = JSON.parse(benefitsJson);
        features = JSON.parse(featuresJson);
        faq = JSON.parse(faqJson);
      } catch {
        setError('Invalid JSON in benefits, features, or FAQ. Please check your input.');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/workflows/${workflowId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          subHeadline: subHeadline || null,
          description,
          benefits,
          features,
          faq,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to save');
        return;
      }

      setSuccessMsg('Content saved successfully');
    } catch {
      setError('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/workflows/${workflowId}/review/content`, {
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
        // Trigger the next agent (SEO) automatically
        try {
          await fetch(`/api/workflows/${workflowId}`, { method: 'POST' });
        } catch {
          // Agent trigger failure is non-fatal
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
        Loading content data...
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3 style={{ color: '#64748b' }}>No content data found</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          The Content Agent may not have completed yet.
        </p>
        <Button variant="secondary" onClick={() => router.push(`/dashboard/workflows/${workflowId}`)}>
          ← Back to Workflow
        </Button>
      </div>
    );
  }

  const isReviewStep = workflow?.currentStep === 'CONTENT_REVIEW';

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
          📝 Content Review & Edit
        </h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
          Review and edit the AI-generated product content before approving
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

      {/* Headline */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="content-headline" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          Headline
        </label>
        <input
          id="content-headline"
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* Sub-headline */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="content-subheadline" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          Sub-headline
        </label>
        <input
          id="content-subheadline"
          type="text"
          value={subHeadline}
          onChange={(e) => setSubHeadline(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* Description */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="content-description" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          Description
        </label>
        <textarea
          id="content-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
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

      {/* Benefits */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="content-benefits" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          Benefits (JSON)
        </label>
        <textarea
          id="content-benefits"
          value={benefitsJson}
          onChange={(e) => setBenefitsJson(e.target.value)}
          rows={5}
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

      {/* Features */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="content-features" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          Features (JSON)
        </label>
        <textarea
          id="content-features"
          value={featuresJson}
          onChange={(e) => setFeaturesJson(e.target.value)}
          rows={5}
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

      {/* FAQ */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="content-faq" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          FAQ (JSON)
        </label>
        <textarea
          id="content-faq"
          value={faqJson}
          onChange={(e) => setFaqJson(e.target.value)}
          rows={5}
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
              Review available at CONTENT_REVIEW step (current: {workflow.currentStep})
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
