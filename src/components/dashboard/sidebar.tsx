/**
 * Purpose:
 * Dashboard sidebar navigation component.
 * Provides navigation between dashboard pages.
 * Client component — marks active link.
 */

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Workflows', href: '/dashboard/workflows', icon: '⚡' },
  { label: 'Product Research', href: '/dashboard/product-research', icon: '🔬' },
  { label: 'Reviews', href: '/dashboard/reviews', icon: '✅' },
  { label: 'Monitoring', href: '/dashboard/monitoring', icon: '📊' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: '240px',
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #1e293b' }}>
        <h1
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#fff',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          🏪 Shopify Auto
        </h1>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
          Autonomous Store
        </p>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                borderRadius: '8px',
                color: isActive ? '#fff' : '#94a3b8',
                background: isActive ? '#1e293b' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                marginBottom: '2px',
                transition: 'all 0.1s',
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #1e293b',
          fontSize: '12px',
          color: '#475569',
        }}
      >
        Platform v1.0
      </div>
    </aside>
  );
}
