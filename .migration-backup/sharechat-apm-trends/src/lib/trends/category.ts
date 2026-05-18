import { CATEGORY_KEYWORDS } from "./constants";
import type { FilteredSignal, RawSignal, TrendCategory } from "./types";

export function detectCategory(signal: RawSignal, normalizedText: string, tokens: string[]): TrendCategory {
  if (signal.categoryHint) return signal.categoryHint;
  const haystack = `${normalizedText} ${tokens.join(" ")}`.toLowerCase();
  if (isIndianCricket(haystack)) return "sports";
  if (isProtestOrPoliticalConflict(haystack)) return "politics";
  if (isPoliticalQuoteOrActor(haystack)) return "politics";
  if (isCrimeOrEnforcement(haystack)) return "news";
  if (isDevotionalIntent(haystack)) return haystack.includes("वट") || haystack.includes("सावित्री") ? "festival" : "devotional";
  const priority: TrendCategory[] = [
    "public_safety",
    "weather",
    "finance",
    "government",
    "sports",
    "festival",
    "devotional",
    "education",
    "jobs",
    "movies",
    "music",
    "entertainment",
    "technology",
    "politics",
    "local",
    "viral",
    "news",
  ];
  for (const category of priority) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => haystack.includes(keyword.toLowerCase()))) return category;
  }
  if (signal.sourceType === "hindi_news" || signal.sourceType === "national_news") return "news";
  if (signal.sourceType === "search_demand") return "viral";
  return "news";
}

function isIndianCricket(text: string): boolean {
  const teams = ["kkr", "gt", "rcb", "csk", "mi", "srh", "dc", "rr", "pbks", "lsg", "ipl", "आईपीएल"];
  const teamHits = teams.filter((team) => new RegExp(`(^|[^a-z0-9])${team}([^a-z0-9]|$)`, "i").test(text)).length;
  return teamHits >= 1 && (text.includes("vs") || text.includes("बनाम") || text.includes("match") || text.includes("score") || text.includes("live") || text.includes("मैच"));
}

function isPoliticalQuoteOrActor(text: string): boolean {
  return [
    "बोले",
    "बयान",
    "दिग्विजय",
    "राहुल गांधी",
    "मोदी",
    "योगी",
    "मुख्यमंत्री",
    "प्रधानमंत्री",
    "मंत्री",
    "bjp",
    "congress",
    "election",
    "चुनाव",
    "पार्टी",
  ].some((term) => text.includes(term));
}

function isProtestOrPoliticalConflict(text: string): boolean {
  return ["किसान", "किसानों", "पुलिस", "बैरिकेड", "आंसू गैस", "प्रदर्शन", "धरना", "कूच", "भिड़", "lathi", "protest", "police"].some((term) => text.includes(term));
}

function isCrimeOrEnforcement(text: string): boolean {
  return ["ncb", "ड्रग", "कैप्टागन", "जब्त", "गिरफ्तार", "हत्या", "मौत", "मर्डर", "क्राइम", "crime", "drug", "seized", "arrest"].some((term) => text.includes(term));
}

function isDevotionalIntent(text: string): boolean {
  return ["पूजा", "व्रत", "आरती", "मंदिर", "भक्ति", "भगवान", "शुभकामनाएं", "त्योहार", "दर्शन", "कथा", "भोलेनाथ", "सावन", "वट सावित्री"].some((term) =>
    text.includes(term),
  );
}

export interface CategoryValidationResult {
  ok: boolean;
  reasons: string[];
  safetyStatus?: "safe" | "limited" | "review_required" | "blocked";
}

