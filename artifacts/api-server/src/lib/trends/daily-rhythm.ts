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

const WEEKDAY_SEED_SETS: Record<number, RhythmSeed[]> = {
  0: [
    {
      tag: "#\u0936\u0941\u092d_\u0930\u0935\u093f\u0935\u093e\u0930",
      title: "\u0936\u0941\u092d \u0930\u0935\u093f\u0935\u093e\u0930",
      displayLabel: "\ud83c\udf37 \u0936\u0941\u092d \u0930\u0935\u093f\u0935\u093e\u0930",
      category: "viral",
      rhythmType: "weekday",
      description: "\u0930\u0935\u093f\u0935\u093e\u0930 \u0915\u0940 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e\u090f\u0902 \u0914\u0930 \u092a\u0949\u091c\u093f\u091f\u093f\u0935 \u0938\u094d\u091f\u0947\u091f\u0938 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
    {
      tag: "#\u0938\u0902\u0921\u0947_\u092b\u0928\u0921\u0947",
      title: "\u0938\u0902\u0921\u0947 \u092b\u0928\u0921\u0947",
      displayLabel: "\ud83d\ude04 \u0938\u0902\u0921\u0947 \u092b\u0928\u0921\u0947",
      category: "viral",
      rhythmType: "weekday",
      description: "\u0930\u0935\u093f\u0935\u093e\u0930 \u0915\u094b \u092e\u094c\u091c-\u092e\u0938\u094d\u0924\u0940 \u0914\u0930 \u092e\u0940\u092e \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "medium",
    },
  ],
  1: [
    {
      tag: "#\u0936\u0941\u092d_\u0938\u094b\u092e\u0935\u093e\u0930",
      title: "\u0936\u0941\u092d \u0938\u094b\u092e\u0935\u093e\u0930",
      displayLabel: "\ud83c\udf37 \u0936\u0941\u092d \u0938\u094b\u092e\u0935\u093e\u0930",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0915\u0940 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e\u090f\u0902 \u2014 \u092d\u094b\u0932\u0947\u0928\u093e\u0925 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u0938\u094b\u092e\u0935\u093e\u0930 \u0938\u094d\u091f\u0947\u091f\u0938 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
    {
      tag: "#\u0939\u0930_\u0939\u0930_\u092e\u0939\u093e\u0926\u0947\u0935",
      title: "\u0939\u0930 \u0939\u0930 \u092e\u0939\u093e\u0926\u0947\u0935",
      displayLabel: "\ud83d\udd31 \u0939\u0930 \u0939\u0930 \u092e\u0939\u093e\u0926\u0947\u0935",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0915\u094b \u0936\u093f\u0935 \u092d\u0915\u094d\u0924\u093f \u2014 \u0939\u0930 \u0939\u0930 \u092e\u0939\u093e\u0926\u0947\u0935 \u0914\u0930 \u092c\u094b\u0932 \u092c\u092e \u0915\u0947 \u0928\u093e\u0930\u0947 \u0917\u0942\u0902\u091c \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
    {
      tag: "#\u091c\u092f_\u092e\u0939\u093e\u0915\u093e\u0932",
      title: "\u091c\u092f \u092e\u0939\u093e\u0915\u093e\u0932",
      displayLabel: "\ud83d\ude4f \u091c\u092f \u092e\u0939\u093e\u0915\u093e\u0932",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0915\u094b \u092e\u0939\u093e\u0915\u093e\u0932 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u091c\u092f \u092e\u0939\u093e\u0915\u093e\u0932 \u0915\u0947 \u091c\u092f\u0915\u093e\u0930\u0947 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
    {
      tag: "#\u092c\u093e\u092c\u093e_\u0915\u0947\u0926\u093e\u0930\u0928\u093e\u0925",
      title: "\u092c\u093e\u092c\u093e \u0915\u0947\u0926\u093e\u0930\u0928\u093e\u0925",
      displayLabel: "\ud83d\uded5 \u092c\u093e\u092c\u093e \u0915\u0947\u0926\u093e\u0930\u0928\u093e\u0925",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0915\u094b \u0915\u0947\u0926\u093e\u0930\u0928\u093e\u0925 \u0927\u093e\u092e \u0915\u0940 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u0926\u0930\u094d\u0936\u0928 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
  ],
  2: [
    {
      tag: "#\u092e\u0902\u0917\u0932\u0935\u093e\u0930_\u0939\u0928\u0941\u092e\u093e\u0928",
      title: "\u092e\u0902\u0917\u0932\u0935\u093e\u0930 \u0939\u0928\u0941\u092e\u093e\u0928 \u091c\u0940",
      displayLabel: "\ud83d\ude4f \u092e\u0902\u0917\u0932\u0935\u093e\u0930 \u0939\u0928\u0941\u092e\u093e\u0928 \u091c\u0940",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u092e\u0902\u0917\u0932\u0935\u093e\u0930 \u0915\u094b \u0939\u0928\u0941\u092e\u093e\u0928 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u091c\u092f \u092c\u091c\u0930\u0902\u0917\u092c\u0932\u0940 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
    {
      tag: "#\u091c\u092f_\u092c\u091c\u0930\u0902\u0917\u092c\u0932\u0940",
      title: "\u091c\u092f \u092c\u091c\u0930\u0902\u0917\u092c\u0932\u0940",
      displayLabel: "\ud83d\ude4f \u091c\u092f \u092c\u091c\u0930\u0902\u0917\u092c\u0932\u0940",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u092e\u0902\u0917\u0932\u0935\u093e\u0930 \u0915\u094b \u0939\u0928\u0941\u092e\u093e\u0928 \u091a\u093e\u0932\u0940\u0938\u093e \u0914\u0930 \u092c\u091c\u0930\u0902\u0917\u092c\u0932\u0940 \u092d\u0915\u094d\u0924\u093f \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "medium",
    },
  ],
  3: [
    {
      tag: "#\u0936\u0941\u092d_\u092c\u0941\u0927\u0935\u093e\u0930",
      title: "\u0936\u0941\u092d \u092c\u0941\u0927\u0935\u093e\u0930",
      displayLabel: "\ud83c\udf3c \u0936\u0941\u092d \u092c\u0941\u0927\u0935\u093e\u0930",
      category: "viral",
      rhythmType: "weekday",
      description: "\u092c\u0941\u0927\u0935\u093e\u0930 \u0915\u0940 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e \u0914\u0930 \u0938\u094d\u091f\u0947\u091f\u0938 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "medium",
    },
  ],
  4: [
    {
      tag: "#\u0917\u0941\u0930\u0941\u0935\u093e\u0930_\u0938\u093e\u0908\u0902_\u092d\u0915\u094d\u0924\u093f",
      title: "\u0917\u0941\u0930\u0941\u0935\u093e\u0930 \u0938\u093e\u0908\u0902 \u092d\u0915\u094d\u0924\u093f",
      displayLabel: "\ud83d\ude4f \u0917\u0941\u0930\u0941\u0935\u093e\u0930 \u0938\u093e\u0908\u0902 \u092d\u0915\u094d\u0924\u093f",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u0917\u0941\u0930\u0941\u0935\u093e\u0930 \u0915\u094b \u0938\u093e\u0908\u0902 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u0906\u0936\u0940\u0930\u094d\u0935\u093e\u0926 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
  ],
  5: [
    {
      tag: "#\u0936\u0941\u0915\u094d\u0930\u0935\u093e\u0930_\u0932\u0915\u094d\u0937\u094d\u092e\u0940_\u092a\u0942\u091c\u093e",
      title: "\u0936\u0941\u0915\u094d\u0930\u0935\u093e\u0930 \u0932\u0915\u094d\u0937\u094d\u092e\u0940 \u092a\u0942\u091c\u093e",
      displayLabel: "\ud83e\udead \u0936\u0941\u0915\u094d\u0930\u0935\u093e\u0930 \u0932\u0915\u094d\u0937\u094d\u092e\u0940 \u092a\u0942\u091c\u093e",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u0936\u0941\u0915\u094d\u0930\u0935\u093e\u0930 \u0915\u094b \u0932\u0915\u094d\u0937\u094d\u092e\u0940 \u092a\u0942\u091c\u093e \u0914\u0930 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
  ],
  6: [
    {
      tag: "#\u0936\u0928\u093f\u0935\u093e\u0930_\u0936\u0928\u093f\u0926\u0947\u0935",
      title: "\u0936\u0928\u093f\u0935\u093e\u0930 \u0936\u0928\u093f\u0926\u0947\u0935",
      displayLabel: "\ud83e\udead \u0936\u0928\u093f\u0935\u093e\u0930 \u0936\u0928\u093f\u0926\u0947\u0935 \u092a\u0942\u091c\u093e",
      category: "devotional",
      rhythmType: "weekday",
      description: "\u0936\u0928\u093f\u0935\u093e\u0930 \u0915\u094b \u0936\u0928\u093f\u0926\u0947\u0935 \u092a\u0942\u091c\u093e \u0914\u0930 \u092d\u0915\u094d\u0924\u093f \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    },
  ],
};

const DEVOTIONAL_ANCHORS: RhythmSeed[] = [
  {
    tag: "#\u092e\u093e\u0901_\u0935\u0948\u0937\u094d\u0923\u094b_\u0926\u0947\u0935\u0940",
    title: "\u092e\u093e\u0901 \u0935\u0948\u0937\u094d\u0923\u094b \u0926\u0947\u0935\u0940",
    displayLabel: "\ud83d\ude4f \u092e\u093e\u0901 \u0935\u0948\u0937\u094d\u0923\u094b \u0926\u0947\u0935\u0940",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "\u092e\u093e\u0901 \u0935\u0948\u0937\u094d\u0923\u094b \u0926\u0947\u0935\u0940 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u091c\u092f \u092e\u093e\u0924\u093e \u0926\u0940 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
    priority: "high",
  },
  {
    tag: "#\u0939\u0928\u0941\u092e\u093e\u0928_\u092d\u0915\u094d\u0924\u093f",
    title: "\u0939\u0928\u0941\u092e\u093e\u0928 \u092d\u0915\u094d\u0924\u093f",
    displayLabel: "\ud83d\ude4f \u0939\u0928\u0941\u092e\u093e\u0928 \u092d\u0915\u094d\u0924\u093f",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "\u0939\u0928\u0941\u092e\u093e\u0928 \u092d\u0915\u094d\u0924\u093f, \u091a\u093e\u0932\u0940\u0938\u093e \u0914\u0930 \u0906\u0936\u0940\u0930\u094d\u0935\u093e\u0926 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
    priority: "medium",
  },
  {
    tag: "#\u092d\u094b\u0932\u0947\u0928\u093e\u0925_\u092d\u0915\u094d\u0924\u093f",
    title: "\u092d\u094b\u0932\u0947\u0928\u093e\u0925 \u092d\u0915\u094d\u0924\u093f",
    displayLabel: "\ud83d\ude4f \u092d\u094b\u0932\u0947\u0928\u093e\u0925 \u092d\u0915\u094d\u0924\u093f",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "\u092d\u094b\u0932\u0947\u0928\u093e\u0925 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u0939\u0930 \u0939\u0930 \u092e\u0939\u093e\u0926\u0947\u0935 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
    priority: "medium",
  },
  {
    tag: "#\u0938\u0942\u0930\u094d\u092f\u0926\u0947\u0935_\u092a\u094d\u0930\u0923\u093e\u092e",
    title: "\u0938\u0942\u0930\u094d\u092f\u0926\u0947\u0935 \u092a\u094d\u0930\u0923\u093e\u092e",
    displayLabel: "\ud83c\udf1e \u0938\u0942\u0930\u094d\u092f\u0926\u0947\u0935 \u092a\u094d\u0930\u0923\u093e\u092e",
    category: "devotional",
    rhythmType: "devotional_anchor",
    description: "\u0938\u0942\u0930\u094d\u092f\u0926\u0947\u0935 \u092a\u094d\u0930\u0923\u093e\u092e \u0914\u0930 \u0938\u0915\u093e\u0930\u093e\u0924\u094d\u092e\u0915 \u0938\u0941\u092c\u0939 \u0915\u0947 \u0938\u094d\u091f\u0947\u091f\u0938 \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
    priority: "low",
  },
];

export function getDailyRhythmSignals(now = new Date(), locale = "hi"): RawSignal[] {
  const ist = toIstParts(now);
  const weekdaySeeds: RhythmSeed[] = WEEKDAY_SEED_SETS[ist.weekday] ?? [];
  const seeds: RhythmSeed[] = [...weekdaySeeds];

  const timeSeed = timeOfDaySeed(ist.hour, ist.weekday);
  if (timeSeed) seeds.push(timeSeed);

  if (ist.weekday === 1) {
    seeds.push(DEVOTIONAL_ANCHORS[2]);
  } else {
    seeds.push(DEVOTIONAL_ANCHORS[0]);
  }

  seeds.push(...observanceSeeds(ist.month, ist.day));
  const seasonal = seasonalSeed(ist.month);
  if (seasonal) seeds.push(seasonal);

  return seeds.map((seed, index) => rhythmSeedToSignal(seed, now, locale, index));
}

function timeOfDaySeed(hour: number, weekday: number): RhythmSeed | null {
  // ── Midnight & pre-dawn: 23:00–04:59 IST ──────────────────────────────────
  // Bharat users post past midnight — especially on Mondays when Shiva bhakts
  // stay awake for late-night vigil content (Shivratri-style posting pattern).
  if (hour >= 23 || hour < 5) {
    if (weekday === 1) {
      return {
        tag: "#\u0938\u094b\u092e\u0935\u093e\u0930_\u0936\u093f\u0935_\u0935\u0902\u0926\u0928\u093e",
        title: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0936\u093f\u0935 \u0935\u0902\u0926\u0928\u093e",
        displayLabel: "\ud83d\udd49\ufe0f \u0938\u094b\u092e\u0935\u093e\u0930 \u0930\u093e\u0924\u094d\u0930\u093f \u0936\u093f\u0935 \u0935\u0902\u0926\u0928\u093e",
        category: "devotional",
        rhythmType: "time_of_day",
        description: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0915\u0940 \u0930\u093e\u0924 \u0915\u094b \u0936\u093f\u0935 \u092d\u0915\u094d\u0924 \u0926\u0947\u0930 \u0930\u093e\u0924 \u0924\u0915 \u091c\u093e\u0917 \u0915\u0930 \u092d\u093c\u094b\u0932\u0947\u0928\u093e\u0925 \u0915\u0947 \u091c\u092f\u0915\u093e\u0930\u0947 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
        priority: "high",
      };
    }
    return {
      tag: "#\u0936\u0941\u092d_\u0930\u093e\u0924\u094d\u0930\u093f",
      title: "\u0936\u0941\u092d \u0930\u093e\u0924\u094d\u0930\u093f",
      displayLabel: "\ud83c\udf19 \u0936\u0941\u092d \u0930\u093e\u0924\u094d\u0930\u093f",
      category: "viral",
      rhythmType: "time_of_day",
      description: "\u0930\u093e\u0924 \u0915\u0947 \u0936\u0941\u092d \u0930\u093e\u0924\u094d\u0930\u093f \u0938\u094d\u091f\u0947\u091f\u0938 \u0914\u0930 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "low",
    };
  }
  // ── Morning: 05:00–10:59 IST ───────────────────────────────────────────────
  if (hour >= 5 && hour < 11) {
    return {
      tag: "#\u0938\u0941\u092a\u094d\u0930\u092d\u093e\u0924_\u0938\u0902\u0926\u0947\u0936",
      title: "\u0938\u0941\u092a\u094d\u0930\u092d\u093e\u0924 \u0938\u0902\u0926\u0947\u0936",
      displayLabel: "\ud83c\udf1e \u0938\u0941\u092a\u094d\u0930\u092d\u093e\u0924 \u0938\u0902\u0926\u0947\u0936",
      category: "viral",
      rhythmType: "time_of_day",
      description: "\u0938\u0941\u092c\u0939-\u0938\u0941\u092c\u0939 \u0938\u0941\u092a\u094d\u0930\u092d\u093e\u0924 \u0914\u0930 \u092a\u0949\u091c\u093f\u091f\u093f\u0935 \u0938\u094d\u091f\u0947\u091f\u0938 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    };
  }
  // ── Midday: 11:00–15:59 IST ────────────────────────────────────────────────
  if (hour >= 11 && hour < 16) {
    if (weekday === 1) {
      return {
        tag: "#\u0938\u094b\u092e\u0935\u093e\u0930_\u0936\u093f\u0935_\u092d\u0915\u094d\u0924\u093f",
        title: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0936\u093f\u0935 \u092d\u0915\u094d\u0924\u093f",
        displayLabel: "\ud83d\udd31 \u0938\u094b\u092e\u0935\u093e\u0930 \u0936\u093f\u0935 \u092d\u0915\u094d\u0924\u093f",
        category: "devotional",
        rhythmType: "time_of_day",
        description: "\u0938\u094b\u092e\u0935\u093e\u0930 \u0926\u094b\u092a\u0939\u0930 \u0915\u094b \u0936\u093f\u0935 \u092d\u0915\u094d\u0924\u093f \u0914\u0930 \u092e\u0939\u093e\u0926\u0947\u0935 \u0915\u0947 \u091c\u092f\u0915\u093e\u0930\u0947 \u091c\u093e\u0930\u0940 \u0939\u0948\u0902\u0964",
        priority: "high",
      };
    }
    return {
      tag: "#\u0936\u0941\u092d_\u0926\u094b\u092a\u0939\u0930",
      title: "\u0936\u0941\u092d \u0926\u094b\u092a\u0939\u0930",
      displayLabel: "\u2600\ufe0f \u0936\u0941\u092d \u0926\u094b\u092a\u0939\u0930",
      category: "viral",
      rhythmType: "time_of_day",
      description: "\u0926\u094b\u092a\u0939\u0930 \u0915\u0940 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e \u0914\u0930 \u092a\u0949\u091c\u093f\u091f\u093f\u0935 \u0938\u094d\u091f\u0947\u091f\u0938 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "medium",
    };
  }
  // ── Evening: 17:00–19:59 IST ───────────────────────────────────────────────
  if (hour >= 17 && hour < 20) {
    return {
      tag: "#\u0936\u0941\u092d_\u0938\u0902\u0927\u094d\u092f\u093e",
      title: "\u0936\u0941\u092d \u0938\u0902\u0927\u094d\u092f\u093e",
      displayLabel: "\ud83c\udf07 \u0936\u0941\u092d \u0938\u0902\u0927\u094d\u092f\u093e",
      category: "viral",
      rhythmType: "time_of_day",
      description: "\u0936\u093e\u092e \u0915\u0947 \u0936\u0941\u092d \u0938\u0902\u0927\u094d\u092f\u093e \u0938\u094d\u091f\u0947\u091f\u0938 \u0914\u0930 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "medium",
    };
  }
  // ── Night: 20:00–22:59 IST ─────────────────────────────────────────────────
  if (hour >= 20 && hour < 23) {
    return {
      tag: "#\u0936\u0941\u092d_\u0930\u093e\u0924\u094d\u0930\u093f",
      title: "\u0936\u0941\u092d \u0930\u093e\u0924\u094d\u0930\u093f",
      displayLabel: "\ud83c\udf19 \u0936\u0941\u092d \u0930\u093e\u0924\u094d\u0930\u093f",
      category: "viral",
      rhythmType: "time_of_day",
      description: "\u0930\u093e\u0924 \u0915\u0947 \u0936\u0941\u092d \u0930\u093e\u0924\u094d\u0930\u093f \u0914\u0930 \u0938\u094d\u091f\u0947\u091f\u0938 \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "low",
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
    description: `\u0906\u091c ${item.event} \u092a\u0930 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0914\u0930 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e \u092a\u094b\u0938\u094d\u091f \u0936\u0947\u092f\u0930 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902\u0964`,
    priority: "medium" as const,
  }));
}

function seasonalSeed(month: number): RhythmSeed | null {
  if (month === 5 || month === 6) {
    return {
      tag: "#\u0917\u0930\u094d\u092e\u0940_\u0938\u0947_\u092c\u091a\u093e\u0935",
      title: "\u0917\u0930\u094d\u092e\u0940 \u0938\u0947 \u092c\u091a\u093e\u0935",
      displayLabel: `${String.fromCodePoint(0x1f305)} \u0917\u0930\u094d\u092e\u0940 \u092e\u0947\u0902 \u0927\u0942\u092a \u0938\u0947 \u092c\u091a\u0928\u0947 \u0915\u0947 \u0909\u092a\u093e\u092f \ud83e\udd75\ud83c\udf1e`,
      category: "weather",
      rhythmType: "seasonal",
      description: "\u0917\u0930\u094d\u092e\u0940 \u0914\u0930 \u0927\u0942\u092a \u0938\u0947 \u092c\u091a\u0928\u0947 \u0915\u0947 \u0906\u0938\u093e\u0928 \u0909\u092a\u093e\u092f \u0932\u094b\u0917 \u0936\u0947\u092f\u0930 \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
      priority: "high",
    };
  }
  return null;
}

function rhythmSeedToSignal(seed: RhythmSeed, now: Date, locale: string, index: number): RawSignal {
  const fetchedAt = now.toISOString();
  const isHighPriorityWeekday = seed.rhythmType === "weekday" && seed.priority === "high";
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
    reliabilityWeight: isHighPriorityWeekday ? 0.82 : 0.65,
    metadata: {
      isDailyRhythm: true,
      rhythmType: seed.rhythmType,
      displayLabel: seed.displayLabel,
      priority: seed.priority ?? "medium",
      isHighPriorityWeekday,
      productionNote: "Prototype proxy for ShareChat internal post velocity, tag taps, shares, creator participation, and status posting patterns.",
    },
  };
}

export function toIstParts(date: Date) {
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
