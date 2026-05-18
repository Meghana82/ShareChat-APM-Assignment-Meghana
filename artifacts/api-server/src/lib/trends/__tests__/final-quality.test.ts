import { describe, expect, it } from "vitest";
import { finalQualityRejectReasonForTest, validateFinalTrendQuality } from "../final-quality";
import type { RankedTrend } from "../types";

function trend(tag: string, title: string, category: RankedTrend["category"] = "news"): RankedTrend {
  return {
    rank: 1,
    tag,
    title,
    displayLabel: title,
    description: `${title} पर चर्चा बढ़ रही है।`,
    category,
    heatScore: 60,
    bharatRelevanceScore: 80,
    sources: ["Google Trends India"],
    sourceTypes: ["search_demand"],
    trendStage: "rising",
    whyTrending: "सर्च और खबरों में संकेत बढ़ रहे हैं।",
    sampleContent: { type: "summary", text: "लोग इस विषय पर चर्चा कर रहे हैं।" },
    safety: { status: "safe", reasons: [] },
    signalSummary: { externalValidationScore: 60, crossSourceCount: 2, freshnessScore: 80, reliabilityScore: 80, regionalRelevanceScore: 80 },
    generatedAt: new Date().toISOString(),
  };
}

describe("final quality gate", () => {
  it("rejects publisher/source names and malformed mixed tags", () => {
    expect(finalQualityRejectReasonForTest(trend("#नवभारत_टाइम्स", "नवभारत टाइम्स"))).toBe("publisher_or_source_name_topic");
    expect(finalQualityRejectReasonForTest(trend("#अमर_उजाला_संवाद_कल", "अमर उजाला संवाद कल"))).toBe("publisher_or_source_name_topic");
    expect(finalQualityRejectReasonForTest(trend("#वित्त_Reserve_Bank_of", "वित्त अपडेट", "finance"))).toBe("malformed_mixed_tag");
    expect(finalQualityRejectReasonForTest(trend("#परीक्षा_orlando_city_vs", "परीक्षा अपडेट", "education"))).toBe("malformed_mixed_tag");
    expect(finalQualityRejectReasonForTest(trend("#LPG_Crisis_अमेरिकी_नाकेबंदी_जुड़े", "LPG Crisis", "finance"))).toBe("malformed_mixed_tag");
  });

  it("rejects weak utility bucket matches", () => {
    const bad = trend("#मुंबई_जुर्माने_राशि_पीड़ित", "मुंबई जुर्माने राशि पीड़ित", "finance");
    bad.interestBucket = "utility_bazaar_prices";
    expect(finalQualityRejectReasonForTest(bad)).toMatch(/weak_bucket_match/);
  });

  it("repairs Himachal Nikay Chunav", () => {
    const result = validateFinalTrendQuality(trend("#Himachal_Nikay_Chunav_हिमाचल", "Himachal Nikay Chunav 2026 Live", "government"));
    expect(result.ok).toBe(true);
    expect(result.repaired?.tag).toBe("#हिमाचल_निकाय_चुनाव");
  });

  it("rejects generic Bollywood gossip without a concrete topic", () => {
    const generic = trend("#बॉलीवुड_गॉसिप", "बॉलीवुड गॉसिप", "entertainment");
    generic.interestBucket = "bollywood_gossip_entertainment";
    expect(finalQualityRejectReasonForTest(generic)).toBe("generic_placeholder_without_entity");
  });

  it("rejects generic public-safety shells without a concrete topic", () => {
    const generic = trend("#वायरस_अपडेट", "वायरस अपडेट", "public_safety");
    generic.interestBucket = "weather_local_public_safety";
    generic.safety = { status: "limited", reasons: ["factual public-health/death report"] };
    expect(finalQualityRejectReasonForTest(generic)).toBe("generic_placeholder_without_entity");
  });
});
