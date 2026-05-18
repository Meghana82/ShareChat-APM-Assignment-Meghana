import { bucketForTrend } from "./interest-buckets";
import { canonicalizeLiveTopic } from "./live-topic-canonicalizer";
import type { RankedTrend } from "./types";

export type FieldIntegrityResult = { ok: true; repaired?: RankedTrend } | { ok: false; reason: string; repaired?: RankedTrend };

export function validateCandidateFieldIntegrity(trend: RankedTrend): FieldIntegrityResult {
  return validateFieldIntegrity(trend);
}

export function validateFieldIntegrity(trend: RankedTrend): FieldIntegrityResult {
  const canonical = canonicalizeLiveTopic(trend);
  const candidate = canonical ?? trend;
  const text = `${candidate.tag} ${candidate.title} ${candidate.displayLabel} ${candidate.description}`.toLowerCase();
  const bucket = bucketForTrend(candidate);

  if (hasRbiRepoEntity(candidate.tag) && !hasFinanceEntity(`${candidate.title} ${candidate.displayLabel} ${candidate.description}`)) {
    return { ok: false, reason: "finance_tag_title_mismatch", repaired: canonical ?? undefined };
  }

  if (hasSportsEntity(`${candidate.title} ${candidate.displayLabel}`) && candidate.category !== "sports") {
    return { ok: false, reason: "sports_title_wrong_category", repaired: canonical ?? undefined };
  }

  if (candidate.category === "finance" && !hasFinanceEntity(text)) {
    return { ok: false, reason: "finance_without_finance_entity", repaired: canonical ?? undefined };
  }

  if (candidate.category === "sports" && !hasSportsEntity(text)) {
    return { ok: false, reason: "sports_without_sports_entity", repaired: canonical ?? undefined };
  }

  if (candidate.category === "public_safety" && !hasPublicSafetyEntity(text)) {
    return { ok: false, reason: "public_safety_without_safety_entity", repaired: canonical ?? undefined };
  }

  if (candidate.category === "weather" && !hasWeatherEntity(text)) {
    return { ok: false, reason: "weather_without_weather_terms", repaired: canonical ?? undefined };
  }

  if (bucket === "daily_rhythm_status") {
    if (!candidate.sourceTypes.includes("daily_rhythm")) return { ok: false, reason: "daily_rhythm_without_daily_source", repaired: canonical ?? undefined };
    if (!hasDailyRhythmEntity(text)) return { ok: false, reason: "daily_rhythm_without_rhythm_entity", repaired: canonical ?? undefined };
  }

  if (bucket === "utility_bazaar_prices" && !hasFinanceEntity(text)) {
    return { ok: false, reason: "utility_without_price_entity", repaired: canonical ?? undefined };
  }

  if (candidate.sources.length === 1 && candidate.sources[0] === "RBI" && !hasFinanceEntity(text)) {
    return { ok: false, reason: "rbi_source_topic_mismatch", repaired: canonical ?? undefined };
  }

  return canonical ? { ok: true, repaired: canonical } : { ok: true };
}

function hasRbiRepoEntity(text: string): boolean {
  return /#RBI|#RBI_|रेपो|upi|bank|बैंक/i.test(text);
}

function hasFinanceEntity(text: string): boolean {
  return /rbi|रेपो|upi|bank|बैंक|वित्त|finance|सोना|चांदी|पेट्रोल|डीजल|lpg|cng|सीएनजी|गैस|महंगाई|कीमत|भाव|रेट|महंगा|price|rate|fuel/i.test(text);
}

function hasSportsEntity(text: string): boolean {
  return /ipl|t20|टी20|टी-20|लीग|kkr|gt|csk|mi|rcb|dc|rr|srh|pbks|lsg|दिल्ली|राजस्थान|क्रिकेट|मैच|कोहली|रोहित|धोनी|गिल|बुमराह/i.test(text);
}

function hasWeatherEntity(text: string): boolean {
  return /बारिश|मौसम|लू|गर्मी|बाढ़|चक्रवात|heat|rain|imd|weather|धूप/i.test(text);
}

function hasPublicSafetyEntity(text: string): boolean {
  return /आग|हादसा|टक्कर|दुर्घटना|मौत|वायरस|इबोला|कोविड|बुखार|train|fire|accident|death|virus|outbreak|public safety/i.test(text);
}

function hasDailyRhythmEntity(text: string): boolean {
  return /शुभ|सुप्रभात|संध्या|रात्रि|वैष्णो|भोलेनाथ|हनुमान|सूर्यदेव|दूरसंचार|गर्मी|धूप|स्टेटस|दिवस|पूजा|व्रत|शिव|महाकाल|केदारनाथ|महादेव|वंदना|भक्ति|जय|बाबा|हर हर|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार|रविवार/i.test(text);
}
