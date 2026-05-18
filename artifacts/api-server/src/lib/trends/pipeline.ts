import { CACHE_NOTE, CACHE_WINDOW_MINUTES, ASSUMPTIONS, toIndiaIsoString } from "./constants";
import { candidatePoolByBucket, generateCandidatesByInterestBucket } from "./candidate-generation";
import { validateCategory } from "./category";
import { clusterSignals, deterministicClusterSignals } from "./clustering";
import { groupForCrossSourceValidation, validateCrossSource } from "./cross-source";
import { setLastFetchSummary, setLastSourceHealth } from "./debug";
import { getDailyRhythmSignals, toIstParts } from "./daily-rhythm";
import { buildMixSummary, missingImportantBuckets, rerankForShareChatMix, returnedByBucket } from "./diversity";
import { rescueEntertainmentTrends } from "./entertainment-rescue";
import { canUseAsLenientFinalRescue, validateFinalTrendQuality } from "./final-quality";
import { validateCandidateFieldIntegrity } from "./field-integrity";
import { getActiveFestivalSignals } from "./festival-resolver";
import { canonicalizeLiveTopic, canonicalizeSignalToTrend } from "./live-topic-canonicalizer";
import { rescueNationalNewsTrends } from "./national-news-rescue";
import { fetchCalendarSignals } from "./fetchers/calendar";
import { fetchGoogleTrends } from "./fetchers/google-trends";
import { fetchHindiAndNationalNews } from "./fetchers/hindi-news";
import { fetchOfficialSources } from "./fetchers/official-sources";
import { fetchReddit } from "./fetchers/reddit";
import { fetchRoanuz } from "./fetchers/roanuz";
import { fetchUtilityPrices } from "./fetchers/utility-prices";
import { fetchWeather } from "./fetchers/weather";
import { fetchYouTube } from "./fetchers/youtube";
import { fetchLimit } from "./fetch-utils";
import { applyHardFilters } from "./filters";
import { generateRankedTrends } from "./metadata";
import { computeClusterBharatRelevanceScore, passesIndiaHindiRelevanceGate } from "./relevance";
import { postGenerationSafetyCheck, type RejectedCandidate } from "./safety";
import { scoreClusters } from "./scoring";
import { rescueSportsTrends } from "./sports-rescue";
import { SOURCE_CONFIGS } from "./source-config";
import { selectTopSurfaceTags } from "./top-surface";
import { validateTrendFreshness } from "./trend-freshness";
import { getTrendTimeMode, isDevotionalSurfaceMode, type TrendTimeMode } from "./time-mode";
import { bucketForSignal, bucketForTrend } from "./interest-buckets";
import type { ApiResponse, FilteredSignal, PipelineOptions, RankedTrend, RawSignal, SourceHealth, TrendCluster } from "./types";
import { rescueUtilityAndEducationTrends } from "./utility-rescue";

type Fetcher = () => Promise<{ ok: boolean; source: string; data?: RawSignal[]; error?: string; health: SourceHealth }>;
type FetcherResult = Awaited<ReturnType<Fetcher>>;
type BucketRejectedCandidate = RejectedCandidate & { bucket?: string };
const SOURCE_FETCHER_TIMEOUT_MS = 25_000;
const DAILY_RHYTHM_TAGS = new Set(["#शुभ_रविवार", "#सुप्रभात_संदेश", "#माँ_वैष्णो_देवी", "#हनुमान_भक्ति", "#भोलेनाथ_भक्ति", "#सूर्यदेव_प्रणाम", "#विश्व_दूरसंचार_दिवस", "#गर्मी_से_बचाव"]);
const IPL_TEAM_TAG_CODES = ["KKR", "GT", "CSK", "MI", "RCB", "DC", "RR", "SRH", "PBKS", "LSG"];

