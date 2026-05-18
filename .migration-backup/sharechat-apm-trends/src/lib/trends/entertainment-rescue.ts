import { makeRescueTrend } from "./rescue-utils";
import type { FilteredSignal, RankedTrend } from "./types";

export function rescueEntertainmentTrends(signals: FilteredSignal[]): RankedTrend[] {
  const valid = signals.filter((signal) => /तुम्बाड|tumbbad|बॉलीवुड|फिल्म|ट्रेलर|ott|गॉसिप|एक्टर|एक्ट्रेस|भोजपुरी|गाना|भजन|movie|trailer|actor|song/i.test(`${signal.rawTitle} ${signal.rawDescription ?? ""}`));
  if (valid.length === 0) return [];
  const text = valid.map((signal) => signal.rawTitle).join(" ").toLowerCase();
  if (text.includes("tumbbad") || text.includes("तुम्बाड")) {
    return [makeRescueTrend({
      tag: "#तुम्बाड_2",
      title: "तुम्बाड 2 चर्चा में",
      displayLabel: "🎬 तुम्बाड 2 चर्चा में",
      description: "फिल्म और सीक्वल अपडेट को लेकर दर्शकों में चर्चा बढ़ रही है।",
      category: "movies",
      heatScore: 58,
      bharatRelevanceScore: 78,
      sources: [valid[0].source],
      sourceTypes: [valid[0].sourceType],
      interestBucket: "bollywood_gossip_entertainment",
    })];
  }
  if (text.includes("भोजपुरी")) {
    return [makeRescueTrend({
      tag: "#भोजपुरी_गाना",
      title: "भोजपुरी गाना",
      displayLabel: "🎵 भोजपुरी गाना ट्रेंड",
      description: "भोजपुरी गानों और वीडियो को लेकर दर्शकों की चर्चा बढ़ रही है।",
      category: "music",
      heatScore: 55,
      bharatRelevanceScore: 80,
      sources: [valid[0].source],
      sourceTypes: [valid[0].sourceType],
      interestBucket: "bhojpuri_music_creator",
    })];
  }
  const specific = valid.find((signal) => hasSpecificEntertainmentTopic(`${signal.rawTitle} ${signal.rawDescription ?? ""}`));
  if (!specific) return [];
  const raw = `${specific.rawTitle} ${specific.rawDescription ?? ""}`;
  const title = buildSpecificEntertainmentTitle(raw);
  return [makeRescueTrend({
    tag: `#${title.replace(/\s+/g, "_").replace(/[^\p{L}\p{M}\p{N}_#]/gu, "")}`,
    title,
    displayLabel: `🎬 ${title}`,
    description: `${title} को लेकर दर्शकों में चर्चा बढ़ रही है।`,
    category: "entertainment",
    heatScore: 55,
    bharatRelevanceScore: 78,
    sources: [specific.source],
    sourceTypes: [specific.sourceType],
    interestBucket: "bollywood_gossip_entertainment",
  })];
}

function hasSpecificEntertainmentTopic(text: string): boolean {
  return /कमल|हासन|विजय|तुम्बाड|भोजपुरी|पवन|खेसारी|निरहुआ|सलमान|शाहरुख|आमिर|अक्षय|दीपिका|आलिया|रणबीर|ranbir|alia|salman|shah\s*rukh|akshay|deepika|tumbbad/i.test(text);
}

function buildSpecificEntertainmentTitle(text: string): string {
  if (/कमल|हासन|विजय/i.test(text)) return "कमल हासन और CM विजय मुलाकात";
  if (/तुम्बाड|tumbbad/i.test(text)) return "तुम्बाड 2";
  if (/भोजपुरी|पवन|खेसारी|निरहुआ/i.test(text)) return "भोजपुरी गाना";
  const cleaned = text.replace(/https?:\/\/\S+/g, "").split(/[।.!?]/)[0]?.trim() ?? "";
  return cleaned.split(/\s+/).slice(0, 4).join(" ") || "सेलेब्रिटी अपडेट";
}
