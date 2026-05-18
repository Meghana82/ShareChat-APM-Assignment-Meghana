import { bucketForTrend } from "./interest-buckets";
import { validateFinalTrendQuality } from "./final-quality";
import { getTrendTimeMode, isDevotionalSurfaceMode, type TrendTimeMode } from "./time-mode";
import type { RankedTrend } from "./types";

type Predicate = (trend: RankedTrend) => boolean;

export function selectTopSurfaceTags(validTrends: RankedTrend[], modeOrDate: TrendTimeMode | Date = new Date()): RankedTrend[] {
  const timeMode = modeOrDate instanceof Date ? getTrendTimeMode(modeOrDate) : modeOrDate;
  const normalized = uniqueByTag(validTrends
    .map((trend) => repairSurfaceTrend(trend))
    .map((trend) => ({ ...trend, isTopSurfaceCandidate: false, surfaceSlot: null, surfaceReason: null })));
  const eligible = normalized
    .filter((trend) => trend.bharatRelevanceScore >= 70 && trend.safety.status !== "review_required" && trend.safety.status !== "blocked")
    .filter((trend) => validateFinalTrendQuality(trend).ok)
    .sort((a, b) => surfaceScore(b, timeMode) - surfaceScore(a, timeMode));

  const selected: RankedTrend[] = [];
  const used = new Set<string>();

  if (timeMode.mode === "midnight_devotional") {
    // Late-night/early-Monday: Shiva devotional content dominates (vigil posting).
    // Pick devotional + greeting alternately so all 4 spotlight slots fill with
    // bhakti/weekday-greeting content before any urgent-live news gets a slot.
    pick(isDevotionalOrFestival, "Midnight devotional/bhakti rhythm");
    pick(isGreetingOrStatus, "Midnight weekday greeting/status rhythm");
    pick(isDevotionalOrFestival, "Midnight second bhakti/Shiva rhythm");
    pick(isGreetingOrStatus, "Midnight second weekday greeting/status");
    pick(isObservance, "Midnight observance rhythm");
    if (selected.length < 4) pick(isUrgentLive, "Urgent live signal");
  } else if (timeMode.mode === "early_morning_status") {
    pick(isGreetingOrStatus, "Morning greeting/status rhythm");
    pick(isDevotionalOrFestival, "Morning devotional/bhakti rhythm");
    pick(isObservance, "Day observance rhythm");
    pick(isSeasonalWeather, "Seasonal utility/weather rhythm");
    if (selected.length < 4) pick(isUrgentLive, "Urgent live signal");
  } else if (timeMode.mode === "daytime_live_pulse") {
    pick(isUrgentLive, "Midday public-safety/news live pulse");
    pick(isUtilityPrice, "Midday utility/price live pulse");
    pick(isCelebrityPoliticsCrossover, "Midday celebrity-politics crossover");
    if (selected.length < 3) pick(isCelebrityPoliticsOrNational, "Midday politics/celebrity conversation");
    pick((trend) => isUrgentLive(trend) && !selected.some((item) => item.tag === trend.tag), "Second urgent live signal");
    if (selected.length < 4) pick(isDailyRhythm, "One capped daily rhythm support tag");
  } else if (timeMode.mode === "evening_entertainment_sports") {
    pick(isSports, "Evening sports/IPL pulse");
    pick(isEntertainment, "Evening entertainment pulse");
    pick(isUrgentLive, "Urgent evening news signal");
    pick((trend) => isDailyRhythm(trend) || isViral(trend), "Evening devotional/status/viral support");
  } else {
    pick(isUrgentLive, "Late-night urgent public-safety signal");
    pick(isEntertainment, "Late-night entertainment pulse");
    pick(isDevotionalOrFestival, "Late-night devotional/status support");
    pick(isUtilityPrice, "Late-night utility support");
  }

  for (const trend of eligible) {
    if (selected.length >= 4) break;
    add(trend, "Highest remaining valid trend");
  }

  const rest = normalized
    .filter((trend) => !used.has(trend.tag))
    .sort((a, b) => finalScore(b) - finalScore(a));

  const orderedSelected = orderSelectedForMode(selected, timeMode);
  return [...orderedSelected, ...rest].map((trend, index) => ({
    ...trend,
    rank: index + 1,
    ...(trend.isTopSurfaceCandidate ? { surfaceSlot: index + 1 } : {}),
  }));

  function pick(predicate: Predicate, reason: string) {
    if (selected.length >= 4) return;
    const trend = eligible.find((item) => !used.has(item.tag) && predicate(item) && canAddByCap(item));
    if (trend) add(trend, reason);
  }

  function add(trend: RankedTrend, reason: string) {
    selected.push({
      ...trend,
      isTopSurfaceCandidate: true,
      surfaceSlot: selected.length + 1,
      surfaceReason: reason,
    });
    used.add(trend.tag);
  }

  function canAddByCap(trend: RankedTrend): boolean {
    if (!countsAsDailySurface(trend, timeMode)) return true;
    return selected.filter((item) => countsAsDailySurface(item, timeMode)).length < timeMode.dailyRhythmTop4Cap;
  }
}

function surfaceScore(trend: RankedTrend, timeMode: TrendTimeMode): number {
  let score = finalScore(trend);
  if (isUrgentLive(trend)) score += timeMode.breakingNewsBoost + timeMode.publicSafetyBoost;
  if (isUtilityPrice(trend)) score += timeMode.utilityPriceBoost;
  if (isSports(trend)) score += timeMode.sportsBoost;
  if (isEntertainment(trend)) score += timeMode.entertainmentBoost;
  if (isDevotionalOrFestival(trend) || isGreetingOrStatus(trend)) score += timeMode.devotionalBoost;
  if (isDailyRhythm(trend) && !isDevotionalSurfaceMode(timeMode)) score -= 14;
  return score;
}

