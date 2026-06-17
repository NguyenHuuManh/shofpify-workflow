'use client';

/**
 * Purpose:
 * Delete Product Research project button with confirmation modal.
 *
 * Responsibilities:
 * - Ask for confirmation before deleting a research project
 * - Call the Product Research DELETE API route
 * - Refresh the dashboard list after deletion
 *
 * Dependencies:
 * - next/navigation
 * - @/components/ui
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner } from '@/components/ui';

interface DeleteResearchProjectButtonProps {
  projectId: string;
  projectQuery: string;
}

export function DeleteResearchProjectButton({
  projectId,
  projectQuery,
}: DeleteResearchProjectButtonProps): React.ReactElement {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showModal) {
      return;
    }

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/product-research/${projectId}`, {
        method: 'DELETE',
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setError(json.error?.message ?? 'Failed to delete research project');
        setDeleting(false);
        return;
      }

      setShowModal(false);
      document.body.style.overflow = '';
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setShowModal(true)}
      >
        Delete
      </Button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete research project confirmation"
          onClick={() => {
            if (!deleting) {
              setShowModal(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !deleting) {
              setShowModal(false);
            }
          }}
          tabIndex={-1}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            role="document"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(15, 23, 42, 0.24)',
            }}
          >
            <h3
              style={{
                color: '#0f172a',
                fontSize: '18px',
                fontWeight: 700,
                margin: '0 0 8px',
              }}
            >
              Delete Research Project
            </h3>
            <p
              style={{
                color: '#64748b',
                fontSize: '14px',
                lineHeight: '22px',
                margin: '0 0 8px',
              }}
            >
              This will permanently delete "{projectQuery}" and its research runs,
              candidates, and source evidence.
            </p>
            <p
              style={{
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: 600,
                margin: '0 0 18px',
              }}
            >
              Product workflows that were already promoted are not deleted.
            </p>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '13px',
                  marginBottom: '14px',
                  padding: '10px 12px',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Spinner size={14} />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
