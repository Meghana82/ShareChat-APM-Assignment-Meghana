import { describe, expect, it } from "vitest";
import { INTEREST_BUCKETS } from "../interest-buckets";

describe("ShareChat interest buckets", () => {
  it("defines all required ShareChat-native buckets with keywords and seed queries", () => {
    const ids = INTEREST_BUCKETS.map((bucket) => bucket.id);
    expect(ids).toEqual(expect.arrayContaining([
      "festival_devotional",
      "modi_national_news",
      "cricket_ipl_sports",
      "bollywood_gossip_entertainment",
      "memes_viral_emotion",
      "bhojpuri_music_creator",
      "weather_local_public_safety",
      "utility_bazaar_prices",
      "finance_education_jobs_utility",
    ]));
    for (const bucket of INTEREST_BUCKETS) {
      expect(bucket.hindiKeywords.length + bucket.romanKeywords.length).toBeGreaterThan(0);
      expect(bucket.seedQueries.length).toBeGreaterThan(0);
      expect(bucket.preferredSourceFamilies.length).toBeGreaterThan(0);
    }
  });

  it("utility bucket covers household price keywords", () => {
    const bucket = INTEREST_BUCKETS.find((item) => item.id === "utility_bazaar_prices");
    expect(bucket).toBeTruthy();
    const all = [...(bucket?.hindiKeywords ?? []), ...(bucket?.romanKeywords ?? [])].join(" ").toLowerCase();
    expect(all).toContain("सोना");
    expect(all).toContain("चांदी");
    expect(all).toContain("पेट्रोल");
    expect(all).toContain("डीजल");
    expect(all).toContain("lpg");
    expect(all).toContain("cng");
    expect(all).toContain("inflation");
  });
});
