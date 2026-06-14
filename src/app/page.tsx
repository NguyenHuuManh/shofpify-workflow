/**
 * Purpose:
 * Root landing page of the Shopify Autonomous Store Platform.
 * Server Component — shows platform overview and links to dashboard.
 *
 * Responsibilities:
 * - Present platform value proposition
 * - Direct users to the dashboard
 * - Show key workflow steps
 *
 * Dependencies:
 * - next
 */

import Link from 'next/link';

export default function HomePage(): React.ReactElement {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Hero */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
          color: '#fff',
          padding: '80px 40px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 800,
            margin: '0 0 16px',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          Shopify Autonomous Store
        </h1>
        <p
          style={{
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}
        >
          AI-powered product automation. Research, generate content, create Shopify drafts,
          and publish — all with human approval. Turn a product idea into a live store in minutes.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: '#3b82f6',
            color: '#fff',
            padding: '14px 36px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '16px',
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
        >
          Open Dashboard →
        </Link>
      </header>

      {/* How It Works */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 40px' }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: '28px',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '40px',
          }}
        >
          How It Works
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
          }}
        >
          {[
            { step: '1', title: 'Submit Idea', desc: 'Enter a product idea like "Portable Blender" — the platform takes it from there.' },
            { step: '2', title: 'AI Research', desc: 'Market research, competitor analysis, and customer personas generated automatically.' },
            { step: '3', title: 'Content & SEO', desc: 'Product descriptions, benefits, features, FAQ, and SEO metadata all AI-generated.' },
            { step: '4', title: 'Landing Page', desc: 'Complete landing page structure with hero, testimonials, and CTA sections.' },
            { step: '5', title: 'Image Prompts', desc: 'AI-generated image prompts ready for Midjourney or DALL-E.' },
            { step: '6', title: 'Shopify Draft', desc: 'Auto-creates draft products in your Shopify store for review.' },
            { step: '7', title: 'Human Review', desc: 'Mandatory approval step — nothing publishes without your say-so.' },
            { step: '8', title: 'Publish', desc: 'One click to publish the approved product to your live store.' },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#eff6ff',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  marginBottom: '12px',
                }}
              >
                {item.step}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: '#f8fafc',
          textAlign: 'center',
          padding: '64px 40px',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
          Ready to automate your store?
        </h2>
        <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '16px' }}>
          Manage workflows, review content, and monitor AI usage from the dashboard.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: '#0f172a',
            color: '#fff',
            padding: '14px 36px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '16px',
            textDecoration: 'none',
          }}
        >
          Go to Dashboard →
        </Link>
      </section>
    </div>
  );
}
