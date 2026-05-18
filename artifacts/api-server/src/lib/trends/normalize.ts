import { HINDI_HINTS, INDIA_TERMS, INDIAN_ENTITIES } from "./constants";
import { detectLanguageHint, stripHtml } from "./rss-parser";
import type { RawSignal } from "./types";

export interface NormalizedSignalData {
  normalizedText: string;
  tokens: string[];
  indiaHints: string[];
  hindiHints: string[];
}

export function normalizeSignal(signal: RawSignal): NormalizedSignalData {
  const text = `${signal.rawTitle} ${signal.rawDescription ?? ""}`;
  const normalizedText = normalizeText(text);
  const tokens = extractTokens(normalizedText);
  return {
    normalizedText,
    tokens,
    indiaHints: extractHints(normalizedText, [...INDIA_TERMS, ...INDIAN_ENTITIES]),
    hindiHints: extractHints(normalizedText, HINDI_HINTS),
  };
}

export function normalizeText(input: string): string {
  const withoutHtml = stripHtml(input);
  const withoutUrls = withoutHtml.replace(/https?:\/\/\S+|www\.\S+/gi, " ");
  const splitHashtags = withoutUrls.replace(/#([A-Za-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)/g, (_match, tag: string) => {
    return `#${tag.replace(/([a-z])([A-Z])/g, "$1 $2")}`;
  });
  const loweredRoman = splitHashtags.replace(/[A-Za-z][A-Za-z0-9_\-]*/g, (token) => token.toLowerCase());
  return loweredRoman
    // Keep Unicode marks (\p{M}) so Devanagari matras/halants are preserved: भारत, बारिश, परीक्षा.
    .replace(/[^#\p{L}\p{M}\p{N}\s_\-&/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTokens(normalizedText: string): string[] {
  const tokens = normalizedText
    .split(/[\s,|:;()\[\]{}]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/^#+/, "#"));
  return [...new Set(tokens)].filter((token) => token.length > 1 || /[\u0900-\u097F]/.test(token));
}

export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

export function extractHints(text: string, hints: string[]): string[] {
  const lower = text.toLowerCase();
  return [...new Set(hints.filter((hint) => lower.includes(hint.toLowerCase())))]
    .sort((a, b) => a.localeCompare(b, "hi"));
}

export function detectSignalLanguage(text: string) {
  return detectLanguageHint(text);
}

export function normalizedKey(tokens: string[], max = 6): string {
  return tokens
    .filter((token) => !STOPWORDS.has(token.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "hi"))
    .slice(0, max)
    .join("|");
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "today",
  "latest",
  "breaking",
  "news",
  "की",
  "के",
  "का",
  "में",
  "से",
  "पर",
  "और",
  "है",
  "हैं",
  "आज",
  "खबर",
]);
