import { differenceInHours } from "date-fns";
import { ADULT_BLOCKLIST, COMMON_ACRONYMS_ALLOWLIST, SENSITIVE_REVIEW_KEYWORDS, SPAM_BLOCKLIST } from "./constants";
import { normalizeSignal } from "./normalize";
import type { FilteredSignal, RawSignal, SourceType, TrendCategory } from "./types";
import { detectCategory } from "./category";
import { computeIndiaHindiRelevanceScore } from "./relevance";

export interface FilterOutcome {
  passed: FilteredSignal[];
  rejected: Array<{ signal: RawSignal; reason: string }>;
}

export function applyHardFilters(signals: RawSignal[], now = new Date()): FilterOutcome {
  const passed: FilteredSignal[] = [];
  const rejected: Array<{ signal: RawSignal; reason: string }> = [];

  for (const signal of signals) {
    const title = signal.rawTitle?.trim() ?? "";
    const text = `${title} ${signal.rawDescription ?? ""}`;
    if (!title) {
      rejected.push({ signal, reason: "empty_title" });
      continue;
    }
    const lower = text.toLowerCase();
    if (containsAny(lower, ADULT_BLOCKLIST)) {
      rejected.push({ signal, reason: "adult_content" });
      continue;
    }
    if (containsAny(lower, SPAM_BLOCKLIST)) {
      rejected.push({ signal, reason: "spam_phrase" });
      continue;
    }
    if (isLowInformation(title)) {
      rejected.push({ signal, reason: "low_information" });
      continue;
    }

    const normalized = normalizeSignal(signal);
    const preliminaryCategory = detectCategory(signal, normalized.normalizedText, normalized.tokens);
    if (isStale(signal, now, preliminaryCategory)) {
      rejected.push({ signal, reason: "stale_content" });
      continue;
    }
    const safetyFlags = findSensitiveFlags(text, preliminaryCategory, signal.sourceType);
    const indiaHindiRelevanceScore = computeIndiaHindiRelevanceScore(signal, normalized, preliminaryCategory, []);
    passed.push({
      ...signal,
      ...normalized,
      safetyFlags,
      preliminaryCategory,
      indiaHindiRelevanceScore,
    });
  }

  return { passed, rejected };
}

export function findSensitiveFlags(text: string, category?: TrendCategory, sourceType?: SourceType): string[] {
  const lower = text.toLowerCase();
  const weatherContext =
    category === "weather" ||
    sourceType === "weather" ||
    ["गर्मी", "लू", "बारिश", "मौसम", "बाढ़", "heatwave", "rain", "weather", "flood", "cyclone", "el niño", "el nino"].some((term) =>
      lower.includes(term),
    );

  return [
    ...new Set(
      SENSITIVE_REVIEW_KEYWORDS.filter((keyword) => {
        if (!matchesSensitiveKeyword(lower, keyword)) return false;
        if (isCasualtyOnlyKeyword(keyword) && weatherContext) return false;
        return true;
      }),
    ),
  ];
}

function matchesSensitiveKeyword(lowerText: string, keyword: string): boolean {
  const lowerKeyword = keyword.toLowerCase();
  if (/^[a-z\s]+$/.test(lowerKeyword)) {
    const escaped = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lowerText);
  }
  return lowerText.includes(lowerKeyword);
}

function isCasualtyOnlyKeyword(keyword: string): boolean {
  return ["death", "dead", "killed", "मौत"].includes(keyword.toLowerCase());
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function isStale(signal: RawSignal, now: Date, preliminaryCategory?: TrendCategory): boolean {
  if (!signal.publishedAt) return false;
  const published = new Date(signal.publishedAt);
  if (Number.isNaN(published.getTime())) return false;
  const hours = differenceInHours(now, published);
  if (hours < 0) return false;
  if (preliminaryCategory === "sports") return isMatchSpecificSportsText(`${signal.rawTitle} ${signal.rawDescription ?? ""}`) ? hours > 8 : hours > 14;
  if (isUtilityPriceText(`${signal.rawTitle} ${signal.rawDescription ?? ""}`)) return hours > 24 * 7;
  if (signal.sourceType === "festival_calendar") return hours > 24 * 90;
  if (["official_government", "official_finance"].includes(signal.sourceType)) return hours > 24 * 7;
  if (["weather", "public_safety"].includes(signal.sourceType)) return hours > 24;
  return hours > 72;
}

function isMatchSpecificSportsText(text: string): boolean {
  return /\b(KKR|GT|CSK|MI|RCB|DC|RR|SRH|PBKS|LSG|IND|AUS)\b|\bvs\b|बनाम|live score|highlights|match|मैच|स्कोर|आईपीएल|ipl/i.test(text);
}

function isUtilityPriceText(text: string): boolean {
  const lower = text.toLowerCase();
  return ["सोना", "सोने", "चांदी", "gold", "silver", "पेट्रोल", "डीजल", "petrol", "diesel", "lpg", "एलपीजी", "cng", "सीएनजी", "महंगाई", "inflation", "टमाटर", "प्याज"].some((term) => lower.includes(term));
}

function isLowInformation(title: string): boolean {
  const compact = title.replace(/[#_\s-]/g, "");
  const upper = compact.toUpperCase();
  if (COMMON_ACRONYMS_ALLOWLIST.includes(upper)) return false;
  if (/^[\u0900-\u097F]{2,}$/.test(compact)) return false;
  if (compact.length < 3) return true;
  if (/^\d+$/.test(compact)) return true;
  return false;
}

export function hasReviewRequiredSignal(signal: FilteredSignal): boolean {
  return signal.safetyFlags.length > 0;
}
