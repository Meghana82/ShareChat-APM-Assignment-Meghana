import { describe, expect, it } from "vitest";
import { applyHardFilters } from "../filters";
import type { RawSignal } from "../types";

function signal(title: string): RawSignal {
  return {
    id: title,
    source: "Google Trends India",
    sourceType: "search_demand",
    rawTitle: title,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "mixed",
    reliabilityWeight: 0.85,
  };
}

describe("hard filters", () => {
  it("does not remove IPL/RBI/UPI/NEET despite short length", () => {
    const result = applyHardFilters(["IPL", "RBI", "UPI", "NEET"].map(signal));
    expect(result.passed.map((item) => item.rawTitle)).toEqual(["IPL", "RBI", "UPI", "NEET"]);
  });

  it("removes spam phrases", () => {
    const result = applyHardFilters([signal("free recharge trick 2026")]);
    expect(result.rejected[0]?.reason).toBe("spam_phrase");
  });

  it("removes adult phrases", () => {
    const result = applyHardFilters([signal("leaked mms nude video")]);
    expect(result.rejected[0]?.reason).toBe("adult_content");
  });

  it("marks sensitive terms as review_required via safety flags", () => {
    const result = applyHardFilters([signal("दिल्ली में धमाका खबर")]);
    expect(result.passed[0]?.safetyFlags).toContain("धमाका");
  });

  it("does not match English sensitive keywords inside unrelated words", () => {
    const result = applyHardFilters([signal("पेट्रोल डीजल automobile कीमत अपडेट")]);
    expect(result.passed[0]?.safetyFlags).not.toContain("mob");
  });

  it("does not flag weather casualty context as crime/sensational trend", () => {
    const result = applyHardFilters([signal("गर्मी से मौत के मामलों पर मौसम विभाग की सलाह")]);
    expect(result.passed[0]?.safetyFlags).not.toContain("मौत");
  });
});
