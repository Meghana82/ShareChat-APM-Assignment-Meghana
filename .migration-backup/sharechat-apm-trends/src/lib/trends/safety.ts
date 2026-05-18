import { ADULT_BLOCKLIST, SENSITIVE_REVIEW_KEYWORDS, SPAM_BLOCKLIST } from "./constants";
import { hasDevanagari } from "./normalize";
import type { RankedTrend } from "./types";

export interface RejectedCandidate {
  title: string;
  reason: string;
  score: number;
  source: string;
}

const NO_EMOJI_CATEGORIES = new Set(["finance", "government", "politics", "public_safety", "weather"]);

export function postGenerationSafetyCheck(trends: RankedTrend[], rejectedCandidates: RejectedCandidate[] = []): RankedTrend[] {
  const seenTags = new Set<string>();
  const safe: RankedTrend[] = [];

  for (const trend of trends) {
    const repaired = repairTrend(trend);
    const key = repaired.tag.toLowerCase();
    const rejectionReason = rejectionReasonFor(repaired, seenTags);
    if (rejectionReason) {
      rejectedCandidates.push({ title: repaired.title, reason: rejectionReason, score: repaired.heatScore, source: repaired.sources.join(", ") });
      continue;
    }
    seenTags.add(key);
    safe.push(repaired);
  }

  return safe.map((trend, index) => ({ ...trend, rank: index + 1 }));
}

