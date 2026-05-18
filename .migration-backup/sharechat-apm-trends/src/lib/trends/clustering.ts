import { hashId } from "./fetch-utils";
import { maybeRefineClustersWithLlm } from "./llm";
import { normalizedKey } from "./normalize";
import { getTopicMappingKey } from "./topic-extraction";
import { computeClusterBharatRelevanceScore } from "./relevance";
import type { FilteredSignal, TrendCluster } from "./types";

export async function clusterSignals(signals: FilteredSignal[], useLlm: boolean): Promise<TrendCluster[]> {
  const deterministic = deterministicClusterSignals(signals);
  if (!useLlm) return deterministic;
  return maybeRefineClustersWithLlm(deterministic).catch(() => deterministic);
}

export function deterministicClusterSignals(signals: FilteredSignal[]): TrendCluster[] {
  const clusters: TrendCluster[] = [];
  for (const signal of signals) {
    let cluster = clusters.find((candidate) => shouldMerge(candidate, signal));
    if (!cluster) {
      cluster = createCluster(signal);
      clusters.push(cluster);
    } else {
      cluster.signals.push(signal);
      cluster.aliases = unique([...cluster.aliases, signal.rawTitle]);
      cluster.sourceNames = unique([...cluster.sourceNames, signal.source]);
      cluster.sourceTypes = unique([...cluster.sourceTypes, signal.sourceType]);
      cluster.firstSeenAt = minIso(cluster.firstSeenAt, signal.publishedAt ?? signal.fetchedAt);
      cluster.lastSeenAt = maxIso(cluster.lastSeenAt, signal.publishedAt ?? signal.fetchedAt);
      cluster.indiaHindiRelevanceScore = computeClusterBharatRelevanceScore(cluster.signals);
    }
  }
  return clusters.map((cluster) => ({
    ...cluster,
    canonicalTitle: chooseCanonicalTitle(cluster.signals),
  }));
}

function createCluster(signal: FilteredSignal): TrendCluster {
  const seenAt = signal.publishedAt ?? signal.fetchedAt;
  return {
    id: `cluster_${hashId(`${signal.preliminaryCategory}|${normalizedKey(signal.tokens)}|${signal.rawTitle}`)}`,
    canonicalTitle: signal.rawTitle,
    aliases: [signal.rawTitle],
    signals: [signal],
    category: signal.preliminaryCategory,
    sourceNames: [signal.source],
    sourceTypes: [signal.sourceType],
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    indiaHindiRelevanceScore: signal.indiaHindiRelevanceScore,
    crossSourceCount: 1,
    crossSourceBoost: 1,
  };
}

function shouldMerge(cluster: TrendCluster, signal: FilteredSignal): boolean {
  if (cluster.category !== signal.preliminaryCategory) return false;
  const signalKey = mappingKeyForSignal(signal);
  const clusterKeys = new Set(cluster.signals.map(mappingKeyForSignal).filter(Boolean));
  if (signalKey && clusterKeys.has(signalKey)) return true;
  if (signalKey && clusterKeys.size > 0 && !clusterKeys.has(signalKey)) return false;
  return cluster.signals.some((existing) => {
    if (entityOverlap(existing, signal)) return true;
    const overlap = jaccard(existing.tokens, signal.tokens);
    if (overlap >= 0.38) return true;
    return cricketSynonymMerge(existing.normalizedText, signal.normalizedText);
  });
}

function mappingKeyForSignal(signal: FilteredSignal): string | null {
  return getTopicMappingKey({ canonicalTitle: signal.rawTitle, rawTitle: signal.rawDescription, category: signal.preliminaryCategory });
}

function cricketSynonymMerge(a: string, b: string): boolean {
  const combined = `${a} ${b}`.toLowerCase();
  const indiaAustralia = ["ind", "india", "भारत", "aus", "australia", "ऑस्ट्रेलिया"].filter((term) => combined.includes(term)).length;
  return indiaAustralia >= 4 && (combined.includes("match") || combined.includes("मैच") || combined.includes("cricket") || combined.includes("क्रिकेट"));
}

function entityOverlap(a: FilteredSignal, b: FilteredSignal): boolean {
  const aHints = new Set(strongHints(a).map((hint) => hint.toLowerCase()));
  if (aHints.size === 0) return false;
  return strongHints(b).some((hint) => aHints.has(hint.toLowerCase()));
}

function jaccard(a: string[], b: string[]): number {
  const aSet = new Set(meaningfulTokens(a).map((token) => token.toLowerCase()));
  const bSet = new Set(meaningfulTokens(b).map((token) => token.toLowerCase()));
  const union = new Set([...aSet, ...bSet]).size;
  if (!union) return 0;
  return [...aSet].filter((token) => bSet.has(token)).length / union;
}

function strongHints(signal: FilteredSignal): string[] {
  return [...signal.indiaHints, ...signal.hindiHints].filter((hint) => !GENERIC_HINTS.has(hint.toLowerCase()) && hint.length > 2);
}

function meaningfulTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !GENERIC_TOKENS.has(token.toLowerCase()) && token.replace(/^#/, "").length > 2);
}

const GENERIC_HINTS = new Set(["भारत", "india", "bharat", "इंडिया", "देश", "desh", "भारतीय", "हिंदी", "पूजा", "मंदिर", "भक्ति", "वायरल", "खबर"]);
const GENERIC_TOKENS = new Set(["भारत", "india", "bharat", "इंडिया", "देश", "the", "and", "news", "खबर", "की", "के", "का", "में", "से", "पर", "और", "है", "हैं", "पूजा", "मंदिर", "भक्ति", "अपडेट", "बड़ी", "बड़ा"]);

function chooseCanonicalTitle(signals: FilteredSignal[]): string {
  const sorted = [...signals].sort((a, b) => {
    const scoreA = (a.languageHint === "hi" ? 10 : 0) + a.reliabilityWeight * 10 + a.indiaHindiRelevanceScore;
    const scoreB = (b.languageHint === "hi" ? 10 : 0) + b.reliabilityWeight * 10 + b.indiaHindiRelevanceScore;
    return scoreB - scoreA || a.rawTitle.localeCompare(b.rawTitle, "hi");
  });
  return sorted[0]?.rawTitle ?? "भारत ट्रेंड";
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function minIso(a: string, b: string): string {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