export async function runTrendingPipeline(options: PipelineOptions): Promise<ApiResponse> {
  const now = new Date();
  const timeMode = getTrendTimeMode(now);

  // Pipeline order mandated by the assignment:
  // 1. External Sources
  const fetchers: Fetcher[] = [
    fetchGoogleTrends,
    fetchHindiAndNationalNews,
    fetchOfficialSources,
    fetchWeather,
    fetchYouTube,
    fetchCalendarSignals,
    fetchUtilityPrices,
    fetchReddit,
    fetchRoanuz,
  ];
  const results = await Promise.all(fetchers.map((fetcher) => fetchLimit(() => runFetcherWithTimeout(fetcher))));
  const health = results.map((result) => result.health);
  setLastSourceHealth(health);
  const rawSignals = [...results.flatMap((result) => (result.ok && result.data ? result.data : [])), ...getDailyRhythmSignals(now, "hi")];
  const candidates = generateCandidatesByInterestBucket(rawSignals);
  const candidateCounts = candidatePoolByBucket(candidates);

  // 2. Normalize Signals + 3. Hard Filters
  const filterOutcome = applyHardFilters(rawSignals, now);
  const hardFiltered = filterOutcome.passed;

  // 4. India-Hindi Relevance Gate: Regional > Global
  const initialGroups = groupForCrossSourceValidation(hardFiltered);
  const relevancePassed = hardFiltered.filter((signal) => {
    const group = initialGroups.find((candidate) => candidate.signals.includes(signal));
    const agreeing = group?.signals.filter((item) => item.id !== signal.id) ?? [];
    return passesIndiaHindiRelevanceGate(signal, agreeing);
  });

  // 5. Cross-Source Validation
  const crossSourceGroups = groupForCrossSourceValidation(relevancePassed);

  // 6. Category Validation
  const categoryValidatedSignals: FilteredSignal[] = [];
  for (const group of crossSourceGroups) {
    const validation = validateCategory(group.signals, group.category);
    if (!validation.ok) continue;
    categoryValidatedSignals.push(...group.signals);
  }

  // 7. LLM Clustering (optional) with deterministic fallback
  let clusters = await clusterSignals(categoryValidatedSignals, Boolean(process.env.ANTHROPIC_API_KEY));
  clusters = attachCrossSourceValidation(clusters);
  clusters = clusters
    .map((cluster) => ({ ...cluster, indiaHindiRelevanceScore: computeClusterBharatRelevanceScore(cluster.signals) }))
    .filter((cluster) => cluster.indiaHindiRelevanceScore >= 70);

  // 8. Deterministic Heat Scoring
  const scored = scoreClusters(clusters, now);

  // 9. LLM Hindi Metadata Generation + deterministic fallback
  const ranked = await generateRankedTrends(scored, options.debug);

  // 10. Post-generation Safety Check
  const rejectedCandidates: RejectedCandidate[] = [];
  let safeRanked = postGenerationSafetyCheck(ranked, rejectedCandidates);
  if (safeRanked.length < options.limit) {
    const backfill = await buildSourceBackfillTrends({
      signals: relevancePassed,
      existing: safeRanked,
      limit: options.limit,
      debug: options.debug,
      now,
      rejectedCandidates,
    });
    safeRanked = [...safeRanked, ...backfill].slice(0, options.limit).map((trend, index) => ({ ...trend, rank: index + 1 }));
  }
  const diversified = rerankForShareChatMix(safeRanked, candidates, options.limit * 2);
  const finalRejectedCandidates: BucketRejectedCandidate[] = [];
  const finalQualityPassed = diversified.flatMap((trend) => {
    const result = repairAndValidateTrend(trend, now);
    if (result.ok) return [result.trend];
    pushRejected(finalRejectedCandidates, trend, result.reason);
    return [];
  });
  let finalPool = finalQualityPassed;
  if (finalPool.length < options.limit) {
    const rescue = safeRanked.flatMap((trend) => {
      if (finalPool.some((item) => item.tag === trend.tag)) return [];
      if (!["sports", "finance", "festival", "devotional", "weather", "education", "government"].includes(trend.category)) return [];
      const result = repairAndValidateTrend(trend, now);
      if (!result.ok) return [];
      return [result.trend];
    });
    finalPool = [...finalPool, ...rescue];
  }
  finalPool = uniqueByTag([
    ...finalPool,
    ...buildLiveCanonicalRescueTrends(relevancePassed, finalPool, now),
    ...rescueSportsTrends(relevancePassed, now),
    ...rescueNationalNewsTrends(relevancePassed),
    ...rescueEntertainmentTrends(relevancePassed),
    ...rescueUtilityAndEducationTrends(relevancePassed),
  ]);
  if (finalPool.length < options.limit) {
    finalPool = [...finalPool, ...buildDailyRhythmRescueTrendsV2(finalPool, now)];
  }
  if (finalPool.length < options.limit) {
    const existingTags = new Set(finalPool.map((trend) => trend.tag));
    const lenient = safeRanked
      .filter((trend) => !existingTags.has(trend.tag))
      .filter(canUseAsLenientFinalRescue)
      .slice(0, options.limit - finalPool.length);
    finalPool = [...finalPool, ...lenient];
  }
  const limited = buildFinalTop10(finalPool, options.previousCache ?? [], timeMode, options.limit, now);
  const returnedCounts = returnedByBucket(limited);
  const mixSummary = buildMixSummary(limited, true);
  const bucketDiagnostics = buildBucketDiagnostics({
    candidateCounts,
    relevancePassed,
    crossSourceSignals: crossSourceGroups.flatMap((group) => group.signals),
    canonicalized: finalPool,
    qualityPassed: finalPool,
    returnedCounts,
    rejected: finalRejectedCandidates,
  });

  let response: ApiResponse = {
    generatedAt: toIndiaIsoString(now),
    cache: { status: "fresh", cacheWindowMinutes: CACHE_WINDOW_MINUTES, note: CACHE_NOTE },
    meta: {
      requestedLocale: "hi",
      geo: "IN",
      sourceCount: SOURCE_CONFIGS.length,
      rawSignalCount: rawSignals.length,
      filteredSignalCount: categoryValidatedSignals.length,
      clusterCount: clusters.length,
      returnedCount: limited.length,
      assumptions: ASSUMPTIONS,
      mixSummary,
      timeMode: timeModeMeta(timeMode),
      coverageAudit: {
        candidatePoolByBucket: candidateCounts,
        returnedByBucket: returnedCounts,
        missingImportantBuckets: missingImportantBuckets(candidateCounts, returnedCounts).map((bucket) => ({
          bucket,
          reason: `${candidateCounts[bucket] ?? 0} raw candidates but ${returnedCounts[bucket] ?? 0} returned after relevance, safety, diversity, and final quality gates`,
        })),
        dominantSourceFamilies: mixSummary.dominantSourceFamilies,
        bucketDiagnostics,
        note: "Used to verify the system considered ShareChat-native categories before ranking.",
      },
    },
    trends: limited,
    debug: options.debug
      ? {
          sourceHealth: health,
          sourceResults: results.map((result) => ({
            source: result.source,
            ok: result.ok,
            itemCount: result.health.itemCount,
            error: result.ok ? undefined : result.error,
          })),
          intermediateCounts: {
            rawSignalCount: rawSignals.length,
            hardFilteredCount: hardFiltered.length,
            hardRejectedCount: filterOutcome.rejected.length,
            relevancePassedCount: relevancePassed.length,
            crossSourceGroupCount: crossSourceGroups.length,
            categoryValidatedSignalCount: categoryValidatedSignals.length,
            clusterCount: clusters.length,
            safeTrendCount: safeRanked.length,
          },
          rejectedReasons: countRejectedReasons(filterOutcome.rejected.map((item) => item.reason)),
          rejectedCandidates,
          rejectedFinalCandidates: finalRejectedCandidates,
          candidatePoolByBucket: candidateCounts,
          pipelineOrder: [
            "External Sources",
            "Normalize Signals",
            "Hard Filters",
            "India-Hindi Relevance Gate: Regional > Global",
            "Cross-Source Validation",
            "Category Validation",
            "LLM Clustering",
            "Deterministic Heat Scoring",
            "LLM Hindi Metadata Generation",
            "Post-generation Safety Check",
            "Safe Backfill if fewer than 10 tags",
            "Short API Cache",
            "Trending Tags API",
          ],
        }
      : undefined,
  };

  // 11. Safe backfill is already applied through source-backed and daily-rhythm rescue before final ranking.
  // Do not run the legacy fallback here; it can reintroduce duplicate/stale items after final quality gates.
  response = finalizeResponseAfterBackfill(response, options.limit, now, timeMode, options.previousCache ?? []);
  if (response.trends.length < 10) {
    response.meta.returnedCountWarning = {
      requiredByAssignment: 10,
      actual: response.trends.length,
      reason: "Final quality gates rejected unsafe, malformed, publisher-name, generic, or low-evidence candidates. Daily rhythm, active festivals, source-backed backfill, and utility rescue were attempted.",
      attemptedBackfillSources: ["daily_rhythm", "active_festival", "google_trends", "hindi_news", "utility_rates", "previous_safe_cache"],
    };
  }

  setLastFetchSummary({
    generatedAt: response.generatedAt,
    sourceCount: SOURCE_CONFIGS.length,
    successfulSourceCount: results.filter((result) => result.ok).length,
    failedSourceCount: results.filter((result) => !result.ok).length,
    rawSignalCount: rawSignals.length,
    filteredSignalCount: categoryValidatedSignals.length,
    clusterCount: clusters.length,
    notes: [
      "Pipeline order: External Sources → Normalize → Hard Filters → India-Hindi Relevance Gate → Cross-Source Validation → Category Validation → LLM Clustering → Deterministic Scoring → LLM Hindi Metadata → Safety → Safe Backfill → Short API Cache → API.",
      "LLM never ranks; ranking is deterministic and auditable from scoringDebug when debug=1.",
    ],
  });

  if (response.trends.length === 0) throw new Error("No valid trends after live pipeline and safe backfill");
  return response;
}

