import festivals from "../../data/indian-festivals.json";
import { CACHE_NOTE, CACHE_WINDOW_MINUTES, ASSUMPTIONS, toIndiaIsoString } from "./constants";
import { activeFestivalSignals } from "./fetchers/calendar";
import { applyHardFilters } from "./filters";
import { deterministicClusterSignals } from "./clustering";
import { scoreClusters } from "./scoring";
import { generateRankedTrends } from "./metadata";
import { postGenerationSafetyCheck } from "./safety";
import type { ApiResponse, FestivalSeed, RankedTrend } from "./types";

export async function buildSafeFallbackResponse(options: { limit: number; debug: boolean }): Promise<ApiResponse> {
  const now = new Date();
  const raw = activeFestivalSignals(festivals as FestivalSeed[], now);
  const filtered = applyHardFilters(raw, now).passed;
  const clusters = deterministicClusterSignals(filtered).map((cluster) => ({
    ...cluster,
    crossSourceCount: 1,
    crossSourceBoost: 1,
  }));
  const scored = scoreClusters(clusters, now);
  const trends = postGenerationSafetyCheck(await generateRankedTrends(scored, options.debug))
    .filter((trend) => trend.bharatRelevanceScore >= 70)
    .slice(0, options.limit);
  return {
    generatedAt: toIndiaIsoString(now),
    cache: { status: "stale_fallback", cacheWindowMinutes: CACHE_WINDOW_MINUTES, note: CACHE_NOTE },
    meta: {
      requestedLocale: "hi",
      geo: "IN",
      sourceCount: 1,
      rawSignalCount: raw.length,
      filteredSignalCount: filtered.length,
      clusterCount: clusters.length,
      returnedCount: trends.length,
      assumptions: [
        ...ASSUMPTIONS,
        "Fallback used only safe internal Bharat/Hindi festival/devotional seeds; no unsafe news, live score, RBI, weather, or crime claims were fabricated.",
      ],
    },
    trends: markBackfill(trends, options.debug),
  };
}

export async function backfillTrends(response: ApiResponse, options: { limit: number; debug: boolean }): Promise<ApiResponse> {
  const baseTrends = postGenerationSafetyCheck(response.trends).filter((trend) => trend.bharatRelevanceScore >= 70);
  if (baseTrends.length >= options.limit) {
    return { ...response, trends: baseTrends.slice(0, options.limit), meta: { ...response.meta, returnedCount: Math.min(options.limit, baseTrends.length) } };
  }
  const fallback = await buildSafeFallbackResponse(options);
  const seen = new Set(baseTrends.map((trend) => trend.tag.toLowerCase()));
  const additions = fallback.trends.filter((trend) => !seen.has(trend.tag.toLowerCase()));
  const trends = [...baseTrends, ...markBackfill(additions, options.debug)].slice(0, options.limit).map((trend, index) => ({ ...trend, rank: index + 1 }));
  return {
    ...response,
    trends,
    meta: {
      ...response.meta,
      returnedCount: trends.length,
      assumptions: [...response.meta.assumptions, "Safe backfill filled gaps using previous cache and internal festival/devotional seeds only."],
    },
  };
}

function markBackfill(trends: RankedTrend[], debug: boolean): RankedTrend[] {
  if (!debug) return trends;
  return trends.map((trend) => ({ ...trend, debug: { ...(trend.debug ?? {}), isBackfill: true } }));
}
