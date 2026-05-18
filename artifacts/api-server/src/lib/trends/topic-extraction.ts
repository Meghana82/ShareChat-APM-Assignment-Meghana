import type { TrendCategory } from "./types";

export interface HindiHashtagInput {
  canonicalTitle: string;
  rawTitle?: string;
  category: TrendCategory;
  aliases?: string[];
}

const ACRONYM_ALLOWLIST = new Set([
  "IPL",
  "RBI",
  "UPI",
  "NEET",
  "JEE",
  "CBSE",
  "NTA",
  "IMD",
  "KKR",
  "GT",
  "CSK",
  "MI",
  "RCB",
  "DC",
  "RR",
  "SRH",
  "PBKS",
  "LSG",
  "IND",
  "AUS",
  "WPL",
  "ODI",
  "T20",
]);

const LOW_VALUE_WORDS = new Set([
  "सालों",
  "साल",
  "से",
  "में",
  "है",
  "हैं",
  "हुई",
  "हुआ",
  "हुए",
  "बोले",
  "कहा",
  "बताया",
  "बड़ी",
  "बड़ा",
  "खुलासा",
  "अपडेट",
  "लाइव",
  "खबर",
  "आज",
  "तक",
  "पर",
  "को",
  "का",
  "की",
  "के",
  "और",
  "या",
  "लिए",
  "होने",
  "वाली",
  "वाले",
  "होगा",
  "the",
  "and",
  "for",
  "with",
  "from",
  "live",
  "score",
  "latest",
  "news",
  "update",
  "today",
]);

