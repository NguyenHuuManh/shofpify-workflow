/**
 * Purpose:
 * Client component for the Product Research creation form with loading state.
 * Uses useFormStatus to show a spinner while the server action is pending.
 */

'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Card, Spinner } from '@/components/ui';
import { createResearchProject } from '@/app/dashboard/product-research/actions';

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner size={16} />
          Researching...
        </>
      ) : (
        'Run Research'
      )}
    </Button>
  );
}

export function ResearchForm(): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card style={{ marginBottom: '24px' }}>
      <form
        ref={formRef}
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
        <SubmitButton />
      </form>
    </Card>
  );
}
