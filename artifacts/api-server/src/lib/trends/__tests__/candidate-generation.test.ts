import { describe, expect, it } from "vitest";
import { generateCandidatesByInterestBucket } from "../candidate-generation";
import { getActiveFestivalSignals } from "../festival-resolver";
import type { RawSignal } from "../types";

function raw(title: string, source: string, sourceType: RawSignal["sourceType"], categoryHint?: RawSignal["categoryHint"]): RawSignal {
  return {
    id: `${source}:${title}`,
    source,
    sourceType,
    rawTitle: title,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "mixed",
    categoryHint,
    reliabilityWeight: 0.75,
  };
}

describe("candidate generation by bucket", () => {
  it("generates candidates for cricket, Modi/news, Bollywood and active festivals", () => {
    const signals = [
      raw("KKR vs GT Live Score", "Google Trends India", "search_demand", "sports"),
      raw("PM Modi speech today", "Dainik Jagran", "hindi_news", "government"),
      raw("Bollywood gossip today new movie trailer", "YouTube", "video", "entertainment"),
      ...getActiveFestivalSignals(new Date("2026-05-16T10:00:00+05:30")),
    ];
    const candidates = generateCandidatesByInterestBucket(signals);
    const buckets = candidates.map((candidate) => candidate.bucketId);
    expect(buckets).toContain("cricket_ipl_sports");
    expect(buckets).toContain("modi_national_news");
    expect(buckets).toContain("bollywood_gossip_entertainment");
    expect(buckets).toContain("festival_devotional");
  });

  it("generates utility bazaar candidates for gold and fuel price stories", () => {
    const candidates = generateCandidatesByInterestBucket([
      raw("Gold Silver Price Today: सोना सस्ता, चांदी 10000 रुपये लुढ़की", "Dainik Jagran", "hindi_news", "finance"),
      raw("Petrol diesel price today Delhi Mumbai Patna rate", "Google Trends India", "search_demand", "finance"),
      raw("LPG cylinder price today", "GoodReturns Petrol Prices", "national_news", "finance"),
    ]);
    expect(candidates.map((candidate) => candidate.bucketId)).toContain("utility_bazaar_prices");
  });
});
