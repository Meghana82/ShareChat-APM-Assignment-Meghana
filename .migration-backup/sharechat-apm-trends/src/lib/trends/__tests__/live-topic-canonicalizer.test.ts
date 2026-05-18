import { describe, expect, it } from "vitest";
import { canonicalizeLiveTopic } from "../live-topic-canonicalizer";
import type { RankedTrend } from "../types";

function trend(title: string): RankedTrend {
  return {
    rank: 1,
    tag: `#${title.replace(/\s+/g, "_")}`,
    title,
    displayLabel: title,
    description: `${title} पर चर्चा बढ़ रही है।`,
    category: "news",
    heatScore: 50,
    bharatRelevanceScore: 80,
    sources: ["Dainik Bhaskar"],
    sourceTypes: ["hindi_news"],
    trendStage: "emerging",
    whyTrending: "भारतीय स्रोतों में इस विषय पर संकेत हैं।",
    sampleContent: { type: "summary", text: "लोग इस विषय पर अपडेट देख रहे हैं।" },
    safety: { status: "safe", reasons: [] },
    signalSummary: { externalValidationScore: 50, crossSourceCount: 1, freshnessScore: 80, reliabilityScore: 70, regionalRelevanceScore: 80 },
    generatedAt: new Date().toISOString(),
  };
}

describe("live topic canonicalizer", () => {
  it("canonicalizes Ebola public-health headlines", () => {
    const repaired = canonicalizeLiveTopic(trend("इबोला वायरस से 80 लोगों की मौत"));
    expect(repaired?.tag).toBe("#इबोला_वायरस");
    expect(repaired?.safety.status).toBe("limited");
  });

  it("does not publish generic virus shells without a concrete disease topic", () => {
    expect(canonicalizeLiveTopic(trend("वायरस अपडेट"))).toBeNull();
  });

  it("canonicalizes Rajdhani Express fire headlines", () => {
    const repaired = canonicalizeLiveTopic(trend("राजधानी एक्सप्रेस में लगी भीषण आग"));
    expect(repaired?.tag).toBe("#राजधानी_एक्सप्रेस_आग");
    expect(repaired?.title).toBe("राजधानी एक्सप्रेस आग");
    expect(repaired?.safety.status).toBe("limited");
  });

  it("canonicalizes road accident casualty headlines", () => {
    const repaired = canonicalizeLiveTopic(trend("दर्दनाक सड़क हादसे में 5 लोगों की मौत"));
    expect(repaired?.tag).toBe("#सड़क_हादसा");
    expect(repaired?.category).toBe("public_safety");
    expect(repaired?.safety.status).toBe("limited");
    expect(repaired?.displayLabel).toContain("5 लोगों की मौत");
  });

  it("canonicalizes road accident updates without inventing death claims", () => {
    const repaired = canonicalizeLiveTopic(trend("सड़क हादसे का अपडेट"));
    expect(repaired?.tag).toBe("#सड़क_हादसा");
    expect(repaired?.displayLabel).toContain("सड़क हादसे का अपडेट");
    expect(repaired?.displayLabel).not.toContain("मौत");
  });

  it("canonicalizes CNG price spike headlines", () => {
    const repaired = canonicalizeLiveTopic(trend("CNG की कीमतों में लगी आग"));
    expect(repaired?.tag).toBe("#CNG_कीमत");
    expect(repaired?.category).toBe("finance");
    expect(repaired?.interestBucket).toBe("utility_bazaar_prices");
  });

  it("canonicalizes education minister resignation demand politics", () => {
    const repaired = canonicalizeLiveTopic(trend("राहुल ने की शिक्षा मंत्री के इस्तीफे की मांग"));
    expect(repaired?.tag).toBe("#राहुल_शिक्षा_मंत्री");
    expect(repaired?.category).toBe("politics");
    expect(repaired?.interestBucket).toBe("modi_national_news");
  });

  it("canonicalizes T20 Delhi vs Rajasthan sports tags", () => {
    const repaired = canonicalizeLiveTopic(trend("T20 लीग: दिल्ली vs राजस्थान"));
    expect(repaired?.tag).toBe("#दिल्ली_बनाम_राजस्थान");
    expect(repaired?.category).toBe("sports");
    expect(repaired?.displayLabel).toBe("🏏 T20 लीग: दिल्ली vs राजस्थान 👊");
  });

  it("repairs DC vs RR to ShareChat-style Delhi vs Rajasthan", () => {
    const repaired = canonicalizeLiveTopic(trend("DC बनाम RR"));
    expect(repaired?.tag).toBe("#दिल्ली_बनाम_राजस्थान");
    expect(repaired?.title).toBe("दिल्ली बनाम राजस्थान");
  });

  it("canonicalizes Kamal Haasan and CM Vijay crossover", () => {
    const repaired = canonicalizeLiveTopic(trend("CM विजय से मिले कमल हासन"));
    expect(repaired?.tag).toBe("#कमल_हासन_CM_विजय");
    expect(repaired?.category).toBe("entertainment");
  });
});
