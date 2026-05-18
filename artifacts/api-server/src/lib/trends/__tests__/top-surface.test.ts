import { describe, expect, it } from "vitest";
import { selectTopSurfaceTags } from "../top-surface";
import { getTrendTimeMode } from "../time-mode";
import type { RankedTrend } from "../types";

function trend(tag: string, category: RankedTrend["category"], bucket?: string, heat = 70): RankedTrend {
  return {
    rank: 1,
    tag,
    title: tag.replace("#", "").replace(/_/g, " "),
    displayLabel: tag.replace("#", "").replace(/_/g, " "),
    description: "भारत में चर्चा बढ़ रही है।",
    category,
    heatScore: heat,
    bharatRelevanceScore: 90,
    sources: ["ShareChat Daily Rhythm Calendar"],
    sourceTypes: [bucket === "daily_rhythm_status" ? "daily_rhythm" : "hindi_news"],
    trendStage: "rising",
    whyTrending: "लोग पोस्ट शेयर कर रहे हैं।",
    sampleContent: { type: "summary", text: "लोग चर्चा कर रहे हैं।" },
    safety: { status: "safe", reasons: [] },
    signalSummary: { externalValidationScore: heat, crossSourceCount: 1, freshnessScore: 90, reliabilityScore: 70, regionalRelevanceScore: 90 },
    generatedAt: new Date().toISOString(),
    interestBucket: bucket,
  };
}

describe("top surface selector", () => {
  it("places daily rhythm/devotional/seasonal candidates in top surface without unsafe items", () => {
    const selected = selectTopSurfaceTags([
      trend("#KKR_बनाम_GT", "sports", "cricket_ipl_sports", 90),
      trend("#शुभ_रविवार", "viral", "daily_rhythm_status", 70),
      trend("#माँ_वैष्णो_देवी", "devotional", "daily_rhythm_status", 68),
      trend("#गर्मी_से_बचाव", "weather", "daily_rhythm_status", 66),
    ], getTrendTimeMode(new Date("2026-05-17T08:00:00+05:30")));
    expect(selected.slice(0, 4).some((item) => item.tag === "#शुभ_रविवार")).toBe(true);
    expect(selected.slice(0, 4).some((item) => item.category === "devotional")).toBe(true);
    expect(selected.slice(0, 4).some((item) => item.tag === "#गर्मी_से_बचाव")).toBe(true);
  });
});
