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
const emptyStringToUndefined = (val: unknown): unknown => (val === '' ? undefined : val);

const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());

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

  // Supplemental Research Providers
  BRAVE_SEARCH_API_KEY: optionalString,
  SERPAPI_API_KEY: optionalString,
  DATAFORSEO_LOGIN: optionalString,
  DATAFORSEO_PASSWORD: optionalString,
  META_AD_LIBRARY_ACCESS_TOKEN: optionalString,
  SUPPLIER_PROVIDER_API_KEY: optionalString,
  SUPPLIER_PROVIDER_ENDPOINT: optionalUrl,
  APIFY_CANDIDATE_DISCOVERY_API_TOKEN: optionalString,
  APIFY_CANDIDATE_DISCOVERY_CONFIG_PATH: optionalString,
  APIFY_CANDIDATE_DISCOVERY_ENDPOINT: optionalUrl,
  SOURCING_1688_PROVIDER: z.enum(['generic', 'apify', 'oxylabs', 'brightdata']).default('generic'),
  SOURCING_1688_API_KEY: optionalString,
  SOURCING_1688_ENDPOINT: optionalUrl,

  // 1688 Sourcing — DajiSaaS (primary)
  SOURCING_1688_DAJISAAS_API_KEY: optionalString,
  SOURCING_1688_DAJISAAS_API_SECRET: optionalString,
  SOURCING_1688_DAJISAAS_ENDPOINT: optionalUrl,
  SOURCING_1688_DAJISAAS_COUNTRY: optionalString,
  SOURCING_1688_CNY_TO_USD_RATE: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().positive().optional(),
  ),

  // 1688 Sourcing — Apify (sequential backup)
  SOURCING_1688_APIFY_API_TOKEN: optionalString,
  SOURCING_1688_APIFY_ACTOR_ID: optionalString,
  SOURCING_1688_APIFY_ENDPOINT: optionalUrl,

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

/**
 * Read optional provider configuration without forcing full application env
 * validation during provider construction and unit tests.
 */
export function getOptionalEnvValue(key: keyof Env): string | undefined {
  const value = process.env[key];
  return value === '' ? undefined : value;
}

export function getOptionalBooleanEnvValue(key: keyof Env): boolean {
  const value = getOptionalEnvValue(key);
  return value === 'true';
}
