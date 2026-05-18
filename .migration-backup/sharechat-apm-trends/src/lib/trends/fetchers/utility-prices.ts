import { combineFetchResults, fetchTextWithHealth, missingSourceConfigResult } from "../fetch-utils";
import { feedItemsToSignals, parseFeedItems } from "../rss-parser";
import { SOURCE_CONFIGS } from "../source-config";
import type { FetchResult, RawSignal } from "../types";

const UTILITY_SOURCES = ["GoodReturns Gold Rates", "GoodReturns Petrol Prices", "Economic Times Fuel Prices"];

export async function fetchUtilityPrices(): Promise<FetchResult<RawSignal[]>> {
  const sources = SOURCE_CONFIGS.filter((source) => UTILITY_SOURCES.includes(source.name));
  if (!sources[0]) return missingSourceConfigResult<RawSignal>("Utility Price Sources");
  const startedAt = Date.now();
  const signals: RawSignal[] = [];
  const errors: string[] = [];

  await Promise.all(
    sources.flatMap((source) =>
      source.urls.map(async (url) => {
        const fetched = await fetchTextWithHealth(source, url);
        if (!fetched.ok) {
          errors.push(`${source.name}: ${fetched.error}`);
          return;
        }
        const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 10);
        const parsedSignals = feedItemsToSignals(items.length ? items : [{ title: source.name, link: url, publishedAt: new Date().toISOString() }], source).map((signal) => ({
          ...signal,
          categoryHint: "finance" as const,
          metadata: {
            ...(signal.metadata ?? {}),
            isUtilityRateSource: true,
            productionNote:
              "In production, utility prices should use licensed commodity/fuel feeds, OMC/partner feeds, or official city-level price data.",
          },
        }));
        signals.push(...parsedSignals);
      }),
    ),
  );

  return combineFetchResults(sources[0], startedAt, signals, errors);
}
