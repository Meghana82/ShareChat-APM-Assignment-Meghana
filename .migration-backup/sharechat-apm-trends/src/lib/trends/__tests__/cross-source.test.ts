import { describe, expect, it } from "vitest";
import { groupForCrossSourceValidation, validateCrossSource } from "../cross-source";
import type { FilteredSignal } from "../types";

function signal(source: string, sourceType: FilteredSignal["sourceType"], title = "भारत क्रिकेट मैच"): FilteredSignal {
  return {
    id: `${source}-${title}`,
    source,
    sourceType,
    rawTitle: title,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: sourceType === "hindi_news" ? "hi" : "mixed",
    reliabilityWeight: sourceType === "social_experimental" ? 0.35 : 0.75,
    normalizedText: title.toLowerCase(),
    tokens: title.split(/\s+/),
    indiaHints: ["भारत"],
    hindiHints: ["क्रिकेट"],
    safetyFlags: [],
    preliminaryCategory: "sports",
    indiaHindiRelevanceScore: 90,
  };
}

describe("cross-source validation", () => {
  it("2 independent sources increase validation level", () => {
    const validation = validateCrossSource([signal("Google Trends India", "search_demand"), signal("Dainik Jagran", "hindi_news")]);
    expect(validation.validationLevel).toBe("medium");
    expect(validation.crossSourceBoost).toBeGreaterThan(1);
  });

  it("Hindi news duplicates merge rather than creating duplicate trends", () => {
    const groups = groupForCrossSourceValidation([
      signal("Dainik Jagran", "hindi_news", "भारत क्रिकेट मैच"),
      signal("Dainik Bhaskar", "hindi_news", "भारत क्रिकेट मैच अपडेट"),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("Reddit alone never passes", () => {
    const validation = validateCrossSource([signal("Reddit", "social_experimental")]);
    expect(validation.validationLevel).toBe("low");
    expect(validation.crossSourceCount).toBe(1);
  });

  it("official source can pass as authority for its category", () => {
    const official = { ...signal("RBI", "official_finance", "RBI repo rate"), preliminaryCategory: "finance" as const };
    const validation = validateCrossSource([official]);
    expect(validation.validationLevel).toBe("authority");
  });
});
