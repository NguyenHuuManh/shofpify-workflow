/**
 * Purpose:
 * Login form component with email/password fields.
 * Handles form submission, validation errors, and redirect after login.
 *
 * Responsibilities:
 * - Collect email and password from the user
 * - Submit to POST /api/auth/login
 * - Display validation and auth errors
 * - Redirect to dashboard on success
 *
 * Dependencies:
 * - react (use client)
 * - next/navigation
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100%',
    maxWidth: '420px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px 36px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  logo: {
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  logoIcon: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderRadius: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#fff',
  },
  title: {
    textAlign: 'center' as const,
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '4px',
  },
  subtitle: {
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '32px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#334155',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box' as const,
    backgroundColor: '#f8fafc',
  },
  button: {
    width: '100%',
    padding: '13px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'opacity 0.15s ease',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
    border: '1px solid #fecaca',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? 'Login failed. Please try again.');
        return;
      }

      // Success — redirect to dashboard or original destination
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>⚡</div>
        </div>

        <h1 style={styles.title}>Shopify Autonomous Store</h1>
        <p style={styles.subtitle}>Sign in to manage your store</p>

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@shopify-autonomous.com"
              autoComplete="email"
              required
              style={styles.input}
              disabled={submitting}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              style={styles.input}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.button,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