function repairTrend(trend: RankedTrend): RankedTrend {
  let tag = trend.tag.startsWith("#") ? trend.tag : `#${trend.tag}`;
  // Keep Unicode marks (\p{M}); otherwise Devanagari matras are stripped: सावन -> सवन, पेट्रोल -> पटरल.
  tag = tag.replace(/\s+/g, "_").replace(/_+/g, "_").replace(/[^#\p{L}\p{M}\p{N}_]/gu, "");
  if (!hasDevanagari(tag) && !/#(IPL|RBI|UPI|NEET|JEE|CBSE|NTA|IMD|BJP|IND|AUS|MI|CSK|WPL|ODI|T20|PM|CM)/i.test(tag)) {
    tag = `#भारत_${tag.replace(/^#/, "")}`;
  }
  const heatScore = Math.max(1, Math.min(100, Math.round(trend.heatScore)));
  const description = trimWords(trend.description, 20);
  const whyTrending = trimSentences(trend.whyTrending, 2);
  const sampleText = trimSentences(trend.sampleContent.text, 2);
  const noEmoji = NO_EMOJI_CATEGORIES.has(trend.category) || trend.safety.status === "review_required";
  const assessment = assessTrendSafety({
    title: trend.title,
    displayLabel: trend.displayLabel,
    description,
    whyTrending,
    category: trend.category,
    safety: trend.safety,
  });
  const repairedHeat = repairHeatScore(heatScore, trend.signalSummary.externalValidationScore, assessment.status);
  return {
    ...trend,
    tag: tag.slice(0, 60),
    heatScore: repairedHeat,
    description: noEmoji ? stripEmoji(description) : description,
    whyTrending: noEmoji ? stripEmoji(whyTrending) : whyTrending,
    sampleContent: { type: "summary", text: noEmoji ? stripEmoji(sampleText) : sampleText },
    safety: {
      ...trend.safety,
      status: assessment.status,
      reasons: assessment.reasons,
    },
  };
}

export function assessTrendSafety(trend: Pick<RankedTrend, "title" | "displayLabel" | "description" | "whyTrending" | "category" | "safety">): RankedTrend["safety"] {
  const text = `${trend.title} ${trend.displayLabel} ${trend.description} ${trend.whyTrending}`.toLowerCase();
  if (ADULT_BLOCKLIST.some((term) => text.includes(term.toLowerCase()))) return { status: "blocked", reasons: ["adult content"] };
  if (SPAM_BLOCKLIST.some((term) => text.includes(term.toLowerCase()))) return { status: "blocked", reasons: ["spam/manipulation"] };
  if (hasDrugOrEnforcementRisk(text)) return { status: "review_required", reasons: ["crime/drug enforcement topic"] };
  if (hasPoliticalConflictRisk(text)) return { status: "review_required", reasons: ["protest/political conflict topic"] };
  if (hasPrivateTragedyOrFuneral(text)) return { status: "review_required", reasons: ["private tragedy/funeral topic"] };
  if (hasCommunalIncitement(text)) return { status: "review_required", reasons: ["communal/incitement risk"] };
  if (isFactualAccidentDeath(text)) return { status: "limited", reasons: ["factual accident/death report"] };
  if (isWeatherCasualtyOrRisk(text, trend.category)) return { status: "limited", reasons: ["weather/public-safety context"] };
  if (trend.category === "finance" || trend.category === "government") return { status: "safe", reasons: [] };
  const exactSensitive = SENSITIVE_REVIEW_KEYWORDS.filter((term) => matchesSensitiveKeyword(text, term));
  if (exactSensitive.length > 0) return { status: "review_required", reasons: exactSensitive.slice(0, 3) };
  if (trend.category === "politics" && trend.safety.status === "review_required") return { status: "review_required", reasons: trend.safety.reasons.length ? trend.safety.reasons : ["sensitive/political topic"] };
  if (trend.safety.status === "limited") return trend.safety;
  return { status: "safe", reasons: [] };
}

function rejectionReasonFor(trend: RankedTrend, seenTags: Set<string>): string | null {
  if (seenTags.has(trend.tag.toLowerCase())) return "duplicate_tag";
  if (trend.safety.status === "blocked") return "blocked_safety";
  if (trend.safety.status === "review_required") return "review_required_not_autopublished";
  if (!isSafeText(`${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description} ${trend.whyTrending}`)) return "unsafe_text";
  if (trend.bharatRelevanceScore < 70) return "bharat_relevance_below_70";
  if (trend.sourceTypes.length > 0 && trend.sourceTypes.every((type) => type === "social_experimental")) return "reddit_only_candidate";
  if (isLowQualityRawHeadline(trend)) return "low_quality_raw_headline";
  if (/^#\d/.test(trend.tag)) return "numeric_leading_tag";
  if (trend.tag.split("_").length > 5) return "tag_too_long";
  if (trend.signalSummary.externalValidationScore <= 20 && trend.heatScore > 35) return "heat_inconsistent_with_external_validation";
  return null;
}

function isLowQualityRawHeadline(trend: RankedTrend): boolean {
  const text = `${trend.title} ${trend.displayLabel} ${trend.description}`.toLowerCase();
  if (["खबर हटके", "इंसानी पॉटी", "लाई डिटेक्टर", "फूट-फूटकर", "आंसू गैस", "बैरिकेडिंग", "जेहादी ड्रग"].some((term) => text.includes(term))) return true;
  if (trend.interestBucket === "daily_rhythm_status" || trend.sourceTypes.includes("daily_rhythm")) return false;
  if (/[#](माँ_वैष्णो_देवी|हनुमान_भक्ति|भोलेनाथ_भक्ति|शुभ_रविवार|सुप्रभात_संदेश|विश्व_दूरसंचार_दिवस|गर्मी_से_बचाव)/.test(trend.tag)) return false;
  if ((trend.category === "devotional" || trend.category === "festival") && !trend.sourceTypes.includes("festival_calendar") && !/[#](सावन|वट|छठ|दिवाली|होली|नवरात्रि|महाशिवरात्रि|राम_नवमी)/.test(trend.tag)) return true;
  return false;
}

function repairHeatScore(heatScore: number, externalValidationScore: number, status: RankedTrend["safety"]["status"]): number {
  let repaired = heatScore;
  if (externalValidationScore <= 20) repaired = Math.min(repaired, 35);
  if (status === "review_required") repaired = Math.min(repaired, 40);
  return Math.max(1, Math.min(100, Math.round(repaired)));
}

function isFactualAccidentDeath(text: string): boolean {
  const hasAccident = ["हादसा", "टक्कर", "accident", "collision", "दुर्घटना"].some((term) => text.includes(term));
  const hasDeath = ["मौत", "death", "dead", "killed"].some((term) => matchesSensitiveKeyword(text, term));
  return hasAccident && hasDeath;
}

function isWeatherCasualtyOrRisk(text: string, category: RankedTrend["category"]): boolean {
  const weather = category === "weather" || category === "public_safety" || ["गर्मी", "लू", "बारिश", "मौसम", "heatwave", "weather", "rain", "el nino", "el niño"].some((term) => text.includes(term));
  const casualtyOrRisk = ["मौत", "सूखा", "आशंका", "warning", "alert", "risk"].some((term) => text.includes(term));
  return weather && casualtyOrRisk;
}

function hasCommunalIncitement(text: string): boolean {
  const communal = ["सांप्रदायिक", "communal", "नफरत", "hate", "हिंसा", "violence"].some((term) => text.includes(term));
  const incitement = ["फैलाने", "अपील", "भड़क", "incite", "spread", "attack"].some((term) => text.includes(term));
  return communal && incitement;
}

function hasDrugOrEnforcementRisk(text: string): boolean {
  return ["ड्रग", "कैप्टागन", "ncb", "जब्त", "सीरियाई", "drug", "seized", "arrest"].some((term) => text.includes(term));
}

function hasPoliticalConflictRisk(text: string): boolean {
  return ["पुलिस से भिड़", "आंसू गैस", "बैरिकेड", "कूच", "water cannon", "lathi", "protest"].some((term) => text.includes(term));
}

function hasPrivateTragedyOrFuneral(text: string): boolean {
  return ["अस्थियां", "फूट-फूटकर", "कलश", "आई लव पापा", "funeral", "cremation"].some((term) => text.includes(term));
}

function matchesSensitiveKeyword(lowerText: string, keyword: string): boolean {
  const lowerKeyword = keyword.toLowerCase();
  if (/^[a-z\s]+$/.test(lowerKeyword)) {
    const escaped = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lowerText);
  }
  return lowerText.includes(lowerKeyword);
}

function isSafeText(text: string): boolean {
  const lower = text.toLowerCase();
  return !ADULT_BLOCKLIST.some((term) => lower.includes(term.toLowerCase())) && !SPAM_BLOCKLIST.some((term) => lower.includes(term.toLowerCase()));
}

function trimWords(input: string, maxWords: number): string {
  const words = input.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? input : `${words.slice(0, maxWords).join(" ")}।`;
}

function trimSentences(input: string, maxSentences: number): string {
  const sentences = input.split(/(?<=[।.!?])\s+/).filter(Boolean);
  return sentences.slice(0, maxSentences).join(" ").trim();
}

function stripEmoji(input: string): string {
  return input.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s+/g, " ").trim();
}
