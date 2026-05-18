import type { RankedTrend, RawSignal, SourceType, TrendCategory } from "./types";

type CanonicalTopic = Pick<RankedTrend, "tag" | "title" | "displayLabel" | "description" | "category" | "safety" | "interestBucket" | "whyTrending" | "sampleContent">;

export function canonicalizeLiveTopic(trend: RankedTrend): RankedTrend | null {
  const topic = detectCanonicalTopic(`${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`);
  if (!topic) return null;
  return {
    ...trend,
    ...topic,
    heatScore: Math.max(trend.heatScore, topic.safety.status === "limited" ? 62 : 58),
    bharatRelevanceScore: Math.max(trend.bharatRelevanceScore, 80),
    signalSummary: {
      ...trend.signalSummary,
      externalValidationScore: Math.max(trend.signalSummary.externalValidationScore, topic.safety.status === "limited" ? 45 : 40),
      regionalRelevanceScore: Math.max(trend.signalSummary.regionalRelevanceScore, 80),
    },
    debug: { ...(trend.debug ?? {}), canonicalizedLiveTopic: true },
  };
}

export function canonicalizeSignalToTrend(signal: RawSignal, generatedAt: string): RankedTrend | null {
  const topic = detectCanonicalTopic(`${signal.rawTitle} ${signal.rawDescription ?? ""}`);
  if (!topic) return null;
  const heatScore = topic.safety.status === "limited" ? 64 : 60;
  return {
    rank: 0,
    ...topic,
    heatScore,
    bharatRelevanceScore: 82,
    sources: [signal.source],
    sourceTypes: [signal.sourceType],
    trendStage: heatScore >= 70 ? "rising" : "emerging",
    signalSummary: {
      externalValidationScore: Math.max(45, Math.round(signal.reliabilityWeight * 80)),
      crossSourceCount: 1,
      freshnessScore: 80,
      reliabilityScore: Math.max(55, Math.round(signal.reliabilityWeight * 100)),
      regionalRelevanceScore: 82,
    },
    generatedAt,
    debug: { canonicalizedLiveSignal: true },
  };
}

