import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { getCachedResponse, setCachedResponse } from "../lib/trends/cache";
import { CACHE_NOTE, CACHE_WINDOW_MINUTES, toIndiaIsoString } from "../lib/trends/constants";
import { buildSafeFallbackResponse, backfillTrends } from "../lib/trends/fallback";
import { runTrendingPipeline } from "../lib/trends/pipeline";
import { getCacheHealth } from "../lib/trends/cache";
import { getLastFetchSummary, getLastSourceHealth } from "../lib/trends/debug";
import { SOURCE_CONFIGS } from "../lib/trends/source-config";
import type { ApiResponse } from "../lib/trends/types";

const router: IRouter = Router();

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.TRENDS_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const booleanFlag = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "y"].includes(value.toLowerCase());
  return Boolean(value);
}, z.boolean());

const querySchema = z.object({
  limit: z.coerce.number().int().min(10).max(20).default(10),
  forceRefresh: booleanFlag.default(false),
  debug: booleanFlag.default(false),
});

function withCacheStatus(response: ApiResponse, status: ApiResponse["cache"]["status"]): ApiResponse {
  return {
    ...response,
    cache: {
      status,
      cacheWindowMinutes: CACHE_WINDOW_MINUTES,
      note: CACHE_NOTE,
    },
  };
}

function jsonResponse(res: Response, body: unknown, status = 200) {
  res.set(corsHeaders);
  res.status(status).json(body);
}

function stripDebug(response: ApiResponse): ApiResponse {
  const { debug: _responseDebug, ...withoutTopLevelDebug } = response;
  return {
    ...withoutTopLevelDebug,
    trends: withoutTopLevelDebug.trends.map(({ debug: _debug, ...trend }) => trend),
  };
}

const TRANSPORT_TERMS = ["ट्रेन", "train", "राजधानी", "एक्सप्रेस", "express", "रेल", "rail", "railway", "बस", "bus", "विमान", "plane", "aircraft", "flight"];
const FIRE_TERMS = ["आग", "fire", "जलकर", "burning", "धुआं", "smoke", "ब्लास्ट", "blast"];
const ROAD_ACCIDENT_TERMS = ["सड़क", "road", "highway", "हाइवे", "हादसा", "accident", "दुर्घटना", "टक्कर", "collision", "पलटी", "overturn"];

function storyKey(trend: { tag: string; title: string; category?: string }): string | null {
  const text = `${trend.tag} ${trend.title}`.normalize("NFC").toLowerCase();
  const isTransport = TRANSPORT_TERMS.some((t) => text.includes(t));
  const isFire = FIRE_TERMS.some((t) => text.includes(t));
  const isRoadAccident = ROAD_ACCIDENT_TERMS.some((t) => text.includes(t));
  if (isTransport && isFire) return "transport_fire";
  if (isTransport && isRoadAccident) return "transport_road_accident";
  return null;
}

function deduplicateTrends(response: ApiResponse): ApiResponse {
  const seenTags = new Set<string>();
  const seenStories = new Set<string>();
  const unique = response.trends.filter((trend) => {
    const tagKey = trend.tag.normalize("NFC").toLowerCase();
    if (seenTags.has(tagKey)) return false;
    seenTags.add(tagKey);
    const story = storyKey(trend);
    if (story) {
      if (seenStories.has(story)) return false;
      seenStories.add(story);
    }
    return true;
  }).map((trend, index) => ({ ...trend, rank: index + 1 }));
  return { ...response, trends: unique, meta: { ...response.meta, returnedCount: unique.length } };
}

router.options("/trends", (_req: Request, res: Response) => {
  res.set(corsHeaders).status(204).send();
});

router.options("/trends/health", (_req: Request, res: Response) => {
  res.set(corsHeaders).status(204).send();
});

router.get("/trends/health", (_req: Request, res: Response) => {
  res.set(corsHeaders).json({
    generatedAt: toIndiaIsoString(),
    cache: getCacheHealth(),
    sourceConfigs: SOURCE_CONFIGS.map((source) => ({
      name: source.name,
      sourceType: source.sourceType,
      reliabilityWeight: source.reliabilityWeight,
      enabled: source.enabled,
      requiresKey: source.requiresKey,
      urlCount: source.urls.length,
      purpose: source.purpose,
    })),
    optionalKeys: {
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      YOUTUBE_API_KEY: Boolean(process.env.YOUTUBE_API_KEY),
      CALENDARIFIC_API_KEY: Boolean(process.env.CALENDARIFIC_API_KEY),
      ROANUZ_API_KEY: Boolean(process.env.ROANUZ_API_KEY),
      REDDIT_CLIENT_ID: Boolean(process.env.REDDIT_CLIENT_ID),
      REDDIT_CLIENT_SECRET: Boolean(process.env.REDDIT_CLIENT_SECRET),
    },
    lastSourceHealth: getLastSourceHealth(),
    lastFetchSummary: getLastFetchSummary(),
  });
});

router.get("/trends", async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    jsonResponse(res, { error: "Invalid query parameters", details: parsed.error.issues }, 400);
    return;
  }

  const { limit, forceRefresh, debug } = parsed.data;
  const cached = getCachedResponse();

  if (!forceRefresh && cached.status === "fresh" && cached.response) {
    const body = withCacheStatus(
      {
        ...cached.response,
        trends: cached.response.trends.slice(0, limit),
        meta: { ...cached.response.meta, returnedCount: Math.min(limit, cached.response.trends.length) },
      },
      "cached",
    );
    jsonResponse(res, debug ? body : stripDebug(body));
    return;
  }

  try {
    const fetchLimit = Math.min(limit + 5, 20);
    const live = await runTrendingPipeline({ limit: fetchLimit, debug, previousCache: cached.response?.trends ?? [] });
    const deduped = deduplicateTrends(withCacheStatus(live, "fresh"));
    const response = {
      ...deduped,
      trends: deduped.trends.slice(0, limit).map((t, i) => ({ ...t, rank: i + 1 })),
      meta: { ...deduped.meta, returnedCount: Math.min(deduped.trends.length, limit) },
    };
    setCachedResponse(response);
    jsonResponse(res, debug ? response : stripDebug(response));
  } catch (error) {
    if (cached.response) {
      const stale = await backfillTrends(withCacheStatus(cached.response, "stale_fallback"), {
        limit,
        debug,
      });
      jsonResponse(res, debug ? deduplicateTrends(stale) : stripDebug(deduplicateTrends(stale)));
      return;
    }

    const fallback = await buildSafeFallbackResponse({ limit, debug });
    if (fallback.trends.length > 0) {
      jsonResponse(res, debug ? fallback : stripDebug(fallback));
      return;
    }

    jsonResponse(
      res,
      {
        error: "Unable to produce trends from live data, cache, or safe fallback",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

export default router;
