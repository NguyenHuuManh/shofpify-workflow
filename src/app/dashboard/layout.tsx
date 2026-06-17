/**
 * Purpose:
 * Dashboard layout wrapping all dashboard pages.
 * Provides sidebar navigation, auth context, and consistent page structure.
 *
 * Dependencies:
 * - @/components/dashboard/sidebar
 * - @/components/auth/auth-provider
 */

import React from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { AuthProvider } from '@/components/auth/auth-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <AuthProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '32px 40px', overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
