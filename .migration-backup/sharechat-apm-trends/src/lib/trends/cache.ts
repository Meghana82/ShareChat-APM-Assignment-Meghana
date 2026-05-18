import { CACHE_WINDOW_MS, CACHE_WINDOW_MINUTES, CACHE_NOTE } from "./constants";
import type { ApiResponse } from "./types";

let cache: { response: ApiResponse; cachedAt: number } | null = null;

export function getCachedResponse(): { status: "fresh" | "stale" | "empty"; response?: ApiResponse; ageMs?: number } {
  if (!cache) return { status: "empty" };
  const ageMs = Date.now() - cache.cachedAt;
  return { status: ageMs <= CACHE_WINDOW_MS ? "fresh" : "stale", response: cache.response, ageMs };
}

export function setCachedResponse(response: ApiResponse) {
  cache = { response, cachedAt: Date.now() };
}

export function getCacheHealth() {
  const current = getCachedResponse();
  return {
    status: current.status,
    hasCachedResponse: Boolean(current.response),
    ageMs: current.ageMs ?? null,
    cacheWindowMinutes: CACHE_WINDOW_MINUTES,
    note: CACHE_NOTE,
    trendCount: current.response?.trends.length ?? 0,
    generatedAt: current.response?.generatedAt ?? null,
  };
}
