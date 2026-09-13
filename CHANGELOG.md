# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-09-14

An interface release, plus the tooling and documentation fixes an end-to-end
review of the project turned up.

### Added

- **A drafting-table title sequence on the dashboard.** A small isometric house
  inks itself in, a parallel rule lays down the writing lines, and a T-square
  blade travels left to right with the PropIQ wordmark following it — the
  *instrument* working, rather than letters appearing by themselves. On scroll
  the house is lowered out of frame, the sheet furniture retracts, and the
  wordmark dismantles letter by letter toward the corner where the navbar sits.

  Three constraints shaped it. It **costs no LCP**: the sheet is a spacer with a
  sticky stage and the dashboard sits beneath it in normal document flow, so the
  content is in the document whether or not the sequence runs. It **cannot flash
  unstyled text**: the wordmark is monoline geometry, not a web font, which is
  also what lets `pathLength` animate it convincingly. And it **stays out of the
  way**: it plays only on the dashboard, only once per session, and never under
  `prefers-reduced-motion`. Navigating away mid-sequence retires it, so
  returning does not replay it. `?intro=1` forces it for recording a demo.

  There is deliberately no shared-element morph between the drawn mark and the
  navbar's typeset logo — the two do not share a shape to morph between, and
  forcing one would read as a bug. The navbar simply fades in once the last
  letter has gone.

- **`ALLOWED_ORIGIN_REGEX`** — allows origins matching a regex in addition to
  the explicit list, so the app can be opened from a phone on the same LAN for
  testing. Empty by default, and documented as something to leave unset
  anywhere the API is reachable from outside the machine.

- **`.gitattributes`** — `* text=auto eol=lf`, which the repository had been
  missing. On a Windows checkout, Git's CRLF conversion and Prettier's LF
  expectation disagree, and that disagreement surfaces as dozens of `Delete ␍`
  lint errors on files nobody meaningfully touched.

- **A documentation set** under `docs/`: the project report (moved from the
  root), plus a model report, an API reference with a live verification log, and
  a prioritised roadmap.

### Fixed

- **`eslint .` traversed roughly 200,000 files before linting anything.** The
  ignore list covered `dist` and `.output` but not the Python virtualenvs living
  in the repository, so every file under `.venv-1/Lib/site-packages` was walked
  first. The run took over ten minutes — long enough that the command reads as
  hung and stops being run at all. With the ignores added it finishes in **13
  seconds**. A check nobody runs provides no safety.

- **Stale figures in the documentation.** The README's worked `POST /api/predict`
  example showed a response from a superseded model, and the test count was
  recorded as 89 against an actual 116. Both now match a live run.

- **A stale comment in CI** claiming prediction tests self-skip because model
  artifacts are not committed. They are committed, and the full suite runs.

### Changed

- The predictor form emits drafts on every edit rather than only on submit, so
  the floor-plan schematic redraws live as the property is configured.
- `Navbar` reads its accent from `var(--ink-500)` rather than a hex literal.
  Twenty-five component files still carry literal hex; finishing that migration
  is [roadmap item 2](docs/ROADMAP.md).
- Removed two stray empty directories left at the repository root (`data/`,
  `models/`), superseded by their counterparts under `propiq-backend/`.

---

## [1.0.0] — 2026-09-11

First production release. The application was audited end to end; this release fixes what that audit found and hardens everything around it.

### Fixed

- **Bedrooms and bathrooms had no effect on predictions.** The trained feature set omitted both, while the predictor UI presented them as primary controls — a 1-bedroom and a 10-bedroom home of the same size returned an identical price. Both are now model features, with regression tests covering them.
- **The predictor rejected any home built after 2015.** The form allowed years up to the present while the API capped `yr_built` at 2015, returning a 422. The API now accepts them and flags the result as an extrapolation instead.
- **The predictor's button silently did nothing on failure.** The page never read the mutation's error state, so a rejected request produced no feedback. Failures now render inline with field-level messages.
- **The property table crashed on search.** It filtered on `zipcode`, which the database model did not have. `zipcode` is now a real column, and the search guards the optional field.
- **The "Avg Prediction Error" KPI read an absent field.** `/api/stats` never returned `mae`, so the card rendered a zero. The endpoint now returns it, sourced from the deployed model.
- **`median_price` and `model_r2` were hardcoded** in the stats service and returned constant values even when computed from real data. Both are now genuine.
- **The database seeding script was an unimplemented stub** that printed "implementation pending", which is why `/api/properties` and `/api/stats` returned empty results. It now loads the full dataset in batches.
- **Published accuracy figures were overstated.** The UI advertised R² 0.883 and MAE $42,100; the deployed model actually scored R² 0.860 with MAE $79,553. Every figure is now read from the model's own evaluation report.
- **Insight claims were factually wrong.** "Waterfront Premium: +120%" against an actual +213%, and a reference to zip-code features the model did not have. All claims are now derived from live data.
- **Cross-field validation was absent.** A 1,000 sqft home with a 9,000 sqft ground floor was accepted and priced. Geometry is now validated, and the form derives above-ground area so the error is unreachable from the UI.

### Added

