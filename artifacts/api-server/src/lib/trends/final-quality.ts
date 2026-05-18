import { bucketForTrend } from "./interest-buckets";
import { canonicalizeLiveTopic } from "./live-topic-canonicalizer";
import { isPublisherOrSourceNameTopic } from "./source-name-filter";
import { buildHindiHashtag } from "./topic-extraction";
import type { RankedTrend, TrendCategory } from "./types";

export interface FinalQualityResult {
  ok: boolean;
  reason?: string;
  repaired?: RankedTrend;
}

const GENERIC_PLACEHOLDERS = new Set([
  "वित्त अपडेट",
  "परीक्षा अपडेट",
  "भारत अपडेट",
  "वायरल अपडेट",
  "वायरस अपडेट",
  "समाचार अपडेट",
  "ताजा अपडेट",
  "मुंबई",
  "बॉलीवुड गॉसिप",
  "सेलेब्रिटी राजनीति मुलाकात",
  "यूटिलिटी कीमत",
]);

const RAW_FRAGMENT_PATTERNS = [
  /जयपुर\s+भोपाल\s+समेत/i,
  /राशि\s+पीड़ित/i,
  /जुर्माने\s+राशि/i,
  /कहा\s*[-:]?\s*बोले/i,
  /आज\s+लाइव/i,
  /कल\s+हुआ/i,
  /orlando\s+city\s+vs/i,
  /reserve\s+bank\s+of/i,
];

