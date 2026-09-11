/**
 * Ranked price drivers from the trained model.
 *
 * Fetches `GET /api/feature-importance`, falling back to the shipped model's
 * recorded importances if the API is unreachable.
 */

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { DEMO_FEATURE_IMPORTANCE } from "@/lib/demo-data";
import type { FeatureImportance } from "@/types";

export function useFeatureImportance(limit?: number) {
  const query = useQuery({
    queryKey: ["feature-importance", limit ?? "all"],
    queryFn: async (): Promise<FeatureImportance[]> => {
      try {
        const path = limit ? `/api/feature-importance?limit=${limit}` : "/api/feature-importance";
        return await apiGet<FeatureImportance[]>(path);
      } catch {
        return limit ? DEMO_FEATURE_IMPORTANCE.slice(0, limit) : DEMO_FEATURE_IMPORTANCE;
      }
    },
    staleTime: Infinity,
    retry: 1,
  });

  return { ...query, data: query.data ?? DEMO_FEATURE_IMPORTANCE };
}
