/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Server-only packages excluded from client bundle
  serverComponentsExternalPackages: ['pino', 'pino-pretty', '@prisma/client', 'prisma'],

  experimental: {
    // Enable typed routes when stable
    typedRoutes: false,
  },

  // Redirects for common patterns
  async redirects() {
    return [
      {
        source: '/api',
        destination: '/api/health',
        permanent: false,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
