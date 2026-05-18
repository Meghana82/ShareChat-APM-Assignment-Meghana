import { describe, expect, it } from "vitest";
import { rerankForShareChatMix } from "../diversity";
import type { RankedTrend } from "../types";

function trend(tag: string, category: RankedTrend["category"], heatScore: number, safety: RankedTrend["safety"]["status"] = "safe"): RankedTrend {
  return {
    rank: 1,
    tag,
    title: tag.replace("#", ""),
    displayLabel: tag.replace("#", ""),
    description: "भारत में चर्चा बढ़ रही है।",
    category,
    heatScore,
    bharatRelevanceScore: 85,
    sources: ["Google Trends India"],
    sourceTypes: ["search_demand"],
    trendStage: "rising",
    whyTrending: "सर्च और खबरों में संकेत बढ़ रहे हैं।",
    sampleContent: { type: "summary", text: "लोग इस विषय पर चर्चा कर रहे हैं।" },
    safety: { status: safety, reasons: [] },
    signalSummary: {
      externalValidationScore: heatScore,
      crossSourceCount: 2,
      freshnessScore: 90,
      reliabilityScore: 80,
      regionalRelevanceScore: 85,
    },
    generatedAt: new Date().toISOString(),
  };
}

describe("ShareChat mix reranking", () => {
  it("keeps sports and festival candidates in the top mix without promoting unsafe items", () => {
    const reranked = rerankForShareChatMix([
      trend("#सरकारी_अपडेट", "government", 90),
      trend("#राजनीतिक_चर्चा", "politics", 85, "review_required"),
      trend("#KKR_बनाम_GT", "sports", 80),
      trend("#वट_सावित्री", "festival", 72),
      trend("#बॉलीवुड_गॉसिप", "entertainment", 70),
    ]);
    expect(reranked.some((item) => item.category === "sports")).toBe(true);
    expect(reranked.some((item) => item.category === "festival")).toBe(true);
    expect(reranked.some((item) => item.safety.status === "review_required")).toBe(false);
  });

  it("includes a strong utility trend but caps utility dominance", () => {
    const reranked = rerankForShareChatMix([
      trend("#सोने_की_कीमत", "finance", 82),
      trend("#पेट्रोल_डीजल_कीमत", "finance", 78),
      trend("#LPG_सिलेंडर_रेट", "finance", 76),
      trend("#KKR_बनाम_GT", "sports", 80),
      trend("#वट_सावित्री", "festival", 72),
    ]);
    const utility = reranked.filter((item) => ["#सोने_की_कीमत", "#पेट्रोल_डीजल_कीमत", "#LPG_सिलेंडर_रेट"].includes(item.tag));
    expect(utility.length).toBeGreaterThanOrEqual(1);
    expect(utility.length).toBeLessThanOrEqual(2);
  });
});
