/**
 * Market statistics for the dashboard.
 *
 * Fetches `GET /api/stats`, falling back to the bundled showcase dataset if
 * the API is unreachable, so the dashboard is never blank.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api';
import { DEMO_STATS } from '@/lib/demo-data';
import type { StatsResponse } from '@/types';

export const statsQueryKey = ['stats'] as const;

export function useStats() {
  const query = useQuery({
    queryKey: statsQueryKey,
    queryFn: async (): Promise<StatsResponse> => {
      try {
        return await apiGet<StatsResponse>('/api/stats');
      } catch {
        // Offline or API down: fall back rather than surfacing an error, so
        // a static deployment still renders a complete dashboard.
        return DEMO_STATS;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const data = query.data ?? DEMO_STATS;

  return {
    ...query,
    data,
    /** True while showing bundled data rather than live records. */
    isDemo: data.source === 'demo',
  };
}