function finalScore(trend: RankedTrend): number {
  return ((trend.debug?.finalRankScore as number | undefined) ?? trend.heatScore) + trend.bharatRelevanceScore * 0.05;
}

function countsAsDailySurface(trend: RankedTrend, timeMode: TrendTimeMode): boolean {
  if (!isDailyRhythm(trend)) return false;
  if (isDevotionalSurfaceMode(timeMode) && isSeasonalWeather(trend)) return false;
  return true;
}

function textOf(trend: RankedTrend): string {
  return `${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`.toLowerCase();
}

function isDailyRhythm(trend: RankedTrend): boolean {
  return bucketForTrend(trend) === "daily_rhythm_status" || trend.sourceTypes.includes("daily_rhythm");
}

function isGreetingOrStatus(trend: RankedTrend): boolean {
  return isDailyRhythm(trend) && /शुभ|सुप्रभात|संध्या|रात्रि|स्टेटस|रविवार|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार/i.test(textOf(trend));
}

function isDevotionalOrFestival(trend: RankedTrend): boolean {
  return ["devotional", "festival"].includes(trend.category) || /वैष्णो|माता|भक्ति|हनुमान|भोलेनाथ|शनि|वट|पूजा|व्रत|शिव|महाकाल|केदारनाथ|महादेव|भजन|आरती|जय_महाकाल|हर_हर_महादेव/i.test(textOf(trend));
}

function isObservance(trend: RankedTrend): boolean {
  return /दिवस|day|observance|जयंती|पंचांग|दूरसंचार/i.test(textOf(trend));
}

function isSeasonalWeather(trend: RankedTrend): boolean {
  return trend.category === "weather" || /गर्मी|धूप|लू|मौसम|बारिश|weather|seasonal/i.test(textOf(trend));
}

function isUrgentLive(trend: RankedTrend): boolean {
  if (isUtilityPrice(trend)) return false;
  return ["public_safety", "news"].includes(trend.category) || /आग|हादसा|मौत|वायरस|इबोला|ब्रेकिंग|fire|death|accident|virus|outbreak/i.test(textOf(trend));
}

function isUtilityPrice(trend: RankedTrend): boolean {
  return bucketForTrend(trend) === "utility_bazaar_prices" || /cng|lpg|पेट्रोल|डीजल|सोना|चांदी|कीमत|भाव|रेट|महंगा|महंगाई/i.test(textOf(trend));
}

function isCelebrityPoliticsOrNational(trend: RankedTrend): boolean {
  return isEntertainment(trend) || ["politics", "government"].includes(trend.category) || /cm|pm|सीएम|पीएम|मुख्यमंत्री|कमल|हासन|विजय|चुनाव|सरकार|मंत्री/i.test(textOf(trend));
}

function isCelebrityPoliticsCrossover(trend: RankedTrend): boolean {
  const text = textOf(trend);
  return /कमल|हासन|actor|actress|अभिनेता|अभिनेत्री|सेलेब्रिटी|celebrity/i.test(text) && /cm|pm|सीएम|पीएम|मुख्यमंत्री|मंत्री|विजय|party|पार्टी/i.test(text);
}

function isSports(trend: RankedTrend): boolean {
  return trend.category === "sports" || /ipl|kkr|gt|csk|mi|rcb|dc|rr|srh|pbks|lsg|क्रिकेट|मैच/i.test(textOf(trend));
}

function isEntertainment(trend: RankedTrend): boolean {
  return ["entertainment", "movies", "music"].includes(trend.category) || /बॉलीवुड|फिल्म|कमल|हासन|विजय|गॉसिप|actor|actress|movie|celebrity/i.test(textOf(trend));
}

function isViral(trend: RankedTrend): boolean {
  return trend.category === "viral" || /viral|मीम|स्टेटस|गॉसिप/i.test(textOf(trend));
}

function orderSelectedForMode(selected: RankedTrend[], timeMode: TrendTimeMode): RankedTrend[] {
  if (timeMode.mode !== "daytime_live_pulse") return selected;
  return [...selected].sort((a, b) => daytimeOrder(a) - daytimeOrder(b));
}

function daytimeOrder(trend: RankedTrend): number {
  if (isUrgentLive(trend)) return 0;
  if (isUtilityPrice(trend)) return 1;
  if (isCelebrityPoliticsCrossover(trend) || isCelebrityPoliticsOrNational(trend)) return 2;
  if (isDailyRhythm(trend)) return 3;
  return 4;
}

function repairSurfaceTrend(trend: RankedTrend): RankedTrend {
  const repaired = validateFinalTrendQuality(trend).repaired ?? trend;
  const originalText = `${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description}`;
  if (/कमल[\s_]*हासन|kamal[\s_]*haasan/i.test(originalText) && /CM[\s_]*विजय|cm[\s_]*vijay|सीएम[\s_]*विजय|विजय/i.test(originalText)) {
    return {
      ...repaired,
      tag: "#कमल_हासन_CM_विजय",
      title: "कमल हासन और CM विजय मुलाकात",
      displayLabel: "📢 CM विजय से मिले कमल हासन 🤝",
      description: "कमल हासन और CM विजय की मुलाकात चर्चा में है।",
      category: "entertainment",
      interestBucket: "bollywood_gossip_entertainment",
    };
  }
  return repaired;
}

function uniqueByTag(trends: RankedTrend[]): RankedTrend[] {
  const seen = new Set<string>();
  return trends.filter((trend) => {
    const key = trend.tag.normalize("NFC").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