export function validateFinalTrendQuality(trend: RankedTrend): FinalQualityResult {
  const repaired = repairFinalTrend(canonicalizeLiveTopic(trend) ?? trend);
  const text = `${repaired.tag} ${repaired.title} ${repaired.displayLabel} ${repaired.description}`;
  const bucket = bucketForTrend(repaired);

  if (isPublisherOrSourceNameTopic(`${repaired.tag} ${repaired.title} ${repaired.displayLabel}`)) return reject("publisher_or_source_name_topic");
  if (repaired.sourceTypes.length > 0 && repaired.sourceTypes.every((type) => type === "social_experimental")) return reject("reddit_only_candidate");
  if (repaired.bharatRelevanceScore < 70) return reject("bharat_relevance_below_70");
  if (repaired.safety.status === "review_required" || repaired.safety.status === "blocked") return reject("unsafe_or_review_required");
  if (hasMalformedEnglishFragment(repaired)) return reject("malformed_mixed_tag");
  if (!bucketHasRequiredEntity(bucket, repaired)) return reject(`weak_bucket_match_${bucket}`);
  if (RAW_FRAGMENT_PATTERNS.some((pattern) => pattern.test(text))) return reject("raw_headline_fragment");
  if (/^#\d/.test(repaired.tag)) return reject("numeric_leading_tag");
  if (repaired.tag.split("_").length > 5) return reject("tag_too_long");
  if (isGenericPlaceholder(repaired) && !hasConcreteEntity(repaired)) return reject("generic_placeholder_without_entity");
  if (isGenericEntertainmentPlaceholder(repaired)) return reject("generic_entertainment_placeholder");
  if (descriptionRepeatsHeadline(repaired)) return reject("description_repeats_headline");

  return { ok: true, repaired };

  function reject(reason: string): FinalQualityResult {
    return { ok: false, reason, repaired };
  }
}

function repairFinalTrend(trend: RankedTrend): RankedTrend {
  const liveRepair = canonicalizeLiveTopic(trend);
  if (liveRepair) return liveRepair;

  const dailyRepair = repairDailyRhythmTrend(trend);
  if (dailyRepair) return dailyRepair;

  const tag = dedupeHashtagTokens(buildHindiHashtag({ canonicalTitle: `${trend.title} ${trend.tag}`, rawTitle: trend.description, category: trend.category }));
  const repaired = { ...trend };
  if (tag !== "#आज_की_खबर" && tag !== "#वायरल_ट्रेंड") repaired.tag = tag;

  if (/himachal|हिमाचल/i.test(`${trend.title} ${trend.tag}`) && /nikay|निकाय|chunav|चुनाव/i.test(`${trend.title} ${trend.tag}`)) {
    repaired.tag = "#हिमाचल_निकाय_चुनाव";
    repaired.title = "हिमाचल निकाय चुनाव";
    repaired.displayLabel = "हिमाचल निकाय चुनाव लाइव अपडेट";
    repaired.description = "हिमाचल के निकाय चुनाव नतीजों और अपडेट पर चर्चा बढ़ रही है।";
  }

  if (/kkr/i.test(`${trend.title} ${trend.tag}`) && /gt/i.test(`${trend.title} ${trend.tag}`)) {
    repaired.tag = "#KKR_बनाम_GT";
    repaired.title = "KKR बनाम GT";
    repaired.displayLabel = "🏏 KKR vs GT चर्चा";
    repaired.description = "IPL मुकाबले और खिलाड़ियों को लेकर फैंस की चर्चा तेज़ है।";
    repaired.category = "sports";
    repaired.bharatRelevanceScore = Math.max(repaired.bharatRelevanceScore, 85);
  }

  const teamPair = detectIplTeamPair(`${trend.title} ${trend.tag} ${trend.description}`);
  if (teamPair) {
    repaired.tag = `#${teamPair[0]}_बनाम_${teamPair[1]}`;
    repaired.title = `${teamPair[0]} बनाम ${teamPair[1]}`;
    repaired.displayLabel = `🏏 ${teamPair[0]} vs ${teamPair[1]} चर्चा`;
    repaired.description = "IPL मुकाबले और खिलाड़ियों को लेकर फैंस की चर्चा तेज़ है।";
    repaired.category = "sports";
    repaired.bharatRelevanceScore = Math.max(repaired.bharatRelevanceScore, 85);
  }

  if (/कमल[\s_]*हासन|kamal[\s_]*haasan/i.test(`${trend.tag} ${trend.title} ${trend.displayLabel}`) && /CM[\s_]*विजय|cm[\s_]*vijay|सीएम[\s_]*विजय|विजय/i.test(`${trend.tag} ${trend.title} ${trend.displayLabel}`)) {
    repaired.tag = "#कमल_हासन_CM_विजय";
    repaired.title = "कमल हासन और CM विजय मुलाकात";
    repaired.displayLabel = "📢 CM विजय से मिले कमल हासन 🤝";
    repaired.description = "यह मुलाकात मनोरंजन और राजनीति दोनों दर्शकों में चर्चा में है।";
    repaired.category = "entertainment";
    repaired.interestBucket = "bollywood_gossip_entertainment";
    repaired.bharatRelevanceScore = Math.max(repaired.bharatRelevanceScore, 82);
  }

  if (/बॉलीवुड|गॉसिप|celebrity|सेलेब्रिटी|actor|actress/i.test(`${trend.title} ${trend.tag} ${trend.displayLabel}`) && hasSpecificEntertainmentEntity(`${trend.title} ${trend.tag} ${trend.displayLabel}`)) {
    repaired.tag = "#बॉलीवुड_गॉसिप";
    repaired.title = "बॉलीवुड गॉसिप";
    repaired.displayLabel = "🎬 बॉलीवुड गॉसिप";
    repaired.description = "बॉलीवुड और सेलेब्रिटी अपडेट पर लोगों की चर्चा बढ़ रही है।";
    repaired.category = "entertainment";
    repaired.interestBucket = "bollywood_gossip_entertainment";
  }

  return repaired;
}

function repairDailyRhythmTrend(trend: RankedTrend): RankedTrend | null {
  const tag = trend.tag;
  const generatedAt = trend.generatedAt;
  const common = {
    ...trend,
    sources: ["ShareChat Daily Rhythm Calendar"],
    sourceTypes: ["daily_rhythm" as const],
    bharatRelevanceScore: Math.max(trend.bharatRelevanceScore, 90),
    safety: { status: "safe" as const, reasons: [] },
    interestBucket: "daily_rhythm_status",
    generatedAt,
  };

  if (tag === "#शुभ_रविवार") {
    return {
      ...common,
      title: "शुभ रविवार",
      displayLabel: "🌷 शुभ रविवार",
      description: "रविवार की शुभकामनाएं और पॉजिटिव स्टेटस पोस्ट शेयर हो रहे हैं।",
      category: "viral",
      whyTrending: "रविवार को शुभकामना, सुप्रभात और स्टेटस पोस्ट ज्यादा शेयर होते हैं।",
      sampleContent: { type: "summary", text: "लोग शुभ रविवार, सुप्रभात और पॉजिटिव स्टेटस पोस्ट शेयर कर रहे हैं।" },
    };
  }
  if (tag === "#सुप्रभात_संदेश") {
    return {
      ...common,
      title: "सुप्रभात संदेश",
      displayLabel: "🌞 सुप्रभात संदेश",
      description: "सुबह-सुबह सुप्रभात और पॉजिटिव स्टेटस पोस्ट शेयर हो रहे हैं।",
      category: "viral",
      whyTrending: "सुबह के समय सुप्रभात और स्टेटस पोस्ट ज्यादा शेयर होते हैं।",
      sampleContent: { type: "summary", text: "लोग सुप्रभात, शुभकामना और सकारात्मक स्टेटस शेयर कर रहे हैं।" },
    };
  }
  if (tag === "#माँ_वैष्णो_देवी") {
    return {
      ...common,
      title: "माँ वैष्णो देवी",
      displayLabel: "🙏 माँ वैष्णो देवी",
      description: "माँ वैष्णो देवी भक्ति और जय माता दी पोस्ट शेयर हो रहे हैं।",
      category: "devotional",
      whyTrending: "माँ वैष्णो देवी और जय माता दी से जुड़े भक्ति स्टेटस आज प्रासंगिक हैं।",
      sampleContent: { type: "summary", text: "लोग जय माता दी, भक्ति और आशीर्वाद से जुड़े स्टेटस शेयर कर रहे हैं।" },
    };
  }
  if (tag === "#हनुमान_भक्ति") {
    return {
      ...common,
      title: "हनुमान भक्ति",
      displayLabel: "🙏 हनुमान भक्ति",
      description: "हनुमान भक्ति, चालीसा और आशीर्वाद पोस्ट शेयर हो रहे हैं।",
      category: "devotional",
      whyTrending: "हनुमान भक्ति और आशीर्वाद से जुड़े स्टेटस आज प्रासंगिक हैं।",
      sampleContent: { type: "summary", text: "लोग हनुमान चालीसा, भक्ति और आशीर्वाद पोस्ट शेयर कर रहे हैं।" },
    };
  }
  if (tag === "#भोलेनाथ_भक्ति") {
    return {
      ...common,
      title: "भोलेनाथ भक्ति",
      displayLabel: "🙏 भोलेनाथ भक्ति",
      description: "भोलेनाथ भक्ति और हर हर महादेव पोस्ट शेयर हो रहे हैं।",
      category: "devotional",
      whyTrending: "भोलेनाथ भक्ति और हर हर महादेव स्टेटस आज प्रासंगिक हैं।",
      sampleContent: { type: "summary", text: "लोग हर हर महादेव और भोलेनाथ भक्ति स्टेटस शेयर कर रहे हैं।" },
    };
  }
  if (tag === "#सूर्यदेव_प्रणाम") {
    return {
      ...common,
      title: "सूर्यदेव प्रणाम",
      displayLabel: "🌞 सूर्यदेव प्रणाम",
      description: "सूर्यदेव प्रणाम और सकारात्मक सुबह के स्टेटस शेयर हो रहे हैं।",
      category: "devotional",
      whyTrending: "सूर्यदेव प्रणाम और सकारात्मक सुबह के स्टेटस आज प्रासंगिक हैं।",
      sampleContent: { type: "summary", text: "लोग सूर्यदेव प्रणाम और सकारात्मक सुबह के स्टेटस शेयर कर रहे हैं।" },
    };
  }
  if (tag === "#विश्व_दूरसंचार_दिवस") {
    return {
      ...common,
      title: "विश्व दूरसंचार दिवस",
      displayLabel: "📡 विश्व दूरसंचार दिवस 😊",
      description: "आज दूरसंचार दिवस पर जानकारी और शुभकामना पोस्ट शेयर हो रहे हैं।",
      category: "technology",
      whyTrending: "आज के दिन दूरसंचार दिवस से जुड़ी जानकारी और शुभकामना पोस्ट शेयर हो रहे हैं।",
      sampleContent: { type: "summary", text: "लोग दूरसंचार दिवस से जुड़ी जानकारी, शुभकामनाएं और जागरूकता पोस्ट शेयर कर रहे हैं।" },
    };
  }
  if (tag === "#गर्मी_से_बचाव") {
    return {
      ...common,
      title: "गर्मी से बचाव",
      displayLabel: `${String.fromCodePoint(0x1f305)} गर्मी में धूप से बचने के उपाय 🥵🌞`,
      description: "गर्मी और धूप से बचने के आसान उपाय लोग शेयर कर रहे हैं।",
      category: "weather",
      whyTrending: "गर्मी के मौसम में धूप और लू से बचने के उपाय ज्यादा शेयर हो रहे हैं।",
      sampleContent: { type: "summary", text: "लोग धूप, लू और गर्मी से बचने के आसान उपाय शेयर कर रहे हैं।" },
    };
  }
  if (
    trend.sourceTypes.includes("daily_rhythm") &&
    trend.interestBucket === "daily_rhythm_status" &&
    /^#[ऀ-ॿA-Za-z0-9_]{2,}$/.test(trend.tag) &&
    trend.title.length > 0 &&
    trend.title.length < 50
  ) {
    return common;
  }
  return null;
}

function detectIplTeamPair(text: string): [string, string] | null {
  const upper = text.toUpperCase();
  const teams = ["KKR", "GT", "CSK", "MI", "RCB", "DC", "RR", "SRH", "PBKS", "LSG"];
  const found = teams.filter((team) => new RegExp(`(^|[^A-Z0-9])${team}([^A-Z0-9]|$)`).test(upper));
  if (found.length >= 2 && (/\bVS\b|बनाम|MATCH|LIVE|IPL/.test(upper))) return [found[0], found[1]];
  return null;
}

function hasMalformedEnglishFragment(trend: RankedTrend): boolean {
  const tag = trend.tag.toLowerCase();
  const allowedLatinTokens = new Set(["CNG", "LPG", "RBI", "NEET", "JEE", "CBSE", "UPSC", "SSC", "KKR", "GT", "CSK", "MI", "RCB", "DC", "RR", "SRH", "PBKS", "LSG", "CM", "PM", "IMD"]);
  const latinTokens = trend.tag.match(/[A-Za-z]+/g) ?? [];
  if (latinTokens.some((token) => !allowedLatinTokens.has(token.toUpperCase()))) return true;
  if (/#वित्त_/.test(tag) && /reserve|bank|operating|framework/.test(tag)) return true;
  if (/#परीक्षा_/.test(tag) && /orlando|city|vs/.test(tag)) return true;
  if (/#.*_[a-z]{4,}_[a-z]{2,}/i.test(trend.tag) && !/#(LPG|CNG|RBI|NEET|JEE|KKR|GT|CSK|MI|RCB|DC|RR|SRH|PBKS|LSG)/.test(trend.tag)) return true;
  return false;
}

function isGenericPlaceholder(trend: RankedTrend): boolean {
  return GENERIC_PLACEHOLDERS.has(trend.title.trim()) || GENERIC_PLACEHOLDERS.has(trend.displayLabel.trim());
}

function hasConcreteEntity(trend: RankedTrend): boolean {
  return /RBI|NEET|JEE|CBSE|UPSC|SSC|KKR|GT|CSK|MI|RCB|DC|RR|SRH|PBKS|LSG|मोदी|हिमाचल|वट|शनि|सोना|चांदी|सब्जी|मंडी|टमाटर|प्याज|पेट्रोल|डीजल|LPG|CNG|मुंबई_बारिश|IMD|इबोला|कोविड|फ्लू|राजधानी|कमल|हासन|विजय|तुम्बाड|भोजपुरी/i.test(
    `${trend.tag} ${trend.title} ${trend.displayLabel}`,
  );
}

function bucketHasRequiredEntity(bucket: string, trend: RankedTrend): boolean {
  const text = `${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`.toLowerCase();
  const hasAny = (terms: string[]) => terms.some((term) => text.includes(term.toLowerCase()));
  if (bucket === "utility_bazaar_prices") {
    if (hasAny(["राशि", "जुर्माना", "पीड़ित", "भुगतान"]) && !hasAny(["सोना", "चांदी", "पेट्रोल", "डीजल", "lpg", "cng", "महंगाई", "टमाटर", "प्याज", "भाव", "रेट", "कीमत"])) return false;
    return hasAny(["सोना", "चांदी", "gold", "silver", "सब्जी", "मंडी", "पेट्रोल", "डीजल", "petrol", "diesel", "lpg", "एलपीजी", "cng", "सीएनजी", "महंगाई", "inflation", "टमाटर", "प्याज", "RBI", "रेपो"]);
  }
  if (bucket === "daily_rhythm_status") return hasAny(["शुभ", "सुप्रभात", "संध्या", "रात्रि", "वैष्णो", "भोलेनाथ", "हनुमान", "सूर्यदेव", "दूरसंचार", "गर्मी", "धूप", "स्टेटस", "शिव", "महाकाल", "केदारनाथ", "महादेव", "वंदना", "भक्ति", "जय", "बाबा", "हर हर", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"]);
  if (bucket === "finance_education_jobs_utility") return hasAny(["neet", "jee", "cbse", "upsc", "ssc", "रिजल्ट", "एडमिट", "नौकरी", "भर्ती", "rbi", "upi"]);
  if (bucket === "cricket_ipl_sports") return hasAny(["ipl", "t20", "टी20", "टी-20", "लीग", "kkr", "gt", "csk", "mi", "rcb", "dc", "rr", "srh", "pbks", "lsg", "दिल्ली", "राजस्थान", "कोहली", "रोहित", "धोनी", "गिल", "बुमराह", "क्रिकेट", "मैच"]);
  if (bucket === "bollywood_gossip_entertainment") return hasAny(["बॉलीवुड", "फिल्म", "ट्रेलर", "ott", "एक्टर", "एक्ट्रेस", "गॉसिप", "रिलीज", "movie", "actor", "कमल", "हासन", "cm", "सीएम", "विजय", "सेलेब्रिटी"]);
  if (bucket === "modi_national_news") return hasAny(["मोदी", "राहुल", "प्रधानमंत्री", "सरकार", "योजना", "चुनाव", "संसद", "कैबिनेट", "मंत्रालय", "मंत्री", "शिक्षा", "इस्तीफा", "pm", "government", "minister", "education", "tamil nadu", "आंध्र"]);
  return true;
}

function isGenericEntertainmentPlaceholder(trend: RankedTrend): boolean {
  if (trend.interestBucket !== "bollywood_gossip_entertainment") return false;
  return !hasSpecificEntertainmentEntity(`${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`);
}

function hasSpecificEntertainmentEntity(text: string): boolean {
  return /कमल|हासन|विजय|तुम्बाड|भोजपुरी|पवन|खेसारी|निरहुआ|सलमान|शाहरुख|आमिर|अक्षय|दीपिका|आलिया|रणबीर|ranbir|alia|salman|shah\s*rukh|akshay|deepika|tumbbad/i.test(text);
}

function dedupeHashtagTokens(tag: string): string {
  const rawTokens = tag.replace(/^#/, "").split("_").filter(Boolean);
  const tokens: string[] = [];
  for (const token of rawTokens) {
    if (tokens[tokens.length - 1]?.toLowerCase() === token.toLowerCase()) continue;
    if (tokens.some((seen) => seen.toLowerCase() === token.toLowerCase()) && rawTokens.length > 3) continue;
    tokens.push(token);
  }
  return `#${tokens.join("_")}`;
}

function descriptionRepeatsHeadline(trend: RankedTrend): boolean {
  if (["weather", "public_safety", "finance"].includes(trend.category)) return false;
  if (trend.tag === "#कमल_हासन_CM_विजय") return false;
  const titleWords = trend.title.split(/\s+/).filter(Boolean);
  if (titleWords.length < 6) return false;
  return trend.description.includes(titleWords.slice(0, 6).join(" "));
}

export function finalQualityRejectReasonForTest(trend: RankedTrend): string | undefined {
  return validateFinalTrendQuality(trend).reason;
}

export function canUseAsLenientFinalRescue(trend: RankedTrend): boolean {
  const result = validateFinalTrendQuality(trend);
  if (result.ok) return true;
  if (!["description_repeats_headline", "tag_too_long"].includes(result.reason ?? "")) return false;
  const repaired = result.repaired ?? trend;
  if (repaired.bharatRelevanceScore < 75 || repaired.safety.status !== "safe") return false;
  if (isPublisherOrSourceNameTopic(`${repaired.tag} ${repaired.title} ${repaired.displayLabel}`)) return false;
  if (hasMalformedEnglishFragment(repaired)) return false;
  if (!bucketHasRequiredEntity(bucketForTrend(repaired), repaired)) return false;
  return true;
}
