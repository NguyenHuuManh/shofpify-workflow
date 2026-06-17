/**
 * Purpose:
 * POST /api/auth/register — Create a new user (admin-only).
 *
 * Responsibilities:
 * - Extract current user from auth_token cookie
 * - Verify admin role
 * - Delegate to AuthService.register()
 * - Return safe user object
 *
 * Dependencies:
 * - next/server
 * - @/services (authService)
 * - @/lib/api-helpers
 * - @/lib/auth (verifyToken)
 * - @/lib/logger
 */

import { NextResponse } from 'next/server';
import { authService } from '@/services';
import { handleError } from '@/app/api/api-helpers';
import { verifyToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Extract current user from cookie
    const cookieHeader = request.headers.get('cookie') ?? '';
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
    const token = tokenMatch?.[1];

    let createdByRole: string | undefined;
    if (token) {
      const payload = await verifyToken(token);
      createdByRole = payload?.role;
    }

    const body = await request.json();
    const user = await authService.register(body, createdByRole);

    return NextResponse.json(
      { success: true, data: { user } },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, 'Register route error');
    return handleError(error);
  }
}
