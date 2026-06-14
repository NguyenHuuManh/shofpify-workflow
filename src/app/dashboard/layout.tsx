/**
 * Purpose:
 * Dashboard layout wrapping all dashboard pages.
 * Provides sidebar navigation and consistent page structure.
 */

import React from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
