import festivals from "../../data/indian-festivals.json";
import type { FestivalSeed, RankedTrend, TrendCategory } from "./types";

export interface TrendFreshnessResult {
  ok: boolean;
  reason?: string;
  repaired?: RankedTrend;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const IPL_TEAMS = ["KKR", "GT", "CSK", "MI", "RCB", "DC", "RR", "SRH", "PBKS", "LSG"];

const MAX_CACHE_AGE_HOURS: Partial<Record<TrendCategory, number>> = {
  sports: 6,
  news: 12,
  politics: 12,
  public_safety: 12,
  viral: 12,
  entertainment: 24,
  movies: 24,
  music: 24,
  weather: 24,
  local: 24,
  festival: 18,
  devotional: 18,
  finance: 36,
  government: 36,
  education: 36,
  jobs: 36,
};

export function validateTrendFreshness(trend: RankedTrend, now = new Date()): TrendFreshnessResult {
  const repaired = applyFreshnessDecay(repairSportsMatchPairFromEvidence(trend));
  const reason = freshnessRejectionReason(repaired, now);
  return reason ? { ok: false, reason, repaired } : { ok: true, repaired };
}

function freshnessRejectionReason(trend: RankedTrend, now: Date): string | null {
  if (isExpiredKnownFestival(trend, now)) return "expired_day_specific_festival";
  if (isStaleDailyRhythm(trend, now)) return "stale_daily_rhythm";
  if (isStaleSportsMatch(trend)) return "stale_sports_match";
  if (isWeakOrStaleSportsPairEvidence(trend)) return "weak_or_stale_sports_pair_evidence";
  if (isExpiredPreviousCacheTrend(trend, now)) return "expired_previous_cache";
  if (isTooColdForCategory(trend)) return "stale_category_signal";
  return null;
}

function applyFreshnessDecay(trend: RankedTrend): RankedTrend {
  const freshness = trend.signalSummary?.freshnessScore ?? 100;
  if (freshness >= 35 || isSlowBurnUtility(trend)) return trend;
  return {
    ...trend,
    trendStage: "cooling",
    heatScore: Math.min(trend.heatScore, Math.max(20, freshness + 18)),
    debug: {
      ...(trend.debug ?? {}),
      categoryFreshnessDecay: true,
      originalHeatScore: trend.heatScore,
    },
  };
}

function isExpiredKnownFestival(trend: RankedTrend, now: Date): boolean {
  if (!["festival", "devotional"].includes(trend.category) && trend.interestBucket !== "festival_devotional") return false;
  const seed = matchingFestivalSeed(trend);
  if (!seed) return false;

  const today = istDayNumber(now);
  const { endDay } = festivalWindow(seed, now);
  if (today <= endDay) return false;

  // A one-day festival can survive past its day only if search demand says users are
  // still actively looking for it. News/video echoes alone are not enough.
  return !trend.sourceTypes.includes("search_demand");
}

function matchingFestivalSeed(trend: RankedTrend): FestivalSeed | undefined {
  const haystack = normalize(`${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`);
  return (festivals as FestivalSeed[]).find((seed) => {
    const tags = seed.seed_tags.map(normalize);
    const names = [seed.event, seed.english_name, ...(seed.aliases ?? [])].map(normalize);
    return tags.some((tag) => tag && haystack.includes(tag)) || names.some((name) => name && haystack.includes(name));
  });
}

function festivalWindow(seed: FestivalSeed, now: Date): { startDay: number; endDay: number } {
  const year = Number(istDateKey(now).slice(0, 4));
  const startKey = dateKeyForYear(seed.date ?? seed.approximate_date, year);
  const endKey = dateKeyForYear(seed.end_date ?? seed.date ?? seed.approximate_date, year);
  return {
    startDay: dateKeyToDayNumber(startKey),
    endDay: dateKeyToDayNumber(endKey),
  };
}

function isStaleDailyRhythm(trend: RankedTrend, now: Date): boolean {
  if (trend.interestBucket !== "daily_rhythm_status" && !trend.sourceTypes.includes("daily_rhythm")) return false;
  if (trend.generatedAt && istDateKey(new Date(trend.generatedAt)) === istDateKey(now)) return false;
  return !hasLiveCorroboration(trend);
}

function isStaleSportsMatch(trend: RankedTrend): boolean {
  if (trend.category !== "sports" && trend.interestBucket !== "cricket_ipl_sports") return false;
  if (!hasTeamPair(trend)) return false;

  const freshness = trend.signalSummary?.freshnessScore ?? 100;
  const threshold = trend.sourceTypes.includes("search_demand") ? 35 : 45;
  if (trend.trendStage === "peaking" && trend.heatScore < 70) return true;
  return freshness < threshold;
}

function isWeakOrStaleSportsPairEvidence(trend: RankedTrend): boolean {
  if (trend.category !== "sports" && trend.interestBucket !== "cricket_ipl_sports") return false;
  if (!hasTeamPair(trend)) return false;

  const aliases = Array.isArray(trend.debug?.aliases) ? trend.debug.aliases.filter((item): item is string => typeof item === "string") : [];
  if (aliases.length < 6) return false;

  const currentPair = firstTeamPair(`${trend.tag} ${trend.title} ${trend.displayLabel}`);
  if (!currentPair) return false;

  const currentPairAliases = aliases.flatMap((alias, index) => {
    const pair = firstTeamPair(alias);
    return pair && samePair(pair, currentPair) ? [{ alias, index, pair }] : [];
  });

  if (currentPairAliases.length === 0) return true;

  const hasEarlyPairEvidence = currentPairAliases.some((item) => item.index < 5);
  const hasEarlyLivePairEvidence = currentPairAliases.some((item) => item.index < 5 && isLiveSportsAlias(item.alias));
  if (hasEarlyLivePairEvidence) return false;

  const topGenericIplDemandCount = aliases.slice(0, 5).filter(isGenericIplDemandAlias).length;
  const otherPairs = new Set(
    aliases
      .map(firstTeamPair)
      .filter((pair): pair is [string, string] => Boolean(pair))
      .filter((pair) => !samePair(pair, currentPair))
      .map(pairKey),
  );

  if (!hasEarlyPairEvidence && currentPairAliases.length <= 2) return true;
  if (!hasEarlyPairEvidence && topGenericIplDemandCount >= 2) return true;
  if (!hasEarlyPairEvidence && otherPairs.size >= 2) return true;
  if (!hasEarlyPairEvidence && currentPairAliases.every((item) => isPastSportsAlias(item.alias))) return true;

  return false;
}

function repairSportsMatchPairFromEvidence(trend: RankedTrend): RankedTrend {
  if (trend.category !== "sports" && trend.interestBucket !== "cricket_ipl_sports") return trend;
  const aliases = Array.isArray(trend.debug?.aliases) ? trend.debug.aliases.filter((item): item is string => typeof item === "string") : [];
  if (aliases.length === 0) return trend;

  const dominant = dominantTeamPairFromAliases(aliases);
  if (!dominant) return trend;

  const current = firstTeamPair(`${trend.tag} ${trend.title} ${trend.displayLabel}`);
  if (current && samePair(current, dominant.pair)) return trend;
  if (dominant.score < 7) return trend;

  const [first, second] = dominant.pair;
  return {
    ...trend,
    tag: `#${first}_बनाम_${second}`,
    title: `${first} बनाम ${second}`,
    displayLabel: `🏏 ${first} vs ${second} चर्चा`,
    description: "IPL मुकाबले और खिलाड़ियों को लेकर फैंस की चर्चा तेज़ है।",
    debug: {
      ...(trend.debug ?? {}),
      sportsPairRepairedFromEvidence: true,
      originalSportsTag: trend.tag,
      originalSportsTitle: trend.title,
      dominantSportsPairScore: dominant.score,
    },
  };
}

function dominantTeamPairFromAliases(aliases: string[]): { pair: [string, string]; score: number } | null {
  const scores = new Map<string, { pair: [string, string]; score: number }>();
  aliases.forEach((alias, index) => {
    const pair = firstTeamPair(alias);
    if (!pair) return;
    const key = pairKey(pair);
    const existing = scores.get(key) ?? { pair, score: 0 };
    existing.score += 10 / (index + 1);
    scores.set(key, existing);
  });
  return [...scores.values()].sort((a, b) => b.score - a.score)[0] ?? null;
}

function firstTeamPair(text: string): [string, string] | null {
  const upper = text.toUpperCase();
  const found = IPL_TEAMS.filter((team) => new RegExp(`(^|[^A-Z0-9])${team}([^A-Z0-9]|$)`).test(upper));
  if (found.length < 2) return null;
  if (!/\b(VS|V)\b|MATCH|LIVE|IPL|बनाम/i.test(text)) return null;
  return [found[0], found[1]];
}

function isLiveSportsAlias(alias: string): boolean {
  if (isPastSportsAlias(alias)) return false;
  return /\blive\b|\blive score\b|\bscore\b|\btoss\b|\btoday\b|\bplaying xi\b|streaming|updates?/i.test(alias);
}

function isPastSportsAlias(alias: string): boolean {
  return /highlights?|beat|beats|won|lost|stars?|in vain|playoff race|points table analysis|future|old|yesterday|last night|recap|full match|throw playoff|dents/i.test(alias);
}

function isGenericIplDemandAlias(alias: string): boolean {
  if (firstTeamPair(alias)) return false;
  return /\bipl points table\b|\bpoints table of ipl\b|\bipl final\b|\borange cap\b|\bpurple cap\b|\bplayoffs?\b/i.test(alias);
}

function isExpiredPreviousCacheTrend(trend: RankedTrend, now: Date): boolean {
  if (!trend.debug?.previousSafeCacheBackfill || !trend.generatedAt) return false;
  const generatedAt = new Date(trend.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) return false;
  const ageHours = Math.max(0, now.getTime() - generatedAt.getTime()) / (60 * 60 * 1000);
  const maxAge = MAX_CACHE_AGE_HOURS[trend.category] ?? 24;
  if (isSlowBurnUtility(trend)) return ageHours > maxAge;
  return ageHours > maxAge && !hasLiveCorroboration(trend);
}

function isTooColdForCategory(trend: RankedTrend): boolean {
  const freshness = trend.signalSummary?.freshnessScore ?? 100;
  if (isSlowBurnUtility(trend)) return false;
  if (trend.category === "sports") return freshness < 35;
  if (trend.category === "viral") return freshness < 35;
  if (["news", "politics", "government", "public_safety"].includes(trend.category)) return freshness < 20;
  if (["entertainment", "movies", "music"].includes(trend.category)) return freshness < 20;
  if (["festival", "devotional"].includes(trend.category)) return freshness < 25 && !hasLiveCorroboration(trend);
  return false;
}

function isSlowBurnUtility(trend: RankedTrend): boolean {
  if (trend.interestBucket === "utility_bazaar_prices") return true;
  const text = normalize(`${trend.tag} ${trend.title} ${trend.displayLabel}`);
  return /(cng|lpg|petrol|diesel|gold|silver|price|rate|fuel|rbi)/i.test(text);
}

function hasLiveCorroboration(trend: RankedTrend): boolean {
  return trend.sourceTypes.includes("search_demand") || trend.signalSummary.crossSourceCount >= 3;
}

function hasTeamPair(trend: RankedTrend): boolean {
  const text = `${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`.toUpperCase();
  const found = IPL_TEAMS.filter((team) => new RegExp(`(^|[^A-Z0-9])${team}([^A-Z0-9]|$)`).test(text));
  return found.length >= 2;
}

function samePair(a: [string, string], b: [string, string]): boolean {
  return pairKey(a) === pairKey(b);
}

function pairKey(pair: [string, string]): string {
  return [...pair].sort().join("_");
}

function normalize(value: string): string {
  return value
    .normalize("NFC")
    .replace(/^#/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function istDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function istDayNumber(date: Date): number {
  return dateKeyToDayNumber(istDateKey(date));
}

function dateKeyForYear(dateString: string, year: number): string {
  const [, month = "01", day = "01"] = dateString.match(/^\d{4}-(\d{2})-(\d{2})/) ?? [];
  return `${year}-${month}-${day}`;
}

function dateKeyToDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}
