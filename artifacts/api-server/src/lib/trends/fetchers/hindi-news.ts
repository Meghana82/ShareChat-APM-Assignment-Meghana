import { combineFetchResults, fetchTextWithHealth, missingSourceConfigResult } from "../fetch-utils";
import { feedItemsToSignals, parseFeedItems } from "../rss-parser";
import { SOURCE_CONFIGS } from "../source-config";
import type { FetchResult, RawSignal } from "../types";

const NEWS_SOURCES = [
  "Dainik Bhaskar",
  "Dainik Jagran",
  "Amar Ujala",
  "Live Hindustan",
  "NDTV Hindi",
  "India TV News",
  "Hindustan Times",
  "News18 Hindi",
  "The Hindu National",
];

export async function fetchHindiAndNationalNews(): Promise<FetchResult<RawSignal[]>> {
  const sources = SOURCE_CONFIGS.filter((source) => source.enabled && NEWS_SOURCES.includes(source.name));
  if (!sources[0]) return missingSourceConfigResult<RawSignal>("Hindi/National News Bundle");
  const startedAt = Date.now();
  const signals: RawSignal[] = [];
  const errors: string[] = [];

  await Promise.all(
    sources.map(async (source) => {
      const sourceErrors: string[] = [];
      for (const url of source.urls) {
        const fetched = await fetchTextWithHealth(source, url);
        if (!fetched.ok) {
          sourceErrors.push(`${url}: ${fetched.error}`);
          continue;
        }

        const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 40);
        if (items.length === 0) {
          sourceErrors.push(`${url}: no RSS items parsed`);
          continue;
        }
        signals.push(...feedItemsToSignals(items, source));
        return;
      }
      errors.push(`${source.name}: ${sourceErrors.join(" | ") || "No RSS fallback returned items"}`);
    }),
  );

  return combineFetchResults(
    {
      ...sources[0],
      name: "Hindi/National News Bundle",
      purpose: "Hindi news and national validation bundle",
    },
    startedAt,
    signals,
    errors,
  );
}
