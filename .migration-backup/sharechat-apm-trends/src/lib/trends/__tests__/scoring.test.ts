import { describe, expect, it } from "vitest";
import { categoryDecayFor, culturalBoostFor, reliabilityWeightForSource, scoreCluster } from "../scoring";
import type { FilteredSignal, TrendCluster } from "../types";

function filtered(source: string, sourceType: FilteredSignal["sourceType"], category: FilteredSignal["preliminaryCategory"]): FilteredSignal {
  return {
    id: `${source}-${category}`,
    source,
    sourceType,
    rawTitle: "भारत ट्रेंड",
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "hi",
    reliabilityWeight: reliabilityWeightForSource(source),
    normalizedText: "भारत ट्रेंड",
    tokens: ["भारत", "ट्रेंड"],
    indiaHints: ["भारत"],
    hindiHints: ["भारत"],
    safetyFlags: [],
    preliminaryCategory: category,
    indiaHindiRelevanceScore: 90,
  };
}

function cluster(category: TrendCluster["category"], crossSourceBoost = 1): TrendCluster {
  const signal = filtered("PIB Hindi", "official_government", category);
  return {
    id: category,
    canonicalTitle: "भारत ट्रेंड",
    aliases: ["भारत ट्रेंड"],
    signals: [signal],
    category,
    sourceNames: [signal.source],
    sourceTypes: [signal.sourceType],
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    indiaHindiRelevanceScore: 90,
    crossSourceCount: crossSourceBoost > 1 ? 2 : 1,
    crossSourceBoost,
  };
}

