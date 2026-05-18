import { describe, expect, it } from "vitest";
import { detectCategory } from "../category";
import { normalizeSignal } from "../normalize";
import { computeIndiaHindiRelevanceScore, passesIndiaHindiRelevanceGate } from "../relevance";
import type { FilteredSignal, RawSignal } from "../types";

function filtered(input: Partial<RawSignal> & Pick<RawSignal, "rawTitle" | "source" | "sourceType">): FilteredSignal {
  const raw: RawSignal = {
    id: input.rawTitle,
    rawTitle: input.rawTitle,
    source: input.source,
    sourceType: input.sourceType,
    fetchedAt: new Date().toISOString(),
    geo: input.geo ?? "IN",
    languageHint: input.languageHint ?? "mixed",
    reliabilityWeight: input.reliabilityWeight ?? 0.75,
    rawDescription: input.rawDescription,
    categoryHint: input.categoryHint,
  };
  const normalized = normalizeSignal(raw);
  const category = detectCategory(raw, normalized.normalizedText, normalized.tokens);
  const score = computeIndiaHindiRelevanceScore(raw, normalized, category);
  return { ...raw, ...normalized, preliminaryCategory: category, safetyFlags: [], indiaHindiRelevanceScore: score };
}

describe("India-Hindi relevance gate", () => {
  it("Google Trends geo=IN passes India relevance", () => {
    const signal = filtered({ rawTitle: "IPL final India cricket", source: "Google Trends India", sourceType: "search_demand" });
    expect(signal.indiaHindiRelevanceScore).toBeGreaterThanOrEqual(70);
    expect(passesIndiaHindiRelevanceGate(signal)).toBe(true);
  });

  it("Hindi-native RSS gives Hindi relevance", () => {
    const signal = filtered({ rawTitle: "भारत में बारिश और मौसम अलर्ट", source: "Dainik Jagran", sourceType: "hindi_news", languageHint: "hi" });
    expect(signal.indiaHindiRelevanceScore).toBeGreaterThanOrEqual(70);
  });

  it("obscure foreign story fails", () => {
    const signal = filtered({ rawTitle: "Texas county mayor local police snowstorm", source: "The Hindu National", sourceType: "national_news", geo: "US", languageHint: "en" });
    expect(passesIndiaHindiRelevanceGate(signal)).toBe(false);
  });

  it("global tech topic passes only with India signals", () => {
    const signal = filtered({ rawTitle: "iPhone launch India UPI offers Hindi review", source: "Google Trends India", sourceType: "search_demand" });
    const agreeing = filtered({ rawTitle: "iPhone launch भारत में चर्चा", source: "Dainik Bhaskar", sourceType: "hindi_news", languageHint: "hi" });
    expect(passesIndiaHindiRelevanceGate(signal, [agreeing])).toBe(true);
  });

  it("global topic fails without 2 India-specific signals", () => {
    const signal = filtered({ rawTitle: "OpenAI Senate hearing social media", source: "Reddit", sourceType: "social_experimental", geo: "US", languageHint: "en" });
    expect(passesIndiaHindiRelevanceGate(signal)).toBe(false);
  });

  it("IPL team match gets Bharat relevance boost even when written in acronyms", () => {
    const signal = filtered({ rawTitle: "KKR vs GT IPL live match", source: "Google Trends India", sourceType: "search_demand", languageHint: "en" });
    expect(signal.indiaHindiRelevanceScore).toBeGreaterThanOrEqual(70);
  });
});
