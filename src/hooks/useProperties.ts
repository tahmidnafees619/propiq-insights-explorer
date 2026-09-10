/**
 * Property records for the dashboard table.
 *
 * Fetches `GET /api/properties`, falling back to the bundled showcase
 * dataset if the API is unreachable.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet, toQuery } from '@/lib/api';
import { DEMO_PROPERTIES } from '@/lib/demo-data';
import type { Property, PropertyListResponse } from '@/types';

export interface UsePropertiesOptions {
  limit?: number;
  offset?: number;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  waterfront?: 0 | 1;
  search?: string;
}

const DEMO_RESPONSE: PropertyListResponse = {
  total: DEMO_PROPERTIES.length,
  limit: DEMO_PROPERTIES.length,
  offset: 0,
  count: DEMO_PROPERTIES.length,
  has_more: false,
  source: 'demo',
  properties: DEMO_PROPERTIES,
};

export function useProperties(options: UsePropertiesOptions = {}) {
  const { limit = 500, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['properties', options],
    queryFn: async (): Promise<PropertyListResponse> => {
      const search = toQuery({
        limit,
        offset,
        min_price: options.minPrice,
        max_price: options.maxPrice,
        min_bedrooms: options.minBedrooms,
        waterfront: options.waterfront,
        search: options.search,
      });

      try {
        return await apiGet<PropertyListResponse>(`/api/properties${search}`);
      } catch {
        return DEMO_RESPONSE;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const response = query.data ?? DEMO_RESPONSE;

  return {
    ...query,
    /** The rows themselves, so callers can map without unwrapping. */
    data: response.properties as Property[],
    total: response.total,
    isDemo: response.source === 'demo',
  };
}
