import { differenceInMinutes } from "date-fns";
import { CATEGORY_BASELINES } from "./constants";
import type { ScoredCluster, TrendCategory, TrendCluster } from "./types";

export function scoreClusters(clusters: TrendCluster[], now = new Date()): ScoredCluster[] {
  return clusters
    .map((cluster) => scoreCluster(cluster, now))
    .sort((a, b) => b.inputScore - a.inputScore || b.indiaHindiRelevanceScore - a.indiaHindiRelevanceScore || a.canonicalTitle.localeCompare(b.canonicalTitle, "hi"));
}

export function scoreCluster(cluster: TrendCluster, now = new Date()): ScoredCluster {
  const sourceTypes = new Set(cluster.sourceTypes);
  const googleDemandScore = sourceTypes.has("search_demand") ? 100 : 0;
  const hindiNewsScore = sourceTypes.has("hindi_news") ? Math.min(100, cluster.signals.filter((signal) => signal.sourceType === "hindi_news").length * 25 + 50) : 0;
  const officialScore = cluster.signals.some((signal) => ["official_government", "official_finance", "weather", "public_safety", "sports"].includes(signal.sourceType))
    ? 100
    : sourceTypes.has("festival_calendar") && (cluster.category === "festival" || cluster.category === "devotional")
      ? 75
      : 0;
  const videoScore = sourceTypes.has("video") ? 80 : cluster.category === "entertainment" || cluster.category === "sports" ? 30 : 0;
  const regionalRelevanceScore = cluster.indiaHindiRelevanceScore;
  const utilityBazaar = isUtilityBazaarCluster(cluster);
  const freshnessScore = utilityBazaar ? computeUtilityFreshnessScore(cluster.lastSeenAt, now) : computeFreshnessScore(cluster.category, cluster.lastSeenAt, now);
  const reliabilityScore = Math.round((cluster.signals.reduce((sum, signal) => sum + signal.reliabilityWeight, 0) / cluster.signals.length) * 100);
  const safetyPenalty = cluster.signals.some((signal) => signal.safetyFlags.length > 0 || cluster.category === "politics") ? 30 : 0;
  const spamPenalty = cluster.signals.some((signal) => signal.safetyFlags.includes("spam_phrase")) ? 20 : 0;
  const fatiguePenalty = 0;

  const externalValidationScore = clamp(
    Math.round(
      googleDemandScore * 0.25 +
        hindiNewsScore * 0.2 +
        officialScore * 0.15 +
        videoScore * 0.15 +
        regionalRelevanceScore * 0.15 +
        freshnessScore * 0.1 -
        safetyPenalty -
        spamPenalty -
        fatiguePenalty,
    ),
    1,
    100,
  );

  const velocityRatio = cluster.signals.length / (CATEGORY_BASELINES[cluster.category] || 1);
  const reliabilityWeight = reliabilityScore / 100;
  const culturalBoost = culturalBoostFor(cluster.category, cluster);
  const categoryDecay = categoryDecayFor(cluster.category, cluster.lastSeenAt, now);
  const rawHeat = velocityRatio * reliabilityWeight * cluster.crossSourceBoost * culturalBoost * categoryDecay * 45;
  const inputScore = calibratedHeatScore({
    cluster,
    externalValidationScore,
    reliabilityScore,
    freshnessScore,
    safetyPenalty,
    spamPenalty,
    fatiguePenalty,
  });

  return {
    ...cluster,
    inputScore,
    scoringDebug: {
      externalValidationScore,
      googleDemandScore,
      hindiNewsScore,
      officialScore,
      videoScore,
      regionalRelevanceScore,
      freshnessScore,
      reliabilityScore,
      rawHeat: Math.round(rawHeat * 100) / 100,
      culturalBoost,
      categoryDecay,
      safetyPenalty,
      spamPenalty,
      fatiguePenalty,
    },
  };
}

