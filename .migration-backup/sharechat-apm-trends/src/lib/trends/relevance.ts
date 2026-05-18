import { BHARAT_RELEVANT_CATEGORIES, HINDI_NEWS_SOURCE_NAMES, OFFICIAL_SOURCE_TYPES } from "./constants";
import { hasDevanagari, type NormalizedSignalData } from "./normalize";
import type { FilteredSignal, RawSignal, TrendCategory } from "./types";

export function computeIndiaHindiRelevanceScore(
  signal: RawSignal,
  normalized: NormalizedSignalData,
  category: TrendCategory,
  agreeingSignals: FilteredSignal[] = [],
): number {
  let score = 0;
  const agreeingSourceTypes = new Set(agreeingSignals.map((item) => item.sourceType));
  const agreeingHasHindiNative = agreeingSignals.some((item) => item.sourceType === "hindi_news" || item.languageHint === "hi");
  const agreeingHasDevanagari = agreeingSignals.some((item) => hasDevanagari(`${item.rawTitle} ${item.rawDescription ?? ""}`));
  const agreeingIndiaHints = new Set(agreeingSignals.flatMap((item) => item.indiaHints));
  const agreeingHindiHints = new Set(agreeingSignals.flatMap((item) => item.hindiHints));
  const sourceIndiaFiltered =
    signal.source === "Google Trends India" ||
    signal.source === "PIB Hindi" ||
    signal.source === "RBI" ||
    signal.source === "IMD" ||
    signal.source === "SACHET" ||
    OFFICIAL_SOURCE_TYPES.includes(signal.sourceType);

  if (signal.sourceType === "daily_rhythm") score += 35;
  if (sourceIndiaFiltered) score += 30;
  if (signal.sourceType === "hindi_news" || HINDI_NEWS_SOURCE_NAMES.includes(signal.source) || signal.languageHint === "hi" || agreeingHasHindiNative) score += 25;
  if (hasDevanagari(`${signal.rawTitle} ${signal.rawDescription ?? ""}`) || agreeingHasDevanagari) score += 20;
  if (normalized.indiaHints.length > 0 || agreeingIndiaHints.size > 0) score += 15;
  if (normalized.indiaHints.length + agreeingIndiaHints.size >= 2) score += 5;
  if (normalized.hindiHints.length > 0 || agreeingHindiHints.size > 0) score += 10;
  if (hasIndianCricketSignal(normalized, signal, category)) score += 25;
  if (hasBharatEducationSignal(normalized, category)) score += 20;
  if (hasIndianPriceSignal(normalized, category)) score += 15;
  if (BHARAT_RELEVANT_CATEGORIES.includes(category)) score += 10;
  if (agreeingSignals.length > 0 || new Set(agreeingSignals.map((item) => item.source)).size > 1 || agreeingSourceTypes.size > 1) score += 10;

  const foreignPenalty = foreignPenaltyFor(signal, normalized);
  score -= foreignPenalty;
  if (signal.sourceType === "festival_calendar" && (category === "festival" || category === "devotional") && signal.metadata?.isActiveFestivalSeed === true) {
    score = Math.max(score, 85);
  }
  if (signal.sourceType === "festival_calendar" && (category === "festival" || category === "devotional") && signal.metadata?.isFestivalToday === true) {
    score = Math.max(score, 90);
  }
  if (signal.sourceType === "daily_rhythm") score = Math.max(score, 85);
  if (hasIndianCricketSignal(normalized, signal, category)) score = Math.max(score, 80);
  return clamp(score, 0, 100);
}

export function computeClusterBharatRelevanceScore(signals: FilteredSignal[]): number {
  if (signals.length === 0) return 0;
  const base = Math.round(signals.reduce((sum, signal) => sum + signal.indiaHindiRelevanceScore, 0) / signals.length);
  const hasIpl = signals.some((signal) => hasIndianCricketSignal(signal, signal, signal.preliminaryCategory));
  const hasActiveFestival = signals.some((signal) => signal.sourceType === "festival_calendar" && signal.metadata?.isActiveFestivalSeed === true);
  const hasFestivalToday = signals.some((signal) => signal.sourceType === "festival_calendar" && signal.metadata?.isFestivalToday === true);
  const hasDailyRhythm = signals.some((signal) => signal.sourceType === "daily_rhythm");
  if (hasIpl) return Math.max(base, 80);
  if (hasFestivalToday) return Math.max(base, 90);
  if (hasActiveFestival) return Math.max(base, 85);
  if (hasDailyRhythm) return Math.max(base, 85);
  return base;
}

