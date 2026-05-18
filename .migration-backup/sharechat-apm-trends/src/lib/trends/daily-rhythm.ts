import observances from "../../data/observances.json";
import { hashId } from "./fetch-utils";
import type { RawSignal, TrendCategory } from "./types";

type RhythmType = "weekday" | "time_of_day" | "devotional_anchor" | "observance" | "seasonal";

interface RhythmSeed {
  tag: string;
  title: string;
  displayLabel: string;
  category: TrendCategory;
  rhythmType: RhythmType;
  description: string;
  priority?: "high" | "medium" | "low";
}

const WEEKDAY_SEEDS: Record<number, RhythmSeed> = {
  0: {
    tag: "#शुभ_रविवार",
    title: "शुभ रविवार",
    displayLabel: "🌷 शुभ रविवार",
    category: "viral",
    rhythmType: "weekday",
    description: "रविवार की शुभकामनाएं और पॉजिटिव स्टेटस पोस्ट शेयर हो रहे हैं।",
    priority: "high",
  },
  1: {
    tag: "#सोमवार_भोलेनाथ",
    title: "सोमवार भोलेनाथ",
    displayLabel: "🙏 सोमवार भोलेनाथ",
    category: "devotional",
    rhythmType: "weekday",
    description: "सोमवार को भोलेनाथ भक्ति और शुभकामना पोस्ट शेयर हो रहे हैं।",
    priority: "high",
  },
  2: {
    tag: "#मंगलवार_हनुमान",
    title: "मंगलवार हनुमान जी",
    displayLabel: "🙏 मंगलवार हनुमान जी",
    category: "devotional",
    rhythmType: "weekday",
    description: "मंगलवार को हनुमान भक्ति और जय बजरंगबली पोस्ट शेयर हो रहे हैं।",
    priority: "high",
  },
  3: {
    tag: "#शुभ_बुधवार",
    title: "शुभ बुधवार",
    displayLabel: "🌼 शुभ बुधवार",
    category: "viral",
    rhythmType: "weekday",
    description: "बुधवार की शुभकामना और स्टेटस पोस्ट शेयर हो रहे हैं।",
  },
  4: {
    tag: "#गुरुवार_साईं_भक्ति",
    title: "गुरुवार साईं भक्ति",
    displayLabel: "🙏 गुरुवार साईं भक्ति",
    category: "devotional",
    rhythmType: "weekday",
    description: "गुरुवार को साईं भक्ति और आशीर्वाद पोस्ट शेयर हो रहे हैं।",
  },
  5: {
    tag: "#शुक्रवार_लक्ष्मी_पूजा",
    title: "शुक्रवार लक्ष्मी पूजा",
    displayLabel: "🪔 शुक्रवार लक्ष्मी पूजा",
    category: "devotional",
    rhythmType: "weekday",
    description: "शुक्रवार को लक्ष्मी पूजा और शुभकामना पोस्ट शेयर हो रहे हैं।",
  },
  6: {
    tag: "#शनिवार_शनिदेव",
    title: "शनिवार शनिदेव",
    displayLabel: "🪔 शनिवार शनिदेव पूजा",
    category: "devotional",
    rhythmType: "weekday",
    description: "शनिवार को शनिदेव पूजा और भक्ति पोस्ट शेयर हो रहे हैं।",
  },
};

const DEVOTIONAL_ANCHORS: RhythmSeed[] = [
  {
    tag: "#माँ_वैष्णो_देवी",
    title: "माँ वैष्णो देवी",
    displayLabel: "🙏 माँ वैष्णो देवी",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "माँ वैष्णो देवी भक्ति और जय माता दी पोस्ट शेयर हो रहे हैं।",
    priority: "high",
  },
  {
    tag: "#हनुमान_भक्ति",
    title: "हनुमान भक्ति",
    displayLabel: "🙏 हनुमान भक्ति",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "हनुमान भक्ति, चालीसा और आशीर्वाद पोस्ट शेयर हो रहे हैं।",
  },
  {
    tag: "#भोलेनाथ_भक्ति",
    title: "भोलेनाथ भक्ति",
    displayLabel: "🙏 भोलेनाथ भक्ति",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "भोलेनाथ भक्ति और हर हर महादेव पोस्ट शेयर हो रहे हैं।",
  },
  {
    tag: "#सूर्यदेव_प्रणाम",
    title: "सूर्यदेव प्रणाम",
    displayLabel: "🌞 सूर्यदेव प्रणाम",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "सूर्यदेव प्रणाम और सकारात्मक सुबह के स्टेटस शेयर हो रहे हैं।",
  },
];

