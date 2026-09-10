/**
 * Shared types.
 *
 * These mirror the FastAPI response models in `propiq-backend/app/schemas/`.
 * Keep the two in step: the backend test suite asserts the field names the
 * dashboard reads here.
 */

/** Whether a payload came from real records or the bundled showcase dataset. */
export type DataSource = "database" | "demo";

export interface Property {
  id: number;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft_living: number;
  sqft_lot: number;
  floors: number;
  waterfront: 0 | 1;
  view: number;
  condition: number;
  grade: number;
  sqft_above: number;
  sqft_basement: number;
  yr_built: number;
  yr_renovated?: number;
  /** Optional: absent on older records, so always guard before calling string methods. */
  zipcode?: string | null;
  lat: number;
  long: number;
  sqft_living15?: number;
  sqft_lot15?: number;
  year_sold?: number | null;
  month_sold?: number | null;
  house_age?: number | null;
  was_renovated?: number | null;
}

export interface PropertyListResponse {
  total: number;
  limit: number;
  offset: number;
  count: number;
  has_more: boolean;
  source: DataSource;
  properties: Property[];
}

export interface PredictionInput {
  sqft_living: number;
  sqft_lot: number;
  sqft_above: number;
  sqft_basement: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  grade: number;
  condition: number;
  waterfront: 0 | 1;
  view: number;
  yr_built: number;
  sqft_living15: number;
  sqft_lot15: number;
  lat: number;
  long: number;
}

/** One row of the value breakdown. */
export interface ValueDriver {
  label: string;
  value: number;
  percent: number;
}

/** Raw `POST /api/predict` response. */
export interface PredictionResponse {
  predicted_price: number;
  price_formatted: string;
  margin_of_error: number;
  price_low: number;
  price_high: number;
  confidence_percent: number;
  confidence_level: "high" | "medium" | "low";
  percentile: number;
  breakdown: ValueDriver[];
  model_used: string;
  model_r2: number;
  extrapolated: boolean;
  notes: string[];
  input_summary: Record<string, number>;
}

/** View-model shape the predictor components render. */
export interface PredictionResult {
  estimate: number;
  margin: number;
  /** Interval coverage as a fraction, e.g. 0.9 for a 90% interval. */
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  breakdown: ValueDriver[];
  percentile: number;
  similar_low: number;
  similar_high: number;
  modelUsed: string;
  extrapolated: boolean;
  notes: string[];
}

export interface BedroomStat {
  bedrooms: number;
  avg_price: number;
  count: number;
}

export interface GradeStat {
  grade: number;
  avg_price: number;
  count: number;
}

export interface MonthlyStat {
  month: string;
  month_number: number;
  avg_price: number;
  volume: number;
}

export interface PriceBucket {
  bucket: string;
  count: number;
  floor: number;
}

export interface ScatterPoint {
  sqft_living: number;
  price: number;
  grade: number;
}

export interface StatsResponse {
  total_properties: number;
  avg_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  model_r2: number;
  mae: number;
  avg_price_by_bedrooms: BedroomStat[];
  grade_breakdown: GradeStat[];
  monthly: MonthlyStat[];
  price_distribution: PriceBucket[];
  scatter_sample: ScatterPoint[];
  waterfront_premium_percent: number;
  source: DataSource;
}

export interface FeatureImportance {
  feature: string;
  label: string;
  importance: number;
  importance_percent: number;
}

export interface ModelMetrics {
  model_name: string;
  trained_at: string | null;
  n_samples: number;
  n_features: number;
  r2: number;
  r2_log: number;
  mae: number;
  rmse: number;
  mape: number;
  median_ape: number;
  within_10_pct: number;
  within_20_pct: number;
  leaderboard: ModelLeaderboardRow[];
}

export interface ModelLeaderboardRow {
  model: string;
  r2: number;
  r2_log: number;
  mae: number;
  rmse: number;
  mape: number;
  median_ape: number;
}

export interface KPIData {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  sub: string;
  icon: string;
  accent: "blue" | "green" | "amber" | "red";
}

/** Aggregates for one ZIP code, used to shade the price choropleth. */
export interface ZipcodeStat {
  zipcode: string;
  median_price: number;
  avg_price: number;
  price_per_sqft: number;
  count: number;
}

export interface ZipcodeStatsResponse {
  zipcodes: ZipcodeStat[];
  /** Lowest ZIP median — the colour scale's floor. */
  min_median: number;
  /** Highest ZIP median — the colour scale's ceiling. */
  max_median: number;
  source: DataSource;
}
