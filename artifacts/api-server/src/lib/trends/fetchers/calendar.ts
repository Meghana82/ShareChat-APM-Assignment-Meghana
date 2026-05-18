import festivals from "../../../data/indian-festivals.json";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { combineFetchResults, fetchTextWithHealth, hashId, missingSourceConfigResult, safeJsonParse } from "../fetch-utils";
import { getActiveFestivalSignals } from "../festival-resolver";
import { getSourceConfig } from "../source-config";
import type { FestivalSeed, FetchResult, RawSignal } from "../types";

export async function fetchCalendarSignals(): Promise<FetchResult<RawSignal[]>> {
  const internalSource = getSourceConfig("Internal Festival Calendar");
  const calendarific = getSourceConfig("Calendarific");
  if (!internalSource || !calendarific) return missingSourceConfigResult<RawSignal>("Calendar Sources");

  const startedAt = Date.now();
  const now = new Date();
  const signals: RawSignal[] = getActiveFestivalSignals(now);
  const errors: string[] = [];

  if (process.env.CALENDARIFIC_API_KEY) {
    const url = new URL("https://calendarific.com/api/v2/holidays");
    url.searchParams.set("api_key", process.env.CALENDARIFIC_API_KEY);
    url.searchParams.set("country", "IN");
    url.searchParams.set("year", String(now.getFullYear()));
    url.searchParams.set("type", "national,religious,observance");
    const fetched = await fetchTextWithHealth(calendarific, url.toString());
    if (fetched.ok) {
      const json = safeJsonParse(fetched.data.body) as { response?: { holidays?: Array<Record<string, unknown>> } } | null;
      const holidays = json?.response?.holidays ?? [];
      signals.push(...holidays.slice(0, 40).map((holiday, index) => calendarificHolidayToSignal(holiday, index)));
    } else {
      errors.push(fetched.error);
    }
  } else {
    errors.push("CALENDARIFIC_API_KEY missing; using internal festival JSON only");
  }

  return combineFetchResults(internalSource, startedAt, signals, errors);
}

export function activeFestivalSignals(seedData: FestivalSeed[], now = new Date()): RawSignal[] {
  if (seedData === (festivals as FestivalSeed[])) return getActiveFestivalSignals(now);
  const fetchedAt = now.toISOString();
  return seedData.flatMap((seed, index) => {
    const eventDate = startOfDay(adjustFestivalDate(seed.approximate_date, now.getFullYear()));
    const endDate = startOfDay(adjustFestivalDate(seed.end_date ?? seed.approximate_date, now.getFullYear()));
    const activeStart = addDays(eventDate, -seed.preseed_window_days);
    const activeEnd = endDate;
    const today = startOfDay(now);
    const isActive = today >= activeStart && today <= activeEnd;
    const diff = Math.abs(differenceInCalendarDays(eventDate, today));
    if (!isActive) return [];
    return seed.seed_tags.slice(0, 2).map((tag, tagIndex) => ({
      id: `Internal Festival Calendar:${hashId(`${seed.event}|${tag}|${index}|${tagIndex}`)}`,
      source: "Internal Festival Calendar",
      sourceType: "festival_calendar" as const,
      rawTitle: `${seed.event} ${tag.replace("#", "")}`,
      rawDescription: `${seed.regions.join(", ")} में ${seed.event} से जुड़ी तैयारी और चर्चा।`,
      publishedAt: fetchedAt,
      fetchedAt,
      geo: "IN",
      languageHint: "hi" as const,
      categoryHint: seed.category,
      reliabilityWeight: 0.55,
      metadata: { seed, isBackfillSeed: true, isActiveFestivalSeed: true, daysFromFestival: diff, activeStart: activeStart.toISOString(), activeEnd: activeEnd.toISOString() },
    }));
  });
}

function adjustFestivalDate(dateString: string, year: number): Date {
  const date = new Date(dateString);
  date.setUTCFullYear(year);
  return date;
}

function calendarificHolidayToSignal(holiday: Record<string, unknown>, index: number): RawSignal {
  const name = typeof holiday.name === "string" ? holiday.name : "India holiday";
  const description = typeof holiday.description === "string" ? holiday.description : undefined;
  const date = holiday.date as Record<string, unknown> | undefined;
  const iso = typeof date?.iso === "string" ? new Date(date.iso).toISOString() : undefined;
  return {
    id: `Calendarific:${hashId(`${name}|${index}`)}`,
    source: "Calendarific",
    sourceType: "festival_calendar",
    rawTitle: name,
    rawDescription: description,
    publishedAt: iso,
    fetchedAt: new Date().toISOString(),
    geo: "IN",
    languageHint: "en",
    categoryHint: "festival",
    reliabilityWeight: 0.55,
    metadata: { holiday },
  };
}
