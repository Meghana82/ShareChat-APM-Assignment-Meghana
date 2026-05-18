import { makeRescueTrend, uniqueSourceTypes } from "./rescue-utils";
import type { FilteredSignal, RankedTrend } from "./types";

const IPL_TEAMS = ["KKR", "GT", "CSK", "MI", "RCB", "DC", "RR", "SRH", "PBKS", "LSG"];

export function rescueSportsTrends(signals: FilteredSignal[], now = new Date()): RankedTrend[] {
  const sportsSignals = signals.filter((signal) => isFreshSportsSignal(signal, now) && /\b(IPL|KKR|GT|CSK|MI|RCB|DC|RR|SRH|PBKS|LSG)\b|क्रिकेट|मैच|कोहली|रोहित|धोनी|गिल|बुमराह/i.test(`${signal.rawTitle} ${signal.rawDescription ?? ""}`));
  const pair = dominantPairFromSameSignal(sportsSignals);
  if (pair) {
    const [first, second] = pair.pair;
    return [makeRescueTrend({
      tag: `#${first}_बनाम_${second}`,
      title: `${first} बनाम ${second}`,
      displayLabel: `🏏 ${first} vs ${second} चर्चा`,
      description: "IPL मुकाबले और खिलाड़ियों को लेकर फैंस की चर्चा तेज़ है।",
      category: "sports",
      heatScore: 75,
      bharatRelevanceScore: 85,
      sources: [...pair.sources].slice(0, 3),
      sourceTypes: uniqueSourceTypes(pair.signals.map((signal) => signal.sourceType)),
      interestBucket: "cricket_ipl_sports",
      whyTrending: "क्रिकेट और IPL से जुड़े भारतीय स्रोतों में चर्चा के संकेत मिल रहे हैं।",
      sampleText: "फैंस मैच, खिलाड़ियों और IPL मोमेंट्स पर पोस्ट और कमेंट कर रहे हैं।",
    })];
  }

  const player = sportsSignals.find((signal) => /कोहली|रोहित|धोनी|गिल|बुमराह|NARINE|FINN ALLEN|ORANGE CAP/i.test(signal.rawTitle));
  if (!player) return [];
  const text = player.rawTitle.toLowerCase();
  const tag = text.includes("orange") ? "#ऑरेंज_कैप" : text.includes("kohli") || text.includes("कोहली") ? "#कोहली_फॉर्म" : "#IPL_चर्चा";
  return [makeRescueTrend({
    tag,
    title: tag.replace("#", "").replace(/_/g, " "),
    displayLabel: "🏏 IPL चर्चा",
    description: "IPL खिलाड़ियों और मुकाबलों को लेकर फैंस की चर्चा तेज़ है।",
    category: "sports",
    heatScore: 60,
    bharatRelevanceScore: 85,
    sources: [player.source],
    sourceTypes: [player.sourceType],
    interestBucket: "cricket_ipl_sports",
  })];
}

function dominantPairFromSameSignal(signals: FilteredSignal[]): { pair: [string, string]; score: number; signals: FilteredSignal[]; sources: Set<string> } | null {
  const candidates = new Map<string, { pair: [string, string]; score: number; signals: FilteredSignal[]; sources: Set<string>; liveEvidence: number }>();
  signals.forEach((signal, index) => {
    const text = `${signal.rawTitle} ${signal.rawDescription ?? ""}`;
    const pair = teamPairFromText(text);
    if (!pair) return;
    const key = pairKey(pair);
    const existing = candidates.get(key) ?? { pair, score: 0, signals: [], sources: new Set<string>(), liveEvidence: 0 };
    const live = isLiveMatchText(text);
    existing.score += pairSignalWeight(signal, text, index);
    existing.liveEvidence += live ? 1 : 0;
    existing.signals.push(signal);
    existing.sources.add(signal.source);
    candidates.set(key, existing);
  });

  const best = [...candidates.values()].sort((a, b) => b.score - a.score || b.sources.size - a.sources.size)[0];
  if (!best) return null;
  if (best.sources.size >= 2 || best.liveEvidence >= 1 || best.score >= 4) return best;
  return null;
}

function teamPairFromText(text: string): [string, string] | null {
  const upper = text.toUpperCase();
  const found = IPL_TEAMS.filter((team) => new RegExp(`(^|[^A-Z0-9])${team}([^A-Z0-9]|$)`).test(upper));
  if (found.length < 2) return null;
  if (!/\b(VS|V)\b|बनाम|LIVE|MATCH|SCORE|IPL|मैच|स्कोर/i.test(text)) return null;
  return [found[0], found[1]];
}

function pairSignalWeight(signal: FilteredSignal, text: string, index: number): number {
  let score = signal.sourceType === "search_demand" ? 2 : 1;
  if (["hindi_news", "national_news", "video", "sports"].includes(signal.sourceType)) score += 1;
  if (isLiveMatchText(text)) score += 2;
  if (/highlights?|beat|beats|won|lost|stars?|in vain|playoff race|points table analysis|future|old|yesterday|last night|recap|full match/i.test(text)) score -= 1;
  return Math.max(0.5, score / (1 + index * 0.05));
}

function isLiveMatchText(text: string): boolean {
  if (/highlights?|beat|beats|won|lost|in vain|recap|full match/i.test(text)) return false;
  return /\blive\b|\blive score\b|\bscore\b|\btoss\b|\bplaying xi\b|आज|लाइव|स्कोर/i.test(text);
}

function pairKey(pair: [string, string]): string {
  return [...pair].sort().join("_");
}

function isFreshSportsSignal(signal: FilteredSignal, now: Date): boolean {
  if (!signal.publishedAt) return signal.sourceType === "search_demand";
  const published = new Date(signal.publishedAt);
  if (Number.isNaN(published.getTime())) return true;
  const ageHours = (now.getTime() - published.getTime()) / 3_600_000;
  if (ageHours < 0) return true;
  const text = `${signal.rawTitle} ${signal.rawDescription ?? ""}`;
  const matchSpecific = /\b(KKR|GT|CSK|MI|RCB|DC|RR|SRH|PBKS|LSG|IND|AUS)\b|\bvs\b|बनाम|live score|highlights|match|मैच|स्कोर|आईपीएल|ipl/i.test(text);
  return ageHours <= (matchSpecific ? 8 : 14);
}