function detectCanonicalTopic(input: string): CanonicalTopic | null {
  const text = input.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  if (hasDiseasePublicHealth(text, lower)) {
    const specific = specificDiseaseTopic(text);
    if (!specific) return null;
    const { title, tag, fallbackHeadline } = specific;
    const headline = text.includes(tag) ? fallbackHeadline : firstHeadline(text, title);
    return {
      tag,
      title,
      displayLabel: `🦠 ${headline} 😢`,
      description: `${title} से जुड़ी खबर पर लोग अपडेट देख रहे हैं।`,
      category: "public_safety",
      interestBucket: "weather_local_public_safety",
      safety: { status: "limited", reasons: ["factual public-health/death report"] },
      whyTrending: `${title} से जुड़ा अपडेट स्रोतों में दिख रहा है; इसे तथ्यात्मक संदर्भ में सीमित रूप से दिखाया गया है।`,
      sampleContent: { type: "summary", text: `${title} पर लोग ताजा जानकारी और सावधानी से जुड़े अपडेट देख रहे हैं।` },
    };
  }

  if (hasRoadAccidentCasualty(text, lower)) {
    const headline = text.includes("#सड़क_हादसा") ? roadAccidentFallbackHeadline(text) : firstHeadline(text, roadAccidentFallbackHeadline(text));
    return {
      tag: "#सड़क_हादसा",
      title: "सड़क हादसा",
      displayLabel: `😲 ${headline} 😨`,
      description: "सड़क हादसे से जुड़ी खबर पर लोग ताजा अपडेट देख रहे हैं।",
      category: "public_safety",
      interestBucket: "weather_local_public_safety",
      safety: { status: "limited", reasons: ["factual road-accident/death report"] },
      whyTrending: "सड़क हादसे से जुड़ा अपडेट स्रोतों में दिख रहा है; इसे तथ्यात्मक संदर्भ में सीमित रूप से दिखाया गया है।",
      sampleContent: { type: "summary", text: "लोग सड़क हादसे से जुड़ी जगह, सुरक्षा और ताजा अपडेट देख रहे हैं।" },
    };
  }

  if (hasTrainFireAccident(text, lower)) {
    const isRajdhani = /राजधानी|rajdhani/i.test(text);
    const title = isRajdhani ? "राजधानी एक्सप्रेस आग" : "ट्रेन आग अपडेट";
    const tag = isRajdhani ? "#राजधानी_एक्सप्रेस_आग" : "#ट्रेन_आग";
    const headline = text.includes(tag) ? (isRajdhani ? "राजधानी एक्सप्रेस में लगी भीषण आग" : title) : firstHeadline(text, title);
    return {
      tag,
      title,
      displayLabel: `🚆 ${headline} 🔥`,
      description: `${title} की खबर पर लोग अपडेट देख रहे हैं।`,
      category: "public_safety",
      interestBucket: "weather_local_public_safety",
      safety: { status: "limited", reasons: ["factual accident/fire report"] },
      whyTrending: `${title} से जुड़ा अपडेट स्रोतों में दिख रहा है; इसे तथ्यात्मक संदर्भ में सीमित रूप से दिखाया गया है।`,
      sampleContent: { type: "summary", text: `${title} पर लोग रूट, सुरक्षा और ताजा अपडेट देख रहे हैं।` },
    };
  }

  if (hasDelhiRajasthanT20(text, lower)) {
    return {
      tag: "#दिल्ली_बनाम_राजस्थान",
      title: "दिल्ली बनाम राजस्थान",
      displayLabel: "🏏 T20 लीग: दिल्ली vs राजस्थान 👊",
      description: "T20 लीग में दिल्ली और राजस्थान के मुकाबले पर फैंस की चर्चा तेज़ है।",
      category: "sports",
      interestBucket: "cricket_ipl_sports",
      safety: { status: "safe", reasons: [] },
      whyTrending: "दिल्ली और राजस्थान के T20 मुकाबले को लेकर मैच अपडेट, फैन रिएक्शन और स्कोर चर्चा बढ़ रही है।",
      sampleContent: { type: "summary", text: "फैंस दिल्ली बनाम राजस्थान मैच, स्कोर और खिलाड़ियों के मोमेंट्स पर पोस्ट कर रहे हैं।" },
    };
  }

  if (hasUtilityPriceSpike(text, lower)) {
    const isCng = /\bCNG\b|सीएनजी/i.test(text);
    const title = isCng ? "CNG कीमत" : utilityTitle(text);
    const tag = isCng ? "#CNG_कीमत" : utilityTag(title);
    const headline = text.includes(tag) ? (isCng ? "CNG की कीमतों में लगी आग" : title) : firstHeadline(text, title);
    const presentation = utilityPresentation(title, headline);
    return {
      tag,
      title,
      displayLabel: presentation.displayLabel,
      description: presentation.description,
      category: "finance",
      interestBucket: "utility_bazaar_prices",
      safety: { status: "safe", reasons: [] },
      whyTrending: presentation.whyTrending,
      sampleContent: { type: "summary", text: presentation.sampleContent },
    };
  }

  if (hasEducationMinisterResignationDemand(text, lower)) {
    return {
      tag: "#राहुल_शिक्षा_मंत्री",
      title: "शिक्षा मंत्री इस्तीफा मांग",
      displayLabel: "📢 राहुल ने की शिक्षा मंत्री के इस्तीफे की मांग",
      description: "राहुल की शिक्षा मंत्री से इस्तीफे की मांग पर राजनीतिक चर्चा बढ़ रही है।",
      category: "politics",
      interestBucket: "modi_national_news",
      safety: { status: "safe", reasons: [] },
      whyTrending: "राहुल और शिक्षा मंत्री से जुड़ी इस्तीफे की मांग समाचार स्रोतों और राजनीतिक चर्चा में दिख रही है।",
      sampleContent: { type: "summary", text: "लोग शिक्षा मंत्री, राहुल के बयान और राजनीतिक प्रतिक्रिया पर पोस्ट शेयर कर रहे हैं।" },
    };
  }

  if (hasCelebrityPoliticsCrossover(text, lower)) {
    const kamal = /कमल[\s_]*हासन|kamal[\s_]*haasan/i.test(text);
    const vijay = /CM[\s_]*विजय|cm[\s_]*vijay|सीएम[\s_]*विजय|विजय/i.test(text);
    const title = kamal && vijay ? "कमल हासन और CM विजय मुलाकात" : "सेलेब्रिटी राजनीति मुलाकात";
    const tag = kamal && vijay ? "#कमल_हासन_CM_विजय" : "#सेलेब्रिटी_राजनीति";
    const headline = text.includes(tag) ? (kamal && vijay ? "CM विजय से मिले कमल हासन" : title) : firstHeadline(text, title);
    return {
      tag,
      title,
      displayLabel: `📢 ${headline} 🤝`,
      description: kamal && vijay ? "यह मुलाकात मनोरंजन और राजनीति दोनों दर्शकों में चर्चा में है।" : `${title} चर्चा में है।`,
      category: "entertainment",
      interestBucket: "bollywood_gossip_entertainment",
      safety: { status: "safe", reasons: [] },
      whyTrending: `${title} पर मनोरंजन और राजनीति दोनों दर्शकों में चर्चा दिख रही है।`,
      sampleContent: { type: "summary", text: `${title} पर लोग पोस्ट, राय और अपडेट शेयर कर रहे हैं।` },
    };
  }

  return null;
}

