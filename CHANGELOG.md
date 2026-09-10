# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **`GET /` service index** in place of a bare 404.
- **Bundled demo dataset** on both the API and the frontend, so the dashboard is never blank on a fresh clone or with the backend offline. Deterministic, anchored to the published aggregates, and always labelled with a visible badge.
- **Structured JSON logging** with per-request correlation IDs, echoed in `X-Request-ID` and embedded in error payloads.
- **A uniform error envelope** across every endpoint, carrying field-level validation detail.
- **Expanded querying** on `/api/properties`: free-text search, sorting, bathroom/sqft/grade/zipcode filters, and complete pagination metadata.
- **Richer statistics**: true median, min/max, sale volume by month, price-band distribution, a down-sampled scatter series, and a computed waterfront premium.
- **89 tests** (from 5), asserting on values rather than key existence, including regression tests for every bug above.
- **Project infrastructure**: GitHub Actions CI, Dockerfiles for both services, `docker-compose.yml`, Ruff and mypy configuration, and contributor documentation.

### Changed

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
