import { combineFetchResults, fetchTextWithHealth, hashId, missingSourceConfigResult, safeJsonParse } from "../fetch-utils";
import { feedItemsToSignals, parseFeedItems } from "../rss-parser";
import { getSourceConfig } from "../source-config";
import type { FetchResult, RawSignal, SourceConfig } from "../types";

const POPULAR_VIDEO_CATEGORIES = ["24", "17", "10"];

const FALLBACK_RSS_CHANNELS = [
  { channelId: "UCq-Fj5jknLsUf-MWSy4_brA", name: "T-Series", categoryHint: "music" as const },
  { channelId: "UCpEhnqL0y41EpW2TvWAHD7Q", name: "SET India", categoryHint: "entertainment" as const },
  { channelId: "UCZFMm1mMw0F81Z37aaEzTUA", name: "NDTV", categoryHint: "news" as const },
  { channelId: "UCIvaYmXn910QMdemBG3v1pQ", name: "Zee News", categoryHint: "news" as const },
  { channelId: "UCttspZesZIDEwwpVIgoZtWQ", name: "India TV News", categoryHint: "news" as const },
  { channelId: "UCRWFSbif-RFENbBrSiez1DA", name: "ABP News", categoryHint: "news" as const },
  { channelId: "UCt4t-jeY85JegMlZ-E5UWtA", name: "Aaj Tak", categoryHint: "news" as const },
];

async function fetchYouTubeRSSFallback(source: SourceConfig, startedAt: number): Promise<FetchResult<RawSignal[]>> {
  const signals: RawSignal[] = [];
  const errors: string[] = [];

  await Promise.all(
    FALLBACK_RSS_CHANNELS.map(async ({ channelId, name, categoryHint }) => {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const fetched = await fetchTextWithHealth(source, url);
      if (!fetched.ok) {
        errors.push(`${name} RSS: ${fetched.error}`);
        return;
      }

      const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 15);
      const channelSource: SourceConfig = {
        ...source,
        name: `YouTube/${name}`,
        categoryHint,
        languageHint: "mixed",
      };
      const channelSignals = feedItemsToSignals(items, channelSource).map((signal) => ({
        ...signal,
        source: source.name,
        categoryHint,
        reliabilityWeight: source.reliabilityWeight * 0.85,
        metadata: {
          ...signal.metadata,
          channel: name,
          channelId,
          via: "youtube_rss_fallback",
        },
      }));
      signals.push(...channelSignals);
    }),
  );

  return combineFetchResults(
    { ...source, purpose: "YouTube channel RSS fallback feeds; no API key required." },
    startedAt,
    signals,
    errors,
  );
}

export async function fetchYouTube(): Promise<FetchResult<RawSignal[]>> {
  const source = getSourceConfig("YouTube");
  if (!source) return missingSourceConfigResult<RawSignal>("YouTube");
  const startedAt = Date.now();
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return fetchYouTubeRSSFallback(source, startedAt);
  }

  const signals: RawSignal[] = [];
  const errors: string[] = [];
  for (const categoryId of POPULAR_VIDEO_CATEGORIES) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,statistics,topicDetails");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("regionCode", "IN");
    url.searchParams.set("videoCategoryId", categoryId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", key);
    const fetched = await fetchTextWithHealth(source, url.toString());
    if (!fetched.ok) {
      errors.push(fetched.error);
      continue;
    }
    const json = safeJsonParse(fetched.data.body) as { items?: Array<Record<string, unknown>> } | null;
    const items = json?.items ?? [];
    const parsedSignals = items
      .map((item, index) => youtubeItemToSignal(item, source.name, source.reliabilityWeight, categoryId, index))
      .filter((item): item is RawSignal => Boolean(item));
    signals.push(...parsedSignals);
  }

  const candidateQueries = [...new Set(signals.slice(0, 3).map((signal) => signal.rawTitle).filter(Boolean))];
  for (const query of candidateQueries) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("regionCode", "IN");
    url.searchParams.set("relevanceLanguage", "hi");
    url.searchParams.set("publishedAfter", todayStartUtc());
    url.searchParams.set("order", "viewCount");
    url.searchParams.set("maxResults", "25");
    url.searchParams.set("key", key);
    const fetched = await fetchTextWithHealth(source, url.toString());
    if (!fetched.ok) {
      errors.push(`search.list ${query}: ${fetched.error}`);
      continue;
    }
    const json = safeJsonParse(fetched.data.body) as { items?: Array<Record<string, unknown>> } | null;
    const parsedSignals = (json?.items ?? [])
      .map((item, index) => youtubeSearchItemToSignal(item, source.name, source.reliabilityWeight, query, index))
      .filter((item): item is RawSignal => Boolean(item));
    signals.push(...parsedSignals);
  }
  return combineFetchResults(source, startedAt, signals.filter(Boolean) as RawSignal[], errors);
}

function youtubeItemToSignal(
  item: Record<string, unknown>,
  source: string,
  reliabilityWeight: number,
  categoryId: string,
  index: number,
): RawSignal | null {
  const snippet = item.snippet as Record<string, unknown> | undefined;
  const title = typeof snippet?.title === "string" ? snippet.title : undefined;
  if (!title) return null;
  return {
    id: `${source}:${hashId(`${item.id ?? ""}|${title}|${index}`)}`,
    source,
    sourceType: "video",
    rawTitle: title,
    rawDescription: typeof snippet?.description === "string" ? snippet.description : undefined,
    url: typeof item.id === "string" ? `https://www.youtube.com/watch?v=${item.id}` : undefined,
    publishedAt: typeof snippet?.publishedAt === "string" ? new Date(snippet.publishedAt).toISOString() : undefined,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "mixed",
    categoryHint: categoryId === "17" ? "sports" : categoryId === "10" ? "music" : "entertainment",
    reliabilityWeight,
    metadata: {
      categoryId,
      statistics: item.statistics,
      channelTitle: snippet?.channelTitle,
      note: "videos.list mostPopular India; search.list Hindi validation can be layered selectively for top candidates.",
    },
  };
}

function youtubeSearchItemToSignal(
  item: Record<string, unknown>,
  source: string,
  reliabilityWeight: number,
  query: string,
  index: number,
): RawSignal | null {
  const snippet = item.snippet as Record<string, unknown> | undefined;
  const id = item.id as Record<string, unknown> | undefined;
  const title = typeof snippet?.title === "string" ? snippet.title : undefined;
  if (!title) return null;
  return {
    id: `${source}:search:${hashId(`${query}|${id?.videoId ?? ""}|${title}|${index}`)}`,
    source,
    sourceType: "video",
    rawTitle: title,
    rawDescription: typeof snippet?.description === "string" ? snippet.description : undefined,
    url: typeof id?.videoId === "string" ? `https://www.youtube.com/watch?v=${id.videoId}` : undefined,
    publishedAt: typeof snippet?.publishedAt === "string" ? new Date(snippet.publishedAt).toISOString() : undefined,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "mixed",
    categoryHint: query.toLowerCase().includes("cricket") ? "sports" : "entertainment",
    reliabilityWeight,
    metadata: {
      query,
      api: "search.list",
      relevanceLanguage: "hi",
      channelTitle: snippet?.channelTitle,
      note: "Selective Hindi candidate search for top India video candidates only.",
    },
  };
}

function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
}
