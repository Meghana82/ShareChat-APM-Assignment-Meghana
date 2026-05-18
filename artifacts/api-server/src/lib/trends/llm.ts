import Anthropic from "@anthropic-ai/sdk";
import type { LlmMetadataItem, ScoredCluster, TrendCluster } from "./types";

function client(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function maybeRefineClustersWithLlm(clusters: TrendCluster[]): Promise<TrendCluster[]> {
  const anthropic = client();
  if (!anthropic || clusters.length === 0) return clusters;

  const prompt = `Audience: Hindi-speaking ShareChat users across Bharat, especially Tier 2/3 cities.
Group related signals into canonical clusters. Merge variants. Preserve previous cycle canonical tag names where possible.
Reject obscure foreign stories, scams, adult content, routine bureaucratic notices.
Output JSON only as {"clusters":[{"id":"existing id","canonicalTitle":"Hindi/India-first title","aliases":["..."]}]}.
Do not rank.

Input clusters:
${JSON.stringify(clusters.slice(0, 30).map((cluster) => ({
  id: cluster.id,
  canonicalTitle: cluster.canonicalTitle,
  category: cluster.category,
  aliases: cluster.aliases.slice(0, 5),
  sources: cluster.sourceNames,
})))}`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 2000,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });
  const text = message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
  const parsed = parseJson<{ clusters?: Array<{ id: string; canonicalTitle?: string; aliases?: string[] }> }>(text);
  if (!parsed?.clusters) return clusters;
  return clusters.map((cluster) => {
    const refined = parsed.clusters?.find((item) => item.id === cluster.id);
    if (!refined) return cluster;
    return {
      ...cluster,
      canonicalTitle: refined.canonicalTitle ?? cluster.canonicalTitle,
      aliases: refined.aliases?.length ? [...new Set([...cluster.aliases, ...refined.aliases])] : cluster.aliases,
    };
  });
}

export async function generateMetadataWithLlm(clusters: ScoredCluster[]): Promise<LlmMetadataItem[] | null> {
  const anthropic = client();
  if (!anthropic || clusters.length === 0) return null;
  const prompt = `Generate natural Hindi metadata for ShareChat trending tags.
Rules:
- Culturalise, do not literally translate.
- Hindi should feel natural to users in Varanasi, Kanpur, Patna, Jaipur, Indore, Lucknow.
- Generate Devanagari-first hashtag. Common acronyms like IPL, RBI, UPI, NEET, JEE are allowed.
- Sports/entertainment/devotional: energetic tone allowed.
- Weather/public safety: informative tone only.
- Finance/government: neutral, no sensational wording.
- Crime/death/accident/communal: no emoji, no clickbait, review-required.
- Do not rank. Do not invent facts. Use only source signals.
- Copy category exactly.
- Output JSON only as {"items":[{"clusterId":"...","tag":"#...","title":"...","displayLabel":"...","description":"...","category":"...","whyTrending":"...","sampleContent":{"type":"summary","text":"..."}}]}.

Input:
${JSON.stringify(clusters.slice(0, 20).map((cluster) => ({
  clusterId: cluster.id,
  canonicalTitle: cluster.canonicalTitle,
  input_score: cluster.inputScore,
  bharatRelevanceScore: cluster.indiaHindiRelevanceScore,
  category: cluster.category,
  sources: cluster.sourceNames,
  sourceTypes: cluster.sourceTypes,
  aliases: cluster.aliases.slice(0, 5),
})))}`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 3000,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  const text = message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
  const parsed = parseJson<{ items?: LlmMetadataItem[] }>(text);
  return parsed?.items ?? null;
}

function parseJson<T>(text: string): T | null {
  const trimmed = text.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
