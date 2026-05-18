import festivals from "../../data/indian-festivals.json";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { hashId } from "./fetch-utils";
import type { FestivalSeed, RawSignal } from "./types";

export function getActiveFestivalSignals(today = new Date()): RawSignal[] {
  const now = startOfDay(today);
  const fetchedAt = today.toISOString();
  return (festivals as FestivalSeed[]).flatMap((seed, index) => {
    const eventDate = startOfDay(adjustFestivalDate(seed.date ?? seed.approximate_date, today.getFullYear()));
    const endDate = startOfDay(adjustFestivalDate(seed.end_date ?? seed.date ?? seed.approximate_date, today.getFullYear()));
    const activeStart = addDays(eventDate, -seed.preseed_window_days);
    const activeEnd = endDate;
    if (now < activeStart || now > activeEnd) return [];

    const isFestivalToday = now >= eventDate && now <= endDate;
    const isFestivalPreseed = now >= activeStart && now < eventDate;
    const daysFromFestival = Math.abs(differenceInCalendarDays(eventDate, now));
    const reliabilityWeight = seed.culturalPriority === "high" ? 0.7 : seed.culturalPriority === "medium" ? 0.6 : 0.55;

    return seed.seed_tags.slice(0, 2).map((tag, tagIndex) => ({
      id: `Internal Festival Calendar:${hashId(`${seed.event}|${tag}|${index}|${tagIndex}`)}`,
      source: "Internal Festival Calendar",
      sourceType: "festival_calendar" as const,
      rawTitle: `${seed.event} ${tag.replace("#", "")}`,
      rawDescription: `${seed.displayLabel ?? seed.event} — ${seed.regions.join(", ")} में पूजा, व्रत और शुभकामनाओं से जुड़ी चर्चा।`,
      publishedAt: fetchedAt,
      fetchedAt,
      geo: "IN",
      languageHint: "hi" as const,
      categoryHint: seed.category,
      reliabilityWeight,
      metadata: {
        seed,
        isBackfillSeed: true,
        isActiveFestivalSeed: true,
        isFestivalToday,
        isFestivalPreseed,
        daysFromFestival,
        activeStart: activeStart.toISOString(),
        activeEnd: activeEnd.toISOString(),
        displayLabel: seed.displayLabel,
        culturalPriority: seed.culturalPriority ?? "medium",
      },
    }));
  });
}

export function getFestivalTagFreshnessStatus(tag: string, today = new Date()): {
  known: boolean;
  active: boolean;
  isFestivalToday: boolean;
  isFestivalPreseed: boolean;
  daysFromFestival?: number;
  isLongDevotionalSeason: boolean;
} {
  const normalizedTag = tag.toLowerCase();
  const now = startOfDay(today);

  for (const seed of festivals as FestivalSeed[]) {
    const tags = seed.seed_tags.map((item) => item.toLowerCase());
    if (!tags.includes(normalizedTag)) continue;

    const eventDate = startOfDay(adjustFestivalDate(seed.date ?? seed.approximate_date, today.getFullYear()));
    const endDate = startOfDay(adjustFestivalDate(seed.end_date ?? seed.date ?? seed.approximate_date, today.getFullYear()));
    const activeStart = addDays(eventDate, -seed.preseed_window_days);
    const activeEnd = endDate;
    const isFestivalToday = now >= eventDate && now <= endDate;
    const isFestivalPreseed = now >= activeStart && now < eventDate;
    const active = now >= activeStart && now <= activeEnd;
    return {
      known: true,
      active,
      isFestivalToday,
      isFestivalPreseed,
      daysFromFestival: differenceInCalendarDays(eventDate, now),
      isLongDevotionalSeason: seed.preseed_window_days >= 21 || /sawan/i.test(seed.english_name),
    };
  }

  return {
    known: false,
    active: false,
    isFestivalToday: false,
    isFestivalPreseed: false,
    isLongDevotionalSeason: false,
  };
}

function adjustFestivalDate(dateString: string, year: number): Date {
  const date = new Date(dateString);
  date.setUTCFullYear(year);
  return date;
}
