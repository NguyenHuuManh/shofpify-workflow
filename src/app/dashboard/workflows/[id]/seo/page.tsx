'use client';

/**
 * Purpose:
 * SEO Review & Edit page — view, edit, approve, or reject AI-generated SEO metadata.
 * Route: /dashboard/workflows/:id/seo
 *
 * Dependencies:
 * - /api/workflows/:id/seo (GET, PUT)
 * - /api/workflows/:id/review/seo (POST approve/reject)
 * - UI components (Card, Button, Badge)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Badge } from '@/components/ui';

interface SEOData {
  id: string;
  productId: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  keywords: string[];
}

interface WorkflowData {
  id: string;
  currentStep: string;
  status: string;
}

export default function SEOReviewPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workflowId = params.id;

  const [seo, setSeo] = useState<SEOData | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [keywordsText, setKeywordsText] = useState('');

  const [rejectComment, setRejectComment] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [seoRes, workflowRes] = await Promise.all([
        fetch(`/api/workflows/${workflowId}/seo`),
        fetch(`/api/workflows/${workflowId}`),
      ]);

      const seoJson = await seoRes.json();
      const workflowJson = await workflowRes.json();

      if (seoJson.success && seoJson.data) {
        const s: SEOData = seoJson.data;
        setSeo(s);
        setMetaTitle(s.metaTitle || '');
        setMetaDescription(s.metaDescription || '');
        setSlug(s.slug || '');
        setKeywordsText(Array.isArray(s.keywords) ? s.keywords.join(', ') : '');
      }

      if (workflowJson.success) {
        setWorkflow(workflowJson.data as WorkflowData);
      }
    } catch {
      setError('Failed to load SEO data');
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

      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch(`/api/workflows/${workflowId}/seo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaTitle,
          metaDescription,
          slug,
          keywords,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to save');
        return;
      }

      setSuccessMsg('SEO metadata saved successfully');
    } catch {
      setError('Failed to save SEO');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/workflows/${workflowId}/review/seo`, {
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
        // Trigger the next agent (Landing) automatically
        try {
          await fetch(`/api/workflows/${workflowId}`, { method: 'POST' });
        } catch {
          // Agent trigger failure is non-fatal
        }
        router.push(`/dashboard/workflows/${workflowId}`);
      } else {
        setSuccessMsg('Rejected — SEO will be regenerated');
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
        Loading SEO data...
      </div>
    );
  }

  if (!seo) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3 style={{ color: '#64748b' }}>No SEO data found</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          The SEO Agent may not have completed yet.
        </p>
        <Button variant="secondary" onClick={() => router.push(`/dashboard/workflows/${workflowId}`)}>
          ← Back to Workflow
        </Button>
      </div>
    );
  }

  const isReviewStep = workflow?.currentStep === 'SEO_REVIEW';

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
          🔎 SEO Review & Edit
        </h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
          Review and edit the AI-generated SEO metadata before approving
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

      {/* Meta Title */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label htmlFor="seo-metatitle" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
            Meta Title
          </label>
          <span style={{ fontSize: '12px', color: metaTitle.length > 70 ? '#ef4444' : '#94a3b8' }}>
            {metaTitle.length}/70
          </span>
        </div>
        <input
          type="text"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1px solid ${metaTitle.length > 70 ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: '8px',
            fontSize: '14px',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* Meta Description */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label htmlFor="seo-metadesc" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
            Meta Description
          </label>
          <span style={{ fontSize: '12px', color: metaDescription.length > 160 ? '#ef4444' : '#94a3b8' }}>
            {metaDescription.length}/160
          </span>
        </div>
        <textarea
          id="seo-metadesc"
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            border: `1px solid ${metaDescription.length > 160 ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'inherit',
            resize: 'vertical',
            color: '#0f172a',
          }}
        />
      </Card>

      {/* URL Slug */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="seo-slug" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          URL Slug
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>/products/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#0f172a',
            }}
          />
        </div>
      </Card>

      {/* Keywords */}
      <Card style={{ marginBottom: '16px' }}>
        <label htmlFor="seo-keywords" style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
          Keywords (comma-separated)
        </label>
        <input
          id="seo-keywords"
          type="text"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="e.g., portable blender, travel blender, mini smoothie maker"
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

      {/* SEO Preview */}
      <Card style={{ marginBottom: '16px', background: '#f8fafc' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px', color: '#64748b' }}>
          🔍 Search Result Preview
        </h3>
        <div style={{ fontSize: '18px', color: '#1a0dab', fontWeight: 400, marginBottom: '2px' }}>
          {metaTitle || 'No title'}
        </div>
        <div style={{ fontSize: '14px', color: '#006621', marginBottom: '2px' }}>
          https://yourstore.com/products/{slug || '...'}
        </div>
        <div style={{ fontSize: '13px', color: '#545454', lineHeight: '1.4' }}>
          {metaDescription || 'No description'}
        </div>
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
              Review available at SEO_REVIEW step (current: {workflow.currentStep})
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