function finalizeResponseAfterBackfill(response: ApiResponse, limit: number, now: Date, timeMode: TrendTimeMode, previousCache: RankedTrend[]): ApiResponse {
  const rejected: BucketRejectedCandidate[] = [];
  let cleaned = response.trends.flatMap((trend) => {
    const result = repairAndValidateTrend(trend, now);
    if (!result.ok) {
      pushRejected(rejected, trend, `${result.reason}_after_backfill`);
      return [];
    }
    return [result.trend];
  });

  if (cleaned.length < limit) cleaned = [...cleaned, ...buildActiveFestivalRescueTrends(cleaned, now)];
  if (cleaned.length < limit || isDevotionalSurfaceMode(timeMode)) cleaned = [...cleaned, ...buildDailyRhythmRescueTrendsV2(cleaned, now)];
  const trends = buildFinalTop10(cleaned, previousCache, timeMode, limit, now);
  const returnedCounts = returnedByBucket(trends);
  const mixSummary = buildMixSummary(trends, true);
  return {
    ...response,
    trends,
    meta: {
      ...response.meta,
      returnedCount: trends.length,
      mixSummary,
      coverageAudit: response.meta.coverageAudit
        ? {
            ...response.meta.coverageAudit,
            returnedByBucket: returnedCounts,
            dominantSourceFamilies: mixSummary.dominantSourceFamilies,
            bucketDiagnostics: response.meta.coverageAudit.bucketDiagnostics
              ? Object.fromEntries(Object.entries(response.meta.coverageAudit.bucketDiagnostics).map(([bucket, diagnostic]) => [bucket, {
                  ...diagnostic,
                  returnedCount: returnedCounts[bucket] ?? 0,
                }]))
              : response.meta.coverageAudit.bucketDiagnostics,
          }
        : response.meta.coverageAudit,
    },
    debug: response.debug
      ? {
          ...response.debug,
          rejectedAfterBackfill: rejected,
        }
      : response.debug,
  };
}

