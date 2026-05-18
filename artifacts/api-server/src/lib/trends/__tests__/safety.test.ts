import { describe, expect, it } from "vitest";
import { assessTrendSafety } from "../safety";
import type { RankedTrend } from "../types";

function safety(title: string, category: RankedTrend["category"] = "news") {
  return assessTrendSafety({
    title,
    displayLabel: title,
    description: title,
    whyTrending: "विश्वसनीय स्रोतों से इस विषय पर चर्चा बढ़ रही है।",
    category,
    safety: { status: "safe", reasons: [] },
  });
}

describe("context-aware safety", () => {
  it("keeps Vagdevi heritage safe", () => {
    expect(safety("117 सालों से लंदन के म्यूजियम में है वाग्देवी की प्रतिमा").status).toBe("safe");
  });

  it("does not let stale raw safety flags override clean final heritage metadata", () => {
    const assessed = assessTrendSafety({
      title: "वाग्देवी प्रतिमा पर चर्चा",
      displayLabel: "🛕 वाग्देवी प्रतिमा को लेकर चर्चा",
      description: "लंदन म्यूजियम में रखी वाग्देवी प्रतिमा पर भारत में चर्चा बढ़ रही है।",
      whyTrending: "हिंदी समाचार स्रोतों में इस विरासत विषय पर चर्चा बढ़ रही है।",
      category: "news",
      safety: { status: "review_required", reasons: ["हत्या"] },
    });
    expect(assessed.status).toBe("safe");
  });

  it("keeps petrol price story safe", () => {
    expect(safety("पेट्रोल-डीजल कीमतों में वृद्धि", "finance").status).toBe("safe");
  });

  it("keeps weather heat risk safe or limited, not review_required", () => {
    expect(["safe", "limited"]).toContain(safety("भारत में सूखा-भीषण गर्मी पड़ने की आशंका", "weather").status);
  });

  it("marks factual accident/death as limited", () => {
    expect(safety("ट्रेन-बस की भीषण टक्कर, 8 की मौत", "news").status).toBe("limited");
  });

  it("marks communal incitement as review_required", () => {
    expect(["review_required", "blocked"]).toContain(safety("सांप्रदायिक हिंसा फैलाने की अपील", "politics").status);
  });

  it("marks drug enforcement and protest conflict as review_required", () => {
    expect(safety("जेहादी ड्रग कैप्टागन की खेप NCB ने जब्त की", "news").status).toBe("review_required");
    expect(safety("पंजाब के किसानों का चंडीगढ़ कूच, पुलिस से भिड़े", "politics").status).toBe("review_required");
  });
});
