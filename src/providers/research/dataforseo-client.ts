/**
 * Purpose:
 * Shared DataForSEO request helpers for research providers.
 *
 * Responsibilities:
 * - Build authenticated DataForSEO REST requests
 * - Keep DataForSEO endpoint details inside the provider layer
 * - Provide small response parsing helpers for DataForSEO task envelopes
 *
 * Dependencies:
 * - @/lib/env
 */

import { getOptionalEnvValue } from '@/lib/env';

export function getDataForSeoCredentials(): {
  login?: string;
  password?: string;
} {
  return {
    login: getOptionalEnvValue('DATAFORSEO_LOGIN'),
    password: getOptionalEnvValue('DATAFORSEO_PASSWORD'),
  };
}

export function hasDataForSeoCredentials(): boolean {
  const credentials = getDataForSeoCredentials();
  return Boolean(credentials.login && credentials.password);
}

export function buildDataForSeoRequest(
  body: Record<string, unknown>[],
): RequestInit {
  const credentials = getDataForSeoCredentials();
  const token = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  return {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export function extractDataForSeoResults(response: unknown): Record<string, unknown>[] {
  const root = asRecord(response);
  const tasks = Array.isArray(root.tasks) ? root.tasks : [];

  return tasks.flatMap((task) => {
    const taskRecord = asRecord(task);
    const result = Array.isArray(taskRecord.result) ? taskRecord.result : [];
    return result.map((item) => asRecord(item));
  });
}

export function extractDataForSeoItems(response: unknown): Record<string, unknown>[] {
  return extractDataForSeoResults(response).flatMap((result) => {
    const items = Array.isArray(result.items) ? result.items : [];
    return items.map((item) => asRecord(item));
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
