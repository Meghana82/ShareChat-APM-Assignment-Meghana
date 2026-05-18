import { SOURCE_FAMILY } from "./constants";
import { normalizedKey } from "./normalize";
import { getTopicMappingKey } from "./topic-extraction";
import type { CrossSourceValidation, FilteredSignal, SourceType } from "./types";

export interface ValidatedSignalGroup extends CrossSourceValidation {
  key: string;
  signals: FilteredSignal[];
  category: FilteredSignal["preliminaryCategory"];
}

export function groupForCrossSourceValidation(signals: FilteredSignal[]): ValidatedSignalGroup[] {
  const groups: ValidatedSignalGroup[] = [];

  for (const signal of signals) {
    const key = buildCrossSourceKey(signal);
    let group = groups.find((candidate) => shouldMergeForValidation(candidate, signal, key));
    if (!group) {
      group = {
        key,
        signals: [],
        category: signal.preliminaryCategory,
        crossSourceCount: 0,
        crossSourceBoost: 1,
        independentSourceNames: [],
        validationLevel: "low",
      };
      groups.push(group);
    }
    group.signals.push(signal);
    Object.assign(group, validateCrossSource(group.signals));
  }

  return groups;
}

export function validateCrossSource(signals: FilteredSignal[]): CrossSourceValidation {
  const independentSourceNames = independentSourceNamesFor(signals);
  const sourceTypes = new Set<SourceType>(signals.map((signal) => signal.sourceType));
  const hasOfficial = signals.some((signal) => ["official_government", "official_finance", "weather", "public_safety", "sports"].includes(signal.sourceType));
  const onlyReddit = signals.length > 0 && signals.every((signal) => signal.sourceType === "social_experimental");
  const crossSourceCount = independentSourceNames.length;
  let validationLevel: CrossSourceValidation["validationLevel"] = "low";
  if (hasOfficial && ["government", "finance", "weather", "public_safety", "sports"].includes(signals[0]?.preliminaryCategory ?? "news")) {
    validationLevel = "authority";
  } else if (crossSourceCount >= 3 && sourceTypes.size >= 2) {
    validationLevel = "high";
  } else if (crossSourceCount >= 2) {
    validationLevel = "medium";
  }
  if (onlyReddit) validationLevel = "low";

  return {
    crossSourceCount,
    crossSourceBoost: boostFor(crossSourceCount),
    independentSourceNames,
    validationLevel,
  };
}

export function independentSourceNamesFor(signals: FilteredSignal[]): string[] {
  const familyToName = new Map<string, string>();
  for (const signal of signals) {
    const family = SOURCE_FAMILY[signal.source] ?? signal.source;
    if (!familyToName.has(family)) familyToName.set(family, signal.source);
  }
  return [...familyToName.values()].sort((a, b) => a.localeCompare(b));
}

function boostFor(count: number): number {
  if (count >= 4) return 1.5;
  if (count === 3) return 1.3;
  if (count === 2) return 1.15;
  return 1.0;
}

export function buildCrossSourceKey(signal: FilteredSignal): string {
  const mappedKey = getTopicMappingKey({ canonicalTitle: signal.rawTitle, rawTitle: signal.rawDescription, category: signal.preliminaryCategory });
  if (mappedKey) return `${signal.preliminaryCategory}:mapped:${mappedKey}`;
  const entityTokens = meaningfulTokens(signal.tokens).filter(
    (token) => strongHints(signal).some((hint) => hint.toLowerCase().includes(token.toLowerCase())) || /^[a-z]{2,5}$/i.test(token),
  );
  const base = normalizedKey([...entityTokens, ...meaningfulTokens(signal.tokens)], 5);
  return `${signal.preliminaryCategory}:${base || signal.normalizedText.slice(0, 48)}`;
}

function shouldMergeForValidation(group: ValidatedSignalGroup, signal: FilteredSignal, key: string): boolean {
  if (group.category !== signal.preliminaryCategory) return false;
  if (group.key === key) return true;
  return group.signals.some((existing) => tokenJaccard(existing.tokens, signal.tokens) >= 0.35 || hasEntityOverlap(existing, signal));
}

function tokenJaccard(a: string[], b: string[]): number {
  const aSet = new Set(meaningfulTokens(a).map((token) => token.toLowerCase()));
  const bSet = new Set(meaningfulTokens(b).map((token) => token.toLowerCase()));
  const intersection = [...aSet].filter((token) => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size || 1;
  return intersection / union;
}

function hasEntityOverlap(a: FilteredSignal, b: FilteredSignal): boolean {
  const aHints = new Set(strongHints(a).map((hint) => hint.toLowerCase()));
  if (aHints.size === 0) return false;
  return strongHints(b).some((hint) => aHints.has(hint.toLowerCase()));
}

function strongHints(signal: FilteredSignal): string[] {
  return [...signal.indiaHints, ...signal.hindiHints].filter((hint) => !GENERIC_HINTS.has(hint.toLowerCase()) && hint.length > 2);
}

function meaningfulTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !GENERIC_TOKENS.has(token.toLowerCase()) && token.replace(/^#/, "").length > 2);
}

const GENERIC_HINTS = new Set(["भारत", "india", "bharat", "इंडिया", "देश", "desh", "भारतीय", "हिंदी", "पूजा", "मंदिर", "भक्ति", "वायरल", "खबर"]);
const GENERIC_TOKENS = new Set(["भारत", "india", "bharat", "इंडिया", "देश", "the", "and", "news", "खबर", "की", "के", "का", "में", "से", "पर", "और", "है", "हैं", "पूजा", "मंदिर", "भक्ति", "अपडेट", "बड़ी", "बड़ा"]);