export function passesIndiaHindiRelevanceGate(signal: FilteredSignal, agreeingSignals: FilteredSignal[] = []): boolean {
  const score = computeIndiaHindiRelevanceScore(signal, signal, signal.preliminaryCategory, agreeingSignals);
  const indiaSignals = countIndiaSpecificSignals(signal, agreeingSignals);
  const isGlobal = isLikelyGlobalTopic(signal);
  if (isGlobal) return score >= 80 && indiaSignals >= 2;
  return score >= 70;
}

export function countIndiaSpecificSignals(signal: FilteredSignal, agreeingSignals: FilteredSignal[] = []): number {
  let count = 0;
  if (signal.geo === "IN") count += 1;
  if (signal.indiaHints.length > 0) count += 1;
  if (signal.sourceType === "hindi_news" || signal.languageHint === "hi") count += 1;
  if (signal.source === "Google Trends India") count += 1;
  if (hasIndianCricketSignal(signal, signal, signal.preliminaryCategory)) count += 1;
  count += new Set(
    agreeingSignals
      .filter((item) => item.geo === "IN" || item.indiaHints.length > 0 || item.sourceType === "hindi_news")
      .map((item) => item.source),
  ).size;
  return count;
}

function hasIndianCricketSignal(normalized: NormalizedSignalData, signal: RawSignal, category: TrendCategory): boolean {
  if (category !== "sports") return false;
  const text = `${normalized.normalizedText} ${signal.rawTitle} ${signal.rawDescription ?? ""}`.toLowerCase();
  const tokens = new Set(normalized.tokens.map((token) => token.toLowerCase().replace(/^#/, "")));
  const teams = ["ipl", "kkr", "gt", "rcb", "csk", "mi", "srh", "dc", "rr", "pbks", "lsg", "kkrvsgt", "kolkata knight riders", "gujarat titans"];
  return teams.some((team) => (team.length <= 4 ? tokens.has(team) || text.includes(` ${team} `) : text.includes(team))) || text.includes("आईपीएल");
}

function hasBharatEducationSignal(normalized: NormalizedSignalData, category: TrendCategory): boolean {
  if (category !== "education" && category !== "jobs") return false;
  const text = normalized.normalizedText.toLowerCase();
  return ["neet", "jee", "nta", "cbse", "upsc", "ssc", "पेपर", "लीक", "परीक्षा", "रिजल्ट", "एडमिट"].some((term) => text.includes(term));
}

function hasIndianPriceSignal(normalized: NormalizedSignalData, category: TrendCategory): boolean {
  if (category !== "finance") return false;
  const text = normalized.normalizedText.toLowerCase();
  return ["पेट्रोल", "डीजल", "सोना", "सोने", "कीमत", "दाम", "महंगाई", "upi", "rbi", "repo"].some((term) => text.includes(term));
}

export function isLikelyGlobalTopic(signal: FilteredSignal): boolean {
  const text = signal.normalizedText.toLowerCase();
  const globalTerms = ["iphone", "openai", "ai", "instagram", "whatsapp", "hollywood", "us ", "usa", "china", "russia", "israel", "gaza", "uk", "europe"];
  return globalTerms.some((term) => text.includes(term)) && signal.sourceType !== "hindi_news";
}

function foreignPenaltyFor(signal: RawSignal, normalized: NormalizedSignalData): number {
  const text = normalized.normalizedText.toLowerCase();
  const hasIndia = normalized.indiaHints.length > 0 || signal.geo === "IN" || signal.sourceType === "hindi_news";
  if (hasIndia) return 0;
  const obscureForeign = ["mayor", "senate", "governor", "county", "local police", "snowstorm", "california", "texas", "florida", "ukraine local"];
  if (obscureForeign.some((term) => text.includes(term))) return 40;
  const foreign = ["us", "usa", "america", "europe", "china", "russia", "uk", "australia"];
  if (foreign.some((term) => new RegExp(`(^|\\s)${term}(\\s|$)`).test(text))) return 30;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
