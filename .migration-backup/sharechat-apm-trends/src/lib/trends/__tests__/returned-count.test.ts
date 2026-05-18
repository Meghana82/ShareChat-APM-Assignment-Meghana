import { describe, expect, it } from "vitest";
import { buildFinalTop10 } from "../pipeline";
import { getTrendTimeMode } from "../time-mode";
import type { RankedTrend } from "../types";

function trend(tag: string, title: string, category: RankedTrend["category"], bucket: string, sourceType: RankedTrend["sourceTypes"][number] = "hindi_news"): RankedTrend {
  return {
    rank: 1,
    tag,
    title,
    displayLabel: title,
    description: `${title} पर चर्चा बढ़ रही है।`,
    category,
    heatScore: 65,
    bharatRelevanceScore: 85,
    sources: [sourceType === "daily_rhythm" ? "ShareChat Daily Rhythm Calendar" : "Dainik Bhaskar"],
    sourceTypes: [sourceType],
    trendStage: "rising",
    whyTrending: "भारतीय स्रोतों में संकेत मिल रहे हैं।",
    sampleContent: { type: "summary", text: `${title} पर लोग अपडेट देख रहे हैं।` },
    safety: { status: category === "public_safety" ? "limited" : "safe", reasons: [] },
    signalSummary: { externalValidationScore: 60, crossSourceCount: 2, freshnessScore: 90, reliabilityScore: 75, regionalRelevanceScore: 85 },
    generatedAt: new Date().toISOString(),
    interestBucket: bucket,
  };
}

const daily = [
  trend("#शुभ_रविवार", "शुभ रविवार", "viral", "daily_rhythm_status", "daily_rhythm"),
  trend("#माँ_वैष्णो_देवी", "माँ वैष्णो देवी", "devotional", "daily_rhythm_status", "daily_rhythm"),
  trend("#विश्व_दूरसंचार_दिवस", "विश्व दूरसंचार दिवस", "technology", "daily_rhythm_status", "daily_rhythm"),
  trend("#गर्मी_से_बचाव", "गर्मी से बचाव", "weather", "daily_rhythm_status", "daily_rhythm"),
];

const sourceBacked = [
  trend("#इबोला_वायरस", "इबोला वायरस", "public_safety", "weather_local_public_safety"),
  trend("#राजधानी_एक्सप्रेस_आग", "राजधानी एक्सप्रेस आग", "public_safety", "weather_local_public_safety"),
  trend("#CNG_कीमत", "CNG कीमत", "finance", "utility_bazaar_prices"),
  trend("#पेट्रोल_डीजल_कीमत", "पेट्रोल-डीजल कीमत", "finance", "utility_bazaar_prices"),
  trend("#हिमाचल_निकाय_चुनाव", "हिमाचल निकाय चुनाव", "government", "modi_national_news"),
  trend("#NEET_पेपर_लीक", "NEET पेपर लीक", "education", "finance_education_jobs_utility"),
  trend("#कमल_हासन_CM_विजय", "कमल हासन और CM विजय मुलाकात", "entertainment", "bollywood_gossip_entertainment"),
  trend("#मुंबई_बारिश", "मुंबई बारिश", "weather", "weather_local_public_safety"),
  trend("#बॉलीवुड_गॉसिप", "बॉलीवुड गॉसिप", "entertainment", "bollywood_gossip_entertainment"),
];

describe("returned count finalization", () => {
  it("returns exactly 10 when enough clean candidates exist", () => {
    const top10 = buildFinalTop10([...sourceBacked, ...daily], [], getTrendTimeMode(new Date("2026-05-17T12:00:00+05:30")), 10, new Date("2026-05-17T12:00:00+05:30"));
    expect(top10).toHaveLength(10);
    expect(top10.map((item) => item.tag)).not.toContain("#बॉलीवुड_गॉसिप");
    expect(top10.map((item) => item.tag)).not.toContain("#वायरस_अपडेट");
    expect(top10.map((item) => item.tag)).not.toContain("#LPG_गैस_कीमत");
  });

  it("uses previous safe cache plus capped daily rhythm without unsafe fabrication", () => {
    const top10 = buildFinalTop10(daily, sourceBacked, getTrendTimeMode(new Date("2026-05-17T12:00:00+05:30")), 10, new Date("2026-05-17T12:00:00+05:30"));
    expect(top10).toHaveLength(10);
    expect(top10.filter((item) => item.interestBucket === "daily_rhythm_status").length).toBeLessThanOrEqual(2);
    expect(top10.every((item) => item.safety.status !== "blocked" && item.safety.status !== "review_required")).toBe(true);
  });
});
