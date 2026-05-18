import { makeRescueTrend, uniqueSourceTypes } from "./rescue-utils";
import type { FilteredSignal, RankedTrend } from "./types";

export function rescueUtilityAndEducationTrends(signals: FilteredSignal[]): RankedTrend[] {
  const out: RankedTrend[] = [];
  const text = signals.map((signal) => `${signal.rawTitle} ${signal.rawDescription ?? ""}`).join(" ").toLowerCase();
  const sources = (terms: RegExp[]) => signals.filter((signal) => terms.some((term) => term.test(`${signal.rawTitle} ${signal.rawDescription ?? ""}`)));

  const cng = sources([/cng/i, /सीएनजी/i]);
  if (cng.length) out.push(makeRescueTrend({
    tag: "#CNG_कीमत",
    title: "CNG कीमत",
    displayLabel: "⛽ CNG की कीमतों में लगी आग 😲",
    description: "CNG कीमतों को लेकर लोगों की नज़र बनी हुई है।",
    category: "finance",
    heatScore: 55,
    bharatRelevanceScore: 85,
    sources: [...new Set(cng.map((signal) => signal.source))].slice(0, 3),
    sourceTypes: uniqueSourceTypes(cng.map((signal) => signal.sourceType)),
    interestBucket: "utility_bazaar_prices",
  }));

  const fuel = sources([/petrol/i, /diesel/i, /पेट्रोल/i, /डीजल/i]);
  if (fuel.length) out.push(makeRescueTrend({
    tag: "#पेट्रोल_डीजल_कीमत",
    title: "पेट्रोल-डीजल कीमत",
    displayLabel: "⛽ पेट्रोल-डीजल कीमतों पर नज़र",
    description: "पेट्रोल-डीजल कीमतों पर शहरों में लोगों की नज़र बनी हुई है।",
    category: "finance",
    heatScore: 55,
    bharatRelevanceScore: 80,
    sources: [...new Set(fuel.map((signal) => signal.source))].slice(0, 3),
    sourceTypes: uniqueSourceTypes(fuel.map((signal) => signal.sourceType)),
    interestBucket: "utility_bazaar_prices",
  }));

  const gold = sources([/gold/i, /silver/i, /सोना/i, /सोने/i, /चांदी/i]);
  if (gold.length) out.push(makeRescueTrend({
    tag: text.includes("चांदी") || text.includes("silver") ? "#चांदी_का_भाव" : "#सोने_की_कीमत",
    title: text.includes("चांदी") || text.includes("silver") ? "चांदी का भाव" : "सोने-चांदी के भाव",
    displayLabel: "💰 सोने-चांदी के भाव बदले",
    description: "सोने-चांदी के भाव में बदलाव को लेकर लोग रेट चेक कर रहे हैं।",
    category: "finance",
    heatScore: 55,
    bharatRelevanceScore: 80,
    sources: [...new Set(gold.map((signal) => signal.source))].slice(0, 3),
    sourceTypes: uniqueSourceTypes(gold.map((signal) => signal.sourceType)),
    interestBucket: "utility_bazaar_prices",
  }));

  const jee = sources([/jeecup/i, /jee/i, /जेईई/i]);
  if (jee.length) out.push(makeRescueTrend({
    tag: "#JEE_परीक्षा",
    title: "JEE परीक्षा",
    displayLabel: "📚 JEE परीक्षा अपडेट",
    description: "JEE परीक्षा से जुड़े अपडेट छात्रों और अभिभावकों में चर्चा में हैं।",
    category: "education",
    heatScore: 56,
    bharatRelevanceScore: 80,
    sources: [...new Set(jee.map((signal) => signal.source))].slice(0, 3),
    sourceTypes: uniqueSourceTypes(jee.map((signal) => signal.sourceType)),
    interestBucket: "finance_education_jobs_utility",
  }));

  const neet = sources([/neet/i, /नीट/i]);
  if (neet.length) out.push(makeRescueTrend({
    tag: "#NEET_पेपर_लीक",
    title: "NEET पेपर लीक",
    displayLabel: "📚 NEET पेपर लीक अपडेट",
    description: "NEET पेपर लीक से जुड़े अपडेट छात्रों और अभिभावकों में चर्चा में हैं।",
    category: "education",
    heatScore: 58,
    bharatRelevanceScore: 85,
    sources: [...new Set(neet.map((signal) => signal.source))].slice(0, 3),
    sourceTypes: uniqueSourceTypes(neet.map((signal) => signal.sourceType)),
    interestBucket: "finance_education_jobs_utility",
  }));

  return out;
}