export function buildHindiHashtag(input: HindiHashtagInput | string): string {
  const normalizedInput = typeof input === "string" ? { canonicalTitle: input, category: "viral" as TrendCategory } : input;
  const mapped = phraseMapping(normalizedInput)?.tag;
  if (mapped) return mapped;

  const corpus = corpusFor(normalizedInput).normalize("NFC");
  const safe = corpus
    // Keep full Devanagari block, Roman acronyms, numbers, spaces, underscores. This preserves matras/halant.
    .replace(/[^\u0900-\u097FA-Za-z0-9_\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = safe
    .split(/\s+/)
    .map(normalizeTagToken)
    .filter(Boolean)
    .filter((token) => !LOW_VALUE_WORDS.has(token.toLowerCase()))
    .filter((token) => !/^\d+$/.test(token))
    .filter((token, index, arr) => arr.findIndex((item) => item.toLowerCase() === token.toLowerCase()) === index)
    .slice(0, 4);

  if (shouldUseHindiFallback(normalizedInput.category, tokens)) return fallbackTagFor(normalizedInput.category);
  if (tokens.length > 0) return `#${tokens.join("_")}`;
  return fallbackTagFor(normalizedInput.category);
}

export function getTopicMappingKey(input: Pick<HindiHashtagInput, "canonicalTitle" | "rawTitle" | "aliases" | "category">): string | null {
  return phraseMapping(input)?.key ?? null;
}

export function extractMeaningfulTopicTokens(text: string): string[] {
  const safe = text
    .normalize("NFC")
    .replace(/[^\u0900-\u097FA-Za-z0-9_\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safe
    .split(/\s+/)
    .map(normalizeTagToken)
    .filter(Boolean)
    .filter((token) => !LOW_VALUE_WORDS.has(token.toLowerCase()))
    .filter((token) => token.replace(/^#/, "").length > 1)
    .filter((token, index, arr) => arr.findIndex((item) => item.toLowerCase() === token.toLowerCase()) === index);
}

function phraseMapping(input: Pick<HindiHashtagInput, "canonicalTitle" | "rawTitle" | "aliases" | "category">): { key: string; tag: string } | null {
  const text = corpusFor(input).toLowerCase().normalize("NFC");
  const has = (...terms: string[]) => terms.some((term) => text.includes(term.toLowerCase()));
  const hasAll = (...groups: string[][]) => groups.every((group) => group.some((term) => text.includes(term.toLowerCase())));

  if (hasAll(["वाग्देवी", "सरस्वती", "vagdevi", "saraswati"], ["लंदन", "म्यूजियम", "museum", "london"])) {
    return { key: "vagdevi_london_museum", tag: "#वाग्देवी_लंदन_म्यूजियम" };
  }
  if (hasAll(["पेट्रोल", "petrol"], ["डीजल", "diesel"], ["कीमत", "कीमतों", "दाम", "मूल्य", "वृद्धि", "बढ़ोतरी", "price", "prices", "hike"])) {
    if (has("वृद्धि", "बढ़ोतरी", "hike")) return { key: "petrol_diesel_hike", tag: "#पेट्रोल_डीजल_मूल्यवृद्धि" };
    return { key: "petrol_diesel_price", tag: "#पेट्रोल_डीजल_कीमत" };
  }
  if (hasAll(["सोना", "सोने", "gold"], ["कीमत", "भाव", "रेट", "price", "rate"])) return { key: "gold_price", tag: "#सोने_की_कीमत" };
  if (hasAll(["चांदी", "silver"], ["कीमत", "भाव", "रेट", "price", "rate"])) return { key: "silver_price", tag: "#चांदी_का_भाव" };
  if (hasAll(["lpg", "एलपीजी"], ["सिलेंडर", "cylinder", "कीमत", "रेट", "price"])) return { key: "lpg_cylinder_rate", tag: "#LPG_सिलेंडर_रेट" };
  if (hasAll(["cng", "सीएनजी"], ["कीमत", "रेट", "price", "rate"])) return { key: "cng_rate", tag: "#CNG_रेट" };
  if (has("महंगाई", "inflation", "mehngai")) return { key: "inflation_update", tag: "#महंगाई_अपडेट" };
  if (hasAll(["टमाटर", "tomato"], ["कीमत", "भाव", "रेट", "price"])) return { key: "tomato_price", tag: "#टमाटर_कीमत" };
  if (hasAll(["neet"], ["पेपर", "paper"], ["लीक", "leak"])) return { key: "neet_paper_leak", tag: "#NEET_पेपर_लीक" };
  if (has("jeecup") || hasAll(["jee"], ["परीक्षा", "exam", "admit", "result"])) return { key: "jee_exam", tag: "#JEE_परीक्षा" };
  if (has("kkr") && has("gt")) return { key: "kkr_gt", tag: "#KKR_बनाम_GT" };
  if (hasAll(["सावन", "sawan"], ["सोमवार", "somwar", "भोलेनाथ", "shiv"])) return { key: "sawan_somwar", tag: "#सावन_सोमवार_भोलेनाथ" };
  if (hasAll(["शनि", "shani"], ["अमावस्या", "amavasya"])) return { key: "shani_amavasya", tag: "#शनि_अमावस्या" };
  if (hasAll(["शुभ", "रविवार"]) || has("sunday wishes")) return { key: "shubh_ravivar", tag: "#शुभ_रविवार" };
  if (has("सुप्रभात", "good morning")) return { key: "suprabhat", tag: "#सुप्रभात_संदेश" };
  if (hasAll(["माँ", "वैष्णो"]) || has("vaishno devi", "जय माता दी")) return { key: "maa_vaishno_devi", tag: "#माँ_वैष्णो_देवी" };
  if (has("हनुमान भक्ति", "hanuman bhakti", "जय बजरंगबली")) return { key: "hanuman_bhakti", tag: "#हनुमान_भक्ति" };
  if (has("भोलेनाथ भक्ति", "bholenath bhakti", "हर हर महादेव")) return { key: "bholenath_bhakti", tag: "#भोलेनाथ_भक्ति" };
  if (has("सूर्यदेव", "surya dev", "सूर्यदेव प्रणाम")) return { key: "suryadev_pranam", tag: "#सूर्यदेव_प्रणाम" };
  if (has("विश्व दूरसंचार दिवस", "world telecommunication day")) return { key: "world_telecom_day", tag: "#विश्व_दूरसंचार_दिवस" };
  if (hasAll(["गर्मी"], ["बचाव"]) || has("heat tips", "धूप से बचाव")) return { key: "heat_safety", tag: "#गर्मी_से_बचाव" };
  if (hasAll(["rbi"], ["रेपो", "repo"])) return { key: "rbi_repo_rate", tag: "#RBI_रेपो_रेट" };
  if (hasAll(["मुंबई", "mumbai"], ["बारिश", "rain"])) return { key: "mumbai_rain", tag: "#मुंबई_बारिश" };
  if (hasAll(["सोना", "सोने", "gold"], ["कीमत", "दाम", "price"], ["गिरावट", "सस्ता", "fall", "down"])) return { key: "gold_price_fall", tag: "#सोने_कीमत_गिरावट" };
  if (hasAll(["ट्रेन", "train"], ["बस", "bus"], ["टक्कर", "हादसा", "accident", "collision"])) return { key: "train_bus_accident", tag: "#ट्रेन_बस_हादसा" };
  if (hasAll(["वट", "vat"], ["सावित्री", "savitri"])) return { key: "vat_savitri", tag: "#वट_सावित्री" };
  return null;
}

function corpusFor(input: Pick<HindiHashtagInput, "canonicalTitle" | "rawTitle" | "aliases">): string {
  return [input.canonicalTitle, input.rawTitle, ...(input.aliases ?? [])].filter(Boolean).join(" ");
}

function normalizeTagToken(token: string): string {
  const nfc = token.normalize("NFC").replace(/^#+/, "").trim();
  const upper = nfc.toUpperCase();
  if (ACRONYM_ALLOWLIST.has(upper)) return upper;
  return nfc;
}

function shouldUseHindiFallback(category: TrendCategory, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const hasDevanagari = tokens.some((token) => /[\u0900-\u097F]/.test(token));
  const hasAllowedAcronym = tokens.some((token) => ACRONYM_ALLOWLIST.has(token.toUpperCase()));
  const officialNeutral = ["finance", "government", "weather", "public_safety", "technology"].includes(category);
  return officialNeutral && !hasDevanagari && !hasAllowedAcronym;
}

function fallbackTagFor(category: TrendCategory): string {
  const fallback: Record<TrendCategory, string> = {
    sports: "#खेल_चर्चा",
    news: "#आज_की_खबर",
    entertainment: "#मनोरंजन_चर्चा",
    finance: "#वित्त_अपडेट",
    weather: "#मौसम_अपडेट",
    politics: "#राजनीतिक_चर्चा",
    devotional: "#भक्ति_चर्चा",
    festival: "#त्योहार_चर्चा",
    education: "#परीक्षा_अपडेट",
    jobs: "#सरकारी_नौकरी",
    viral: "#वायरल_ट्रेंड",
    public_safety: "#सुरक्षा_अपडेट",
    government: "#सरकारी_अपडेट",
    technology: "#टेक_अपडेट",
    local: "#लोकल_खबर",
    movies: "#फिल्म_चर्चा",
    music: "#गाना_ट्रेंड",
  };
  return fallback[category];
}
