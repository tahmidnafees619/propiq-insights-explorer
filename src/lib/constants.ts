export const COLORS = {
  bg: '#060B18',
  surface: '#0D1526',
  elevated: '#111D35',
  border: '#1E2D4A',
  primary: '#3B82F6',
  emerald: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textDim: '#475569',
};

export const GRADE_COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#84CC16', '#EAB308', '#F59E0B', '#EF4444'];

export function gradeColor(grade: number) {
  // 1..13 mapped to blue->red
  const idx = Math.min(GRADE_COLORS.length - 1, Math.max(0, Math.floor((grade - 1) / 13 * GRADE_COLORS.length)));
  return GRADE_COLORS[idx];
}

export const FEATURE_LABELS: Record<string, string> = {
  sqft_living: 'Living Area',
  grade: 'Construction Grade',
  lat: 'Latitude',
  sqft_above: 'Above-Ground Area',
  yr_built: 'Year Built',
  bathrooms: 'Bathrooms',
  sqft_lot: 'Lot Size',
  waterfront: 'Waterfront',
  view: 'View Quality',
  bedrooms: 'Bedrooms',
};

export const MOCK_FEATURE_IMPORTANCE = [
  { feature: 'sqft_living', importance: 0.312 },
  { feature: 'grade', importance: 0.198 },
  { feature: 'lat', importance: 0.134 },
  { feature: 'sqft_above', importance: 0.098 },
  { feature: 'yr_built', importance: 0.076 },
  { feature: 'bathrooms', importance: 0.054 },
  { feature: 'sqft_lot', importance: 0.042 },
  { feature: 'waterfront', importance: 0.038 },
  { feature: 'view', importance: 0.029 },
  { feature: 'bedrooms', importance: 0.019 },
].map(f => ({ ...f, label: FEATURE_LABELS[f.feature] ?? f.feature }));
