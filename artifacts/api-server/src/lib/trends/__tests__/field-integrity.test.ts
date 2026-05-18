import { describe, expect, it } from "vitest";
import { validateFieldIntegrity } from "../field-integrity";
import type { RankedTrend } from "../types";

function trend(tag: string, title: string, category: RankedTrend["category"], bucket?: string, sourceType: RankedTrend["sourceTypes"][number] = "hindi_news"): RankedTrend {
  return {
    rank: 1,
    tag,
    title,
    displayLabel: title,
    description: `${title} पर चर्चा बढ़ रही है।`,
    category,
    heatScore: 70,
    bharatRelevanceScore: 85,
    sources: [sourceType === "daily_rhythm" ? "ShareChat Daily Rhythm Calendar" : "Google Trends India"],
    sourceTypes: [sourceType],
    trendStage: "rising",
    whyTrending: "सर्च में संकेत हैं।",
    sampleContent: { type: "summary", text: "लोग चर्चा कर रहे हैं।" },
    safety: { status: category === "public_safety" ? "limited" : "safe", reasons: [] },
    signalSummary: { externalValidationScore: 70, crossSourceCount: 2, freshnessScore: 90, reliabilityScore: 80, regionalRelevanceScore: 85 },
    generatedAt: new Date().toISOString(),
    interestBucket: bucket,
  };
}

describe("field integrity", () => {
  it("rejects RBI tag with IPL title", () => {
    expect(validateFieldIntegrity(trend("#RBI_रेपो_रेट", "IPL 2026", "finance")).ok).toBe(false);
  });

  it("rejects finance category with no finance entity", () => {
    expect(validateFieldIntegrity(trend("#लोकल_अपडेट", "लोकल अपडेट", "finance")).ok).toBe(false);
  });

  it("rejects daily rhythm candidates without rhythm titles or daily sources", () => {
    expect(validateFieldIntegrity(trend("#लोकल_अपडेट", "लोकल अपडेट", "viral", "daily_rhythm_status", "daily_rhythm")).ok).toBe(false);
    expect(validateFieldIntegrity(trend("#शुभ_रविवार", "शुभ रविवार", "viral", "daily_rhythm_status", "hindi_news")).ok).toBe(false);
  });

  it("accepts valid CNG, train fire, and devotional candidates", () => {
    expect(validateFieldIntegrity(trend("#CNG_कीमत", "CNG कीमत", "finance", "utility_bazaar_prices")).ok).toBe(true);
    expect(validateFieldIntegrity(trend("#राजधानी_एक्सप्रेस_आग", "राजधानी एक्सप्रेस आग", "public_safety", "weather_local_public_safety")).ok).toBe(true);
    expect(validateFieldIntegrity(trend("#माँ_वैष्णो_देवी", "माँ वैष्णो देवी", "devotional", "daily_rhythm_status", "daily_rhythm")).ok).toBe(true);
  });
});