- **Calibrated prediction intervals.** Replaces the fixed ±8% margin with a 90% interval derived from held-out residuals, plus a high/medium/low confidence label and explicit extrapolation warnings.
- **Value breakdown by ablation.** Attributes each estimate to size, rooms, quality, location and waterfront/view by re-pricing a typical home with each group swapped in. The non-additive remainder is reported openly as "Combined effects" rather than being hidden; the column reconciles to the final price.
- **`GET /api/model/metrics`** — held-out accuracy of the deployed model, and the single source of truth for every published figure.
- **`GET /api/stats/by-zipcode`** — median price, price per square foot and sale volume for each of the 70 King County ZIP codes.
- **Comparable sales on every prediction.** Returns the five most similar real transactions nearby, ranked by proximity, size, grade and room count, with the estimate plotted against what those homes actually sold for. Comps are matched exactly on waterfront status, since that carries a ~213% premium and mixing across it makes the range meaningless. Sale dates are shown so the reader can judge how current the comparison is.
- **A real price choropleth**, replacing the fake pulsing-dot placeholder on the insights page. Renders all 70 ZIPs from simplified US Census ZCTA boundaries bundled with the app, projected to Web Mercator in-component — no tile server, no API key, and no network once the page has loaded. Shaded by quantile rather than equal interval, because the 8x price spread is skewed enough that equal intervals would render 68 of the 70 ZIPs identically.
- **`GET /` service index** in place of a bare 404.
- **Bundled demo dataset** on both the API and the frontend, so the dashboard is never blank on a fresh clone or with the backend offline. Deterministic, anchored to the published aggregates, and always labelled with a visible badge.
- **Structured JSON logging** with per-request correlation IDs, echoed in `X-Request-ID` and embedded in error payloads.
- **A uniform error envelope** across every endpoint, carrying field-level validation detail.
- **Expanded querying** on `/api/properties`: free-text search, sorting, bathroom/sqft/grade/zipcode filters, and complete pagination metadata.
- **Richer statistics**: true median, min/max, sale volume by month, price-band distribution, a down-sampled scatter series, and a computed waterfront premium.
- **116 tests** (from 5), asserting on values rather than key existence, including regression tests for every bug above.
- **Project infrastructure**: GitHub Actions CI, Dockerfiles for both services, `docker-compose.yml`, Ruff and mypy configuration, and contributor documentation.

### Changed

- **Rewrote the floor-plan schematic as a rules engine.** It previously subdivided the footprint as a treemap, which tiled perfectly and looked nothing like a home — bathrooms between bedrooms, no circulation, nothing opening off anything. A corridor template fixed that but produced one rigid plan that only grew more columns. It now generates plans from residential design rules: the room programme grows with floor area (dining, utility, study), circulation changes with size (no hall in a small flat, a corridor in a mid-size home, a double-loaded spine in a large one), and bathrooms are *allocated* rather than counted — a half bath is a guest WC in the public zone, ensuites attach to bedrooms and are drawn smaller than a shared family bathroom, except above grade 10 where the primary suite becomes the largest bathroom in the house. Arrangement is chosen by a seed derived from the property, with a Shuffle control for alternative arrangements of the same brief. All 10,368 input/shuffle combinations are checked against layout invariants: no overlaps, everything inside the footprint, and every habitable room on an exterior wall for a window.

- **Replaced the entire colour palette.** The interface previously ran on Tailwind's default swatches — `blue-500`, `emerald-500`, `amber-500`, `red-500` and stock slate — which is the most recognisable "scaffolded project" signal there is. It now uses a palette derived from drafting materials: cyanotype blue, aged brass, verdigris and iron oxide, with a custom cyan-navy neutral ramp. Ramps are generated in HSL rather than hand-picked, and every text pairing is verified against WCAG (all pass AA, most exceed AAA). Brass is reserved for a single primary action, and quantitative charts were moved onto a dedicated sequential scale so a data series can never be confused with an interactive element.

- **Retrained the model.** Adding the room features and tuning the estimator improved held-out accuracy substantially:

  | Metric | Before | After |
  |---|---|---|
  | R² (dollars) | 0.860 | **0.904** |
  | MAE | $79,553 | **$64,704** |
  | Median error | 10.3% | **8.3%** |

- Training now compares four candidates, records a leaderboard, and writes `models/metrics.json` with calibration data.
- Migrated to SQLAlchemy 2.0 `DeclarativeBase` and typed `Mapped` columns; added indexes covering the common query shapes.
- Migrated settings to Pydantic v2 `SettingsConfigDict`. All deprecation warnings resolved.
- Split `requirements.txt` from `requirements-dev.txt` and dropped `matplotlib`, `seaborn` and `plotly`, none of which the API imported.
- `.env` is no longer tracked; `.gitignore` now covers Python artifacts, virtual environments, databases and secrets.

### Security

- Model artifacts are validated against the scaler on load; a feature-count mismatch refuses to start rather than serving silently wrong predictions.
- Sort fields are a closed `Literal` set rather than interpolated column names.
- Internal exception details are logged server-side and never returned to callers.
- Both Docker images run as a non-root user.
