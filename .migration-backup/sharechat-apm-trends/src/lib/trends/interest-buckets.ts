import type { RankedTrend, RawSignal, SourceType, TrendCategory } from "./types";

export type InterestBucketId =
  | "daily_rhythm_status"
  | "festival_devotional"
  | "modi_national_news"
  | "cricket_ipl_sports"
  | "bollywood_gossip_entertainment"
  | "memes_viral_emotion"
  | "bhojpuri_music_creator"
  | "weather_local_public_safety"
  | "utility_bazaar_prices"
  | "finance_education_jobs_utility";

export interface InterestBucket {
  id: InterestBucketId;
  label: string;
  categories: TrendCategory[];
  hindiKeywords: string[];
  romanKeywords: string[];
  preferredSourceFamilies: string[];
  seedQueries: string[];
  minimumCandidateTarget: number;
  finalTop10Preference: number;
}

export const INTEREST_BUCKETS: InterestBucket[] = [
  {
    id: "daily_rhythm_status",
    label: "Daily rhythm, greetings, observances and status culture",
    categories: ["viral", "devotional", "weather", "technology", "news"],
    hindiKeywords: ["शुभ रविवार", "शुभ सोमवार", "शुभ मंगलवार", "सुप्रभात", "गुड मॉर्निंग", "शुभ संध्या", "शुभ रात्रि", "माँ वैष्णो देवी", "जय माता दी", "भोलेनाथ", "हनुमान जी", "सूर्यदेव", "विश्व दूरसंचार दिवस", "गर्मी से बचाव", "धूप से बचाव", "आज का दिन", "स्टेटस", "शुभकामनाएं"],
    romanKeywords: ["good morning", "good night", "sunday wishes", "status", "jai mata di", "vaishno devi", "world telecommunication day", "heat tips"],
    preferredSourceFamilies: ["daily_rhythm", "festival_cultural", "search_demand", "video_entertainment", "hindi_news"],
    seedQueries: ["शुभ रविवार", "सुप्रभात संदेश", "माँ वैष्णो देवी", "विश्व दूरसंचार दिवस", "गर्मी से बचाव"],
    minimumCandidateTarget: 3,
    finalTop10Preference: 2,
  },
  {
    id: "festival_devotional",
    label: "Festival, devotional, panchang and regional culture",
    categories: ["festival", "devotional"],
    hindiKeywords: ["व्रत", "पूजा", "शुभकामनाएं", "भक्ति", "आरती", "मंदिर", "दर्शन", "कथा", "पंचांग", "मुहूर्त", "अमावस्या", "पूर्णिमा", "सावन", "भोलेनाथ", "शनिदेव", "हनुमान", "वट सावित्री", "छठ", "नवरात्रि", "करवा चौथ"],
    romanKeywords: ["vat savitri", "shani amavasya", "panchang", "puja", "vrat", "bhajan", "bhakti", "sawan", "chhath", "navratri"],
    preferredSourceFamilies: ["festival_cultural", "hindi_news", "search_demand", "video_entertainment"],
    seedQueries: ["आज का पंचांग", "आज कौन सा व्रत है", "वट सावित्री व्रत", "शनि अमावस्या पूजा", "भोलेनाथ भजन", "हनुमान भक्ति"],
    minimumCandidateTarget: 2,
    finalTop10Preference: 1,
  },
  {
    id: "modi_national_news",
    label: "Modi, government and national public affairs",
    categories: ["government", "politics", "news"],
    hindiKeywords: ["मोदी", "प्रधानमंत्री", "पीएम", "लोकसभा", "संसद", "बीजेपी", "कांग्रेस", "चुनाव", "भाषण", "रैली", "योजना", "सरकार", "कैबिनेट", "मंत्रालय"],
    romanKeywords: ["modi", "pm modi", "bjp", "congress", "election", "government scheme", "parliament"],
    preferredSourceFamilies: ["government_official", "hindi_news", "search_demand", "national_news"],
    seedQueries: ["PM Modi speech today", "मोदी भाषण", "सरकारी योजना", "प्रधानमंत्री खबर"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
  {
    id: "cricket_ipl_sports",
    label: "Cricket, IPL and sports emotion",
    categories: ["sports"],
    hindiKeywords: ["क्रिकेट", "मैच", "लाइव स्कोर", "विकेट", "कोहली", "रोहित", "धोनी", "गिल", "बुमराह", "टीम इंडिया"],
    romanKeywords: ["ipl", "wpl", "kkr", "gt", "csk", "mi", "rcb", "srh", "rr", "pbks", "lsg", "dc", "ind", "aus", "cricket", "match", "live score", "toss", "wicket", "kohli", "rohit", "dhoni", "gill", "bumrah"],
    preferredSourceFamilies: ["search_demand", "hindi_news", "video_entertainment", "sports_authority"],
    seedQueries: ["IPL live", "IPL live score", "आज का IPL मैच", "क्रिकेट लाइव", "कोहली", "टीम इंडिया"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
  {
    id: "bollywood_gossip_entertainment",
    label: "Bollywood, celebrity gossip and entertainment",
    categories: ["entertainment", "movies", "music"],
    hindiKeywords: ["बॉलीवुड", "फिल्म", "मूवी", "ट्रेलर", "गाना", "ओटीटी", "एक्टर", "एक्ट्रेस", "सेलेब्रिटी", "अफेयर", "शादी", "तलाक", "गॉसिप", "रिव्यू", "रिलीज"],
    romanKeywords: ["bollywood", "movie", "film", "trailer", "ott", "actor", "actress", "celebrity", "gossip", "release", "review"],
    preferredSourceFamilies: ["video_entertainment", "hindi_news", "search_demand"],
    seedQueries: ["Bollywood gossip today", "नई फिल्म रिलीज", "OTT release India", "बॉलीवुड गॉसिप", "movie trailer hindi"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
  {
    id: "memes_viral_emotion",
    label: "Memes, viral and emotional shareability",
    categories: ["viral", "entertainment", "local"],
    hindiKeywords: ["वायरल", "मीम", "मजेदार", "फनी", "अजब", "गजब", "भावुक", "इमोशनल", "वीडियो वायरल", "सोशल मीडिया"],
    romanKeywords: ["viral", "meme", "funny", "emotional", "trending video", "social media"],
    preferredSourceFamilies: ["search_demand", "video_entertainment", "hindi_news"],
    seedQueries: ["viral video India", "funny meme India", "वायरल वीडियो", "फनी मीम", "आज का वायरल"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
  {
    id: "bhojpuri_music_creator",
    label: "Bhojpuri, music and creator-led entertainment",
    categories: ["music", "entertainment", "devotional"],
    hindiKeywords: ["भोजपुरी", "गाना", "पवन सिंह", "खेसारी", "निरहुआ", "अरविंद अकेला", "भजन", "लोकगीत", "डांस वीडियो"],
    romanKeywords: ["bhojpuri", "pawan singh", "khesari", "nirahua", "bhojpuri song", "bhajan"],
    preferredSourceFamilies: ["video_entertainment", "hindi_news", "search_demand"],
    seedQueries: ["भोजपुरी गाना नया", "Bhojpuri song trending", "भोजपुरी भजन"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
  {
    id: "weather_local_public_safety",
    label: "Weather, local and public safety",
    categories: ["weather", "local", "public_safety"],
    hindiKeywords: ["बारिश", "मौसम", "लू", "गर्मी", "बाढ़", "चक्रवात", "अलर्ट", "दिल्ली बारिश", "मुंबई बारिश", "बिहार बाढ़"],
    romanKeywords: ["imd", "weather", "rain", "heatwave", "flood", "cyclone", "alert"],
    preferredSourceFamilies: ["weather_safety", "hindi_news", "search_demand"],
    seedQueries: ["मौसम आज", "बारिश अलर्ट", "दिल्ली मौसम", "मुंबई बारिश"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
  {
    id: "utility_bazaar_prices",
    label: "Utility, bazaar and daily household price trends",
    categories: ["finance", "news", "local"],
    hindiKeywords: ["सोना", "चांदी", "सोने का भाव", "सोने की कीमत", "सोना सस्ता", "सोना महंगा", "चांदी का भाव", "पेट्रोल", "डीजल", "पेट्रोल डीजल", "ईंधन", "फ्यूल", "एलपीजी", "सिलेंडर", "सीएनजी", "महंगाई", "महंगा", "कीमत", "रेट", "भाव", "आज का रेट", "तेल", "सब्जी", "टमाटर", "प्याज", "खाद्य तेल"],
    romanKeywords: ["gold rate", "gold price", "silver price", "silver rate", "petrol price", "diesel price", "fuel price", "lpg cylinder", "cng price", "inflation", "mehngai", "sone ka bhav", "chandi ka bhav", "petrol diesel rate"],
    preferredSourceFamilies: ["search_demand", "utility_rates", "hindi_news", "finance_official"],
    seedQueries: ["सोने का भाव आज", "gold rate today India", "चांदी का भाव आज", "petrol diesel price today India", "पेट्रोल डीजल कीमत", "LPG cylinder price", "CNG price today", "महंगाई अपडेट", "टमाटर प्याज कीमत"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
  {
    id: "finance_education_jobs_utility",
    label: "Finance, education, jobs and utility",
    categories: ["finance", "education", "jobs", "government"],
    hindiKeywords: ["रेपो रेट", "पेट्रोल", "डीजल", "सोना", "रिजल्ट", "एडमिट कार्ड", "सरकारी नौकरी", "भर्ती", "परीक्षा"],
    romanKeywords: ["rbi", "upi", "repo", "neet", "jee", "cbse", "ssc", "upsc", "result", "admit card", "sarkari naukri"],
    preferredSourceFamilies: ["finance_official", "hindi_news", "search_demand", "national_news"],
    seedQueries: ["RBI repo rate", "NEET result", "सरकारी नौकरी", "पेट्रोल डीजल कीमत", "सोने की कीमत"],
    minimumCandidateTarget: 1,
    finalTop10Preference: 1,
  },
];

export function sourceFamilyFor(source: string, sourceType: SourceType): string {
  if (source === "ShareChat Daily Rhythm Calendar" || sourceType === "daily_rhythm") return "daily_rhythm";
  if (["GoodReturns Gold Rates", "GoodReturns Petrol Prices", "Economic Times Fuel Prices"].includes(source)) return "utility_rates";
  if (source === "PIB Hindi" || sourceType === "official_government") return "government_official";
  if (source === "RBI" || sourceType === "official_finance") return "finance_official";
  if (source === "IMD" || source === "SACHET" || sourceType === "weather" || sourceType === "public_safety") return "weather_safety";
  if (source === "Google Trends India" || sourceType === "search_demand") return "search_demand";
  if (sourceType === "hindi_news") return "hindi_news";
  if (sourceType === "national_news") return "national_news";
  if (sourceType === "video") return "video_entertainment";
  if (sourceType === "festival_calendar") return "festival_cultural";
  if (sourceType === "sports") return "sports_authority";
  if (sourceType === "social_experimental") return "social_experimental";
  return "unknown";
}

export function bucketForTextAndCategory(text: string, category: TrendCategory): InterestBucketId {
  const lower = text.toLowerCase();
  const categoryMatch = INTEREST_BUCKETS.find((bucket) => bucket.categories.includes(category) && bucketMatches(bucket, lower));
  if (categoryMatch) return categoryMatch.id;
  const keywordMatch = INTEREST_BUCKETS.find((bucket) => bucketMatches(bucket, lower));
  if (keywordMatch) return keywordMatch.id;
  const categoryOnly = INTEREST_BUCKETS.find((bucket) => bucket.categories.includes(category));
  return categoryOnly?.id ?? "memes_viral_emotion";
}

export function bucketForSignal(signal: RawSignal): InterestBucketId {
  return bucketForTextAndCategory(`${signal.rawTitle} ${signal.rawDescription ?? ""}`, signal.categoryHint ?? "viral");
}

export function bucketForTrend(trend: RankedTrend): InterestBucketId {
  if (trend.interestBucket) return trend.interestBucket as InterestBucketId;
  return bucketForTextAndCategory(`${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`, trend.category);
}

export function sourceFamilyMixForTrend(trend: RankedTrend): string[] {
  return [...new Set(trend.sources.map((source, index) => sourceFamilyFor(source, trend.sourceTypes[index] ?? trend.sourceTypes[0] ?? "hindi_news")))];
}

function bucketMatches(bucket: InterestBucket, lower: string): boolean {
  return [...bucket.hindiKeywords, ...bucket.romanKeywords].some((keyword) => lower.includes(keyword.toLowerCase()));
}
