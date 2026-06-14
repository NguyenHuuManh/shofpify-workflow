import type { Metadata } from 'next';

/**
 * Purpose:
 * Root layout for the Shopify Autonomous Store Platform.
 * Provides base HTML structure, fonts, and metadata.
 *
 * Responsibilities:
 * - Set global metadata
 * - Render children within consistent HTML structure
 *
 * Dependencies:
 * - next
 */

export const metadata: Metadata = {
  title: 'Shopify Autonomous Store',
  description: 'AI-powered Shopify product automation platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
