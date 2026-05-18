import type { SourceHealth } from "./types";

export interface FetchSummary {
  generatedAt: string;
  sourceCount: number;
  successfulSourceCount: number;
  failedSourceCount: number;
  rawSignalCount: number;
  filteredSignalCount?: number;
  clusterCount?: number;
  notes: string[];
}

let lastSourceHealth: SourceHealth[] = [];
let lastFetchSummary: FetchSummary | null = null;

export function setLastSourceHealth(health: SourceHealth[]) {
  lastSourceHealth = health;
}

export function getLastSourceHealth(): SourceHealth[] {
  return lastSourceHealth;
}

export function setLastFetchSummary(summary: FetchSummary) {
  lastFetchSummary = summary;
}

export function getLastFetchSummary(): FetchSummary | null {
  return lastFetchSummary;
}