function hasDiseasePublicHealth(text: string, lower: string): boolean {
  return /(इबोला|वायरस|प्रकोप|बुखार|कोविड|ebola|virus|outbreak|flu|fever|covid|corona|कोरोना)/i.test(text)
    && /(इबोला|वायरस|virus|outbreak|कोविड|flu|बुखार|covid|corona|कोरोना)/i.test(lower);
}

function specificDiseaseTopic(text: string): { title: string; tag: string; fallbackHeadline: string } | null {
  if (/इबोला|ebola/i.test(text)) return { title: "इबोला वायरस", tag: "#इबोला_वायरस", fallbackHeadline: "इबोला वायरस से जुड़ी खबर" };
  if (/कोविड|covid|corona|कोरोना/i.test(text)) return { title: "कोविड अपडेट", tag: "#कोविड_अपडेट", fallbackHeadline: "कोविड से जुड़ी खबर" };
  if (/flu|फ्लू/i.test(text)) return { title: "फ्लू अपडेट", tag: "#फ्लू_अपडेट", fallbackHeadline: "फ्लू से जुड़ी खबर" };
  if (/बुखार|fever/i.test(text)) return { title: "बुखार अलर्ट", tag: "#बुखार_अलर्ट", fallbackHeadline: "बुखार से जुड़ी स्वास्थ्य खबर" };
  return null;
}

function hasTrainFireAccident(text: string, lower: string): boolean {
  return /(ट्रेन|एक्सप्रेस|राजधानी|train|express|rail)/i.test(text) && /(आग|हादसा|टक्कर|दुर्घटना|fire|accident|collision)/i.test(lower);
}

function hasRoadAccidentCasualty(text: string, lower: string): boolean {
  return /(सड़क|रोड|बस|कार|ट्रक|बाइक|वाहन|road|bus|car|truck|bike|vehicle)/i.test(text)
    && /(हादस|दुर्घटना|टक्कर|accident|crash|collision)/i.test(lower);
}

function roadAccidentFallbackHeadline(text: string): string {
  const count = text.match(/(\d+)\s*(लोगों|लोग|persons?|people)/i)?.[1];
  const hasDeath = /(मौत|मारे|लोगों की मौत|dead|death|killed)/i.test(text);
  if (count && hasDeath) return `दर्दनाक सड़क हादसे में ${count} लोगों की मौत`;
  if (hasDeath) return "दर्दनाक सड़क हादसे में लोगों की मौत";
  return "सड़क हादसे का अपडेट";
}

function hasDelhiRajasthanT20(text: string, lower: string): boolean {
  const hasNamedPair = /(दिल्ली|delhi|dc)/i.test(text) && /(राजस्थान|rajasthan|rr)/i.test(text);
  const hasAcronymPair = /(^|[^A-Z0-9])DC([^A-Z0-9]).*(^|[^A-Z0-9])RR([^A-Z0-9]|$)|(^|[^A-Z0-9])RR([^A-Z0-9]).*(^|[^A-Z0-9])DC([^A-Z0-9]|$)/i.test(text);
  return (hasNamedPair || hasAcronymPair)
    && /(vs|बनाम|मैच|match|स्कोर|score)/i.test(lower);
}

function hasEducationMinisterResignationDemand(text: string, lower: string): boolean {
  return /(राहुल|rahul)/i.test(text)
    && /(शिक्षा\s*मंत्री|education\s*minister|शिक्षा)/i.test(lower)
    && /(इस्तीफा|इस्तीफे|resign|resignation|मांग|demand)/i.test(lower);
}

function hasUtilityPriceSpike(text: string, lower: string): boolean {
  return /(\bCNG\b|सीएनजी|पेट्रोल|डीजल|LPG|एलपीजी|गैस|सोना|सोने|चांदी|gold|silver|कीमत|भाव|रेट|महंगा|महंगाई|price|rate|cost|fuel|petrol|diesel|gas)/i.test(text)
    && /(कीमत|भाव|रेट|महंगा|महंगाई|price|rate|cost|लगी आग|spike|hike)/i.test(lower);
}

