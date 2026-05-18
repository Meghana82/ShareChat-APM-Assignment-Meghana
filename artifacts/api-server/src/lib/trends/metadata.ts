import { generateMetadataWithLlm } from "./llm";
import { toIndiaIsoString } from "./constants";
import { hasDevanagari, normalizeText } from "./normalize";
import { trendStageFor } from "./scoring";
import { buildHindiHashtag } from "./topic-extraction";
import type { LlmMetadataItem, RankedTrend, ScoredCluster, TrendCategory } from "./types";

export async function generateRankedTrends(clusters: ScoredCluster[], debug: boolean): Promise<RankedTrend[]> {
  const llmItems = await generateMetadataWithLlm(clusters).catch(() => null);
  const llmById = new Map((llmItems ?? []).map((item) => [item.clusterId, item]));
  const generatedAt = toIndiaIsoString();

  return clusters.map((cluster, index) => {
    const llm = llmById.get(cluster.id);
    const fallback = deterministicMetadata(cluster);
    const metadata = llm ? repairMetadata(llm, fallback) : fallback;
    const safetyStatus = cluster.signals.some((signal) => signal.safetyFlags.length > 0 || cluster.category === "politics") ? "review_required" : "safe";
    return {
      rank: index + 1,
      tag: metadata.tag,
      title: metadata.title,
      displayLabel: metadata.displayLabel,
      description: metadata.description,
      category: cluster.category,
      heatScore: cluster.inputScore,
      bharatRelevanceScore: cluster.indiaHindiRelevanceScore,
      sources: cluster.sourceNames,
      sourceTypes: cluster.sourceTypes,
      trendStage: trendStageFor(cluster.inputScore, cluster.lastSeenAt, cluster.category),
      whyTrending: metadata.whyTrending,
      sampleContent: metadata.sampleContent,
      safety: {
        status: safetyStatus,
        reasons: [...new Set(cluster.signals.flatMap((signal) => signal.safetyFlags))],
      },
      signalSummary: {
        externalValidationScore: cluster.scoringDebug.externalValidationScore,
        crossSourceCount: cluster.crossSourceCount,
        freshnessScore: cluster.scoringDebug.freshnessScore,
        reliabilityScore: cluster.scoringDebug.reliabilityScore,
        regionalRelevanceScore: cluster.scoringDebug.regionalRelevanceScore,
      },
      generatedAt,
      debug: debug
        ? {
            clusterId: cluster.id,
            aliases: cluster.aliases,
            scoring: cluster.scoringDebug,
            sourceFamilyMix: uniqueSignalSourceFamilies(cluster),
            signalCount: cluster.signals.length,
          }
        : undefined,
    };
  });
}

export function deterministicMetadata(cluster: ScoredCluster): LlmMetadataItem {
  const rawTitle = hindiTitleFor(cluster.canonicalTitle, cluster.category);
  const tag = buildHindiHashtag({ canonicalTitle: rawTitle, rawTitle: cluster.canonicalTitle, category: cluster.category, aliases: cluster.aliases });
  const title = titleForTag(tag, rawTitle, cluster.category);
  const sourceText = sourceSummary(cluster.sourceNames);
  return {
    clusterId: cluster.id,
    tag,
    title,
    displayLabel: displayLabelFor(tag, title, cluster.category),
    description: descriptionFor(title, cluster.category, tag),
    category: cluster.category,
    whyTrending: whyTrendingFor(title, cluster.category, sourceText),
    sampleContent: {
      type: "summary",
      text: sampleContentFor(title, cluster.category),
    },
  };
}

function repairMetadata(input: LlmMetadataItem, fallback: LlmMetadataItem): LlmMetadataItem {
  return {
    ...fallback,
    ...input,
    tag: input.tag?.startsWith("#") ? input.tag : fallback.tag,
    displayLabel: input.displayLabel || fallback.displayLabel,
    description: trimWords(input.description || fallback.description, 20),
    whyTrending: trimSentences(input.whyTrending || fallback.whyTrending, 2),
    sampleContent: input.sampleContent?.text
      ? { type: "summary", text: trimSentences(input.sampleContent.text, 2) }
      : fallback.sampleContent,
  };
}

