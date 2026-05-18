export type TrendTimeModeName =
  | "early_morning_status"
  | "midnight_devotional"
  | "daytime_live_pulse"
  | "evening_entertainment_sports"
  | "night_cooling";

export interface TrendTimeMode {
  mode: TrendTimeModeName;
  istHour: number;
  dailyRhythmTop4Cap: number;
  dailyRhythmTop10Cap: number;
  breakingNewsBoost: number;
  utilityPriceBoost: number;
  sportsBoost: number;
  entertainmentBoost: number;
  devotionalBoost: number;
  publicSafetyBoost: number;
  minLiveSourceBackedItems: number;
  reason: string;
}

export function isDevotionalSurfaceMode(timeMode: TrendTimeMode): boolean {
  return timeMode.mode === "early_morning_status" || timeMode.mode === "midnight_devotional";
}

export function getTrendTimeMode(now = new Date()): TrendTimeMode {
  const istHour = getIstHour(now);

  // ── Midnight & pre-dawn: 23:00–04:59 IST ─────────────────────────────────
  // Bharat users post past midnight — especially on Mondays when Shiva bhakts
  // stay awake for late-night vigil content. Devotional and status content
  // dominates this window; breaking news is rare after 11 PM.
  if (istHour >= 23 || istHour < 5) {
    return {
      mode: "midnight_devotional",
      istHour,
      dailyRhythmTop4Cap: 4,
      dailyRhythmTop10Cap: 5,
      breakingNewsBoost: 4,
      utilityPriceBoost: 3,
      sportsBoost: 3,
      entertainmentBoost: 5,
      devotionalBoost: 16,
      publicSafetyBoost: 5,
      minLiveSourceBackedItems: 3,
      reason: "Midnight ShareChat surface mirrors early-morning behaviour: devotional, status, and weekday-seed content dominates while urgent public-safety signals are still surfaced.",
    };
  }

  if (istHour >= 5 && istHour < 10) {
    return {
      mode: "early_morning_status",
      istHour,
      dailyRhythmTop4Cap: 3,
      dailyRhythmTop10Cap: 4,
      breakingNewsBoost: 8,
      utilityPriceBoost: 5,
      sportsBoost: 4,
      entertainmentBoost: 4,
      devotionalBoost: 10,
      publicSafetyBoost: 8,
      minLiveSourceBackedItems: 4,
      reason: "Morning ShareChat surface leans into greeting, devotional, observance, and status culture while still allowing urgent live signals.",
    };
  }
  if (istHour >= 10 && istHour < 16) {
    return {
      mode: "daytime_live_pulse",
      istHour,
      dailyRhythmTop4Cap: 1,
      dailyRhythmTop10Cap: 2,
      breakingNewsBoost: 10,
      utilityPriceBoost: 10,
      sportsBoost: 6,
      entertainmentBoost: 6,
      devotionalBoost: 2,
      publicSafetyBoost: 10,
      minLiveSourceBackedItems: 7,
      reason: "Midday ShareChat surface shifts from greeting/status to live news, utility, public safety, politics, and entertainment signals.",
    };
  }
  if (istHour >= 16 && istHour < 23) {
    return {
      mode: "evening_entertainment_sports",
      istHour,
      dailyRhythmTop4Cap: 1,
      dailyRhythmTop10Cap: 2,
      breakingNewsBoost: 8,
      utilityPriceBoost: 6,
      sportsBoost: 10,
      entertainmentBoost: 10,
      devotionalBoost: 3,
      publicSafetyBoost: 8,
      minLiveSourceBackedItems: 7,
      reason: "Evening ShareChat surface gives more room to sports, entertainment, and live conversations while preserving urgent news.",
    };
  }
  return {
    mode: "night_cooling",
    istHour,
    dailyRhythmTop4Cap: 1,
    dailyRhythmTop10Cap: 2,
    breakingNewsBoost: 6,
    utilityPriceBoost: 4,
    sportsBoost: 4,
    entertainmentBoost: 6,
    devotionalBoost: 6,
    publicSafetyBoost: 10,
    minLiveSourceBackedItems: 6,
    reason: "Late-night ShareChat surface cools down but keeps urgent public-safety signals above evergreen rhythm content.",
  };
}

function getIstHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Number(parts.find((part) => part.type === "hour")?.value ?? now.getHours());
}