export function validateCategory(signals: FilteredSignal[], category: TrendCategory): CategoryValidationResult {
  const sources = new Set(signals.map((signal) => signal.source));
  const sourceTypes = new Set(signals.map((signal) => signal.sourceType));
  const reasons: string[] = [];

  if (signals.length > 0 && signals.every((signal) => signal.sourceType === "social_experimental")) {
    return { ok: false, reasons: ["Reddit/social-experimental alone can never pass a trend."], safetyStatus: "blocked" };
  }

  if (category === "weather" && !sourceTypes.has("weather") && !sourceTypes.has("public_safety")) {
    reasons.push("Weather alert-level treatment requires IMD or SACHET; keeping only if framed as discussion, not official warning.");
  }
  if (category === "public_safety" && !sourceTypes.has("public_safety") && !sourceTypes.has("official_government")) {
    return { ok: false, reasons: ["Public safety trend requires SACHET or official authority."], safetyStatus: "blocked" };
  }
  if (category === "finance" && isUtilityPriceTopic(signals) && (sourceTypes.has("search_demand") || sourceTypes.has("hindi_news") || sourceTypes.has("national_news"))) {
    reasons.push("Utility/bazaar price topic validated by search/news/rate evidence; RBI is not required for retail prices.");
  } else if (category === "finance" && !sourceTypes.has("official_finance") && !sourceTypes.has("hindi_news") && !sourceTypes.has("national_news")) {
    return { ok: false, reasons: ["Finance trend requires RBI or trusted news validation."], safetyStatus: "blocked" };
  }
  if (category === "government" && !sourceTypes.has("official_government") && !sourceTypes.has("hindi_news") && !sourceTypes.has("national_news")) {
    return { ok: false, reasons: ["Government trend requires PIB/ministry or trusted news validation."], safetyStatus: "blocked" };
  }
  if (category === "sports" && hasLiveCricketFact(signals) && !sourceTypes.has("sports") && !sourceTypes.has("hindi_news") && !sourceTypes.has("national_news")) {
    return { ok: false, reasons: ["Cricket live facts require Roanuz/sports authority/trusted sports news."], safetyStatus: "blocked" };
  }
  if (category === "festival" && !sourceTypes.has("festival_calendar")) {
    return { ok: false, reasons: ["Festival trend requires Calendarific or internal festival JSON."], safetyStatus: "limited" };
  }
  if (category === "devotional" && !sourceTypes.has("festival_calendar") && !sourceTypes.has("hindi_news")) {
    reasons.push("Devotional trend should be backed by internal festival/devotional JSON or Hindi coverage.");
  }
  if ((category === "news" || category === "politics") && sources.size < 2 && !hasOfficialType(sourceTypes)) {
    return { ok: false, reasons: ["Breaking news needs 2+ independent sources unless official."], safetyStatus: "limited" };
  }
  const hasSensitive = signals.some((signal) => signal.safetyFlags.length > 0 || category === "politics");
  if (hasSensitive) {
    reasons.push("Sensitive/political content requires review and downranking.");
    return { ok: true, reasons, safetyStatus: "review_required" };
  }

  return { ok: true, reasons, safetyStatus: reasons.length ? "limited" : "safe" };
}

function hasOfficialType(sourceTypes: Set<string>): boolean {
  return ["official_government", "official_finance", "weather", "public_safety", "sports"].some((type) => sourceTypes.has(type));
}

function hasLiveCricketFact(signals: FilteredSignal[]): boolean {
  const text = signals.map((signal) => signal.normalizedText).join(" ").toLowerCase();
  return ["score", "toss", "wicket", "won by", "runs", "live", "स्कोर", "टॉस", "विकेट", "जीता"].some((term) => text.includes(term));
}

function isUtilityPriceTopic(signals: FilteredSignal[]): boolean {
  const text = signals.map((signal) => `${signal.normalizedText} ${signal.rawTitle} ${signal.rawDescription ?? ""}`).join(" ").toLowerCase();
  return ["सोना", "सोने", "चांदी", "gold", "silver", "पेट्रोल", "डीजल", "petrol", "diesel", "lpg", "एलपीजी", "cng", "सीएनजी", "महंगाई", "inflation", "टमाटर", "प्याज", "भाव", "रेट", "कीमत"].some((term) => text.includes(term));
}
