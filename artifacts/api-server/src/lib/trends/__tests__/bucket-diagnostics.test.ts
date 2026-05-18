import { describe, expect, it } from "vitest";
import { buildBucketDiagnostics } from "../pipeline";
import type { FilteredSignal, RankedTrend } from "../types";

function signal(rawTitle: string, categoryHint: FilteredSignal["categoryHint"], preliminaryCategory: FilteredSignal["preliminaryCategory"]): FilteredSignal {
  return {
    id: rawTitle,
    source: "Dainik Bhaskar",
    sourceType: "hindi_news",
    rawTitle,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "hi",
    categoryHint,
    reliabilityWeight: 0.7,
    normalizedText: rawTitle,
    tokens: rawTitle.split(/\s+/),
    indiaHints: ["IN"],
    hindiHints: ["hi"],
    safetyFlags: [],
    preliminaryCategory,
    indiaHindiRelevanceScore: 85,
  };
}

function trend(tag: string, title: string, category: RankedTrend["category"], bucket: string): RankedTrend {
  return {
    rank: 1,
    tag,
    title,
    displayLabel: title,
    description: `${title} पर चर्चा बढ़ रही है।`,
    category,
    heatScore: 65,
    bharatRelevanceScore: 85,
    sources: ["Dainik Bhaskar"],
    sourceTypes: ["hindi_news"],
    trendStage: "rising",
    whyTrending: "भारतीय स्रोतों में संकेत हैं।",
    sampleContent: { type: "summary", text: "लोग अपडेट देख रहे हैं।" },
    safety: { status: "safe", reasons: [] },
    signalSummary: { externalValidationScore: 60, crossSourceCount: 1, freshnessScore: 80, reliabilityScore: 70, regionalRelevanceScore: 85 },
    generatedAt: new Date().toISOString(),
    interestBucket: bucket,
  };
}

describe("bucket diagnostics", () => {
  it("keeps rejection reasons bucket-specific and counted", () => {
    const diagnostics = buildBucketDiagnostics({
      candidateCounts: { daily_rhythm_status: 2, utility_bazaar_prices: 2 },
      relevancePassed: [
        signal("शुभ रविवार", "viral", "viral"),
        signal("CNG कीमत", "finance", "finance"),
      ],
      crossSourceSignals: [signal("CNG कीमत", "finance", "finance")],
      canonicalized: [trend("#CNG_कीमत", "CNG कीमत", "finance", "utility_bazaar_prices")],
      qualityPassed: [trend("#CNG_कीमत", "CNG कीमत", "finance", "utility_bazaar_prices")],
      returnedCounts: { daily_rhythm_status: 0, utility_bazaar_prices: 1 },
      rejected: [
        { title: "bad daily", reason: "daily_rhythm_without_rhythm_entity", score: 1, source: "x", bucket: "daily_rhythm_status" },
        { title: "bad utility", reason: "utility_without_price_entity", score: 1, source: "x", bucket: "utility_bazaar_prices" },
        { title: "bad utility 2", reason: "utility_without_price_entity", score: 1, source: "x", bucket: "utility_bazaar_prices" },
      ],
    });

    expect(diagnostics.daily_rhythm_status.topRejectionReasons).toEqual([{ reason: "daily_rhythm_without_rhythm_entity", count: 1 }]);
    expect(diagnostics.utility_bazaar_prices.topRejectionReasons).toEqual([{ reason: "utility_without_price_entity", count: 2 }]);
    expect(diagnostics.daily_rhythm_status.topRejectionReasons).not.toEqual(diagnostics.utility_bazaar_prices.topRejectionReasons);
  });
});
