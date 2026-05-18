import { describe, expect, it } from "vitest";
import { buildHindiHashtag } from "../topic-extraction";
import { validateCategory } from "../category";
import type { FilteredSignal } from "../types";

function signal(title: string): FilteredSignal {
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
    tokens: title.toLowerCase().split(/\s+/),
    indiaHints: ["भारत"],
    hindiHints: [],
    safetyFlags: [],
    preliminaryCategory: "finance",
    indiaHindiRelevanceScore: 85,
  };
}

describe("utility price quality", () => {
  it("canonicalizes daily price tags", () => {
    expect(buildHindiHashtag({ canonicalTitle: "Gold Rate Today", category: "finance" })).toBe("#सोने_की_कीमत");
    expect(buildHindiHashtag({ canonicalTitle: "Petrol Diesel Price Today", category: "finance" })).toBe("#पेट्रोल_डीजल_कीमत");
  });

  it("does not require RBI for fuel/gold daily price topics", () => {
    expect(validateCategory([signal("पेट्रोल डीजल कीमत आज")], "finance").ok).toBe(true);
  });
});
