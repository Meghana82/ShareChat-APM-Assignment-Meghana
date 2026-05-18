import { combineFetchResults, fetchTextWithHealth, missingSourceConfigResult } from "../fetch-utils";
import { feedItemsToSignals, parseFeedItems } from "../rss-parser";
import { getSourceConfig } from "../source-config";
import type { FetchResult, RawSignal } from "../types";

export async function fetchGoogleTrends(): Promise<FetchResult<RawSignal[]>> {
  const source = getSourceConfig("Google Trends India");
  if (!source) return missingSourceConfigResult<RawSignal>("Google Trends India");
  const startedAt = Date.now();
  const signals: RawSignal[] = [];
  const errors: string[] = [];
  for (const url of source.urls) {
    const fetched = await fetchTextWithHealth(source, url);
    if (!fetched.ok) {
      errors.push(fetched.error);
      continue;
    }
    const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 50);
    signals.push(...feedItemsToSignals(items, source));
  }
  return combineFetchResults(source, startedAt, signals, errors);
}
