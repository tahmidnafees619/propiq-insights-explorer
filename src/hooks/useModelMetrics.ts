/**
 * Published accuracy of the deployed model.
 *
 * Fetches `GET /api/model/metrics` so the About page reports the model that
 * is actually serving traffic rather than a figure typed into the markup.
 */

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { DEMO_MODEL_METRICS } from "@/lib/demo-data";
import type { ModelMetrics } from "@/types";

export function useModelMetrics() {
  const query = useQuery({
    queryKey: ["model-metrics"],
    queryFn: async (): Promise<ModelMetrics> => {
      try {
        return await apiGet<ModelMetrics>("/api/model/metrics");
      } catch {
        return DEMO_MODEL_METRICS;
      }
    },
    staleTime: Infinity,
    retry: 1,
  });

  return { ...query, data: query.data ?? DEMO_MODEL_METRICS };
}
