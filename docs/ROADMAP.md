# Roadmap

Where PropIQ goes next, ordered by value per unit of effort rather than by
ambition. Each item states **why** it matters and **what it costs**, because a
roadmap of undifferentiated good ideas is not a roadmap.

Items marked **⚡** are high value and low effort — the ones to do first.

---

## Tier 1 — Do these first

### ⚡ 1. Switch prediction intervals to empirical quantiles

**Problem.** The shipped interval uses a normal band (`z·σ`) and empirically
covers **91.3%** where it claims 90%. Residual kurtosis is +4.18 — distinctly
heavier-tailed than a normal — so the Gaussian assumption is mis-specified
exactly in the tails that produce the worst misses. The band is also forced
symmetric, which the residuals are not.

**Fix.** `q05 = −0.2468` and `q95 = +0.2611` are **already computed and already
stored** in `metrics.json`. Reading those two numbers instead of `1.645·σ`
lands coverage on exactly 90.0% and makes the interval asymmetric in the
direction the data actually is.

**Cost.** A few lines in `ml_service.py`, plus a coverage test. Highest
value-per-line change left in the model layer.

### ⚡ 2. Finish the design-token migration

**Problem.** The palette was rebuilt around 83 CSS custom properties, but 25
component files still carry literal hex — `#2F99DA`, `#28363E`,
`rgba(7,13,16,0.9)`. `Navbar.tsx` was migrated to `var(--ink-500)`;
`MobileTabBar.tsx`, sitting directly beneath it, was not. The system exists and
is only partly adopted, which is the worst of both states: the indirection's
cost is paid, and its benefit — changing a colour in one place — is not.

**Fix.** Replace literal hex with `var(--*)` across `src/components` and
`src/routes`, then add an ESLint rule banning hex literals in JSX so it cannot
regress.

**Cost.** Mechanical, roughly an afternoon. Unblocks a light theme entirely.

### ⚡ 3. Frontend tests

**Problem.** 116 backend tests and zero frontend tests. The heaviest logic in
the repo — `lib/floorplan.ts`, the Web Mercator projection and quantile binning
in `PriceChoropleth`, the intro state machine in `IntroProvider` — is the part
with no automated coverage at all. The floor-plan invariants (no overlap,
inside footprint, every habitable room on an exterior wall) are *already
written as assertions*; they are simply not run by anything.

**Fix.** Vitest for the pure modules first — `floorplan`, `formatters`, the
projection — then React Testing Library for `IntroProvider`'s three gating
conditions and the demo-fallback path in the hooks.

**Cost.** Low, and it converts existing invariants into a safety net.

### 4. Temporal validation split

**Problem.** The 80/20 split is random, not chronological. The reported
accuracy measures interpolation within a 12-month window, not forecasting. For
anything calling itself a valuation model, that is the wrong evaluation.

**Fix.** Add a time-based split (train on months 1–9, test on 10–12) and
publish **both** figures. The chronological number will be worse. Publishing it
anyway is the point.

---

## Tier 2 — Meaningful product work

### 5. Market-conditions index

The single biggest limitation is that the data is from 2014–15. A time index —
even a coarse county-level appreciation factor — applied to historic
comparables would let the UI show *"sold for $415,000 in Nov 2014, roughly
$X today"*. This turns the dataset's age from a disclaimer into a modelled,
visible adjustment.

Requires an external index (FHFA HPI or Case-Shiller for Seattle), and should
be shown as an explicit adjustment row, never folded silently into the estimate.

### 6. Renovation ROI

**The ablation engine already computes this.** Re-pricing with one feature group
swapped is exactly the machinery needed to answer *"add a bathroom → +$X"*,
*"finish the basement → +$Y"*, *"grade 8 → grade 9 → +$Z"*. The backend work is
largely a new response shape over existing code; the work is mostly interface.

Highest-value *product* feature on this list, because it is the question owners
actually ask.

### 7. Exportable CMA report

A Comparative Market Analysis is the real deliverable in residential practice.
The application already produces every component — estimate, interval,
breakdown, comparables with distances and sale dates. A branded PDF would make
it something an agent takes to an appointment rather than something they look
at.

### 8. Correct the retransformation bias for aggregates

Predictions run **1.75% low in aggregate** because `expm1` of a log-space
prediction returns a conditional median, not a mean. Immaterial for a single
property — and arguably the right point estimate there — but it compounds
across every row of a portfolio.

Apply a Duan smearing estimator **on an explicit aggregate-valuation path
only**, not to the single-property estimate. Gated behind a real use case
rather than applied blindly.

### 9. Batch valuation

Portfolio underwriting: upload a CSV, get priced rows back. Natural companion
to item 8, and the first feature that would need real async job handling.

---

## Tier 3 — Infrastructure and scale

### 10. Response caching

`/api/stats` recomputes every aggregate on each request (50 ms, 22.5 KB). The
underlying data changes only when the database is reseeded. A cache keyed on
row count, or ETag-based conditional responses, removes the work entirely.

### 11. Postgres and PostGIS

SQLite is correct for single-instance read-heavy use and would not survive
concurrent writes or multi-instance deployment. PostGIS additionally replaces
the bounding-box-then-haversine comparables prefilter with a real spatial
index — the current approach is sound but does not scale past one county.

### 12. Split the Recharts bundle

The chart chunk is **376 KB raw / 104 KB gzipped**, the largest asset after the
main bundle. Charts already code-split per route, but Recharts itself is
heavy for what it draws. The choropleth demonstrates the alternative: it is
hand-projected SVG with no mapping library at all, and the entire insights route
is 32.7 KB gzipped including 26.8 KB of boundary geometry. Several of the
simpler charts could follow the same path.

### 13. Model monitoring

Nothing currently watches for drift between the training distribution and live
request inputs. Log prediction inputs, compare feature distributions against
the training set on a schedule, and alert when they separate. Prerequisite for
running this against a live data feed rather than a static file.

### 14. Hyperparameter search

Parameters were chosen by hand and held fixed. A `RandomizedSearchCV` with
proper cross-validation would likely recover another point or two of R². Listed
low deliberately — it is the most obvious thing to do and among the least
valuable, because the error structure in §5 of the
[model report](MODEL_REPORT.md) says the remaining error is concentrated in
segments where more data, not better tuning, is the constraint.

---

## Tier 4 — Scope changes

### 15. Authentication and multi-tenancy

There is no auth. Intended to run locally or behind access controls. Any
deployment serving real users needs accounts, rate limiting and per-tenant
data isolation.

### 16. Beyond King County

Latitude carries 31% importance because of *this* county's geography. The model
does not transfer. Generalising means per-market models, or a hierarchical model
with market-level effects — a research project, not a port.

### 17. Richer features

The dataset has no interior photographs, no condition report, no school
catchment, no transit access and no listing text. Each is a meaningful lift in
the segments where the model is currently weakest. All require data acquisition
rather than modelling work.

---

## Explicitly not planned

- **SHAP in place of ablation.** More principled, less usable. Sixteen
  per-feature values do not reconcile to a column a seller can be shown.
  Discussed in [the model report](MODEL_REPORT.md#6-explainability).
- **A narrower default interval.** The ±27% band is wide because the evidence
  is thin. Narrowing it for presentation would be the single most dishonest
  change available.
- **Dropping `bedrooms` and `floors` for their low importance.** Both are
  primary controls in the UI. A control the model ignores is a lie told through
  an input.

---

*See also: [Project report](PROJECT_REPORT.md) · [Model report](MODEL_REPORT.md) · [API reference](API.md)*