export function buildFinalTop10(validCandidates: RankedTrend[], previousCache: RankedTrend[] = [], timeMode: TrendTimeMode = getTrendTimeMode(), limit = 10, now: Date = new Date()): RankedTrend[] {
  const repairedCandidates = repairAndValidateMany(validCandidates, now);
  const repairedPrevious = repairAndValidateMany(previousCache, now).map((trend) => ({
    ...trend,
    debug: { ...(trend.debug ?? {}), previousSafeCacheBackfill: true },
  }));
  let pool = uniqueByTag([...repairedCandidates, ...repairedPrevious]);

  if (pool.length < limit) pool = uniqueByTag([...pool, ...repairAndValidateMany(buildActiveFestivalRescueTrends(pool, now), now)]);
  if (pool.length < limit || isDevotionalSurfaceMode(timeMode)) pool = uniqueByTag([...pool, ...repairAndValidateMany(buildDailyRhythmRescueTrendsV2(pool, now), now)]);
  pool = filterWrongWeekdayRhythmContent(pool, now);

  const liveSourceBacked = pool.filter((trend) => !isDailyRhythmTrend(trend));
  const baseDailyCap = liveSourceBacked.length >= timeMode.minLiveSourceBackedItems || !isDevotionalSurfaceMode(timeMode)
    ? timeMode.dailyRhythmTop10Cap
    : Math.max(timeMode.dailyRhythmTop10Cap, 3);
  const dailyCap = !isDevotionalSurfaceMode(timeMode) && nonDailyCount(pool) >= limit - 1 ? 1 : baseDailyCap;
  const utilityCap = timeMode.mode === "early_morning_status" ? 2 : 2;

  const ranked = [...pool].sort((a, b) => scoreForTimeMode(b, timeMode) - scoreForTimeMode(a, timeMode));
  let selected = capDailyRhythmInFinalList(ranked, pool, limit, dailyCap, utilityCap, timeMode);

  if (selected.length < limit) {
    const seen = new Set(selected.map((trend) => trend.tag.toLowerCase()));
    for (const trend of ranked) {
      if (selected.length >= limit) break;
      if (seen.has(trend.tag.toLowerCase())) continue;
      if (isDailyRhythmTrend(trend) && dailyCount(selected) >= dailyCap) continue;
      if (isUtilityTrend(trend) && utilityCount(selected) >= utilityCap) continue;
      selected.push(trend);
      seen.add(trend.tag.toLowerCase());
    }
  }

  if (selected.length < limit) {
    const seen = new Set(selected.map((trend) => trend.tag.toLowerCase()));
    for (const trend of ranked) {
      if (selected.length >= limit) break;
      if (seen.has(trend.tag.toLowerCase())) continue;
      if (isDailyRhythmTrend(trend) && dailyCount(selected) >= dailyCap) continue;
      selected.push(trend);
      seen.add(trend.tag.toLowerCase());
    }
  }

  if (selected.length < limit) {
    const seen = new Set(selected.map((trend) => trend.tag.toLowerCase()));
    const festivalFill = repairAndValidateMany(buildActiveFestivalRescueTrends(pool, now), now)
      .sort((a, b) => scoreForTimeMode(b, timeMode) - scoreForTimeMode(a, timeMode));
    for (const trend of festivalFill) {
      if (selected.length >= limit) break;
      if (seen.has(trend.tag.toLowerCase())) continue;
      selected.push(trend);
      seen.add(trend.tag.toLowerCase());
    }
  }

  return selectTopSurfaceTags(selected.slice(0, limit), timeMode).map((trend, index) => ({
    ...trend,
    rank: index + 1,
  }));
}

