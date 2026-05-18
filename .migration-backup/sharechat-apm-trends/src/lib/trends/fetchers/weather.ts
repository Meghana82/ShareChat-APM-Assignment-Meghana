import { combineFetchResults, fetchTextWithHealth, hashId, missingSourceConfigResult, safeJsonParse } from "../fetch-utils";
import { parseFeedItems, stripHtml } from "../rss-parser";
import { getSourceConfig } from "../source-config";
import type { FetchResult, RawSignal } from "../types";

interface WttrCondition {
  temp_C?: string;
  FeelsLikeC?: string;
  weatherCode?: string;
  weatherDesc?: Array<{ value?: string }>;
  humidity?: string;
  precipMM?: string;
  windspeedKmph?: string;
}

interface WttrForecast {
  maxtempC?: string;
  mintempC?: string;
}

interface WttrArea {
  areaName?: Array<{ value?: string }>;
  region?: Array<{ value?: string }>;
}

interface WttrJson {
  current_condition?: WttrCondition[];
  nearest_area?: WttrArea[];
  weather?: WttrForecast[];
}

const STORM_CODES = new Set(["200", "386", "389"]);
const HEAVY_RAIN_CODES = new Set(["302", "305", "308", "356", "359"]);
const RAIN_CODES = new Set(["293", "296", "299", "353"]);