function calibratedHeatScore(input: {
  cluster: TrendCluster;
  externalValidationScore: number;
  reliabilityScore: number;
  freshnessScore: number;
  safetyPenalty: number;
  spamPenalty: number;
  fatiguePenalty: number;
}): number {
  const { cluster, externalValidationScore, reliabilityScore, freshnessScore, safetyPenalty, spamPenalty, fatiguePenalty } = input;
  const sourceCount = new Set(cluster.sourceNames).size;
  const sourceTypes = new Set(cluster.sourceTypes);
  const activeFestival = isActiveFestivalCluster(cluster);
  const festivalToday = isFestivalTodayCluster(cluster);
  const dailyRhythm = isDailyRhythmCluster(cluster);
  const utilityBazaar = isUtilityBazaarCluster(cluster);
  const utilityRateSource = cluster.signals.some((signal) => signal.metadata?.isUtilityRateSource === true);
  const cricketLive = isIndianCricketCluster(cluster);
  const officialAuthority = cluster.signals.some((signal) => ["official_government", "official_finance", "weather", "public_safety", "sports"].includes(signal.sourceType));
  const onlyReddit = cluster.signals.length > 0 && cluster.signals.every((signal) => signal.sourceType === "social_experimental");

  let score = externalValidationScore;
  score += sourceCount >= 4 ? 22 : sourceCount === 3 ? 15 : sourceCount === 2 ? 8 : 0;
  score += Math.max(0, (reliabilityScore - 55) * 0.15);
  score += Math.max(0, (freshnessScore - 50) * 0.08);
  if (dailyRhythm) score += 18;
  if (festivalToday) score += 22;
  else if (activeFestival) score += 18;
  else if (cluster.category === "festival" || cluster.category === "devotional") score += 8;
  if ((cluster.category === "festival" || cluster.category === "devotional") && cluster.sourceTypes.some((type) => type === "search_demand" || type === "hindi_news")) score += 10;
  if ((cluster.category === "festival" || cluster.category === "devotional") && cluster.sourceTypes.includes("video")) score += 5;
  if (officialAuthority) score += 12;
  if (utilityBazaar) score += sustainedUtilityBuzzScore(cluster);
  if (utilityRateSource && cluster.sourceTypes.includes("hindi_news")) score += 8;
  if (cricketLive) score += 15;
  score += Math.max(0, (cluster.crossSourceBoost - 1) * 20);
  score -= safetyPenalty + spamPenalty + fatiguePenalty;

  if (externalValidationScore <= 20) score = Math.min(score, 35);
  if (onlyReddit) score = Math.min(score, 29);
  if (safetyPenalty > 0) score = Math.min(score, 40);

  const singleSource = sourceCount <= 1;
  if (singleSource && !officialAuthority && !activeFestival) score = Math.min(score, 55);
  if (singleSource && utilityBazaar && !utilityRateSource) score = Math.min(score, 55);
  if (utilityBazaar && utilityRateSource && cluster.sourceTypes.includes("hindi_news") && !cluster.sourceTypes.includes("search_demand")) score = Math.min(score, 70);
  if (utilityBazaar && cluster.sourceTypes.includes("search_demand") && cluster.sourceTypes.includes("hindi_news")) score = Math.max(score, 75);
  if (singleSource && activeFestival && !festivalToday) score = Math.min(score, 65);
  if (festivalToday) score = Math.max(score, 72);
  else if (activeFestival) score = Math.max(score, 62);
  if (dailyRhythm) score = Math.max(score, 68);
  if (cricketLive && (sourceTypes.has("search_demand") || sourceTypes.has("hindi_news") || sourceTypes.has("video"))) score = Math.max(score, 75);
  if (officialAuthority && (cluster.category === "weather" || cluster.category === "public_safety") && cluster.crossSourceCount >= 2) score = Math.max(score, 80);

  return clamp(Math.round(score), 1, 100);
}

export function trendStageFor(heatScore: number, lastSeenAt: string, category: TrendCategory, now = new Date()): "emerging" | "rising" | "hot" | "peaking" | "cooling" {
  const ageMinutes = Math.max(0, differenceInMinutes(now, new Date(lastSeenAt)));
  if (ageMinutes > freshnessWindowMinutes(category) * 1.2 && heatScore >= 70) return "peaking";
  if (ageMinutes > freshnessWindowMinutes(category) * 1.8) return "cooling";
  if (heatScore >= 85) return "hot";
  if (heatScore >= 70) return "rising";
  return "emerging";
}

export function computeFreshnessScore(category: TrendCategory, lastSeenAt: string, now = new Date()): number {
  const ageMinutes = Math.max(0, differenceInMinutes(now, new Date(lastSeenAt)));
  const window = freshnessWindowMinutes(category);
  return clamp(Math.round(100 * Math.exp(-ageMinutes / Math.max(window, 1))), 15, 100);
}

export function categoryDecayFor(category: TrendCategory, lastSeenAt: string, now = new Date()): number {
  const freshness = computeFreshnessScore(category, lastSeenAt, now);
  return clampNumber(0.45 + freshness / 180, 0.45, 1.0);
}

export function culturalBoostFor(category: TrendCategory, cluster?: TrendCluster): number {
  if (category === "festival" || category === "devotional") {
    const daysFromFestival = minDaysFromFestival(cluster);
    if (daysFromFestival !== undefined && daysFromFestival <= 7) return 1.8;
    if (hasLongDevotionalSeason(cluster)) return 1.8;
    if (daysFromFestival !== undefined && daysFromFestival <= 30) return 1.6;
    return 1.35;
  }
  if (category === "weather" || category === "local" || category === "public_safety") return 1.1;
  return 1.0;
}

function minDaysFromFestival(cluster?: TrendCluster): number | undefined {
  const values = cluster?.signals
    .map((signal) => signal.metadata?.daysFromFestival)
    .filter((value): value is number => typeof value === "number") ?? [];
  return values.length ? Math.min(...values) : undefined;
}

