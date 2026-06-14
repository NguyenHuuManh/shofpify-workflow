/**
 * Purpose:
 * Reusable UI primitives for dashboard pages.
 * Clean, minimal components with consistent styling.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const buttonStyles: Record<string, React.CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid transparent',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: '20px',
  },
  primary: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  secondary: { background: '#fff', color: '#0f172a', borderColor: '#e2e8f0' },
  danger: { background: '#ef4444', color: '#fff', borderColor: '#ef4444' },
  ghost: { background: 'transparent', color: '#64748b', borderColor: 'transparent' },
  sm: { padding: '6px 12px', fontSize: '13px' },
  md: { padding: '8px 16px' },
  lg: { padding: '12px 24px', fontSize: '16px' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  style,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      style={{
        ...buttonStyles.base,
        ...buttonStyles[variant],
        ...buttonStyles[size],
        ...style,
      }}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ children, style }: CardProps): React.ReactElement {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const badgeColors: Record<string, { bg: string; color: string; border: string }> = {
  default: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  success: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  warning: { bg: '#fefce8', color: '#854d0e', border: '#fef08a' },
  danger: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  info: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
};

export function Badge({ children, variant = 'default' }: BadgeProps): React.ReactElement {
  const colors = badgeColors[variant]!;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

interface TableProps {
  headers: string[];
  rows: React.ReactNode[][];
}

export function Table({ headers, rows }: TableProps): React.ReactElement {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: '#64748b',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                borderBottom: '1px solid #f1f5f9',
                transition: 'background 0.1s',
              }}
            >
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '12px 16px' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={headers.length}
                style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
