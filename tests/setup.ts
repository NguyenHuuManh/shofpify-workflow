/**
 * Purpose:
 * Test setup file for Vitest.
 * Runs before all tests.
 *
 * Responsibilities:
 * - Load environment variables for testing
 * - Configure global test utilities
 *
 * Dependencies:
 * - vitest
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Set test environment
  (process.env as Record<string, string>).NODE_ENV = 'test';
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgresql://shopify:shopify@localhost:5432/shopify_autonomous_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';
});

afterAll(() => {
  // Cleanup after all tests
});
