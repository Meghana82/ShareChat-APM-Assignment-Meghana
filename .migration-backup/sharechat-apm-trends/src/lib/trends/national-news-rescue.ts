import { makeRescueTrend, uniqueSourceTypes } from "./rescue-utils";
import type { FilteredSignal, RankedTrend } from "./types";

export function rescueNationalNewsTrends(signals: FilteredSignal[]): RankedTrend[] {
  const valid = signals.filter((signal) => /मोदी|प्रधानमंत्री|PM Modi|पीएम|सरकार|योजना|संसद|लोकसभा|कैबिनेट|मंत्रालय|हिमाचल|निकाय|चुनाव/i.test(`${signal.rawTitle} ${signal.rawDescription ?? ""}`));
  if (valid.length === 0) return [];
  const text = valid.map((signal) => signal.rawTitle).join(" ");
  if (/हिमाचल|निकाय|चुनाव/i.test(text)) {
    return [makeRescueTrend({
      tag: "#हिमाचल_निकाय_चुनाव",
      title: "हिमाचल निकाय चुनाव",
      displayLabel: "हिमाचल निकाय चुनाव लाइव अपडेट",
      description: "हिमाचल के निकाय चुनाव नतीजों और अपडेट पर चर्चा बढ़ रही है।",
      category: "government",
      heatScore: 58,
      bharatRelevanceScore: 85,
      sources: [...new Set(valid.map((signal) => signal.source))].slice(0, 3),
      sourceTypes: uniqueSourceTypes(valid.map((signal) => signal.sourceType)),
      interestBucket: "modi_national_news",
    })];
  }
  const modi = valid.find((signal) => /मोदी|PM Modi|प्रधानमंत्री|पीएम/i.test(signal.rawTitle));
  if (modi) {
    return [makeRescueTrend({
      tag: "#मोदी_भाषण",
      title: "मोदी भाषण",
      displayLabel: "पीएम मोदी अपडेट",
      description: "पीएम मोदी से जुड़े भाषण और राष्ट्रीय अपडेट पर चर्चा बढ़ रही है।",
      category: "government",
      heatScore: 60,
      bharatRelevanceScore: 85,
      sources: [modi.source],
      sourceTypes: [modi.sourceType],
      interestBucket: "modi_national_news",
    })];
  }
  return [];
}