export function makeHindiTag(title: string, category: TrendCategory): string {
  return buildHindiHashtag({ canonicalTitle: title, category });
}

function legacyMakeHindiTag(title: string, category: TrendCategory): string {
  const specialTag = specialHindiTag(title, category);
  if (specialTag) return specialTag;
  const cleaned = title
    .replace(/^#/, "")
    .replace(/भारत\s+ऑस्ट्रेलिया/i, "भारत बनाम ऑस्ट्रेलिया")
    .replace(/india\s+australia|ind\s+aus/i, "भारत बनाम ऑस्ट्रेलिया")
    .trim();
  const devanagariTitle = hasDevanagari(cleaned) ? cleaned : transliterateKnownTerms(cleaned, category);
  const words = devanagariTitle
    .replace(/[।,.!?;:()\[\]{}"'\-–—]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !TAG_STOPWORDS.has(word.toLowerCase()) && !/^\d+$/.test(word))
    .slice(0, 5);
  const tag = `#${words.join("_")}`.replace(/_+/g, "_");
  return tag.length > 3 ? tag : fallbackTag(category);
}

function displayLabelFor(tag: string, title: string, category: TrendCategory): string {
  if (tag === "#वाग्देवी_लंदन_म्यूजियम") return "🛕 वाग्देवी प्रतिमा को लेकर चर्चा";
  if (tag === "#पेट्रोल_डीजल_मूल्यवृद्धि") return "⛽ पेट्रोल-डीजल कीमतों पर चर्चा";
  if (tag === "#पेट्रोल_डीजल_कीमत") return "⛽ पेट्रोल-डीजल कीमतों पर नज़र";
  if (tag === "#सोने_की_कीमत" || tag === "#चांदी_का_भाव") return "💰 सोने-चांदी के भाव बदले";
  if (tag === "#LPG_सिलेंडर_रेट") return "🔥 LPG सिलेंडर रेट अपडेट";
  if (tag === "#CNG_रेट") return "⛽ CNG रेट अपडेट";
  if (tag === "#महंगाई_अपडेट") return "📈 महंगाई पर लोगों की चर्चा";
  if (tag === "#टमाटर_कीमत") return "🍅 टमाटर कीमत पर चर्चा";
  if (tag === "#KKR_बनाम_GT") return "🏏 KKR vs GT लाइव चर्चा";
  if (tag === "#सावन_सोमवार_भोलेनाथ") return "🙏 सावन सोमवार की तैयारी";
  if (tag === "#वट_सावित्री") return "🪔 वट सावित्री की शुभकामनाएं 🙏";
  if (tag === "#शनि_अमावस्या") return "🪔 शनि अमावस्या पर पूजा-पाठ";
  if (tag === "#NEET_पेपर_लीक") return "📚 NEET पेपर लीक अपडेट";
  if (tag === "#JEE_परीक्षा") return "📚 JEE परीक्षा अपडेट";
  if (tag === "#शुभ_रविवार") return "🌷 शुभ रविवार";
  if (tag === "#सुप्रभात_संदेश") return "🌞 सुप्रभात संदेश";
  if (tag === "#माँ_वैष्णो_देवी") return "🙏 माँ वैष्णो देवी";
  if (tag === "#हनुमान_भक्ति") return "🙏 हनुमान भक्ति";
  if (tag === "#भोलेनाथ_भक्ति") return "🙏 भोलेनाथ भक्ति";
  if (tag === "#सूर्यदेव_प्रणाम") return "🌞 सूर्यदेव प्रणाम";
  if (tag === "#विश्व_दूरसंचार_दिवस") return "📡 विश्व दूरसंचार दिवस 😊";
  if (tag === "#गर्मी_से_बचाव") return `${String.fromCodePoint(0x1f305)} गर्मी में धूप से बचने के उपाय 🥵🌞`;
  if (category === "sports") return `🏏 ${title} पर चर्चा`;
  if (category === "festival" || category === "devotional") return `🙏 ${title}`;
  if (category === "movies" || category === "music" || category === "entertainment") return `🎬 ${title}`;
  return title;
}

function titleForTag(tag: string, rawTitle: string, category: TrendCategory): string {
  const mapped: Record<string, string> = {
    "#वाग्देवी_लंदन_म्यूजियम": "वाग्देवी प्रतिमा पर चर्चा",
    "#पेट्रोल_डीजल_मूल्यवृद्धि": "पेट्रोल-डीजल मूल्यवृद्धि",
    "#पेट्रोल_डीजल_कीमत": "पेट्रोल-डीजल कीमत",
    "#सोने_की_कीमत": "सोने-चांदी के भाव",
    "#चांदी_का_भाव": "चांदी का भाव",
    "#LPG_सिलेंडर_रेट": "LPG सिलेंडर रेट",
    "#CNG_रेट": "CNG रेट",
    "#महंगाई_अपडेट": "महंगाई अपडेट",
    "#टमाटर_कीमत": "टमाटर कीमत",
    "#KKR_बनाम_GT": "KKR बनाम GT",
    "#सावन_सोमवार_भोलेनाथ": "सावन सोमवार भोलेनाथ",
    "#वट_सावित्री": "वट सावित्री",
    "#शनि_अमावस्या": "शनि अमावस्या",
    "#NEET_पेपर_लीक": "NEET पेपर लीक",
    "#JEE_परीक्षा": "JEE परीक्षा",
    "#शुभ_रविवार": "शुभ रविवार",
    "#सुप्रभात_संदेश": "सुप्रभात संदेश",
    "#माँ_वैष्णो_देवी": "माँ वैष्णो देवी",
    "#हनुमान_भक्ति": "हनुमान भक्ति",
    "#भोलेनाथ_भक्ति": "भोलेनाथ भक्ति",
    "#सूर्यदेव_प्रणाम": "सूर्यदेव प्रणाम",
    "#विश्व_दूरसंचार_दिवस": "विश्व दूरसंचार दिवस",
    "#गर्मी_से_बचाव": "गर्मी से बचाव",
  };
  if (mapped[tag]) return mapped[tag];
  const clean = rawTitle.replace(/[:|].*$/, "").replace(/\s+/g, " ").trim();
  if (clean.length <= 42) return clean;
  const tagWords = tag
    .replace(/^#/, "")
    .split("_")
    .filter(Boolean)
    .slice(0, category === "sports" ? 4 : 3)
    .join(" ");
  return tagWords || clean.slice(0, 42).trim();
}

function specialHindiTag(title: string, category: TrendCategory): string | null {
  const text = normalizeText(title).toLowerCase();
  const raw = title.toLowerCase();
  if ((text.includes("वाग्देवी") || text.includes("सरस्वती") || raw.includes("vagdevi") || raw.includes("saraswati")) && (text.includes("लंदन") || text.includes("म्यूजियम") || raw.includes("london") || raw.includes("museum"))) {
    return "#वाग्देवी_लंदन_म्यूजियम";
  }
  if ((text.includes("पेट्रोल") || text.includes("डीजल") || raw.includes("petrol") || raw.includes("diesel")) && (text.includes("कीमत") || text.includes("दाम") || text.includes("मूल्य") || raw.includes("price"))) {
    return "#पेट्रोल_डीजल_मूल्यवृद्धि";
  }
  if ((text.includes("सावन") || raw.includes("sawan")) && (text.includes("सोमवार") || text.includes("भोलेनाथ") || raw.includes("somwar") || raw.includes("shiv"))) {
    return "#सावन_सोमवार_भोलेनाथ";
  }
  if (category === "sports") {
    const teams: Array<[RegExp, string]> = [
      [/(^|\W)(kkr|kolkata knight riders)(\W|$)/i, "KKR"],
      [/(^|\W)(gt|gujarat titans)(\W|$)/i, "GT"],
      [/(^|\W)(rcb|royal challengers)(\W|$)/i, "RCB"],
      [/(^|\W)(csk|chennai super kings)(\W|$)/i, "CSK"],
      [/(^|\W)(mi|mumbai indians)(\W|$)/i, "MI"],
      [/(^|\W)(srh|sunrisers)(\W|$)/i, "SRH"],
      [/(^|\W)(dc|delhi capitals)(\W|$)/i, "DC"],
      [/(^|\W)(rr|rajasthan royals)(\W|$)/i, "RR"],
    ];
    const matched = teams.filter(([regex]) => regex.test(title)).map(([, label]) => label);
    if (matched.length >= 2) return `#${matched[0]}_बनाम_${matched[1]}`;
  }
  return null;
}

function hindiTitleFor(raw: string, category: TrendCategory): string {
  if (hasDevanagari(raw)) return cleanTitle(raw);
  return cleanTitle(transliterateKnownTerms(raw, category));
}

function cleanTitle(title: string): string {
  return title.replace(/^#/, "").replace(/\s+/g, " ").trim().slice(0, 70);
}

function transliterateKnownTerms(raw: string, category: TrendCategory): string {
  const text = normalizeText(raw).toLowerCase();
  if ((text.includes("ind") || text.includes("india")) && (text.includes("aus") || text.includes("australia"))) return "भारत बनाम ऑस्ट्रेलिया";
  if (text.includes("ipl")) return "IPL क्रिकेट";
  if (text.includes("rbi")) return "RBI अपडेट";
  if (text.includes("upi")) return "UPI अपडेट";
  if (text.includes("neet")) return "NEET परीक्षा";
  if (text.includes("jee")) return "JEE परीक्षा";
  if (text.includes("weather") || text.includes("rain")) return "मौसम अपडेट";
  if (text.includes("diwali")) return "दिवाली";
  if (text.includes("holi")) return "होली";
  if (text.includes("chhath")) return "छठ पूजा";
  if (text.includes("navratri")) return "नवरात्रि";
  if (text.includes("bollywood")) return "बॉलीवुड चर्चा";
  if (text.includes("bhojpuri")) return "भोजपुरी ट्रेंड";
  const categoryTitle: Record<TrendCategory, string> = {
    sports: "खेल चर्चा",
    news: "आज की खबर",
    entertainment: "मनोरंजन चर्चा",
    finance: "वित्त अपडेट",
    weather: "मौसम अपडेट",
    politics: "राजनीतिक चर्चा",
    devotional: "भक्ति चर्चा",
    festival: "त्योहार चर्चा",
    education: "परीक्षा अपडेट",
    jobs: "सरकारी नौकरी",
    viral: "वायरल ट्रेंड",
    public_safety: "सुरक्षा अपडेट",
    government: "सरकारी अपडेट",
    technology: "टेक अपडेट",
    local: "लोकल खबर",
    movies: "फिल्म चर्चा",
    music: "गाना ट्रेंड",
  };
  return categoryTitle[category];
}

function descriptionFor(title: string, category: TrendCategory, knownTag?: string): string {
  const tag = knownTag ?? buildHindiHashtag({ canonicalTitle: title, category });
  if (tag === "#वाग्देवी_लंदन_म्यूजियम") return "लंदन म्यूजियम में रखी वाग्देवी प्रतिमा पर भारत में चर्चा बढ़ रही है।";
  if (tag === "#पेट्रोल_डीजल_मूल्यवृद्धि") return "ईंधन कीमतों को लेकर खबरें और प्रतिक्रियाएं बढ़ रही हैं।";
  if (tag === "#पेट्रोल_डीजल_कीमत") return "पेट्रोल-डीजल कीमतों पर शहरों में लोगों की नज़र बनी हुई है।";
  if (tag === "#सोने_की_कीमत" || tag === "#चांदी_का_भाव") return "सोने-चांदी के भाव में बदलाव को लेकर लोग रेट चेक कर रहे हैं।";
  if (tag === "#LPG_सिलेंडर_रेट") return "LPG सिलेंडर रेट को लेकर घरों में खर्च की चर्चा बढ़ रही है।";
  if (tag === "#CNG_रेट") return "CNG रेट को लेकर गाड़ी चलाने वालों की नज़र बनी हुई है।";
  if (tag === "#महंगाई_अपडेट") return "महंगाई और रोज़मर्रा के खर्चों पर चर्चा बढ़ रही है।";
  if (tag === "#टमाटर_कीमत") return "टमाटर और सब्ज़ियों की कीमतों पर लोग बात कर रहे हैं।";
  if (tag === "#KKR_बनाम_GT") return "KKR और GT के मुकाबले को लेकर फैंस की लाइव चर्चा तेज़ है।";
  if (tag === "#सावन_सोमवार_भोलेनाथ") return "भोलेनाथ भक्ति, पूजा और शुभकामना पोस्ट पर चर्चा बढ़ रही है।";
  if (tag === "#वट_सावित्री") return "वट सावित्री व्रत, पूजा और शुभकामनाओं पर चर्चा बढ़ रही है।";
  if (tag === "#शनि_अमावस्या") return "शनिदेव पूजा, अमावस्या और उपायों पर भक्तों की चर्चा बढ़ रही है।";
  if (tag === "#NEET_पेपर_लीक") return "NEET पेपर लीक से जुड़े अपडेट छात्रों और अभिभावकों में चर्चा में हैं।";
  if (tag === "#JEE_परीक्षा") return "JEE परीक्षा से जुड़े अपडेट छात्रों और अभिभावकों में चर्चा में हैं।";
  if (tag === "#शुभ_रविवार") return "रविवार की शुभकामनाएं और पॉजिटिव स्टेटस पोस्ट शेयर हो रहे हैं।";
  if (tag === "#सुप्रभात_संदेश") return "सुबह-सुबह सुप्रभात और पॉजिटिव स्टेटस पोस्ट शेयर हो रहे हैं।";
  if (tag === "#माँ_वैष्णो_देवी") return "माँ वैष्णो देवी भक्ति और जय माता दी पोस्ट शेयर हो रहे हैं।";
  if (tag === "#हनुमान_भक्ति") return "हनुमान भक्ति, चालीसा और आशीर्वाद पोस्ट शेयर हो रहे हैं।";
  if (tag === "#भोलेनाथ_भक्ति") return "भोलेनाथ भक्ति और हर हर महादेव पोस्ट शेयर हो रहे हैं।";
  if (tag === "#सूर्यदेव_प्रणाम") return "सूर्यदेव प्रणाम और सकारात्मक सुबह के स्टेटस शेयर हो रहे हैं।";
  if (tag === "#विश्व_दूरसंचार_दिवस") return "आज दूरसंचार दिवस पर जानकारी और शुभकामना पोस्ट शेयर हो रहे हैं।";
  if (tag === "#गर्मी_से_बचाव") return "गर्मी और धूप से बचने के आसान उपाय लोग शेयर कर रहे हैं।";
  switch (category) {
    case "sports":
      return `${title} को लेकर फैंस के बीच तेज चर्चा चल रही है।`;
    case "weather":
    case "public_safety":
      return `${title} से जुड़ी जानकारी लोगों के लिए उपयोगी है।`;
    case "finance":
      return `${title} से जुड़े अपडेट बैंकिंग और पैसों पर असर डाल सकते हैं।`;
    case "government":
      return `${title} पर सरकारी और समाचार स्रोतों से अपडेट आ रहे हैं।`;
    case "festival":
    case "devotional":
      return `${title} को लेकर पूजा, तैयारी और शुभकामनाओं की चर्चा है।`;
    case "education":
    case "jobs":
      return `${title} से जुड़े अपडेट छात्रों और युवाओं के लिए अहम हैं।`;
    default:
      return `${title} आज भारत में चर्चा में है।`;
  }
}

function whyTrendingFor(title: string, category: TrendCategory, sources: string): string {
  if (["शुभ रविवार", "सुप्रभात संदेश", "माँ वैष्णो देवी", "हनुमान भक्ति", "भोलेनाथ भक्ति", "सूर्यदेव प्रणाम", "विश्व दूरसंचार दिवस", "गर्मी से बचाव"].includes(title)) {
    return `${title} से जुड़े स्टेटस, शुभकामना और शेयर करने लायक पोस्ट आज ज्यादा प्रासंगिक हैं।`;
  }
  if (category === "weather" || category === "public_safety") return `${sources} से ${title} पर नए संकेत मिले हैं। लोग ताजा जानकारी देख रहे हैं।`;
  if (category === "festival" || category === "devotional") return `${title} से जुड़ी तैयारी, भक्ति और शुभकामना पोस्ट बढ़ रही हैं।`;
  return `${sources} जैसे स्रोतों में इस विषय पर संकेत बढ़ रहे हैं। इसलिए यह ट्रेंड ऊपर आ रहा है।`;
}

function sampleContentFor(title: string, category: TrendCategory): string {
  if (title === "शुभ रविवार") return "लोग शुभ रविवार, सुप्रभात और पॉजिटिव स्टेटस पोस्ट शेयर कर रहे हैं।";
  if (title === "माँ वैष्णो देवी") return "लोग जय माता दी, भक्ति और आशीर्वाद से जुड़े स्टेटस शेयर कर रहे हैं।";
  if (title === "हनुमान भक्ति") return "लोग हनुमान चालीसा, भक्ति और आशीर्वाद पोस्ट शेयर कर रहे हैं।";
  if (title === "भोलेनाथ भक्ति") return "लोग हर हर महादेव और भोलेनाथ भक्ति स्टेटस शेयर कर रहे हैं।";
  if (title === "सूर्यदेव प्रणाम") return "लोग सूर्यदेव प्रणाम और सकारात्मक सुबह के स्टेटस शेयर कर रहे हैं।";
  if (title === "विश्व दूरसंचार दिवस") return "लोग दूरसंचार दिवस से जुड़ी जानकारी, शुभकामनाएं और जागरूकता पोस्ट शेयर कर रहे हैं।";
  if (title === "गर्मी से बचाव") return "लोग धूप, लू और गर्मी से बचने के आसान उपाय शेयर कर रहे हैं।";
  if (category === "sports") return `फैंस ${title} से जुड़े खिलाड़ियों, मोमेंट्स और मैच चर्चा पर पोस्ट कर रहे हैं।`;
  if (category === "festival" || category === "devotional") return `लोग ${title} से जुड़े गीत, पूजा-विधि, शुभकामनाएं और वीडियो शेयर कर रहे हैं।`;
  if (category === "weather" || category === "public_safety") return `यूजर्स ${title} से जुड़ी सावधानी, स्थानीय अपडेट और आधिकारिक जानकारी देख रहे हैं।`;
  return `लोग ${title} पर खबरें, राय और छोटे वीडियो के जरिए चर्चा कर रहे हैं।`;
}

function sourceSummary(sources: string[]): string {
  if (sources.length === 0) return "बाहरी स्रोतों";
  return sources.slice(0, 3).join(", ");
}

function uniqueSignalSourceFamilies(cluster: ScoredCluster): string[] {
  return [...new Set(cluster.signals.map((signal) => `${signal.source}:${signal.sourceType}`))];
}

function fallbackTag(category: TrendCategory): string {
  return makeHindiTag(transliterateKnownTerms("", category), category);
}

const TAG_STOPWORDS = new Set([
  "की",
  "के",
  "का",
  "में",
  "से",
  "पर",
  "और",
  "है",
  "हैं",
  "को",
  "ने",
  "तक",
  "लिए",
  "साल",
  "आज",
  "ताजा",
  "खबर",
  "the",
  "and",
  "for",
  "with",
  "latest",
  "news",
]);

function trimWords(input: string, maxWords: number): string {
  const words = input.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? input : `${words.slice(0, maxWords).join(" ")}।`;
}

function trimSentences(input: string, maxSentences: number): string {
  const sentences = input.split(/(?<=[।.!?])\s+/).filter(Boolean);
  return sentences.slice(0, maxSentences).join(" ").trim();
}