function hasCelebrityPoliticsCrossover(text: string, lower: string): boolean {
  const celebrity = /(कमल[\s_]*हासन|kamal[\s_]*haasan|actor|actress|अभिनेता|अभिनेत्री|फिल्म|celebrity|सेलेब्रिटी)/i.test(text);
  const politics = /(\bCM\b|\bPM\b|सीएम|पीएम|मुख्यमंत्री|प्रधानमंत्री|मंत्री|minister|party|पार्टी|विजय)/i.test(lower);
  return celebrity && politics;
}

function firstHeadline(text: string, fallback: string): string {
  const withoutHash = text
    .replace(/#[\p{L}\p{M}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = withoutHash.split(/[।.!?]/)[0]?.trim();
  if (!sentence || sentence.length < 4) return fallback;
  return sentence.length > 70 ? `${sentence.slice(0, 67).trim()}...` : sentence;
}

function utilityTitle(text: string): string {
  if (/सोना|सोने|gold/i.test(text) && /चांदी|silver/i.test(text)) return "सोने-चांदी के भाव";
  if (/चांदी|silver/i.test(text)) return "चांदी का भाव";
  if (/सोना|सोने|gold/i.test(text)) return "सोने की कीमत";
  if (/सब्जी|मंडी|टमाटर|प्याज|vegetable/i.test(text)) return "सब्जी मंडी भाव";
  if (/पेट्रोल|diesel|डीजल|petrol/i.test(text)) return "पेट्रोल-डीजल कीमत";
  if (/LPG|एलपीजी|गैस/i.test(text)) return "LPG गैस कीमत";
  return "यूटिलिटी कीमत";
}

function utilityTag(title: string): string {
  if (title.includes("सोने-चांदी")) return "#सोने_चांदी_भाव";
  if (title.includes("चांदी")) return "#चांदी_का_भाव";
  if (title.includes("सोने")) return "#सोने_की_कीमत";
  if (title.includes("सब्जी")) return "#सब्जी_मंडी_भाव";
  if (title.includes("पेट्रोल")) return "#पेट्रोल_डीजल_कीमत";
  if (title.includes("LPG")) return "#LPG_गैस_कीमत";
  return "#यूटिलिटी_कीमत";
}

function utilityPresentation(title: string, headline: string): { displayLabel: string; description: string; whyTrending: string; sampleContent: string } {
  if (/सब्जी|मंडी|टमाटर|प्याज|vegetable/i.test(title)) {
    return {
      displayLabel: `🥬 ${headline} पर नज़र`,
      description: `${title} को लेकर लोग रोजमर्रा के खर्च और बाजार भाव देख रहे हैं।`,
      whyTrending: `${title} घरेलू खरीदारी और स्थानीय बाजार चर्चा से जुड़ा उपयोगी संकेत है।`,
      sampleContent: `${title} पर लोग शहरों के रेट और आज के बाजार भाव देख रहे हैं।`,
    };
  }

  if (/सोने|चांदी|gold|silver/i.test(title)) {
    return {
      displayLabel: `💰 ${title === "चांदी का भाव" ? "चांदी के भाव" : headline} पर नज़र`,
      description: `${title === "चांदी का भाव" ? "चांदी के भाव" : title} को लेकर लोग ताजा रेट और बाजार भाव देख रहे हैं।`,
      whyTrending: `${title} से जुड़े रेट घरेलू खरीदारी और निवेश चर्चा में दिख रहे हैं।`,
      sampleContent: `${title} पर लोग आज के रेट, शहरों के भाव और खरीदारी की चर्चा कर रहे हैं।`,
    };
  }

  if (/CNG|पेट्रोल|डीजल|LPG|गैस/i.test(title)) {
    return {
      displayLabel: `⛽ ${headline} 😲`,
      description: `${title} को लेकर लोगों की नज़र बनी हुई है।`,
      whyTrending: `${title} से जुड़े रेट और घरेलू खर्च पर लोग अपडेट देख रहे हैं।`,
      sampleContent: `${title} पर लोग शहरों के रेट और कीमतों की चर्चा कर रहे हैं।`,
    };
  }

  return {
    displayLabel: `📊 ${headline}`,
    description: `${title} को लेकर लोग ताजा जानकारी देख रहे हैं।`,
    whyTrending: `${title} से जुड़े रेट और उपयोगी अपडेट चर्चा में हैं।`,
    sampleContent: `${title} पर लोग उपयोगी अपडेट शेयर कर रहे हैं।`,
  };
}
