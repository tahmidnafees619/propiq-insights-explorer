/**
 * Per-ZIP market aggregates for the price choropleth.
 *
 * Fetches `GET /api/stats/by-zipcode`, falling back to the bundled dataset so
 * the map still renders when the API is unreachable.
 */

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { DEMO_ZIPCODE_STATS } from "@/lib/demo-data";
import type { ZipcodeStatsResponse } from "@/types";

export const zipcodeStatsQueryKey = ["stats", "by-zipcode"] as const;

export function useZipcodeStats() {
  const query = useQuery({
    queryKey: zipcodeStatsQueryKey,
    queryFn: async (): Promise<ZipcodeStatsResponse> => {
      try {
        return await apiGet<ZipcodeStatsResponse>("/api/stats/by-zipcode");
      } catch {
        // Offline or API down: shade the map from bundled data rather than
        // showing an empty county.
        return DEMO_ZIPCODE_STATS;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const data = query.data ?? DEMO_ZIPCODE_STATS;

  return {
    ...query,
    data,
    /** True while shading from bundled data rather than live records. */
    isDemo: data.source === "demo",
  };
}
