import { describe, expect, it } from "vitest";
import { deterministicClusterSignals } from "../clustering";
import type { FilteredSignal, TrendCategory } from "../types";

function signal(title: string, category: TrendCategory = "news", safetyFlags: string[] = []): FilteredSignal {
  const tokens = title.toLowerCase().split(/\s+/);
  return {
    id: title,
    source: "Dainik Jagran",
    sourceType: "hindi_news",
    rawTitle: title,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "hi",
    reliabilityWeight: 0.75,
    normalizedText: title.toLowerCase(),
    tokens,
    indiaHints: title.includes("भारत") ? ["भारत"] : [],
    hindiHints: [],
    safetyFlags,
    preliminaryCategory: category,
    indiaHindiRelevanceScore: 80,
  };
}

describe("deterministic clustering", () => {
  it("does not merge Vagdevi heritage with murder/death stories", () => {
    const clusters = deterministicClusterSignals([
      signal("117 सालों से लंदन के म्यूजियम में है वाग्देवी की प्रतिमा"),
      signal("दिल्ली हत्या मामले में नया अपडेट", "news", ["हत्या"]),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it("does not merge petrol price story with mob/death story", () => {
    const clusters = deterministicClusterSignals([
      signal("पेट्रोल-डीजल कीमतों में वृद्धि", "finance"),
      signal("mob violence death report", "news", ["mob", "death"]),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it("merges KKR vs GT variants", () => {
    const clusters = deterministicClusterSignals([
      signal("KKR vs GT Live Score", "sports"),
      signal("KKR बनाम GT मैच अपडेट", "sports"),
    ]);
    expect(clusters).toHaveLength(1);
  });
});
