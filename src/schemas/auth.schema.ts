/**
 * Purpose:
 * Zod validation schemas for authentication DTOs.
 * Ensures all login/register payloads are validated before processing.
 *
 * Responsibilities:
 * - Validate login credentials (email format, password present)
 * - Validate registration payload (email, name, password strength, valid role)
 *
 * Dependencies:
 * - zod
 * - @prisma/client (UserRole enum)
 */

import { z } from 'zod';
import { UserRole } from '@prisma/client';

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  role: z.nativeEnum(UserRole),
});

export type RegisterInput = z.infer<typeof registerSchema>;
