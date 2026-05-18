import { describe, expect, it } from "vitest";
import { detectCategory } from "../category";
import { normalizeSignal } from "../normalize";
import type { RawSignal } from "../types";

function category(title: string) {
  const raw: RawSignal = {
    id: title,
    source: "Dainik Jagran",
    sourceType: "hindi_news",
    rawTitle: title,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "hi",
    reliabilityWeight: 0.75,
  };
  const normalized = normalizeSignal(raw);
  return detectCategory(raw, normalized.normalizedText, normalized.tokens);
}

describe("category precedence", () => {
  it("does not classify political सनातनी quote as devotional", () => {
    expect(category("दिग्विजय सिंह बोले- मैं घोर सनातनी हूं")).not.toBe("devotional");
  });

  it("classifies devotional intent as devotional", () => {
    expect(category("सावन सोमवार भोलेनाथ पूजा")).toBe("devotional");
  });

  it("classifies Vat Savitri greeting as festival", () => {
    expect(category("वट सावित्री की शुभकामनाएं")).toBe("festival");
  });

  it("does not classify protest/crime as devotional", () => {
    expect(category("पंजाब के किसानों का चंडीगढ़ कूच, पुलिस से भिड़े")).toBe("politics");
    expect(category("जेहादी ड्रग कैप्टागन की खेप NCB ने जब्त की")).toBe("news");
  });
});
