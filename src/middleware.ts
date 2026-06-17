/**
 * Purpose:
 * Next.js middleware for authentication enforcement.
 * Protects /dashboard/* and /api/* routes (except /api/auth/*).
 * Reads the auth_token httpOnly cookie, verifies the JWT, and either
 * allows the request through or redirects/returns 401.
 *
 * Responsibilities:
 * - Allow public routes (/login, /api/auth/*, static assets) without auth
 * - Verify JWT from auth_token cookie for protected routes
 * - Redirect unauthenticated dashboard requests to /login
 * - Return 401 for unauthenticated API requests
 *
 * Dependencies:
 * - next/server
 * - jose (Edge-compatible JWT via @/lib/auth verifyToken)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Paths that do not require authentication. */
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/health',
];

/** Prefixes that are always public. */
const PUBLIC_PREFIXES = ['/_next/', '/favicon', '/api/auth/'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// JWT Verification (Edge-compatible, avoids importing server-only modules)
// ---------------------------------------------------------------------------

async function getSecret(): Promise<Uint8Array> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

async function verifyTokenEdge(
  token: string,
): Promise<{ sub: string; email: string; role: string; exp?: number } | null> {
  try {
    // Dynamic import to keep jose at the edge
    const { jwtVerify } = await import('jose');
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as { sub: string; email: string; role: string; exp?: number };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Extract token from cookie
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return handleUnauthenticated(request, pathname);
  }

  // Verify token
  const payload = await verifyTokenEdge(token);

  if (!payload) {
    return handleUnauthenticated(request, pathname);
  }

  // Token valid — proceed
  return NextResponse.next();
}

function handleUnauthenticated(
  request: NextRequest,
  pathname: string,
): NextResponse {
  // API routes: return 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  // Dashboard / other pages: redirect to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

// ---------------------------------------------------------------------------
// Route Matcher
// ---------------------------------------------------------------------------

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
