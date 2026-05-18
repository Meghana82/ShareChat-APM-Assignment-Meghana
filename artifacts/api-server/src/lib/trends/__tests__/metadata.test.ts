import { describe, expect, it } from "vitest";
import { makeHindiTag } from "../metadata";
import { postGenerationSafetyCheck } from "../safety";
import type { RankedTrend } from "../types";

describe("Hindi tag generation and repair", () => {
  it("preserves Devanagari matras in generated tags", () => {
    const tag = makeHindiTag("सावन सोमवार भोलेनाथ", "devotional");
    expect(tag).toBe("#सावन_सोमवार_भोलेनाथ");
  });

  it("repairs tags without corrupting Devanagari matras", () => {
    const trend: RankedTrend = {
      rank: 1,
      tag: "#सावन_सोमवार_भोलेनाथ",
      title: "सावन सोमवार भोलेनाथ",
      displayLabel: "🙏 सावन सोमवार की तैयारी",
      description: "सावन सोमवार को लेकर भक्ति चर्चा है।",
      category: "devotional",
      heatScore: 65,
      bharatRelevanceScore: 95,
      sources: ["Internal Festival Calendar"],
      sourceTypes: ["festival_calendar"],
      trendStage: "emerging",
      whyTrending: "सावन सोमवार से जुड़ी भक्ति पोस्ट बढ़ रही हैं।",
      sampleContent: { type: "summary", text: "लोग भक्ति गीत और शुभकामनाएं शेयर कर रहे हैं।" },
      safety: { status: "safe", reasons: [] },
      signalSummary: {
        externalValidationScore: 50,
        crossSourceCount: 1,
        freshnessScore: 90,
        reliabilityScore: 55,
        regionalRelevanceScore: 95,
      },
      generatedAt: "2026-05-16T20:00:00+05:30",
    };
    expect(postGenerationSafetyCheck([trend])[0]?.tag).toBe("#सावन_सोमवार_भोलेनाथ");
  });

  it("uses product-friendly semantic tags for common Bharat trend patterns", () => {
    expect(makeHindiTag("117 साल से लंदन के म्यूजियम में रखी वाग्देवी प्रतिमा", "news")).toBe("#वाग्देवी_लंदन_म्यूजियम");
    expect(makeHindiTag("पेट्रोल-डीजल कीमत में बढ़ोतरी", "finance")).toBe("#पेट्रोल_डीजल_मूल्यवृद्धि");
  });

  it("uses clean utility tags without inventing exact prices", () => {
    expect(makeHindiTag("सोने का भाव आज", "finance")).toBe("#सोने_की_कीमत");
    expect(makeHindiTag("पेट्रोल डीजल कीमत आज", "finance")).toBe("#पेट्रोल_डीजल_कीमत");
  });
});