export async function fetchWeather(): Promise<FetchResult<RawSignal[]>> {
  const source = getSourceConfig("IMD");
  if (!source) return missingSourceConfigResult<RawSignal>("IMD");
  const startedAt = Date.now();
  const signals: RawSignal[] = [];
  const errors: string[] = [];
  let successfulEndpointCount = 0;

  await Promise.all(
    source.urls.map(async (url) => {
      const fetched = await fetchTextWithHealth(source, url);
      if (!fetched.ok) {
        errors.push(`${url}: ${fetched.error}`);
        return;
      }

      successfulEndpointCount += 1;
      const json = safeJsonParse(fetched.data.body);
      if (isWttrJson(json)) {
        signals.push(...wttrJsonToWeatherSignals(json, source.name, source.reliabilityWeight, url));
        return;
      }

      if (json) {
        signals.push(...legacyJsonToWeatherSignals(json, source.name, source.reliabilityWeight));
        return;
      }

      const items = parseFeedItems(fetched.data.body, fetched.data.contentType).slice(0, 30);
      signals.push(
        ...items.map((item, index) => ({
          id: `${source.name}:${hashId(`${item.title}|${index}`)}`,
          source: source.name,
          sourceType: "weather" as const,
          rawTitle: item.title,
          rawDescription: item.description,
          url: item.link,
          publishedAt: item.publishedAt,
          fetchedAt: new Date().toISOString(),
          geo: "IN",
          languageHint: "mixed" as const,
          categoryHint: "weather" as const,
          reliabilityWeight: source.reliabilityWeight,
          metadata: { endpoint: url },
        })),
      );
    }),
  );

  if (signals.length > 0) return combineFetchResults(source, startedAt, signals.slice(0, 80), errors);

  if (successfulEndpointCount > 0) {
    return {
      ok: true,
      source: source.name,
      data: [],
      health: {
        source: source.name,
        lastSuccessAt: new Date().toISOString(),
        lastError: errors.length ? errors.join(" | ") : undefined,
        itemCount: 0,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  return combineFetchResults(source, startedAt, [], errors);
}

function isWttrJson(json: unknown): json is WttrJson {
  return typeof json === "object" && json !== null && Array.isArray((json as WttrJson).current_condition);
}

function wttrJsonToWeatherSignals(json: WttrJson, source: string, reliabilityWeight: number, url: string): RawSignal[] {
  const current = json.current_condition?.[0];
  if (!current) return [];

  const city = cityFromWttr(json, url);
  const tempC = toNumber(current.temp_C);
  const feelsLikeC = toNumber(current.FeelsLikeC);
  const maxTempC = toNumber(json.weather?.[0]?.maxtempC) || tempC;
  const precipMM = toNumber(current.precipMM);
  const windKmph = toNumber(current.windspeedKmph);
  const code = current.weatherCode ?? "";
  const fetchedAt = new Date().toISOString();

  const makeSignal = (type: string, rawTitle: string, rawDescription: string): RawSignal => ({
    id: `${source}:${type}:${hashId(`${city}|${type}|${new Date().toDateString()}`)}`,
    source,
    sourceType: "weather",
    rawTitle,
    rawDescription,
    fetchedAt,
    geo: "IN",
    languageHint: "hi",
    categoryHint: type.includes("heat") || type.includes("rain") || type.includes("storm") ? "weather" : "public_safety",
    reliabilityWeight: reliabilityWeight * 0.85,
    metadata: { city, tempC, feelsLikeC, maxTempC, precipMM, windKmph, weatherCode: code, endpoint: url, provider: "wttr.in" },
  });

  const result: RawSignal[] = [];

  if (maxTempC >= 45) {
    result.push(makeSignal(
      "extreme_heat",
      `${city} में भीषण लू अलर्ट`,
      `${city} में अधिकतम तापमान ${maxTempC}°C तक जा सकता है। लोग गर्मी और लू से बचाव के उपाय देख रहे हैं।`,
    ));
  } else if (maxTempC >= 42 || feelsLikeC >= 44) {
    result.push(makeSignal(
      "heat_wave",
      `${city} में लू का अलर्ट`,
      `${city} में तापमान ${maxTempC}°C और महसूस तापमान ${feelsLikeC || maxTempC}°C के आसपास है। गर्मी से सावधान रहने की चर्चा बढ़ रही है।`,
    ));
  }

  if (STORM_CODES.has(code) || windKmph >= 65) {
    result.push(makeSignal(
      "storm",
      `${city} में आंधी-तूफान का अलर्ट`,
      `${city} में तेज हवा और तूफानी मौसम की संभावना है। लोग मौसम और सुरक्षा अपडेट देख रहे हैं।`,
    ));
  } else if (HEAVY_RAIN_CODES.has(code) || precipMM >= 15) {
    result.push(makeSignal(
      "heavy_rain",
      `${city} में भारी बारिश`,
      `${city} में भारी बारिश का संकेत है। लोग रास्तों, जलभराव और मौसम अपडेट देख रहे हैं।`,
    ));
  } else if (RAIN_CODES.has(code) || precipMM >= 5) {
    result.push(makeSignal(
      "rain",
      `${city} में बारिश`,
      `${city} में बारिश का मौसम बना हुआ है। लोग स्थानीय मौसम और बाहर निकलने से पहले अपडेट देख रहे हैं।`,
    ));
  }

  return result;
}

function cityFromWttr(json: WttrJson, url: string): string {
  const area = json.nearest_area?.[0];
  const cityFromResponse = area?.areaName?.[0]?.value;
  if (cityFromResponse) return cityFromResponse;
  const match = url.match(/wttr\.in\/([^?]+)/i);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "भारत";
}

function legacyJsonToWeatherSignals(json: unknown, source: string, reliabilityWeight: number): RawSignal[] {
  const fetchedAt = new Date().toISOString();
  const rows = flattenObjects(json).slice(0, 80);
  return rows
    .map((row, index) => {
      const titleParts = [
        valueOf(row, ["district", "districtName", "state", "stateName", "city"]),
        valueOf(row, ["warning", "alert", "message", "phenomena", "weather", "desc", "description"]),
      ].filter(Boolean);
      const title = stripHtml(titleParts.join(" ")).trim();
      if (!title || title.length < 4) return null;
      return {
        id: `${source}:${hashId(`${title}|${index}`)}`,
        source,
        sourceType: "weather" as const,
        rawTitle: title,
        rawDescription: stripHtml(valueOf(row, ["details", "message", "description", "warningtext"]) ?? ""),
        publishedAt: undefined,
        fetchedAt,
        geo: "IN",
        languageHint: "mixed" as const,
        categoryHint: "weather" as const,
        reliabilityWeight,
        metadata: row,
      };
    })
    .filter(Boolean) as RawSignal[];
}

function flattenObjects(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.flatMap(flattenObjects);
  if (!input || typeof input !== "object") return [];
  const obj = input as Record<string, unknown>;
  const hasPrimitive = Object.values(obj).some((value) => typeof value === "string" || typeof value === "number");
  const nested = Object.values(obj).flatMap(flattenObjects);
  return hasPrimitive ? [obj, ...nested] : nested;
}

function valueOf(row: Record<string, unknown>, keys: string[]): string | undefined {
  const lowerMap = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const value = lowerMap.get(key.toLowerCase());
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return undefined;
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