function computeUtilityFreshnessScore(lastSeenAt: string, now = new Date()): number {
  const ageMinutes = Math.max(0, differenceInMinutes(now, new Date(lastSeenAt)));
  const ageHours = ageMinutes / 60;
  if (ageHours <= 24) return 80;
  if (ageHours <= 72) return 70;
  if (ageHours <= 24 * 7) return Math.max(35, Math.round(70 - (ageHours - 72) * 0.2));
  return 15;
}

function sustainedUtilityBuzzScore(cluster: TrendCluster): number {
  let score = 0;
  const text = `${cluster.canonicalTitle} ${cluster.aliases.join(" ")}`.toLowerCase();
  if (cluster.sourceTypes.includes("search_demand")) score += 30;
  if (new Set(cluster.sourceNames.filter((source) => !["GoodReturns Gold Rates", "GoodReturns Petrol Prices", "Economic Times Fuel Prices"].includes(source))).size >= 2) score += 20;
  if (cluster.signals.some((signal) => signal.metadata?.isUtilityRateSource === true)) score += 20;
  if (["delhi", "mumbai", "patna", "दिल्ली", "मुंबई", "पटना", "लखनऊ", "जयपुर"].some((city) => text.includes(city))) score += 15;
  if (["petrol", "diesel", "पेट्रोल", "डीजल", "gold", "सोना", "lpg", "महंगाई", "टमाटर", "प्याज"].some((term) => text.includes(term))) score += 10;
  return Math.min(35, Math.round(score * 0.25));
}

function isUtilityBazaarCluster(cluster: TrendCluster): boolean {
  const text = `${cluster.canonicalTitle} ${cluster.aliases.join(" ")}`.toLowerCase();
  return ["सोना", "सोने", "चांदी", "gold", "silver", "पेट्रोल", "डीजल", "petrol", "diesel", "lpg", "एलपीजी", "cng", "सीएनजी", "महंगाई", "inflation", "टमाटर", "प्याज", "भाव", "रेट", "कीमत"].some((term) => text.includes(term));
}

function hasLongDevotionalSeason(cluster?: TrendCluster): boolean {
  return Boolean(
    cluster?.signals.some((signal) => {
      const seed = signal.metadata?.seed as { preseed_window_days?: unknown; english_name?: unknown; event?: unknown } | undefined;
      return seed?.preseed_window_days === 30 || String(seed?.english_name ?? seed?.event ?? "").toLowerCase().includes("sawan");
    }),
  );
}

function isActiveFestivalCluster(cluster: TrendCluster): boolean {
  return (cluster.category === "festival" || cluster.category === "devotional") && cluster.signals.some((signal) => signal.metadata?.isActiveFestivalSeed === true);
}

function isFestivalTodayCluster(cluster: TrendCluster): boolean {
  return (cluster.category === "festival" || cluster.category === "devotional") && cluster.signals.some((signal) => signal.metadata?.isFestivalToday === true);
}

function isDailyRhythmCluster(cluster: TrendCluster): boolean {
  return cluster.signals.some((signal) => signal.sourceType === "daily_rhythm" || signal.metadata?.isDailyRhythm === true);
}

function isIndianCricketCluster(cluster: TrendCluster): boolean {
  if (cluster.category !== "sports") return false;
  const text = `${cluster.canonicalTitle} ${cluster.aliases.join(" ")}`.toLowerCase();
  const teams = ["ipl", "kkr", "gt", "rcb", "csk", "mi", "srh", "dc", "rr", "pbks", "lsg", "आईपीएल"];
  return teams.some((team) => new RegExp(`(^|[^a-z0-9])${team}([^a-z0-9]|$)`, "i").test(text));
}

export function reliabilityWeightForSource(source: string): number {
  if (["PIB Hindi", "RBI", "IMD", "SACHET"].includes(source)) return 0.95;
  if (source === "Google Trends India") return 0.85;
  if (["Dainik Bhaskar", "Dainik Jagran", "Amar Ujala", "Live Hindustan"].includes(source)) return 0.75;
  if (source === "The Hindu National") return 0.65;
  if (source === "YouTube") return 0.7;
  if (["Calendarific", "Internal Festival Calendar"].includes(source)) return 0.55;
  if (source === "Reddit") return 0.35;
  return 0.5;
}

function freshnessWindowMinutes(category: TrendCategory): number {
  switch (category) {
    case "sports":
      return 60;
    case "news":
    case "politics":
      return 120;
    case "weather":
    case "public_safety":
      return 240;
    case "festival":
    case "devotional":
      return 72 * 60;
    case "movies":
    case "music":
    case "entertainment":
      return 48 * 60;
    case "government":
    case "finance":
      return 24 * 60;
    case "viral":
      return 180;
    default:
      return 12 * 60;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
