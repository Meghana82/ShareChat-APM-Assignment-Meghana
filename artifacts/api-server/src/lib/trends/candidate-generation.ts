import { INTEREST_BUCKETS, bucketForSignal, type InterestBucketId, sourceFamilyFor } from "./interest-buckets";
import { getTopicMappingKey } from "./topic-extraction";
import type { RawSignal, TrendCategory } from "./types";

export interface Candidate {
  bucketId: InterestBucketId;
  canonicalTopic: string;
  aliases: string[];
  evidenceSignals: RawSignal[];
  sourceFamilyMix: string[];
  searchDemandEvidence: number;
  onlineViralityEvidence: number;
  culturalEvidence: number;
  authorityEvidence: number;
  preliminaryCategory: TrendCategory;
  shouldPreferForMix: boolean;
  candidateQualityScore: number;
  onlineDemandScore: number;
}

export function generateCandidatesByInterestBucket(rawSignals: RawSignal[]): Candidate[] {
  const groups = new Map<string, Candidate>();
  for (const signal of rawSignals) {
    const bucketId = bucketForSignal(signal);
    const canonicalTopic = getTopicMappingKey({ canonicalTitle: signal.rawTitle, rawTitle: signal.rawDescription, category: signal.categoryHint ?? "viral" }) ?? signal.rawTitle.slice(0, 80);
    const key = `${bucketId}:${canonicalTopic.toLowerCase()}`;
    const family = sourceFamilyFor(signal.source, signal.sourceType);
    const existing = groups.get(key);
    if (existing) {
      existing.evidenceSignals.push(signal);
      existing.aliases.push(signal.rawTitle);
      existing.sourceFamilyMix = [...new Set([...existing.sourceFamilyMix, family])];
      existing.onlineDemandScore = computeOnlineDemandScore(existing);
      existing.candidateQualityScore = computeCandidateQuality(existing);
    } else {
      const candidate: Candidate = {
        bucketId,
        canonicalTopic,
        aliases: [signal.rawTitle],
        evidenceSignals: [signal],
        sourceFamilyMix: [family],
        searchDemandEvidence: signal.sourceType === "search_demand" ? 1 : 0,
        onlineViralityEvidence: signal.sourceType === "video" || signal.sourceType === "social_experimental" ? 1 : 0,
        culturalEvidence: signal.sourceType === "festival_calendar" ? 1 : 0,
        authorityEvidence: ["official_government", "official_finance", "weather", "public_safety", "sports"].includes(signal.sourceType) ? 1 : 0,
        preliminaryCategory: signal.categoryHint ?? "viral",
        shouldPreferForMix: signal.sourceType === "festival_calendar" || signal.sourceType === "search_demand",
        candidateQualityScore: 0,
        onlineDemandScore: 0,
      };
      candidate.onlineDemandScore = computeOnlineDemandScore(candidate);
      candidate.candidateQualityScore = computeCandidateQuality(candidate);
      groups.set(key, candidate);
    }
  }
  return [...groups.values()].sort((a, b) => b.candidateQualityScore - a.candidateQualityScore);
}

export function computeOnlineDemandScore(candidate: Candidate): number {
  let score = 0;
  if (candidate.sourceFamilyMix.includes("search_demand")) score += 40;
  if (candidate.sourceFamilyMix.includes("video_entertainment")) score += 20;
  if (candidate.evidenceSignals.filter((signal) => signal.sourceType === "hindi_news").map((signal) => signal.source).filter((source, index, arr) => arr.indexOf(source) === index).length >= 2) score += 15;
  if (candidate.evidenceSignals.some((signal) => signal.metadata?.isFestivalToday === true)) score += 10;
  if (candidate.sourceFamilyMix.length >= 2) score += 10;
  if (candidate.sourceFamilyMix.includes("festival_cultural")) score += 10;
  return Math.min(100, score);
}

function computeCandidateQuality(candidate: Candidate): number {
  return Math.min(
    100,
    candidate.onlineDemandScore + candidate.sourceFamilyMix.length * 8 + candidate.authorityEvidence * 12 + candidate.culturalEvidence * 12,
  );
}

export function candidatePoolByBucket(candidates: Candidate[]): Record<string, number> {
  const initial = Object.fromEntries(INTEREST_BUCKETS.map((bucket) => [bucket.id, 0])) as Record<string, number>;
  return candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.bucketId] = (acc[candidate.bucketId] ?? 0) + 1;
    return acc;
  }, initial);
}

export function rejectedByBucketSkeleton(): Record<string, Record<string, number>> {
  return {};
}
