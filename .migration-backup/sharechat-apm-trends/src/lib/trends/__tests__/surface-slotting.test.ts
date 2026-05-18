import { describe, expect, it } from "vitest";
import { buildFinalTop10 } from "../pipeline";
import { selectTopSurfaceTags } from "../top-surface";
import { getTrendTimeMode } from "../time-mode";
import type { RankedTrend } from "../types";

function trend(tag: string, title: string, category: RankedTrend["category"], bucket: string, sourceType: RankedTrend["sourceTypes"][number] = "hindi_news", heatScore = 70): RankedTrend {
  const daily = sourceType === "daily_rhythm";
  return {
    rank: 1,
    tag,
    title,
    displayLabel: title,
    description: `${title} पर चर्चा बढ़ रही है।`,
    category,
    heatScore,
    bharatRelevanceScore: 85,
    sources: [daily ? "ShareChat Daily Rhythm Calendar" : "Dainik Bhaskar"],
    sourceTypes: [sourceType],
    trendStage: "rising",
    whyTrending: "भारतीय स्रोतों में संकेत मिल रहे हैं।",
    sampleContent: { type: "summary", text: `${title} पर लोग अपडेट देख रहे हैं।` },
    safety: { status: category === "public_safety" ? "limited" : "safe", reasons: [] },
    signalSummary: { externalValidationScore: 65, crossSourceCount: 2, freshnessScore: 90, reliabilityScore: 75, regionalRelevanceScore: 85 },
    generatedAt: new Date().toISOString(),
    interestBucket: bucket,
  };
}

const morningRhythm = [
  trend("#शुभ_रविवार", "शुभ रविवार", "viral", "daily_rhythm_status", "daily_rhythm", 68),
  trend("#माँ_वैष्णो_देवी", "माँ वैष्णो देवी", "devotional", "daily_rhythm_status", "daily_rhythm", 68),
  trend("#विश्व_दूरसंचार_दिवस", "विश्व दूरसंचार दिवस", "technology", "daily_rhythm_status", "daily_rhythm", 68),
  trend("#गर्मी_से_बचाव", "गर्मी से बचाव", "weather", "daily_rhythm_status", "daily_rhythm", 68),
];

const livePulse = [
  trend("#इबोला_वायरस", "इबोला वायरस", "public_safety", "weather_local_public_safety", "hindi_news", 78),
  trend("#राजधानी_एक्सप्रेस_आग", "राजधानी एक्सप्रेस आग", "public_safety", "weather_local_public_safety", "hindi_news", 76),
  trend("#CNG_कीमत", "CNG कीमत", "finance", "utility_bazaar_prices", "hindi_news", 74),
  trend("#कमल_हासन_CM_विजय", "कमल हासन और CM विजय मुलाकात", "entertainment", "bollywood_gossip_entertainment", "hindi_news", 72),
  trend("#हिमाचल_निकाय_चुनाव", "हिमाचल निकाय चुनाव", "government", "modi_national_news", "hindi_news", 66),
  trend("#NEET_पेपर_लीक", "NEET पेपर लीक", "education", "finance_education_jobs_utility", "hindi_news", 64),
  trend("#मुंबई_बारिश", "मुंबई बारिश", "weather", "weather_local_public_safety", "hindi_news", 63),
  trend("#बॉलीवुड_गॉसिप", "बॉलीवुड गॉसिप", "entertainment", "bollywood_gossip_entertainment", "hindi_news", 62),
  trend("#पेट्रोल_डीजल_कीमत", "पेट्रोल-डीजल कीमत", "finance", "utility_bazaar_prices", "hindi_news", 60),
];

describe("surface slotting", () => {
  it("morning top 4 can include observed rhythm/devotional/observance/weather tags", () => {
    const surface = selectTopSurfaceTags([...morningRhythm, ...livePulse], getTrendTimeMode(new Date("2026-05-17T08:00:00+05:30"))).slice(0, 4);
    expect(surface.map((item) => item.tag)).toEqual(expect.arrayContaining(["#शुभ_रविवार", "#माँ_वैष्णो_देवी", "#विश्व_दूरसंचार_दिवस", "#गर्मी_से_बचाव"]));
  });

  it("midday top 4 prefers live/public-safety/utility/celebrity-politics over daily rhythm", () => {
    const surface = selectTopSurfaceTags([...morningRhythm, ...livePulse], getTrendTimeMode(new Date("2026-05-17T12:00:00+05:30"))).slice(0, 4);
    expect(surface.map((item) => item.tag)).toEqual(expect.arrayContaining(["#इबोला_वायरस", "#CNG_कीमत", "#कमल_हासन_CM_विजय"]));
    expect(surface.filter((item) => item.interestBucket === "daily_rhythm_status").length).toBeLessThanOrEqual(1);
  });

  it("full top 10 includes at most two daily rhythm tags at midday", () => {
    const top10 = buildFinalTop10([...morningRhythm, ...livePulse], [], getTrendTimeMode(new Date("2026-05-17T12:00:00+05:30")), 10, new Date("2026-05-17T12:00:00+05:30"));
    expect(top10).toHaveLength(10);
    expect(top10.filter((item) => item.interestBucket === "daily_rhythm_status").length).toBeLessThanOrEqual(2);
  });
});