describe("deterministic scoring", () => {
  it("official source has higher reliability than Reddit", () => {
    expect(reliabilityWeightForSource("RBI")).toBeGreaterThan(reliabilityWeightForSource("Reddit"));
  });

  it("cross-source boost increases score", () => {
    const low = scoreCluster(cluster("government", 1)).inputScore;
    const high = scoreCluster(cluster("government", 1.5)).inputScore;
    expect(high).toBeGreaterThan(low);
  });

  it("cultural boost increases festival/devotional/hyperlocal trends", () => {
    expect(culturalBoostFor("festival")).toBeGreaterThan(culturalBoostFor("technology"));
    expect(culturalBoostFor("weather")).toBeGreaterThan(culturalBoostFor("technology"));
  });

  it("category decay handles festival vs cricket differently", () => {
    const old = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    expect(categoryDecayFor("festival", old)).toBeGreaterThan(categoryDecayFor("sports", old));
  });

  it("final heat clamps 1-100", () => {
    const scored = scoreCluster({ ...cluster("festival", 10), signals: Array.from({ length: 50 }, () => filtered("PIB Hindi", "official_government", "festival")) });
    expect(scored.inputScore).toBeLessThanOrEqual(100);
    expect(scored.inputScore).toBeGreaterThanOrEqual(1);
  });

  it("active internal devotional season seeds receive stronger cultural boost", () => {
    const signal = {
      ...filtered("Internal Festival Calendar", "festival_calendar", "devotional"),
      metadata: { isActiveFestivalSeed: true, daysFromFestival: 2, seed: { english_name: "Sawan Somwar", preseed_window_days: 30 } },
    };
    const scored = scoreCluster({
      ...cluster("devotional", 1),
      signals: [signal, { ...signal, id: "second-sawan-signal" }],
      sourceNames: ["Internal Festival Calendar"],
      sourceTypes: ["festival_calendar"],
      indiaHindiRelevanceScore: 95,
    });
    expect(scored.inputScore).toBeGreaterThanOrEqual(60);
  });

  it("festival today gets heat and relevance floors", () => {
    const signal = {
      ...filtered("Internal Festival Calendar", "festival_calendar", "festival"),
      metadata: { isActiveFestivalSeed: true, isFestivalToday: true, daysFromFestival: 0, seed: { english_name: "Vat Savitri Vrat", culturalPriority: "high" } },
      indiaHindiRelevanceScore: 90,
    };
    const scored = scoreCluster({
      ...cluster("festival", 1),
      canonicalTitle: "वट सावित्री व्रत",
      signals: [signal],
      sourceNames: ["Internal Festival Calendar"],
      sourceTypes: ["festival_calendar"],
      indiaHindiRelevanceScore: 90,
    });
    expect(scored.inputScore).toBeGreaterThanOrEqual(72);
  });

  it("weak external validation cannot produce heatScore 100", () => {
    const weak = scoreCluster({
      ...cluster("viral", 1),
      signals: [filtered("Reddit", "social_experimental", "viral")],
      sourceNames: ["Reddit"],
      sourceTypes: ["social_experimental"],
      indiaHindiRelevanceScore: 20,
    });
    expect(weak.scoringDebug.externalValidationScore).toBeLessThanOrEqual(20);
    expect(weak.inputScore).toBeLessThanOrEqual(35);
  });

  it("3-source Google Trends + Hindi News + YouTube candidate can score strongly", () => {
    const signals = [
      filtered("Google Trends India", "search_demand", "sports"),
      filtered("Dainik Jagran", "hindi_news", "sports"),
      filtered("YouTube", "video", "sports"),
    ];
    const strong = scoreCluster({
      ...cluster("sports", 1.3),
      canonicalTitle: "KKR vs GT IPL match",
      aliases: ["KKR vs GT Live Score", "KKR बनाम GT मैच"],
      signals,
      sourceNames: ["Google Trends India", "Dainik Jagran", "YouTube"],
      sourceTypes: ["search_demand", "hindi_news", "video"],
      crossSourceCount: 3,
      crossSourceBoost: 1.3,
      indiaHindiRelevanceScore: 90,
    });
    expect(strong.inputScore).toBeGreaterThanOrEqual(80);
  });

  it("utility trend with Google Trends + Hindi news + rate source can score strongly", () => {
    const signals = [
      { ...filtered("Google Trends India", "search_demand", "finance"), rawTitle: "gold rate today India", normalizedText: "gold rate today india", tokens: ["gold", "rate", "today", "india"] },
      { ...filtered("Dainik Jagran", "hindi_news", "finance"), rawTitle: "सोने का भाव आज", normalizedText: "सोने का भाव आज", tokens: ["सोने", "भाव", "आज"] },
      { ...filtered("GoodReturns Gold Rates", "national_news", "finance"), rawTitle: "Gold Rates", normalizedText: "gold rates", tokens: ["gold", "rates"], metadata: { isUtilityRateSource: true } },
    ];
    const scored = scoreCluster({
      ...cluster("finance", 1.3),
      canonicalTitle: "सोने का भाव आज",
      aliases: ["gold rate today India", "सोने की कीमत"],
      signals,
      sourceNames: ["Google Trends India", "Dainik Jagran", "GoodReturns Gold Rates"],
      sourceTypes: ["search_demand", "hindi_news", "national_news"],
      crossSourceCount: 3,
      crossSourceBoost: 1.3,
      indiaHindiRelevanceScore: 90,
    });
    expect(scored.inputScore).toBeGreaterThanOrEqual(75);
  });

  it("single-source utility article caps at 55 and does not require RBI", () => {
    const scored = scoreCluster({
      ...cluster("finance", 1),
      canonicalTitle: "पेट्रोल डीजल कीमत आज",
      aliases: ["petrol diesel price today"],
      signals: [{ ...filtered("Dainik Jagran", "hindi_news", "finance"), rawTitle: "पेट्रोल डीजल कीमत आज", normalizedText: "पेट्रोल डीजल कीमत आज", tokens: ["पेट्रोल", "डीजल", "कीमत"] }],
      sourceNames: ["Dainik Jagran"],
      sourceTypes: ["hindi_news"],
      indiaHindiRelevanceScore: 85,
    });
    expect(scored.inputScore).toBeLessThanOrEqual(55);
  });
});
