/**
 * Purpose:
 * Authentication service handling login, registration, and session management.
 * Centralizes all authentication business logic.
 *
 * Responsibilities:
 * - Validate login credentials and return a JWT token
 * - Register new users (admin-only) with hashed passwords
 * - Verify JWT tokens and return the authenticated session
 * - Never expose passwordHash outside this service
 *
 * Dependencies:
 * - @/lib/auth (hashPassword, comparePassword, signToken, verifyToken, toSafeUser)
 * - @/lib/errors (AppError, ErrorCodes)
 * - @/lib/logger
 * - @/repositories (userRepository)
 * - @/schemas (loginSchema, registerSchema)
 * - @/types (LoginInput, RegisterInput, AuthSession, SafeUser)
 */

import {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  toSafeUser,
} from '@/lib/auth';
import { AppError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { userRepository } from '@/repositories';
import { loginSchema, registerSchema } from '@/schemas';
import type { LoginInput, RegisterInput, AuthSession, SafeUser } from '@/types';

export class AuthService {
  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  /**
   * Authenticate a user with email and password.
   * Returns a JWT token string and the safe user object.
   */
  async login(input: LoginInput): Promise<{ token: string; user: SafeUser }> {
    // Validate input
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid login credentials format',
        statusCode: 400,
        details: { errors: parsed.error.flatten().fieldErrors },
      });
    }

    const { email, password } = parsed.data;

    // Find user
    const user = await userRepository.findByEmail(email);
    if (!user) {
      logger.warn({ email }, 'Login failed: user not found');
      throw new AppError({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid email or password',
        statusCode: 401,
      });
    }

    // Compare password
    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      logger.warn({ email }, 'Login failed: invalid password');
      throw new AppError({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid email or password',
        statusCode: 401,
      });
    }

    // Sign token
    const token = await signToken(user);
    const safeUser = toSafeUser(user);

    logger.info({ userId: user.id, email }, 'User logged in successfully');
    return { token, user: safeUser };
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------

  /**
   * Register a new user. Only ADMIN users can create new accounts.
   */
  async register(
    input: RegisterInput,
    createdByRole?: string,
  ): Promise<SafeUser> {
    // Only admins can create users
    if (createdByRole !== 'ADMIN') {
      throw new AppError({
        code: ErrorCodes.FORBIDDEN,
        message: 'Only administrators can create new users',
        statusCode: 403,
      });
    }

    // Validate input
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid registration data',
        statusCode: 400,
        details: { errors: parsed.error.flatten().fieldErrors },
      });
    }

    const { email, name, password, role } = parsed.data;

    // Check if email already exists
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `User with email '${email}' already exists`,
        statusCode: 409,
      });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({
      email,
      name,
      role,
      passwordHash,
    });

    logger.info({ userId: user.id, email, role }, 'New user registered');
    return toSafeUser(user);
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  /**
   * Verify a JWT token and return the authenticated session.
   * Returns null if the token is invalid or expired.
   */
  async getSession(token: string): Promise<AuthSession | null> {
    const payload = await verifyToken(token);
    if (!payload) {
      return null;
    }

    // Verify the user still exists in the database
    const user = await userRepository.findById(payload.sub);
    if (!user) {
      logger.warn({ userId: payload.sub }, 'Session user no longer exists');
      return null;
    }

    return {
      user: toSafeUser(user),
      expiresAt: payload.exp ?? 0,
    };
  }

  /**
   * Verify a token and return the SafeUser, or null.
   * Lightweight version that doesn't re-query the database.
   */
  async verifyTokenAndGetPayload(token: string): Promise<{ userId: string; role: string } | null> {
    const payload = await verifyToken(token);
    if (!payload) {
      return null;
    }
    return { userId: payload.sub, role: payload.role };
  }
}

export const authService = new AuthService();
