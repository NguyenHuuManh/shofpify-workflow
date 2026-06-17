/**
 * Purpose:
 * POST /api/auth/login — Authenticate user and set httpOnly auth_token cookie.
 *
 * Responsibilities:
 * - Validate login credentials via Zod
 * - Delegate to AuthService.login()
 * - Set auth_token as httpOnly, Secure, SameSite=Lax cookie
 * - Return safe user object (no passwordHash)
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

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token, user } = await authService.login(body);

    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      data: { user },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    logger.error({ err: error }, 'Login route error');
    return handleError(error);
  }
}
