/**
 * Purpose:
 * Authentication utilities — password hashing, JWT signing, and JWT verification.
 * Used by AuthService and the Next.js middleware to manage authentication.
 *
 * Responsibilities:
 * - Hash passwords with bcrypt
 * - Compare plaintext passwords against hashes
 * - Sign JWT tokens with the AUTH_SECRET from environment
 * - Verify and decode JWT tokens
 * - Extract SafeUser from a User record (strip passwordHash)
 *
 * Dependencies:
 * - bcryptjs (pure JS bcrypt — no native bindings)
 * - jose (Edge-compatible JWT library for Next.js middleware compatibility)
 * - @/lib/env
 * - @/types (JwtPayload, SafeUser)
 * - @prisma/client (User)
 */

import { hash, compare } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from './env';
import type { JwtPayload, SafeUser } from '@/types';
import type { User } from '@prisma/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '24h';

// ---------------------------------------------------------------------------
// Password Hashing
// ---------------------------------------------------------------------------

/** Hash a plaintext password with bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

/** Compare a plaintext password against a bcrypt hash. */
export async function comparePassword(
  password: string,
  hashed: string,
): Promise<boolean> {
  return compare(password, hashed);
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

function getSecret(): Uint8Array {
  const env = getEnv();
  return new TextEncoder().encode(env.AUTH_SECRET);
}

/** Create a signed JWT token for a given user. */
export async function signToken(user: User): Promise<string> {
  const secret = getSecret();
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

/** Verify and decode a JWT token. Returns the payload or null if invalid. */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// User Projection
// ---------------------------------------------------------------------------

/** Strip passwordHash from a User record to produce a SafeUser for the client. */
export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}