function capDailyRhythmInFinalList(ranked: RankedTrend[], pool: RankedTrend[], limit: number, maxDaily: number, maxUtility: number, timeMode: TrendTimeMode): RankedTrend[] {
  const selected: RankedTrend[] = [];
  const seen = new Set<string>();
  for (const trend of ranked) {
    if (selected.length >= limit) break;
    if (seen.has(trend.tag.toLowerCase())) continue;
    if (isDailyRhythmTrend(trend) && dailyCount(selected) >= maxDaily) continue;
    if (isUtilityTrend(trend) && utilityCount(selected) >= maxUtility) continue;
    selected.push(trend);
    seen.add(trend.tag.toLowerCase());
  }

  for (const trend of [...pool].sort((a, b) => scoreForTimeMode(b, timeMode) - scoreForTimeMode(a, timeMode))) {
    if (selected.length >= limit) break;
    if (seen.has(trend.tag.toLowerCase())) continue;
    if (isDailyRhythmTrend(trend) && dailyCount(selected) >= maxDaily) continue;
    if (isUtilityTrend(trend) && utilityCount(selected) >= maxUtility) continue;
    selected.push(trend);
    seen.add(trend.tag.toLowerCase());
  }
  return selected;
}

function scoreForTimeMode(trend: RankedTrend, timeMode: TrendTimeMode): number {
  const text = `${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`.toLowerCase();
  let score = ((trend.debug?.finalRankScore as number | undefined) ?? trend.heatScore) + trend.signalSummary.externalValidationScore * 0.12 + trend.bharatRelevanceScore * 0.08;
  if (/(आग|हादसा|मौत|वायरस|इबोला|ब्रेकिंग|fire|accident|death|virus|outbreak)/i.test(text) || trend.category === "public_safety") score += timeMode.breakingNewsBoost + timeMode.publicSafetyBoost;
  if (trend.interestBucket === "utility_bazaar_prices" || /(cng|lpg|पेट्रोल|डीजल|सोना|चांदी|कीमत|भाव|रेट|महंगा)/i.test(text)) score += timeMode.utilityPriceBoost;
  if (trend.category === "sports" || trend.interestBucket === "cricket_ipl_sports") score += timeMode.sportsBoost;
  if (["entertainment", "movies", "music"].includes(trend.category) || trend.interestBucket === "bollywood_gossip_entertainment") score += timeMode.entertainmentBoost;
  if (["devotional", "festival"].includes(trend.category) || trend.interestBucket === "daily_rhythm_status") score += timeMode.devotionalBoost;
  if (isDailyRhythmTrend(trend) && !isDevotionalSurfaceMode(timeMode)) score -= 18;
  if (trend.debug?.previousSafeCacheBackfill) score -= 6;
  return score;
}

function dailyCount(trends: RankedTrend[]): number {
  return trends.filter(isDailyRhythmTrend).length;
}

function utilityCount(trends: RankedTrend[]): number {
  return trends.filter(isUtilityTrend).length;
}

function isUtilityTrend(trend: RankedTrend): boolean {
  return trend.interestBucket === "utility_bazaar_prices" || /(cng|lpg|पेट्रोल|डीजल|सोना|चांदी|कीमत|भाव|रेट|महंगाई)/i.test(`${trend.tag} ${trend.title} ${trend.displayLabel}`);
}

function nonDailyCount(trends: RankedTrend[]): number {
  return trends.filter((trend) => !isDailyRhythmTrend(trend)).length;
}

function isDailyRhythmTrend(trend: RankedTrend): boolean {
  return trend.interestBucket === "daily_rhythm_status" || trend.sourceTypes.includes("daily_rhythm");
}

