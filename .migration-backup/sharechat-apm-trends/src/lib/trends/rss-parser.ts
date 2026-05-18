import { XMLParser } from "fast-xml-parser";
import { hashId, safeJsonParse } from "./fetch-utils";
import type { LanguageHint, RawSignal, SourceConfig } from "./types";

export interface ParsedFeedItem {
  title: string;
  description?: string;
  link?: string;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  htmlEntities: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

export function stripHtml(input = ""): string {
  return decodeHtmlEntities(input)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeHtmlEntities(input = ""): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

export function normalizeWhitespace(input = ""): string {
  return input.replace(/\s+/g, " ").trim();
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function readString(value: unknown): string | undefined {
  if (typeof value === "string") return stripHtml(value);
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return stripHtml(obj["#text"]);
    if (typeof obj["@_href"] === "string") return stripHtml(obj["@_href"]);
  }
  return undefined;
}

function itemFromObject(raw: Record<string, unknown>): ParsedFeedItem | null {
  const title = readString(raw.title ?? raw["atom:title"] ?? raw.name ?? raw.headline);
  if (!title) return null;

  const description = readString(raw.description ?? raw.summary ?? raw.content ?? raw["content:encoded"] ?? raw.snippet);
  const linkCandidate = raw.link;
  let link = readString(linkCandidate) ?? readString(raw.url ?? raw.guid);
  if (Array.isArray(linkCandidate)) {
    const first = linkCandidate.find((candidate) => typeof candidate === "string" || typeof candidate === "object");
    link = readString(first) ?? link;
  }
  const publishedAt = parseDateString(
    readString(raw.pubDate ?? raw.published ?? raw.updated ?? raw.isoDate ?? raw.date ?? raw.created_at),
  );

  return {
    title: normalizeWhitespace(title),
    description: description ? normalizeWhitespace(description) : undefined,
    link,
    publishedAt,
    metadata: { rawKeys: Object.keys(raw).slice(0, 20) },
  };
}

function parseDateString(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function parseFeedItems(body: string, contentType = ""): ParsedFeedItem[] {
  if (!body.trim()) return [];
  const maybeJson = contentType.includes("json") || body.trimStart().startsWith("{") || body.trimStart().startsWith("[");
  if (maybeJson) {
    const json = safeJsonParse(body);
    const jsonItems = parseJsonItems(json);
    if (jsonItems.length > 0) return jsonItems;
  }

  if (body.includes("<rss") || body.includes("<feed") || body.includes("<?xml") || body.includes("<entry") || body.includes("<item")) {
    try {
      const parsed = parser.parse(body) as Record<string, unknown>;
      const rss = parsed.rss as Record<string, unknown> | undefined;
      const channel = rss?.channel as Record<string, unknown> | undefined;
      const feed = parsed.feed as Record<string, unknown> | undefined;
      const items = [
        ...asArray(channel?.item as Record<string, unknown> | Record<string, unknown>[] | undefined),
        ...asArray(feed?.entry as Record<string, unknown> | Record<string, unknown>[] | undefined),
        ...asArray((parsed as { item?: Record<string, unknown> | Record<string, unknown>[] }).item),
      ];
      return items.map(itemFromObject).filter(Boolean) as ParsedFeedItem[];
    } catch {
      // Continue to HTML fallback.
    }
  }

  return parseHtmlFallback(body);
}

function parseJsonItems(json: unknown): ParsedFeedItem[] {
  if (!json) return [];
  const containers: unknown[] = [];
  if (Array.isArray(json)) containers.push(json);
  if (typeof json === "object") {
    const root = json as Record<string, unknown>;
    containers.push(root.items, root.data, root.results, root.response, root.alerts, root.holidays);
    const children = (root.data as Record<string, unknown> | undefined)?.children;
    if (Array.isArray(children)) {
      containers.push(children.map((child) => (child as Record<string, unknown>).data));
    }
    const responseHolidays = (root.response as Record<string, unknown> | undefined)?.holidays;
    containers.push(responseHolidays);
  }

  return containers
    .flatMap((container) => (Array.isArray(container) ? container : []))
    .map((item) => (item && typeof item === "object" ? itemFromObject(item as Record<string, unknown>) : null))
    .filter(Boolean) as ParsedFeedItem[];
}

function parseHtmlFallback(body: string): ParsedFeedItem[] {
  const titleMatches = [...body.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((match) => stripHtml(match[1]));
  const headingMatches = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((match) => stripHtml(match[1]));
  return [...titleMatches, ...headingMatches]
    .filter((title, index, arr) => title && arr.indexOf(title) === index)
    .slice(0, 25)
    .map((title) => ({ title }));
}

export function feedItemsToSignals(items: ParsedFeedItem[], source: SourceConfig): RawSignal[] {
  const fetchedAt = new Date().toISOString();
  return items
    .filter((item) => item.title)
    .map((item, index) => ({
      id: `${source.name}:${hashId(`${item.title}|${item.link ?? ""}|${index}`)}`,
      source: source.name,
      sourceType: source.sourceType,
      rawTitle: item.title,
      rawDescription: item.description,
      url: item.link,
      publishedAt: item.publishedAt,
      fetchedAt,
      geo: "IN",
      languageHint: source.languageHint ?? detectLanguageHint(`${item.title} ${item.description ?? ""}`),
      categoryHint: source.categoryHint,
      reliabilityWeight: source.reliabilityWeight,
      metadata: item.metadata,
    }));
}

export function detectLanguageHint(text: string): LanguageHint {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasRoman = /[A-Za-z]/.test(text);
  if (hasDevanagari && hasRoman) return "mixed";
  if (hasDevanagari) return "hi";
  if (hasRoman) return "en";
  return "unknown";
}
