import { z } from "zod";

export const sourceTypeSchema = z.enum([
  "search_demand",
  "hindi_news",
  "national_news",
  "official_government",
  "official_finance",
  "weather",
  "public_safety",
  "video",
  "festival_calendar",
  "daily_rhythm",
  "sports",
  "social_experimental",
]);

export type SourceType = z.infer<typeof sourceTypeSchema>;

export const trendCategorySchema = z.enum([
  "sports",
  "news",
  "entertainment",
  "finance",
  "weather",
  "politics",
  "devotional",
  "festival",
  "education",
  "jobs",
  "viral",
  "public_safety",
  "government",
  "technology",
  "local",
  "movies",
  "music",
]);

export type TrendCategory = z.infer<typeof trendCategorySchema>;

export type LanguageHint = "hi" | "en" | "mixed" | "unknown";

export interface RawSignal {
  id: string;
  source: string;
  sourceType: SourceType;
  rawTitle: string;
  rawDescription?: string;
  url?: string;
  publishedAt?: string;
  fetchedAt: string;
  geo: "IN" | string;
  languageHint: LanguageHint;
  categoryHint?: TrendCategory;
  reliabilityWeight: number;
  metadata?: Record<string, unknown>;
}

export interface FilteredSignal extends RawSignal {
  normalizedText: string;
  tokens: string[];
  indiaHints: string[];
  hindiHints: string[];
  safetyFlags: string[];
  preliminaryCategory: TrendCategory;
  indiaHindiRelevanceScore: number;
}

export interface TrendCluster {
  id: string;
  canonicalTitle: string;
  aliases: string[];
  signals: FilteredSignal[];
  category: TrendCategory;
  sourceNames: string[];
  sourceTypes: SourceType[];
  firstSeenAt: string;
  lastSeenAt: string;
  indiaHindiRelevanceScore: number;
  crossSourceCount: number;
  crossSourceBoost: number;
  inputScore?: number;
}

export interface RankedTrend {
  rank: number;
  tag: string;
  title: string;
  displayLabel: string;
  description: string;
  category: TrendCategory;
  heatScore: number;
  bharatRelevanceScore: number;
  sources: string[];
  sourceTypes: SourceType[];
  trendStage: "emerging" | "rising" | "hot" | "peaking" | "cooling";
  whyTrending: string;
  sampleContent: {
    type: "summary";
    text: string;
  };
  safety: {
    status: "safe" | "limited" | "review_required" | "blocked";
    reasons: string[];
  };
  signalSummary: {
    externalValidationScore: number;
    crossSourceCount: number;
    freshnessScore: number;
    reliabilityScore: number;
    regionalRelevanceScore: number;
  };
  generatedAt: string;
  interestBucket?: string;
  feedPlacement?: "hero" | "standard";
  isTopSurfaceCandidate?: boolean;
  surfaceSlot?: number | null;
  surfaceReason?: string | null;
  debug?: Record<string, unknown>;
}

export interface CoverageAudit {
  candidatePoolByBucket: Record<string, number>;
  returnedByBucket: Record<string, number>;
  missingImportantBuckets: Array<string | { bucket: string; reason: string }>;
  dominantSourceFamilies: string[];
  bucketDiagnostics?: Record<string, {
    rawCandidateCount: number;
    afterRelevanceCount?: number;
    afterCrossSourceCount?: number;
    afterCanonicalizationCount?: number;
    afterQualityGateCount?: number;
    returnedCount: number;
    topRejectionReasons: Array<string | { reason: string; count: number }>;
    action?: string;
  }>;
  note: string;
}

export interface MixSummary {
  dailyRhythmCount: number;
  observanceCount: number;
  seasonalUtilityCount: number;
  sportsCount: number;
  newsGovernmentCount: number;
  festivalDevotionalCount: number;
  entertainmentViralCount: number;
  weatherLocalCount: number;
  financeEducationJobsCount: number;
  utilityPriceCount: number;
  diversityApplied: boolean;
  dominantSourceFamilies: string[];
  notes: string[];
}

export interface ApiResponse {
  generatedAt: string;
  cache: {
    status: "fresh" | "cached" | "stale_fallback";
    cacheWindowMinutes: 30;
    note: string;
  };
  meta: {
    requestedLocale: "hi";
    geo: "IN";
    sourceCount: number;
    rawSignalCount: number;
    filteredSignalCount: number;
    clusterCount: number;
    returnedCount: number;
    assumptions: string[];
    mixSummary?: MixSummary;
    timeMode?: {
      mode: string;
      istHour: number;
      dailyRhythmTop4Cap: number;
      dailyRhythmTop10Cap: number;
      reason: string;
    };
    coverageAudit?: CoverageAudit;
    returnedCountWarning?: {
      requiredByAssignment: 10;
      actual: number;
      reason: string;
      attemptedBackfillSources: string[];
    };
  };
  trends: RankedTrend[];
  debug?: Record<string, unknown>;
}

export interface SourceConfig {
  name: string;
  sourceType: SourceType;
  urls: string[];
  reliabilityWeight: number;
  purpose: string;
  userAgent: string;
  enabled: boolean;
  requiresKey?: string;
  languageHint?: LanguageHint;
  categoryHint?: TrendCategory;
  indiaFilteredByDesign?: boolean;
  hindiNative?: boolean;
  official?: boolean;
}

export interface SourceHealth {
  source: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  itemCount: number;
  latencyMs: number;
}

export type FetchOk<T> = {
  ok: true;
  source: string;
  data: T;
  health: SourceHealth;
};

export type FetchErr = {
  ok: false;
  source: string;
  error: string;
  health: SourceHealth;
};

export type FetchResult<T> = FetchOk<T> | FetchErr;

export interface CrossSourceValidation {
  crossSourceCount: number;
  crossSourceBoost: number;
  independentSourceNames: string[];
  validationLevel: "low" | "medium" | "high" | "authority";
}

export interface ScoredCluster extends TrendCluster {
  inputScore: number;
  scoringDebug: {
    externalValidationScore: number;
    googleDemandScore: number;
    hindiNewsScore: number;
    officialScore: number;
    videoScore: number;
    regionalRelevanceScore: number;
    freshnessScore: number;
    reliabilityScore: number;
    rawHeat: number;
    culturalBoost: number;
    categoryDecay: number;
    safetyPenalty: number;
    spamPenalty: number;
    fatiguePenalty: number;
  };
}

export interface PipelineOptions {
  limit: number;
  debug: boolean;
  previousCache?: RankedTrend[];
}

export interface LlmMetadataItem {
  clusterId: string;
  tag: string;
  title: string;
  displayLabel: string;
  description: string;
  category: TrendCategory;
  whyTrending: string;
  sampleContent: { type: "summary"; text: string };
}

export interface FestivalSeed {
  event: string;
  english_name: string;
  regions: string[];
  languages: string[];
  aliases?: string[];
  date?: string;
  approximate_date: string;
  end_date?: string;
  preseed_window_days: number;
  seed_tags: string[];
  displayLabel?: string;
  culturalPriority?: "high" | "medium" | "low";
  category: "festival" | "devotional";
}
