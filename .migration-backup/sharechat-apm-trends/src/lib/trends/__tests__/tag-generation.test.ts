import { describe, expect, it } from "vitest";
import { buildHindiHashtag } from "../topic-extraction";

describe("Unicode-safe Hindi hashtag builder", () => {
  it("preserves Devanagari matras", () => {
    expect(buildHindiHashtag("सावन सोमवार भोलेनाथ")).toBe("#सावन_सोमवार_भोलेनाथ");
    expect(buildHindiHashtag("सावन सोमवार भोलेनाथ")).not.toBe("#सवन_समवर_भलनथ");
  });

  it("uses phrase mappings for product-ready canonical tags", () => {
    expect(buildHindiHashtag("पेट्रोल-डीजल कीमतों में वृद्धि")).toBe("#पेट्रोल_डीजल_मूल्यवृद्धि");
    expect(buildHindiHashtag("117 सालों से लंदन के म्यूजियम में है वाग्देवी की प्रतिमा")).toBe("#वाग्देवी_लंदन_म्यूजियम");
    expect(buildHindiHashtag("NEET पेपर लीक में बड़ा खुलासा")).toBe("#NEET_पेपर_लीक");
    expect(buildHindiHashtag("KKR vs GT Live Score")).toBe("#KKR_बनाम_GT");
  });

  it("uses Hindi fallback for long English official finance text", () => {
    expect(buildHindiHashtag({ canonicalTitle: "Operating framework for facilitating Outward Remittance services", category: "finance" })).toBe("#वित्त_अपडेट");
  });

  it("creates clean utility price tags", () => {
    expect(buildHindiHashtag({ canonicalTitle: "Gold Silver Price Today: सोना सस्ता, चांदी 10000 रुपये लुढ़की", category: "finance" })).toBe("#सोने_की_कीमत");
    expect(buildHindiHashtag({ canonicalTitle: "Petrol diesel price today: दिल्ली, मुंबई, पटना में रेट", category: "finance" })).toBe("#पेट्रोल_डीजल_कीमत");
    expect(buildHindiHashtag({ canonicalTitle: "LPG cylinder price today", category: "finance" })).toBe("#LPG_सिलेंडर_रेट");
  });
});
