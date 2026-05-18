import pLimit from "p-limit";
import type { FetchResult, SourceConfig } from "./types";

export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_RETRY_COUNT = 1;
export const MAX_FETCH_CONCURRENCY = 5;

export const fetchLimit = pLimit(MAX_FETCH_CONCURRENCY);

export type TextFetchResult = FetchResult<{ body: string; contentType: string; url: string }>;

export async function fetchTextWithHealth(source: SourceConfig, url: string): Promise<TextFetchResult> {
  const startedAt = Date.now();
  let lastError = "Unknown fetch error";

  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": source.userAgent,
          Accept: "application/rss+xml, application/atom+xml, application/xml, application/json, text/html;q=0.8, */*;q=0.5",
        },
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (!response.ok) {
        lastError = `HTTP ${response.status} ${response.statusText}`;
        if (response.status >= 500 && attempt < FETCH_RETRY_COUNT) continue;
        break;
      }

      const body = await response.text();
      const latencyMs = Date.now() - startedAt;
      return {
        ok: true,
        source: source.name,
        data: { body, contentType: response.headers.get("content-type") ?? "", url },
        health: {
          source: source.name,
          lastSuccessAt: new Date().toISOString(),
          itemCount: 0,
          latencyMs,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < FETCH_RETRY_COUNT) continue;
    }
  }

  return {
    ok: false,
    source: source.name,
    error: lastError,
    health: {
      source: source.name,
      lastFailureAt: new Date().toISOString(),
      lastError,
      itemCount: 0,
      latencyMs: Date.now() - startedAt,
    },
  };
}

export function combineFetchResults<T>(source: SourceConfig, startedAt: number, values: T[], errors: string[]): FetchResult<T[]> {
  if (values.length > 0) {
    return {
      ok: true,
      source: source.name,
      data: values,
      health: {
        source: source.name,
        lastSuccessAt: new Date().toISOString(),
        lastError: errors.length ? errors.join(" | ") : undefined,
        itemCount: values.length,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  return {
    ok: false,
    source: source.name,
    error: errors.join(" | ") || "No items returned",
    health: {
      source: source.name,
      lastFailureAt: new Date().toISOString(),
      lastError: errors.join(" | ") || "No items returned",
      itemCount: 0,
      latencyMs: Date.now() - startedAt,
    },
  };
}

export function missingSourceConfigResult<T>(sourceName: string): FetchResult<T[]> {
  const error = `Source config missing for ${sourceName}`;
  return {
    ok: false,
    source: sourceName,
    error,
    health: {
      source: sourceName,
      lastFailureAt: new Date().toISOString(),
      lastError: error,
      itemCount: 0,
      latencyMs: 0,
    },
  };
}

export function hashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
