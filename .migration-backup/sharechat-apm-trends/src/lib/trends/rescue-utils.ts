import { toIndiaIsoString } from "./constants";
import type { RankedTrend, SourceType, TrendCategory } from "./types";

export function makeRescueTrend(input: {
  tag: string;
  title: string;
  displayLabel: string;
  description: string;
  category: TrendCategory;
  heatScore: number;
  bharatRelevanceScore: number;
  sources: string[];
  sourceTypes: SourceType[];
  interestBucket: string;
  generatedAt?: string;
  whyTrending?: string;
  sampleText?: string;
}): RankedTrend {
  return {
    rank: 0,
    tag: input.tag,
    title: input.title,
    displayLabel: input.displayLabel,
    description: input.description,
    category: input.category,
    heatScore: input.heatScore,
    bharatRelevanceScore: input.bharatRelevanceScore,
    sources: input.sources.length ? input.sources : ["External Signals"],
    sourceTypes: input.sourceTypes.length ? input.sourceTypes : ["hindi_news"],
    trendStage: input.heatScore >= 85 ? "hot" : input.heatScore >= 70 ? "rising" : "emerging",
    whyTrending: input.whyTrending ?? "भारतीय स्रोतों में इस विषय पर साफ संकेत मिल रहे हैं।",
    sampleContent: { type: "summary", text: input.sampleText ?? `${input.title} पर लोग पोस्ट, राय और अपडेट शेयर कर रहे हैं।` },
    safety: { status: "safe", reasons: [] },
    signalSummary: {
      externalValidationScore: Math.min(100, Math.max(35, input.heatScore)),
      crossSourceCount: Math.max(1, input.sources.length),
      freshnessScore: 80,
      reliabilityScore: 70,
      regionalRelevanceScore: input.bharatRelevanceScore,
    },
    generatedAt: input.generatedAt ?? toIndiaIsoString(),
    interestBucket: input.interestBucket,
    debug: { isRescueTrend: true, finalRankScore: input.heatScore },
  };
}

export function uniqueSourceTypes(types: SourceType[]): SourceType[] {
  return [...new Set(types)];
}
