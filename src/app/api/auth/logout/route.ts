/**
 * Purpose:
 * POST /api/auth/logout — Clear the auth_token cookie.
 *
 * Responsibilities:
 * - Set auth_token cookie with maxAge=0 to clear it
 * - Return success response
 *
 * Dependencies:
 * - next/server
 */

import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });

  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Immediately expire
  });

  return response;
}
