import { NextResponse } from "next/server";
import { getCacheHealth } from "../../../../lib/trends/cache";
import { toIndiaIsoString } from "../../../../lib/trends/constants";
import { getLastFetchSummary, getLastSourceHealth } from "../../../../lib/trends/debug";
import { SOURCE_CONFIGS } from "../../../../lib/trends/source-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
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
}
