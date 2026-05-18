import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCachedResponse, setCachedResponse } from "@/lib/trends/cache";
import { CACHE_NOTE, CACHE_WINDOW_MINUTES } from "@/lib/trends/constants";
import { buildSafeFallbackResponse, backfillTrends } from "@/lib/trends/fallback";
import { runTrendingPipeline } from "@/lib/trends/pipeline";
import type { ApiResponse } from "@/lib/trends/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return jsonResponse(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
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
    return jsonResponse(debug ? body : stripDebug(body));
  }

  try {
    const live = await runTrendingPipeline({ limit, debug, previousCache: cached.response?.trends ?? [] });
    const response = withCacheStatus(live, "fresh");
    setCachedResponse(response);
    return jsonResponse(debug ? response : stripDebug(response));
  } catch (error) {
    if (cached.response) {
      const stale = await backfillTrends(withCacheStatus(cached.response, "stale_fallback"), {
        limit,
        debug,
      });
      return jsonResponse(debug ? stale : stripDebug(stale));
    }

    const fallback = await buildSafeFallbackResponse({ limit, debug });
    if (fallback.trends.length > 0) {
      return jsonResponse(debug ? fallback : stripDebug(fallback));
    }

    return jsonResponse(
      {
        error: "Unable to produce trends from live data, cache, or safe fallback",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

function stripDebug(response: ApiResponse): ApiResponse {
  const { debug: _responseDebug, ...withoutTopLevelDebug } = response;
  return {
    ...withoutTopLevelDebug,
    trends: withoutTopLevelDebug.trends.map(({ debug: _debug, ...trend }) => trend),
  };
}
