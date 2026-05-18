import { combineFetchResults, fetchTextWithHealth, hashId, missingSourceConfigResult } from "../fetch-utils";
import { feedItemsToSignals, parseFeedItems } from "../rss-parser";
import { getSourceConfig, SOURCE_CONFIGS } from "../source-config";
import type { FetchResult, RawSignal } from "../types";

export async function fetchReddit(): Promise<FetchResult<RawSignal[]>> {
  const socialSource = SOURCE_CONFIGS.find((source) => source.name === "India Social Trends");
  if (!socialSource) {
    const reddit = getSourceConfig("Reddit");
    if (!reddit) return missingSourceConfigResult<RawSignal>("Reddit");
    return combineFetchResults(reddit, Date.now(), [], ["Reddit disabled: OAuth is required; India Social Trends source is not configured."]);
  }

  const startedAt = Date.now();
  const signals: RawSignal[] = [];
  const errors: string[] = [];

  await Promise.all(
    socialSource.urls.map(async (url) => {
      const fetched = await fetchTextWithHealth(socialSource, url);
      if (!fetched.ok) {
        errors.push(fetched.error);
        return;
      }

      const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 20);
      signals.push(
        ...feedItemsToSignals(items, socialSource).map((signal) => ({
          ...signal,
          metadata: {
            ...signal.metadata,
            via: "reddit_replacement_patrika_rss",
          },
        })),
      );
    }),
  );

  return combineFetchResults(socialSource, startedAt, signals, errors);
}

function redditPostToSignal(post: Record<string, unknown>, url: string, index: number): RawSignal | null {
  const title = typeof post.title === "string" ? post.title : undefined;
  if (!title) return null;
  return {
    id: `Reddit:${hashId(`${url}|${title}|${index}`)}`,
    source: "Reddit",
    sourceType: "social_experimental",
    rawTitle: title,
    rawDescription: typeof post.selftext === "string" ? post.selftext : undefined,
    url: typeof post.permalink === "string" ? `https://www.reddit.com${post.permalink}` : undefined,
    publishedAt: typeof post.created_utc === "number" ? new Date(post.created_utc * 1000).toISOString() : undefined,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "en",
    categoryHint: url.includes("cricket") ? "sports" : url.includes("bollywood") ? "entertainment" : "viral",
    reliabilityWeight: 0.35,
    metadata: {
      subreddit: post.subreddit,
      score: post.score,
      note: "Experimental public JSON only; Reddit alone never passes validation.",
    },
  };
}
