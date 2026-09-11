export const COLORS = {
  bg: "#070D10",
  surface: "#111A1F",
  elevated: "#192329",
  border: "#28363E",
  primary: "#2F99DA",
  emerald: "#3DAE91",
  danger: "#D5533F",
  warning: "#D0A74E",
  text: "#EDF1F2",
  textMuted: "#91A2AC",
  textDim: "#394B56",
};

/**
 * Construction grade is ordered, so it gets the sequential data ramp rather
 * than a set of unrelated hues. Low grades read cool, high grades read warm,
 * and none of it borrows the interactive accent.
 */
export const GRADE_COLORS = [
  "#18486D",
  "#1E6794",
  "#2C8DBA",
  "#3DB0C2",
  "#45BAA3",
  "#85B356",
  "#CEBE5A",
];

export function gradeColor(grade: number) {
  // 1..13 mapped to blue->red
  const idx = Math.min(
    GRADE_COLORS.length - 1,
    Math.max(0, Math.floor(((grade - 1) / 13) * GRADE_COLORS.length)),
  );
  return GRADE_COLORS[idx];
}

export const FEATURE_LABELS: Record<string, string> = {
  sqft_living: "Living Area",
  grade: "Construction Grade",
  lat: "Latitude",
  sqft_above: "Above-Ground Area",
  yr_built: "Year Built",
  bathrooms: "Bathrooms",
  sqft_lot: "Lot Size",
  waterfront: "Waterfront",
  view: "View Quality",
  bedrooms: "Bedrooms",
};

export const MOCK_FEATURE_IMPORTANCE = [
  { feature: "sqft_living", importance: 0.312 },
  { feature: "grade", importance: 0.198 },
  { feature: "lat", importance: 0.134 },
  { feature: "sqft_above", importance: 0.098 },
  { feature: "yr_built", importance: 0.076 },
  { feature: "bathrooms", importance: 0.054 },
  { feature: "sqft_lot", importance: 0.042 },
  { feature: "waterfront", importance: 0.038 },
  { feature: "view", importance: 0.029 },
  { feature: "bedrooms", importance: 0.019 },
].map((f) => ({ ...f, label: FEATURE_LABELS[f.feature] ?? f.feature }));
