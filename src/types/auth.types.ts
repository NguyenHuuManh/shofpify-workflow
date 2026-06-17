/**
 * Purpose:
 * Authentication-related TypeScript type definitions.
 * Defines DTOs for login, registration, JWT payloads, and session state.
 *
 * Responsibilities:
 * - Define LoginInput and RegisterInput DTOs
 * - Define JwtPayload for token signing/verification
 * - Define AuthSession for the authenticated user context
 * - Define safe user projection (without passwordHash)
 *
 * Dependencies:
 * - @prisma/client (UserRole enum)
 */

import type { UserRole } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/** Credentials submitted by the user at login. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Data required to register a new user (admin-only action). */
export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

/** Claims embedded in the JWT token. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Public user representation returned to the client (NEVER includes passwordHash). */
export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/** Authenticated session containing the user and token metadata. */
export interface AuthSession {
  user: SafeUser;
  expiresAt: number;
}
