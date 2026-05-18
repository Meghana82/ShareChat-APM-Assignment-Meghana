import { describe, expect, it } from "vitest";
import { buildHindiHashtag } from "../topic-extraction";
import { computeIndiaHindiRelevanceScore } from "../relevance";
import { normalizeSignal } from "../normalize";
import type { RawSignal } from "../types";

describe("sports quality repair", () => {
  it("canonicalizes IPL team pairs", () => {
    expect(buildHindiHashtag({ canonicalTitle: "KKR vs GT Live Score", category: "sports" })).toBe("#KKR_बनाम_GT");
  });

  it("IPL team pair receives strong Bharat relevance", () => {
    const raw: RawSignal = {
      id: "kkr-gt",
      source: "Google Trends India",
      sourceType: "search_demand",
      rawTitle: "KKR vs GT Live Score",
      fetchedAt: new Date().toISOString(),
      geo: "IN",
      languageHint: "en",
      categoryHint: "sports",
      reliabilityWeight: 0.85,
    };
    const n = normalizeSignal(raw);
    expect(computeIndiaHindiRelevanceScore(raw, n, "sports")).toBeGreaterThanOrEqual(80);
  });
});
