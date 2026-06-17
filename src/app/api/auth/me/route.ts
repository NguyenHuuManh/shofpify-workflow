/**
 * Purpose:
 * GET /api/auth/me — Return the currently authenticated user from the JWT cookie.
 *
 * Responsibilities:
 * - Read auth_token from cookies
 * - Verify JWT and return SafeUser
 * - Return 401 if no valid token
 *
 * Dependencies:
 * - next/server
 * - @/services (authService)
 * - @/lib/api-helpers
 * - @/lib/logger
 */

import { NextResponse } from 'next/server';
import { authService } from '@/services';
import { handleError } from '@/app/api/api-helpers';
import { logger } from '@/lib/logger';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Extract token from cookie
    const cookieHeader = request.headers.get('cookie') ?? '';
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
    const token = tokenMatch?.[1];

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        },
        { status: 401 },
      );
    }

    const session = await authService.getSession(token);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { user: session.user },
    });
  } catch (error) {
    logger.error({ err: error }, 'Auth me route error');
    return handleError(error);
  }
}
