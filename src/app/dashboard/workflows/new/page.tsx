/**
 * Purpose:
 * New Workflow page — create a product and start its automation workflow.
 * Server Component + Client form for product idea submission.
 *
 * Dependencies:
 * - productService
 * - workflowService
 * - next/navigation
 */

import { Card } from '@/components/ui';
import { startWorkflowFromIdea } from './actions';

export default function NewWorkflowPage(): React.ReactElement {
  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <a
          href="/dashboard/workflows"
          style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none' }}
        >
          ← Back to Workflows
        </a>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px', color: '#0f172a' }}>
          ✨ New Product Workflow
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Create a production workflow for a known product. Use Product Research first when you still need to discover candidates.
        </p>
      </div>

      {/* Form */}
      <Card>
        <form
          action={startWorkflowFromIdea}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div>
            <label
              htmlFor="productIdea"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '8px',
              }}
            >
              Product Idea
            </label>
            <input
              id="productIdea"
              name="productIdea"
              type="text"
              required
              placeholder='e.g. "Portable Blender", "Smart Water Bottle", "Wireless Earbuds"'
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '15px',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
              Be specific — the production workflow starts at content generation.
            </p>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 12px' }}>
              ⚡ What happens next
            </h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#475569', lineHeight: 1.8 }}>
              <li>Content Agent writes product copy</li>
              <li>SEO Agent generates metadata and keywords</li>
              <li>Landing Agent designs the page structure</li>
              <li>Image Agent creates image generation prompts</li>
              <li>Shopify Agent creates a draft product</li>
              <li>You review and approve before publishing</li>
            </ol>
          </div>

          <button
            type="submit"
            style={{
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              padding: '14px 28px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🚀 Start Workflow
          </button>
        </form>
      </Card>
    </div>
  );
}
