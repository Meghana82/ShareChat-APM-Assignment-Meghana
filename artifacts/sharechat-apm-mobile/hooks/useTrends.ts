import {
  useGetTrends,
  getTrends,
  getGetTrendsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const TRENDS_PARAMS = { limit: 10 as const };

export function useTrends() {
  return useGetTrends(TRENDS_PARAMS);
}

export function useRefreshTrends() {
  const qc = useQueryClient();
  return async () => {
    const freshData = await getTrends({ ...TRENDS_PARAMS, forceRefresh: true });
    qc.setQueryData(getGetTrendsQueryKey(TRENDS_PARAMS), freshData);
  };
}
