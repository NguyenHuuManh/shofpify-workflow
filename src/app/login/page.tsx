/**
 * Purpose:
 * Login page for the Shopify Autonomous Store Platform.
 * Unauthenticated users are redirected here by middleware.
 * After successful login, redirects to /dashboard or the original requested path.
 *
 * Responsibilities:
 * - Render the LoginForm component
 * - Redirect authenticated users away from this page
 *
 * Dependencies:
 * - next/navigation
 * - @/components/auth/login-form
 */

import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '24px',
      }}
    >
      <LoginForm />
    </div>
  );
}
