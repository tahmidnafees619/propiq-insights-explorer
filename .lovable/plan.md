
# PropIQ — King County Real Estate Intelligence

A production-grade dark dashboard (Vercel × Bloomberg × Linear) with 4 pages, animated charts, an ML price predictor UI, and a clean file structure ready for backend wiring.

Note on stack: this project uses **TanStack Start + TanStack Router** (not React Router v6) and **TanStack Query** is already available. All routing will use file-based routes under `src/routes/`. Everything else in your spec stays as-is.

---

## 1. Design System (global)

Update `src/styles.css`:
- Import Inter from Google Fonts.
- Override tokens in `:root` to map to your palette in oklch equivalents:
  - background `#060B18`, surface `#0D1526`, elevated `#111D35`, border `#1E2D4A`
  - primary `#3B82F6`, secondary `#10B981`, destructive `#EF4444`, warning `#F59E0B`
  - foreground `#F1F5F9`, muted-foreground `#94A3B8`, muted `#475569`
- Add custom utilities: grain noise overlay, custom scrollbar, shimmer keyframes, card glow, gradient-top-border, hover-lift, count-up-ready classes.
- Force dark theme globally (apply `.dark` on `<html>` in `__root.tsx`).

## 2. Routing & Layout

File-based routes:
- `src/routes/__root.tsx` — adds `<html class="dark">`, mounts `Navbar`, `Sidebar`, grain overlay, page-transition wrapper around `<Outlet />`.
- `src/routes/index.tsx` → Dashboard
- `src/routes/predictor.tsx` → Predictor
- `src/routes/insights.tsx` → Insights
- `src/routes/about.tsx` → About

Layout components in `src/components/layout/`:
- `Navbar.tsx` — sticky, blurred, PropIQ logo (Prop white / IQ blue + house icon), nav links, GitHub outline button, "Model Live" green pulsing dot.
- `Sidebar.tsx` — collapsible 240↔60px with icons (Dashboard, Market Map, Price Predictor, Model Report, Settings), bottom model badge ("Gradient Boosting | R² 0.88"), collapse toggle. On mobile becomes a bottom tab bar.
- `PageWrapper.tsx` — fade + slide-up transition wrapper.

## 3. Page 1 — Dashboard

- **Hero KPI row** (`KPICard.tsx` × 4): Properties / Avg Price / R² / MAE. Gradient top border, icon glow, count-up animation, label uppercase tracked.
- **Charts row 60/40**:
  - `ScatterPlot.tsx` — price vs sqft_living, colored by grade, custom dark tooltip, subtle grid.
  - `BarChartBedrooms.tsx` — horizontal bars, blue→emerald gradient, rounded, value labels, grow-in animation.
- **Secondary charts (3 cols)**:
  - `PriceDistribution.tsx` — AreaChart with blue gradient fade.
  - `SeasonalTrendChart.tsx` (reused mini) — LineChart, dual Y-axis, avg price + volume.
  - `GradeVsPrice.tsx` — ComposedChart bar + line.
- **`PropertyTable.tsx`** — dark themed, alt rows, sortable headers, search input, pagination (10/page), currency cells color-coded vs median, hover row gets blue left border.

## 4. Page 2 — Predictor (50/50)

Left — `PropertyForm.tsx`:
- Grouped sections: Size & Layout (sliders + number inputs), Rooms (pill selectors for beds/baths/floors), Quality (custom gradient slider for grade 1–13 with red→amber→green track, condition 1–5), Features & Location (waterfront toggle that glows the card, view segmented control, year built with live age, neighbor sqft slider).
- Big gradient CTA "Analyze & Predict Price" with loading spinner state.

Right — results (staggered fade-in):
- `PredictionResult.tsx` — big $ value, ± margin in amber, confidence progress bar, blue glow.
- `ValueBreakdown.tsx` — small table: Base / Location / Quality / Final with +/- badges.
- `FeatureImportanceChart.tsx` — horizontal bar chart, top 8 features, green for top drivers, blue for rest.
- `ConfidenceGauge.tsx` — arc chart for percentile + similar-sold range text.
- Default `EmptyState` with SVG house illustration before predict.

## 5. Page 3 — Insights

- 3 insight cards (`InsightCard.tsx`): Waterfront premium +120%, Grade impact, Location effect.
- "What Drives Price?" ranked feature list with visual bars + plain English explanations.
- Map placeholder: styled grid with decorative lat/long labels and pulsing blue dots ("Connect API for live geo data").
- Full-width seasonal `AreaChart` with annotation markers on peak months.

## 6. Page 4 — About

Editorial layout: hero with title + tech pill badges; The Business Problem; My Approach (3 numbered step cards); Model Performance comparison table (best row highlighted blue); Architecture flow diagram in pure SVG/CSS (CSV → Python → SQLite → FastAPI → React); Tech stack 6-card grid; footer with GitHub button.

## 7. Data Layer (mock now, API later)

`src/lib/api.ts` — axios instance placeholder (commented) reading `VITE_API_URL`.
`src/lib/formatters.ts` — currency, compact numbers, percent.
`src/lib/constants.ts` — feature names, grade color scale, palette tokens.
`src/types/index.ts` — `Property`, `PredictionInput`, `PredictionResult`, `StatsResponse`, `FeatureImportance`, `KPIData`.

Hooks in `src/hooks/` (TanStack Query, return mock data with TODO comments):
- `useProperties.ts` — 50 generated realistic properties.
- `useStats.ts` — KPI + bedroom averages mock.
- `usePredict.ts` — mutation that simulates 800ms latency and returns a deterministic mock prediction.
- `useFeatureImportance.ts` — sorted importance mock.

## 8. Shared

- `LoadingSkeleton.tsx` — shimmer dark blocks.
- `ErrorState.tsx` — red-tinted card + retry.
- `EmptyState.tsx` — SVG illustration + helper text.

## 9. Micro-interactions

- Page transitions via framer-motion (already common) — install if missing.
- Recharts `animationDuration={800}` ease-out on every chart.
- Count-up KPI numbers (lightweight custom hook, no extra dep).
- Slider floating value badge above thumb.
- Staggered card reveal on prediction (100ms delays).
- Button active scale 0.97, hover translateY -1px.
- Custom chart tooltips (dark card, blue border).

## Technical notes

- Router: TanStack Router file routes (not react-router-dom).
- Data: TanStack Query for all hooks; mocks live inside `queryFn` until API ready.
- Charts: Recharts (install if not present).
- Icons: lucide-react (already installed).
- Animation: framer-motion (install).
- Forms/UI: shadcn primitives already in `src/components/ui/`.
- Strict TS, no external image URLs, every component renders with null-safe defaults.
- Note: `src/pages/` is not used in TanStack Start; page components live in `src/routes/` per framework convention. The spec's `src/pages/` folder is intentionally replaced by `src/routes/` to keep routing working — all components from the spec still exist with the same names.
- `.env.example` and `.env.local` added with `VITE_API_URL=http://localhost:8000`.

## Deliverable

A fully clickable, dark, animated, mock-data-powered PropIQ app across 4 routes with the complete component/hook/lib folder structure ready for backend wiring.
