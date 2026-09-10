/**
 * Price prediction.
 *
 * Unlike the read hooks, this one does **not** fall back to demo data: an
 * invented price presented as a model output would be misleading. Failures
 * surface as an `ApiError` the predictor page renders inline, with
 * field-level messages when the API rejected the input.
 */

import { useMutation } from '@tanstack/react-query';

import { ApiError, apiPost } from '@/lib/api';
import type { PredictionInput, PredictionResponse, PredictionResult } from '@/types';

/** Map the API payload onto the shape the result components render. */
function toResult(response: PredictionResponse): PredictionResult {
  return {
    estimate: response.predicted_price,
    margin: response.margin_of_error,
    confidence: response.confidence_percent / 100,
    confidenceLevel: response.confidence_level,
    breakdown: response.breakdown,
    percentile: response.percentile,
    similar_low: response.price_low,
    similar_high: response.price_high,
    modelUsed: response.model_used,
    extrapolated: response.extrapolated,
    notes: response.notes ?? [],
  };
}

export function usePredict() {
  return useMutation<PredictionResult, ApiError, PredictionInput>({
    mutationFn: async (input) => toResult(await apiPost<PredictionResponse>('/api/predict', input)),
    retry: false,
  });
}
