import { describe, expect, it } from "vitest";
import { validateTrendFreshness } from "../trend-freshness";
import type { RankedTrend, SourceType, TrendCategory } from "../types";

function trend(input: Partial<RankedTrend>): RankedTrend {
  return {
    rank: 1,
    tag: "#टेस्ट",
    title: "टेस्ट",
    displayLabel: "टेस्ट",
    description: "टेस्ट",
    category: "news",
    heatScore: 60,
    bharatRelevanceScore: 85,
    sources: ["Dainik Bhaskar"],
    sourceTypes: ["hindi_news"],
    trendStage: "rising",
    whyTrending: "स्रोतों में चर्चा दिख रही है।",
    sampleContent: { type: "summary", text: "लोग अपडेट देख रहे हैं।" },
    safety: { status: "safe", reasons: [] },
    signalSummary: {
      externalValidationScore: 60,
      crossSourceCount: 2,
      freshnessScore: 80,
      reliabilityScore: 75,
      regionalRelevanceScore: 85,
    },
    generatedAt: "2026-05-17T18:00:00+05:30",
    ...input,
  };
}

function typedSourceTypes(sourceTypes: SourceType[]): SourceType[] {
  return sourceTypes;
}

function typedCategory(category: TrendCategory): TrendCategory {
  return category;
}

describe("trend freshness policy", () => {
  it("rejects a one-day festival after its IST day ends unless search demand corroborates it", () => {
    const result = validateTrendFreshness(
      trend({
        tag: "#शनि_अमावस्या",
        title: "शनि अमावस्या",
        displayLabel: "🪔 शनि अमावस्या पर पूजा-पाठ",
        category: typedCategory("devotional"),
        interestBucket: "festival_devotional",
        sourceTypes: typedSourceTypes(["festival_calendar", "hindi_news", "national_news"]),
        signalSummary: {
          externalValidationScore: 80,
          crossSourceCount: 3,
          freshnessScore: 100,
          reliabilityScore: 75,
          regionalRelevanceScore: 85,
        },
      }),
      new Date("2026-05-17T18:00:00+05:30"),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("expired_day_specific_festival");
  });

  it("keeps a one-day festival on its actual IST day", () => {
    const result = validateTrendFreshness(
      trend({
        tag: "#शनि_अमावस्या",
        title: "शनि अमावस्या",
        category: typedCategory("devotional"),
        interestBucket: "festival_devotional",
        sourceTypes: typedSourceTypes(["festival_calendar"]),
      }),
      new Date("2026-05-16T18:00:00+05:30"),
    );

    expect(result.ok).toBe(true);
  });

  it("rejects stale IPL match-pair topics without fresh search demand", () => {
    const result = validateTrendFreshness(
      trend({
        tag: "#KKR_बनाम_GT",
        title: "KKR बनाम GT",
        displayLabel: "🏏 KKR vs GT चर्चा",
        category: typedCategory("sports"),
        interestBucket: "cricket_ipl_sports",
        sourceTypes: typedSourceTypes(["hindi_news", "video"]),
        signalSummary: {
          externalValidationScore: 16,
          crossSourceCount: 3,
          freshnessScore: 17,
          reliabilityScore: 71,
          regionalRelevanceScore: 80,
        },
      }),
      new Date("2026-05-17T18:00:00+05:30"),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("stale_sports_match");
  });

  it("rejects old match pairs fused into generic live IPL demand", () => {
    const result = validateTrendFreshness(
      trend({
        tag: "#KKR_बनाम_GT",
        title: "KKR बनाम GT",
        displayLabel: "🏏 KKR vs GT चर्चा",
        category: typedCategory("sports"),
        interestBucket: "cricket_ipl_sports",
        sourceTypes: typedSourceTypes(["search_demand", "hindi_news", "video"]),
        signalSummary: {
          externalValidationScore: 42,
          crossSourceCount: 3,
          freshnessScore: 78,
          reliabilityScore: 74,
          regionalRelevanceScore: 80,
        },
        debug: {
          aliases: [
            "ipl points table",
            "points table of ipl 2026",
            "ipl final",
            "Delhi Traffic Advisory: आज DC vs RR का मैच",
            "generic cricket shorts",
            "RCB travel video",
            "Mark Wood IPL private jet",
            "KKR vs GT: Finn Allen Stars, Shubman Gill's 85 In Vain As KKR Beat GT",
            "KKR VS GT: post match analysis",
            "LSG Dents CSK playoff Hopes | LSG vs CSK | IPL 2026",
            "What a TWIST! CSK Playoffs Future is Now in RCB Hands? | IPL Points Table Analysis",
            "Playoff race heats up in Lucknow | LSG vs CSK Game Plan",
            "csk vs srh",
          ],
        },
      }),
      new Date("2026-05-17T18:00:00+05:30"),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("weak_or_stale_sports_pair_evidence");
  });

  it("keeps a fresh IPL match-pair topic", () => {
    const result = validateTrendFreshness(
      trend({
        tag: "#RCB_बनाम_PBKS",
        title: "RCB बनाम PBKS",
        displayLabel: "🏏 RCB vs PBKS चर्चा",
        category: typedCategory("sports"),
        interestBucket: "cricket_ipl_sports",
        sourceTypes: typedSourceTypes(["hindi_news", "video"]),
        signalSummary: {
          externalValidationScore: 75,
          crossSourceCount: 3,
          freshnessScore: 80,
          reliabilityScore: 70,
          regionalRelevanceScore: 85,
        },
      }),
      new Date("2026-05-17T18:00:00+05:30"),
    );

    expect(result.ok).toBe(true);
  });

  it("keeps a match pair when live-score evidence is prominent", () => {
    const result = validateTrendFreshness(
      trend({
        tag: "#RCB_बनाम_PBKS",
        title: "RCB बनाम PBKS",
        displayLabel: "🏏 RCB vs PBKS चर्चा",
        category: typedCategory("sports"),
        interestBucket: "cricket_ipl_sports",
        sourceTypes: typedSourceTypes(["hindi_news", "video"]),
        debug: {
          aliases: [
            "PBKS vs RCB Live Score: स्टोइनिस और शशांक के बीच साझेदारी",
            "PBKS vs RCB: कोहली का कैच",
            "IPL points table",
            "generic cricket shorts",
            "KKR vs GT: old highlights",
            "LSG vs CSK match analysis",
          ],
        },
      }),
      new Date("2026-05-17T18:00:00+05:30"),
    );

    expect(result.ok).toBe(true);
  });

  it("repairs a mixed IPL cluster to the dominant fresh match pair from aliases", () => {
    const result = validateTrendFreshness(
      trend({
        tag: "#KKR_बनाम_GT",
        title: "KKR बनाम GT",
        displayLabel: "🏏 KKR vs GT चर्चा",
        category: typedCategory("sports"),
        interestBucket: "cricket_ipl_sports",
        sourceTypes: typedSourceTypes(["hindi_news", "video"]),
        debug: {
          aliases: [
            "PBKS vs RCB Live Score: पंजाब की आधी टीम पवेलियन लौटी",
            "PBKS vs RCB: कोहली का शानदार कैच",
            "KKR vs GT: old highlights",
          ],
        },
      }),
      new Date("2026-05-17T18:00:00+05:30"),
    );

    expect(result.ok).toBe(true);
    expect(result.repaired?.tag).toBe("#RCB_बनाम_PBKS");
    expect(result.repaired?.debug?.sportsPairRepairedFromEvidence).toBe(true);
  });
});
