import { INTEREST_BUCKETS, bucketForTrend, sourceFamilyMixForTrend } from "./interest-buckets";
import type { Candidate } from "./candidate-generation";
import type { MixSummary, RankedTrend } from "./types";

const HARD_NEWS = new Set(["news", "government", "politics", "public_safety"]);

export function rerankForShareChatMix(trends: RankedTrend[], candidates: Candidate[] = [], limit = 10): RankedTrend[] {
  const eligible = trends.filter((trend) => trend.bharatRelevanceScore >= 70 && trend.safety.status !== "review_required" && !trend.sourceTypes.every((type) => type === "social_experimental"));
  const selected: RankedTrend[] = [];
  const used = new Set<string>();
  const requiredBuckets = ["daily_rhythm_status", "festival_devotional", "cricket_ipl_sports", "modi_national_news", "bollywood_gossip_entertainment", "memes_viral_emotion", "utility_bazaar_prices", "finance_education_jobs_utility"];

  for (const bucketId of requiredBuckets) {
    const candidateExists = candidates.some((candidate) => candidate.bucketId === bucketId) || eligible.some((trend) => bucketForTrend(trend) === bucketId);
    if (!candidateExists) continue;
    const trend = eligible.find((item) => !used.has(item.tag) && bucketForTrend(item) === bucketId);
    if (trend) pushTrend(trend);
  }

  for (const trend of eligible) {
    if (selected.length >= limit) break;
    if (used.has(trend.tag)) continue;
    const hardNewsCount = selected.filter((item) => HARD_NEWS.has(item.category)).length;
    const utilityCount = selected.filter((item) => bucketForTrend(item) === "utility_bazaar_prices").length;
    if (HARD_NEWS.has(trend.category) && hardNewsCount >= 3 && trend.signalSummary.crossSourceCount < 4) continue;
    if (bucketForTrend(trend) === "utility_bazaar_prices" && utilityCount >= 2) continue;
    pushTrend(trend);
  }

  return selected
    .map((trend) => addFinalRankDebug(trend, mixPriorityFor(bucketForTrend(trend))))
    .sort((a, b) => ((b.debug?.finalRankScore as number | undefined) ?? b.heatScore) - ((a.debug?.finalRankScore as number | undefined) ?? a.heatScore))
    .map((trend, index) => ({ ...trend, rank: index + 1, interestBucket: bucketForTrend(trend) }));

  function pushTrend(trend: RankedTrend) {
    selected.push({ ...trend, interestBucket: bucketForTrend(trend) });
    used.add(trend.tag);
  }
}

function mixPriorityFor(bucket: string): number {
  if (["daily_rhythm_status", "festival_devotional", "cricket_ipl_sports", "utility_bazaar_prices"].includes(bucket)) return 8;
  if (["bollywood_gossip_entertainment", "memes_viral_emotion", "finance_education_jobs_utility"].includes(bucket)) return 6;
  return 3;
}

function addFinalRankDebug(trend: RankedTrend, mixPriorityBoost: number): RankedTrend {
  const qualityPenalty = isGenericTrend(trend) ? 25 : 0;
  const finalRankScore = trend.heatScore + Math.min(8, mixPriorityBoost) - qualityPenalty;
  return {
    ...trend,
    debug: {
      ...(trend.debug ?? {}),
      finalRankReason: {
        heatScore: trend.heatScore,
        mixPriorityBoost: Math.min(8, mixPriorityBoost),
        qualityPenalty,
        finalRankScore,
        reason: qualityPenalty ? "generic candidate penalized" : "ranked by heat plus bounded mix priority",
      },
      finalRankScore,
    },
  };
}

function isGenericTrend(trend: RankedTrend): boolean {
  return ["वित्त अपडेट", "परीक्षा अपडेट", "वायरल अपडेट", "समाचार अपडेट", "ताजा अपडेट"].includes(trend.title.trim());
}

export function buildMixSummary(trends: RankedTrend[], diversityApplied: boolean): MixSummary {
  const families = trends.flatMap(sourceFamilyMixForTrend);
  const familyCounts = families.reduce<Record<string, number>>((acc, family) => {
    acc[family] = (acc[family] ?? 0) + 1;
    return acc;
  }, {});

  return {
    dailyRhythmCount: trends.filter((trend) => bucketForTrend(trend) === "daily_rhythm_status").length,
    observanceCount: trends.filter((trend) => /दूरसंचार|दिवस/.test(`${trend.tag} ${trend.title}`)).length,
    seasonalUtilityCount: trends.filter((trend) => /गर्मी|धूप|बचाव/.test(`${trend.tag} ${trend.title}`)).length,
    sportsCount: trends.filter((trend) => trend.category === "sports").length,
    newsGovernmentCount: trends.filter((trend) => ["news", "government", "politics", "public_safety"].includes(trend.category)).length,
    festivalDevotionalCount: trends.filter((trend) => ["festival", "devotional"].includes(trend.category)).length,
    entertainmentViralCount: trends.filter((trend) => ["entertainment", "movies", "music", "viral"].includes(trend.category)).length,
    weatherLocalCount: trends.filter((trend) => ["weather", "local", "public_safety"].includes(trend.category)).length,
    financeEducationJobsCount: trends.filter((trend) => ["finance", "education", "jobs"].includes(trend.category)).length,
    utilityPriceCount: trends.filter((trend) => bucketForTrend(trend) === "utility_bazaar_prices").length,
    diversityApplied,
    dominantSourceFamilies: Object.entries(familyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([family]) => family),
    notes: ["Final list is balanced across hard news, cricket, culture, entertainment, local/weather, and utility categories when valid candidates exist."],
  };
}

export function returnedByBucket(trends: RankedTrend[]): Record<string, number> {
  const initial = Object.fromEntries(INTEREST_BUCKETS.map((bucket) => [bucket.id, 0])) as Record<string, number>;
  for (const trend of trends) {
    const bucket = bucketForTrend(trend);
    initial[bucket] = (initial[bucket] ?? 0) + 1;
  }
  return initial;
}

export function missingImportantBuckets(candidateCounts: Record<string, number>, returnedCounts: Record<string, number>): string[] {
  return INTEREST_BUCKETS.filter((bucket) => (candidateCounts[bucket.id] ?? 0) > 0 && (returnedCounts[bucket.id] ?? 0) === 0).map((bucket) => bucket.id);
}