export function getDailyRhythmSignals(now = new Date(), locale = "hi"): RawSignal[] {
  const ist = toIstParts(now);
  const seeds: RhythmSeed[] = [WEEKDAY_SEEDS[ist.weekday]];
  const timeSeed = timeOfDaySeed(ist.hour);
  if (timeSeed) seeds.push(timeSeed);
  // Keep daily rhythm strong but not spammy: one evergreen devotional anchor by default.
  // Day-specific devotional tags are already represented in weekday seeds (e.g. Monday भोलेनाथ, Tuesday हनुमान).
  seeds.push(DEVOTIONAL_ANCHORS[0]);
  seeds.push(...observanceSeeds(ist.month, ist.day));
  const seasonal = seasonalSeed(ist.month);
  if (seasonal) seeds.push(seasonal);

  return seeds.map((seed, index) => rhythmSeedToSignal(seed, now, locale, index));
}

function timeOfDaySeed(hour: number): RhythmSeed | null {
  if (hour >= 5 && hour < 11) {
    return {
      tag: "#सुप्रभात_संदेश",
      title: "सुप्रभात संदेश",
      displayLabel: "🌞 सुप्रभात संदेश",
      category: "viral",
      rhythmType: "time_of_day",
      description: "सुबह-सुबह सुप्रभात और पॉजिटिव स्टेटस पोस्ट शेयर हो रहे हैं।",
      priority: "high",
    };
  }
  if (hour >= 17 && hour < 20) {
    return {
      tag: "#शुभ_संध्या",
      title: "शुभ संध्या",
      displayLabel: "🌇 शुभ संध्या",
      category: "viral",
      rhythmType: "time_of_day",
      description: "शाम के शुभ संध्या स्टेटस और शुभकामना पोस्ट शेयर हो रहे हैं।",
    };
  }
  if (hour >= 20 && hour < 23) {
    return {
      tag: "#शुभ_रात्रि",
      title: "शुभ रात्रि",
      displayLabel: "🌙 शुभ रात्रि",
      category: "viral",
      rhythmType: "time_of_day",
      description: "रात के शुभ रात्रि और स्टेटस पोस्ट शेयर हो रहे हैं।",
    };
  }
  return null;
}

function observanceSeeds(month: number, day: number): RhythmSeed[] {
  const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return (observances as Array<{ date: string; event: string; seed_tags: string[]; displayLabel: string; category: TrendCategory }>).filter((item) => item.date === key).map((item) => ({
    tag: item.seed_tags[0],
    title: item.event,
    displayLabel: item.displayLabel,
    category: item.category,
    rhythmType: "observance" as const,
    description: `आज ${item.event} पर जानकारी और शुभकामना पोस्ट शेयर हो रहे हैं।`,
    priority: "medium" as const,
  }));
}

function seasonalSeed(month: number): RhythmSeed | null {
  if (month === 5 || month === 6) {
    return {
      tag: "#गर्मी_से_बचाव",
      title: "गर्मी से बचाव",
      displayLabel: `${String.fromCodePoint(0x1f305)} गर्मी में धूप से बचने के उपाय 🥵🌞`,
      category: "weather",
      rhythmType: "seasonal",
      description: "गर्मी और धूप से बचने के आसान उपाय लोग शेयर कर रहे हैं।",
      priority: "high",
    };
  }
  return null;
}

function rhythmSeedToSignal(seed: RhythmSeed, now: Date, locale: string, index: number): RawSignal {
  const fetchedAt = now.toISOString();
  return {
    id: `ShareChat Daily Rhythm Calendar:${hashId(`${seed.tag}|${fetchedAt}|${index}`)}`,
    source: "ShareChat Daily Rhythm Calendar",
    sourceType: "daily_rhythm",
    rawTitle: `${seed.title} ${seed.tag}`,
    rawDescription: seed.description,
    publishedAt: fetchedAt,
    fetchedAt,
    geo: "IN",
    languageHint: locale === "hi" ? "hi" : "mixed",
    categoryHint: seed.category,
    reliabilityWeight: 0.65,
    metadata: {
      isDailyRhythm: true,
      rhythmType: seed.rhythmType,
      displayLabel: seed.displayLabel,
      priority: seed.priority ?? "medium",
      productionNote: "Prototype proxy for ShareChat internal post velocity, tag taps, shares, creator participation, and status posting patterns.",
    },
  };
}

function toIstParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: weekdayMap[parts.weekday] ?? date.getDay(),
  };
}
