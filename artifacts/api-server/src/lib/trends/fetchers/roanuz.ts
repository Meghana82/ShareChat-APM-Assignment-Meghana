import { combineFetchResults, missingSourceConfigResult } from "../fetch-utils";
import { getSourceConfig } from "../source-config";
import type { FetchResult, RawSignal } from "../types";

export async function fetchRoanuz(): Promise<FetchResult<RawSignal[]>> {
  const source = getSourceConfig("Roanuz");
  if (!source) return missingSourceConfigResult<RawSignal>("Roanuz");
  const startedAt = Date.now();
  if (!process.env.ROANUZ_API_KEY) {
    return combineFetchResults(source, startedAt, [], ["ROANUZ_API_KEY missing; live cricket facts skipped gracefully"]);
  }

  // Roanuz endpoints vary by account/product. This prototype intentionally does not invent live cricket
  // score/toss/wicket facts. When configured, this fetcher is the place to add account-specific calls.
  return combineFetchResults(source, startedAt, [], ["ROANUZ_API_KEY present, but account-specific endpoint not configured"]);
}
