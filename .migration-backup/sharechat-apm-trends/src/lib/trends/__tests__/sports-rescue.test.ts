import { describe, expect, it } from "vitest";
import { rescueSportsTrends } from "../sports-rescue";
import type { FilteredSignal, SourceType } from "../types";

function signal(rawTitle: string, sourceType: SourceType = "hindi_news"): FilteredSignal {
  return {
    id: rawTitle,
    source: sourceType === "search_demand" ? "Google Trends India" : "Dainik Bhaskar",
    sourceType,
    rawTitle,
    rawDescription: "",
    publishedAt: "2026-05-17T13:00:00Z",
    fetchedAt: "2026-05-17T13:30:00Z",
    geo: "IN",
    languageHint: "mixed",
    categoryHint: "sports",
    reliabilityWeight: 0.8,
    normalizedText: rawTitle.toLowerCase(),
    tokens: rawTitle.toLowerCase().split(/\s+/),
    indiaHints: ["india"],
    hindiHints: [],
    safetyFlags: [],
    preliminaryCategory: "sports",
    indiaHindiRelevanceScore: 85,
  };
}

describe("sports rescue", () => {
  it("does not invent a match by combining teams from unrelated signals", () => {
    const rescued = rescueSportsTrends([
      signal("Raipur to Dharamshala IPL 2026 RCB travel update", "video"),
      signal("SRH practice update before IPL match", "hindi_news"),
    ], new Date("2026-05-17T19:00:00+05:30"));

    expect(rescued).toHaveLength(0);
  });

  it("rescues a match pair when the pair appears in the same live signal", () => {
    const rescued = rescueSportsTrends([
      signal("PBKS vs RCB Live Score: Kohli catch and Punjab wickets", "hindi_news"),
      signal("IPL points table", "search_demand"),
    ], new Date("2026-05-17T19:00:00+05:30"));

    expect(rescued[0]?.tag).toBe("#RCB_बनाम_PBKS");
  });
});
