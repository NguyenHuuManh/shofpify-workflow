'use client';

/**
 * Purpose:
 * Delete workflow button with modal confirmation popup.
 */

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useState, useEffect } from 'react';

interface Props {
  workflowId: string;
}

export function DeleteWorkflowButton({ workflowId }: Props): React.ReactElement {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [showModal]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { method: 'DELETE' });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Failed to delete');
        setDeleting(false);
        return;
      }

      // Close modal immediately, then redirect
      setShowModal(false);
      document.body.style.overflow = '';
      router.push('/dashboard/workflows');
      router.refresh();
    } catch {
      setError('Network error — please try again');
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setShowModal(true)}>
        🗑 Delete
      </Button>

      {showModal && (
        <>
          {/* Overlay */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete workflow confirmation"
            onClick={() => !deleting && setShowModal(false)}
            onKeyDown={(e) => { if (e.key === 'Escape' && !deleting) setShowModal(false); }}
            tabIndex={-1}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Modal */}
            <div
              role="document"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: '14px',
                padding: '28px 32px',
                maxWidth: '420px',
                width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                zIndex: 1001,
              }}
            >
              {/* Icon */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#fef2f2',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                  }}
                >
                  ⚠️
                </div>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  textAlign: 'center',
                  margin: '0 0 8px',
                  color: '#0f172a',
                }}
              >
                Delete Workflow
              </h3>

              {/* Message */}
              <p
                style={{
                  fontSize: '14px',
                  color: '#64748b',
                  textAlign: 'center',
                  margin: '0 0 8px',
                  lineHeight: '1.5',
                }}
              >
                This will permanently delete the workflow and all its steps, approvals, and agent runs.
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: '#ef4444',
                  textAlign: 'center',
                  margin: '0 0 24px',
                  fontWeight: 500,
                }}
              >
                This action cannot be undone.
              </p>

              {/* Error */}
              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    marginBottom: '16px',
                    textAlign: 'center',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => { setShowModal(false); setError(null); }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '⏳ Deleting...' : 'Delete Permanently'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
