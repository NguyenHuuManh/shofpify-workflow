/**
 * Purpose:
 * Zod-validated environment variable loader.
 * All environment variables must be validated at startup.
 * Never access process.env directly in application code.
 *
 * Responsibilities:
 * - Parse and validate all environment variables
 * - Provide type-safe access to configuration
 * - Fail fast on missing or invalid configuration
 *
 * Dependencies:
 * - zod
 */

import { z } from 'zod';

/**
 * Preprocess: turn empty strings into undefined so .optional() works correctly.
 */
const emptyStringToUndefined = (val: unknown): unknown =>
  val === '' ? undefined : val;

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional(),
);

const optionalString = z.preprocess(emptyStringToUndefined, z.string().optional());

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('shopify-autonomous-store'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: optionalString,

  // Shopify
  SHOPIFY_STORE_URL: z.string().url(),
  SHOPIFY_ACCESS_TOKEN: z.string().min(1),
  SHOPIFY_API_VERSION: z.string().default('2024-04'),
  SHOPIFY_API_SECRET: z.string().min(1),

  // AI Providers (at least one must be configured)
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20240620'),
  DEEPSEEK_API_KEY: optionalString,
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  OPENAI_API_KEY: optionalString,

  // Authentication
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().default('http://localhost:3000'),

  // BullMQ Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Feature Flags
  ENABLE_AUTO_PUBLISH: z.coerce.boolean().default(false),
  ENABLE_IMAGE_GENERATION: z.coerce.boolean().default(false),

  // Monitoring
  SENTRY_DSN: optionalUrl,
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Load and validate environment variables.
 * Must be called once at application startup.
 * Throws if any required variable is missing or invalid.
 */
export function loadEnv(): Env {
  if (_env) {
    return _env;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // eslint-disable-next-line no-console -- intentional: logger not yet available
    console.error(`❌ Environment validation failed:\n${errors}`);
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  _env = result.data;
  return _env;
}

/**
 * Get validated environment variables.
 * Prefer this over loadEnv() after initial startup.
 */
export function getEnv(): Env {
  if (!_env) {
    return loadEnv();
  }
  return _env;
}