function uniqueByTag<T extends { tag: string }>(trends: T[]): T[] {
  const seen = new Set<string>();
  return trends.filter((trend) => {
    const key = canonicalTagKey(trend.tag);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalTagKey(tag: string): string {
  const base = tag
    .normalize("NFC")
    .replace(/^#/, "")
    .replace(/पीबीकेएस|पंजाब_किंग्स/gi, "PBKS")
    .replace(/आरसीबी/gi, "RCB")
    .replace(/सीएसके/gi, "CSK")
    .replace(/एमआई/gi, "MI")
    .replace(/केकेआर/gi, "KKR")
    .replace(/एसआरएच/gi, "SRH")
    .replace(/एलएसजी/gi, "LSG")
    .replace(/सीएनजी/gi, "CNG")
    .toLowerCase();
  if (/cng/.test(base)) return "cng_price";
  if (/lpg/.test(base)) return "lpg_price";
  if (/पेट्रोल|petrol|डीजल|diesel/.test(base)) return "petrol_diesel_price";
  const teams = IPL_TEAM_TAG_CODES.filter((team) => new RegExp(`(^|[^a-z0-9])${team.toLowerCase()}([^a-z0-9]|$)`).test(base));
  if (teams.length >= 2) return `ipl_pair_${teams.slice(0, 2).sort().join("_").toLowerCase()}`;
  return base;
}

const HINDI_WEEKDAY_MARKERS: { name: string; day: number }[] = [
  { name: "रविवार", day: 0 },
  { name: "सोमवार", day: 1 },
  { name: "मंगलवार", day: 2 },
  { name: "बुधवार", day: 3 },
  { name: "गुरुवार", day: 4 },
  { name: "शुक्रवार", day: 5 },
  { name: "शनिवार", day: 6 },
];

function filterWrongWeekdayRhythmContent(trends: RankedTrend[], now: Date): RankedTrend[] {
  const { weekday } = toIstParts(now);
  return trends.filter((trend) => {
    if (!trend.sourceTypes.includes("daily_rhythm")) return true;
    const text = `${trend.tag} ${trend.title}`;
    for (const marker of HINDI_WEEKDAY_MARKERS) {
      if (marker.day !== weekday && text.includes(marker.name)) return false;
    }
    return true;
  });
}

function buildDailyRhythmRescueTrendsV2(existing: RankedTrend[], now: Date): RankedTrend[] {
  const existingTags = new Set(existing.map((trend) => trend.tag));
  return getDailyRhythmSignals(now, "hi")
    .filter((signal) => !existingTags.has(signal.rawTitle.match(/#[\u0900-\u097FA-Za-z0-9_]+/)?.[0] ?? ""))
    .map((signal) => {
      const tag = signal.rawTitle.match(/#[\u0900-\u097FA-Za-z0-9_]+/)?.[0] ?? "#शुभ_दिन";
      const title = signal.rawTitle.replace(tag, "").trim();
      return makeCleanPipelineTrend({
        rank: 0,
        tag,
        title,
        displayLabel: String(signal.metadata?.displayLabel ?? title),
        description: signal.rawDescription ?? "आज इस स्टेटस पर लोग पोस्ट शेयर कर रहे हैं।",
        category: signal.categoryHint ?? "viral",
        heatScore: signal.metadata?.rhythmType === "weekday" ? 70 : 66,
        bharatRelevanceScore: 90,
        sources: [signal.source],
        sourceTypes: [signal.sourceType],
        generatedAt: toIndiaIsoString(now),
        interestBucket: "daily_rhythm_status",
      });
    });
}

function buildActiveFestivalRescueTrends(existing: RankedTrend[], now: Date): RankedTrend[] {
  const existingTags = new Set(existing.map((trend) => trend.tag.toLowerCase()));
  return getActiveFestivalSignals(now).flatMap((signal) => {
    const tag = signal.rawTitle.match(/#[\u0900-\u097FA-Za-z0-9_]+/)?.[0] ?? `#${String(signal.rawTitle).split(/\s+/).slice(0, 3).join("_")}`;
    if (existingTags.has(tag.toLowerCase())) return [];
    if (DAILY_RHYTHM_TAGS.has(tag)) return [];
    return [makeCleanPipelineTrend({
      rank: 0,
      tag,
      title: signal.rawTitle.replace(tag, "").trim() || String(signal.metadata?.displayLabel ?? "आज का व्रत"),
      displayLabel: String(signal.metadata?.displayLabel ?? signal.rawTitle.replace(tag, "").trim()),
      description: signal.rawDescription ?? "त्योहार, पूजा और शुभकामनाओं से जुड़ी चर्चा बढ़ रही है।",
      category: signal.categoryHint ?? "festival",
      heatScore: signal.metadata?.culturalPriority === "high" ? 66 : 62,
      bharatRelevanceScore: 86,
      sources: [signal.source],
      sourceTypes: [signal.sourceType],
      generatedAt: toIndiaIsoString(now),
      interestBucket: "festival_devotional",
    })];
  });
}

function buildLiveCanonicalRescueTrends(signals: FilteredSignal[], existing: RankedTrend[], now: Date): RankedTrend[] {
  const existingTags = new Set(existing.map((trend) => trend.tag.toLowerCase()));
  const generatedAt = toIndiaIsoString(now);
  const repaired = signals.flatMap((signal) => {
    if (signal.indiaHindiRelevanceScore < 70 || signal.sourceType === "social_experimental") return [];
    const canonical = canonicalizeSignalToTrend(signal, generatedAt);
    if (!canonical || existingTags.has(canonical.tag.toLowerCase())) return [];
    const result = repairAndValidateTrend(canonical, now);
    return result.ok ? [result.trend] : [];
  });
  return uniqueByTag(repaired);
}

function repairAndValidateMany(trends: RankedTrend[], now = new Date()): RankedTrend[] {
  return uniqueByTag(trends.flatMap((trend) => {
    const result = repairAndValidateTrend(trend, now);
    return result.ok ? [result.trend] : [];
  }));
}

function repairAndValidateTrend(trend: RankedTrend, now = new Date()): { ok: true; trend: RankedTrend } | { ok: false; reason: string } {
  const canonical = canonicalizeLiveTopic(trend) ?? trend;
  const quality = validateFinalTrendQuality(canonical);
  if (!quality.ok) return { ok: false, reason: quality.reason ?? "final_quality_rejected" };
  const repaired = quality.repaired ?? canonical;
  const freshness = validateTrendFreshness(repaired, now);
  if (!freshness.ok) return { ok: false, reason: freshness.reason ?? "stale_trend" };
  const freshTrend = freshness.repaired ?? repaired;
  const integrity = validateCandidateFieldIntegrity(freshTrend);
  if (!integrity.ok) return { ok: false, reason: integrity.reason };
  return {
    ok: true,
    trend: {
      ...(integrity.repaired ?? freshTrend),
      isTopSurfaceCandidate: false,
      surfaceSlot: null,
      surfaceReason: null,
    },
  };
}

function pushRejected(rejected: BucketRejectedCandidate[], trend: RankedTrend, reason: string) {
  rejected.push({
    title: trend.title,
    reason,
    score: trend.heatScore,
    source: trend.sources.join(", "),
    bucket: bucketForTrend(trend),
  });
}

function timeModeMeta(timeMode: TrendTimeMode) {
  return {
    mode: timeMode.mode,
    istHour: timeMode.istHour,
    dailyRhythmTop4Cap: timeMode.dailyRhythmTop4Cap,
    dailyRhythmTop10Cap: timeMode.dailyRhythmTop10Cap,
    reason: timeMode.reason,
  };
}

export function buildBucketDiagnostics(input: {
  candidateCounts: Record<string, number>;
  relevancePassed: FilteredSignal[];
  crossSourceSignals: FilteredSignal[];
  canonicalized: RankedTrend[];
  qualityPassed: RankedTrend[];
  returnedCounts: Record<string, number>;
  rejected: BucketRejectedCandidate[];
}) {
  const relevanceCounts = countSignalsByBucket(input.relevancePassed);
  const crossSourceCounts = countSignalsByBucket(input.crossSourceSignals);
  const canonicalCounts = countTrendsByBucket(input.canonicalized);
  const qualityCounts = countTrendsByBucket(input.qualityPassed);
  const buckets = new Set([
    ...Object.keys(input.candidateCounts),
    ...Object.keys(relevanceCounts),
    ...Object.keys(crossSourceCounts),
    ...Object.keys(canonicalCounts),
    ...Object.keys(qualityCounts),
    ...Object.keys(input.returnedCounts),
    ...input.rejected.map((item) => item.bucket ?? "unknown"),
  ]);

  return Object.fromEntries([...buckets].map((bucket) => {
    const reasonCounts = input.rejected
      .filter((item) => (item.bucket ?? "unknown") === bucket)
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.reason] = (acc[item.reason] ?? 0) + 1;
        return acc;
      }, {});
    const topRejectionReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));
    const returnedCount = input.returnedCounts[bucket] ?? 0;
    return [bucket, {
      rawCandidateCount: input.candidateCounts[bucket] ?? 0,
      afterRelevanceCount: relevanceCounts[bucket] ?? 0,
      afterCrossSourceCount: crossSourceCounts[bucket] ?? 0,
      afterCanonicalizationCount: canonicalCounts[bucket] ?? 0,
      afterQualityGateCount: qualityCounts[bucket] ?? 0,
      returnedCount,
      topRejectionReasons,
      ...(returnedCount === 0 && (input.candidateCounts[bucket] ?? 0) > 0
        ? { action: `${bucket} candidates need stronger canonical topic, safety, or validation evidence` }
        : {}),
    }];
  }));
}

function countSignalsByBucket(signals: FilteredSignal[]): Record<string, number> {
  return signals.reduce<Record<string, number>>((acc, signal) => {
    const bucket = bucketForSignal(signal);
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});
}

function countTrendsByBucket(trends: RankedTrend[]): Record<string, number> {
  return trends.reduce<Record<string, number>>((acc, trend) => {
    const bucket = bucketForTrend(trend);
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});
}

function makeCleanPipelineTrend(input: Pick<RankedTrend, "rank" | "tag" | "title" | "displayLabel" | "description" | "category" | "heatScore" | "bharatRelevanceScore" | "sources" | "sourceTypes" | "generatedAt" | "interestBucket">): RankedTrend {
  return {
    ...input,
    trendStage: input.heatScore >= 70 ? "rising" : "emerging",
    whyTrending: "सर्च और भारतीय स्रोतों में इस विषय पर संकेत मिल रहे हैं।",
    sampleContent: { type: "summary", text: `${input.title} पर लोग पोस्ट, राय और अपडेट शेयर कर रहे हैं।` },
    safety: { status: "safe", reasons: [] },
    signalSummary: {
      externalValidationScore: Math.min(80, input.heatScore),
      crossSourceCount: Math.max(1, input.sources.length),
      freshnessScore: 80,
      reliabilityScore: 70,
      regionalRelevanceScore: input.bharatRelevanceScore,
    },
    isTopSurfaceCandidate: false,
    surfaceSlot: null,
    surfaceReason: null,
    debug: { isTargetedRescue: true, finalRankScore: input.heatScore },
  };
}

async function runFetcherWithTimeout(fetcher: Fetcher): Promise<FetcherResult> {
  const source = fetcher.name || "anonymousFetcher";
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<FetcherResult>((resolve) => {
    timeout = setTimeout(() => {
      resolve({
        ok: false,
        source,
        error: `Source fetcher timed out after ${SOURCE_FETCHER_TIMEOUT_MS}ms`,
        health: {
          source,
          lastFailureAt: new Date().toISOString(),
          lastError: `Source fetcher timed out after ${SOURCE_FETCHER_TIMEOUT_MS}ms`,
          itemCount: 0,
          latencyMs: SOURCE_FETCHER_TIMEOUT_MS,
        },
      });
    }, SOURCE_FETCHER_TIMEOUT_MS);
  });

  try {
    return await Promise.race([fetcher(), timeoutPromise]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      source,
      error: message,
      health: {
        source,
        lastFailureAt: new Date().toISOString(),
        lastError: message,
        itemCount: 0,
        latencyMs: 0,
      },
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function countRejectedReasons(reasons: string[]): Record<string, number> {
  return reasons.reduce<Record<string, number>>((acc, reason) => {
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
}

function attachCrossSourceValidation(clusters: TrendCluster[]): TrendCluster[] {
  return clusters.map((cluster) => {
    const validation = validateCrossSource(cluster.signals);
    return {
      ...cluster,
      sourceNames: validation.independentSourceNames.length ? validation.independentSourceNames : cluster.sourceNames,
      crossSourceCount: validation.crossSourceCount,
      crossSourceBoost: validation.crossSourceBoost,
    };
  });
}

async function buildSourceBackfillTrends(input: {
  signals: FilteredSignal[];
  existing: Awaited<ReturnType<typeof generateRankedTrends>>;
  limit: number;
  debug: boolean;
  now: Date;
  rejectedCandidates: RejectedCandidate[];
}) {
  const existingTags = new Set(input.existing.map((trend) => trend.tag.toLowerCase()));
  const safeBackfillSignals = input.signals.filter((signal) => {
    if (signal.indiaHindiRelevanceScore < 70) return false;
    if (signal.safetyFlags.length > 0 || signal.sourceType === "social_experimental") return false;
    if (signal.preliminaryCategory === "politics" || signal.preliminaryCategory === "public_safety") return false;
    return signal.source === "Google Trends India" || signal.sourceType === "hindi_news" || signal.sourceType === "national_news" || signal.sourceType === "official_finance" || signal.sourceType === "official_government";
  });

  const clusters = attachCrossSourceValidation(deterministicClusterSignals(safeBackfillSignals))
    .map((cluster) => ({ ...cluster, indiaHindiRelevanceScore: computeClusterBharatRelevanceScore(cluster.signals) }))
    .filter((cluster) => cluster.indiaHindiRelevanceScore >= 70)
    .filter((cluster) => !cluster.signals.some((signal) => signal.safetyFlags.length > 0));

  const trends = postGenerationSafetyCheck(await generateRankedTrends(scoreClusters(clusters, input.now), input.debug), input.rejectedCandidates)
    .filter((trend) => trend.bharatRelevanceScore >= 70)
    .filter((trend) => !existingTags.has(trend.tag.toLowerCase()))
    .slice(0, Math.max(0, input.limit - input.existing.length));

  return trends.map((trend) => ({ ...trend, debug: input.debug ? { ...(trend.debug ?? {}), isSourceBackfill: true } : trend.debug }));
}
