import { combineFetchResults, fetchTextWithHealth, missingSourceConfigResult } from "../fetch-utils";
import { feedItemsToSignals, parseFeedItems } from "../rss-parser";
import { SOURCE_CONFIGS } from "../source-config";
import type { FetchResult, RawSignal } from "../types";

const OFFICIAL_SOURCES = ["PIB Hindi", "RBI", "SACHET"];

export async function fetchOfficialSources(): Promise<FetchResult<RawSignal[]>> {
  const sources = SOURCE_CONFIGS.filter((source) => source.enabled && OFFICIAL_SOURCES.includes(source.name));
  if (!sources[0]) return missingSourceConfigResult<RawSignal>("Official Sources Bundle");
  const startedAt = Date.now();
  const signals: RawSignal[] = [];
  const errors: string[] = [];

  await Promise.all(
    sources.map(async (source) => {
      if (source.name === "PIB Hindi") {
        const sourceErrors: string[] = [];
        for (const url of source.urls) {
          const fetched = await fetchTextWithHealth(source, url);
          if (!fetched.ok) {
            sourceErrors.push(`${url}: ${fetched.error}`);
            continue;
          }

          const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 35);
          if (items.length === 0) {
            sourceErrors.push(`${url}: no RSS items parsed`);
            continue;
          }
          signals.push(...feedItemsToSignals(items, source));
          return;
        }
        errors.push(`${source.name}: ${sourceErrors.join(" | ") || "No official fallback returned items"}`);
        return;
      }

      await Promise.all(source.urls.map(async (url) => {
        const fetched = await fetchTextWithHealth(source, url);
        if (!fetched.ok) {
          errors.push(`${source.name}: ${fetched.error}`);
          return;
        }
        const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 35);
        signals.push(...feedItemsToSignals(items, source));
      }));
    }),
  );

  return combineFetchResults(
    { ...sources[0], name: "Official Sources Bundle", purpose: "PIB, RBI, and SACHET official authority bundle" },
    startedAt,
    signals,
    errors,
  );
}
