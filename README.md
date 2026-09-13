<div align="center">

# PropIQ

**Real estate market intelligence for King County, WA**

A production-grade ML application that prices homes from 21,000+ real sales — and shows its working: what drove the number, how confident it is, and how accurate the model actually is.

[![CI](https://github.com/tahmidnafees619/propiq-insights-explorer-main/actions/workflows/ci.yml/badge.svg)](https://github.com/tahmidnafees619/propiq-insights-explorer-main/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3B82F6.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

[Quick start](#quick-start) · [Architecture](#architecture) · [API](#api-reference) · [Model](#the-model) · [Interface](#interface-engineering) · [Testing](#testing)

</div>

---

## Documentation

| Document | What's in it |
|---|---|
| **[Project report](docs/PROJECT_REPORT.md)** | The full write-up: problem, method, UI/UX problems solved, engineering practice, results |
| **[Model report](docs/MODEL_REPORT.md)** | Model selection, calibration, residual diagnostics, error structure by price band and segment, honest limitations |
| **[API reference](docs/API.md)** | Every endpoint, request/response shapes, error envelope, and a live verification log |
| **[Roadmap](docs/ROADMAP.md)** | Prioritised future work, each item with its cost and its reason |
| **[Changelog](CHANGELOG.md)** | Release history |

---

## What it does

Most home-value estimators hand you a number and nothing else. PropIQ is built around the idea that an unexplained estimate is not worth much, so every prediction ships with four things:

| | |
|---|---|
| **A price** | A gradient-boosted estimate from 16 property attributes. |
| **A calibrated range** | A 90% prediction interval derived from the model's held-out residuals — not a fixed percentage. Measured empirical coverage: 91.3%. A wider band genuinely means a less certain estimate. |
| **A breakdown** | The estimate decomposed by ablation into size, rooms, quality, location and waterfront/view, so you can see *why* it landed where it did. The column sums to the final price. |
| **Real comparables** | The five most similar sales nearby, with the estimate shown against what those homes actually sold for. Comps never cross the waterfront line. |

Alongside the predictor sits a market dashboard: price distributions, per-bedroom and per-grade breakdowns, seasonal trends, a ZIP-code choropleth, and a filterable table of sale records. The predictor also draws a **live floor plan** that re-plans as you configure the property.

### Design principles

- **Published numbers must be real.** Every accuracy figure in the UI is read from `models/metrics.json`, written by the training script. Nothing is typed into the markup, so the case study cannot drift out of step with the deployed model.
- **The demo must never be blank.** A curated showcase dataset ships with the project, so the dashboard renders fully on a fresh clone with no data and no backend. It is always visibly labelled.
- **Every control must matter.** If the UI exposes an input, the model uses it.
- **A limitation stated beats a request refused.** Post-2015 builds are priced *and* flagged, rather than rejected.

---

## Quick start

**Prerequisites:** Python 3.11+, Node 20+

```bash
git clone https://github.com/tahmidnafees619/propiq-insights-explorer-main.git
cd propiq-insights-explorer-main
```

<details open>
<summary><b>1. Backend</b></summary>

```bash
cd propiq-backend

python -m venv venv
source venv/bin/activate          # Windows: .\venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env

uvicorn app.main:app --reload --port 8000
```

API at **http://localhost:8000** · interactive docs at **http://localhost:8000/docs**

</details>

<details open>
<summary><b>2. Frontend</b></summary>

```bash
# from the repository root, in a second terminal
npm install
cp .env.example .env

npm run dev
```

App at **http://localhost:5173**

</details>

That is enough to explore everything. The API serves its bundled demo dataset until you load real data, and the dashboard falls back to its own copy if the API is not running at all.

<details>
<summary><b>3. Optional — load the real dataset</b></summary>

The King County House Sales dataset is not redistributed here. Download `kc_house_data.csv` ([Kaggle](https://www.kaggle.com/datasets/harlfoxem/housesalesprediction)) and place it at `propiq-backend/data/raw/kc_house_data.csv`, then:

```bash
cd propiq-backend
python scripts/train_model.py     # ~2 min: trains 4 models, keeps the best
python scripts/seed_db.py         # loads 21,599 sales into SQLite
```

Restart the API. `/api/health` will now report `"data_source": "database"` and every endpoint switches to live aggregates.

</details>

### Docker

```bash
docker compose up --build
```

Backend on `:8000`, frontend on `:5173`.

### Common tasks

`make help` lists everything. The ones worth knowing:

```bash
make dev-api      # run the API with reload
make dev-web      # run the frontend dev server
make test         # backend test suite
make check        # everything CI runs: lint, typecheck, test, build
make train        # retrain and rewrite models/metrics.json
```

---

## Architecture

```
┌───────────────────────────┐         ┌───────────────────────────┐
│  React 19 + TanStack      │  HTTP   │  FastAPI                  │
│  Router · Query · Recharts│ ──────► │  routers → services → ORM │
└───────────────────────────┘  JSON   └────────────┬──────────────┘
         │                                         │
         │ falls back to                           ├──► SQLite (SQLAlchemy 2.0)
         ▼                                         │
   bundled demo dataset                            └──► scikit-learn artifacts
   (never a blank screen)                               model · scaler · metrics
```

**Request path:** `router` (HTTP contract, validation) → `service` (business logic) → `model` (persistence). Routers never touch the ORM directly and services never see a `Request`, which is what keeps the services unit-testable without a client.

<details>
<summary><b>Project layout</b></summary>

```
propiq/
├── docs/                             # Project, model, API and roadmap documents
│
├── src/                              # React frontend
│   ├── routes/                       # File-based routes (dashboard, predictor, insights, about)
│   ├── components/
│   │   ├── background/               # Living blueprint background
│   │   ├── charts/                   # Recharts visualisations + hand-built choropleth
│   │   ├── dashboard/                # KPI cards, property table
│   │   ├── intro/                    # Title sheet: provider, sequence, drawn wordmark
│   │   ├── predictor/                # Form, result, breakdown, gauge, floor plan, comps
│   │   ├── layout/                   # Navbar, sidebar, mobile tab bar, page wrapper
│   │   ├── motion/                   # Motion primitives + reduced-motion hook
│   │   ├── shared/                   # Empty/error/loading states, data-source badge
│   │   └── ui/                       # shadcn/ui primitives
│   ├── hooks/                        # One hook per endpoint, each with demo fallback
│   ├── data/                         # Simplified Census ZCTA boundaries (~125 KB)
│   ├── lib/
│   │   ├── api.ts                    # Typed client, error normalisation, timeouts
│   │   ├── floorplan.ts              # Floor-plan rules engine
│   │   ├── motion.ts                 # Motion design tokens
│   │   └── demo-data.ts              # Bundled showcase dataset
│   ├── types/                        # Shared contracts, mirroring the API schemas
│   └── styles.css                    # 83 design tokens
│
├── propiq-backend/
│   ├── app/
│   │   ├── main.py                   # App factory, middleware, lifespan
│   │   ├── config.py                 # Env-driven settings
│   │   ├── database.py               # Engine, session, schema bootstrap
│   │   ├── exceptions.py             # Domain errors + JSON error envelope
│   │   ├── middleware.py             # Request IDs, timing, access logs
│   │   ├── logging_config.py         # JSON logs in production
│   │   ├── models/                   # SQLAlchemy ORM
│   │   ├── schemas/                  # Pydantic request/response contracts
│   │   ├── routers/                  # health · prediction · properties · stats
│   │   └── services/                 # ml · property · stats · comps · demo_data
│   ├── scripts/
│   │   ├── train_model.py            # Trains, compares, calibrates, persists
│   │   └── seed_db.py                # Loads the CSV into SQLite
│   ├── tests/                        # 116 tests
│   └── models/                       # model.pkl · scaler.pkl · metrics.json
│
└── .github/workflows/ci.yml          # Lint, typecheck, test, build, contract guard
```

</details>

---

## The model

A `GradientBoostingRegressor` trained on 21,599 cleaned sales, predicting `log1p(price)` to correct the heavy right skew in house prices.

### Performance

Scored on a 20% held-out split. **All figures are on actual sale prices, not the log-transformed target** — reporting the log-space R² alone is flattering and not what a user experiences.

| Model | R² (dollars) | R² (log) | MAE | Median error |
|---|---|---|---|---|
| **Gradient Boosting** ⭐ | **0.904** | 0.907 | **$64,704** | **8.3%** |
| Random Forest | 0.885 | 0.896 | $69,200 | 8.7% |
| Ridge | 0.469 | 0.768 | $115,701 | 15.8% |
| Linear Regression | 0.469 | 0.768 | $115,701 | 15.8% |

57% of homes are priced within ±10% of their actual sale price; 83% within ±20%.

Ridge's collapse from 0.768 to 0.469 across those two columns is the most instructive row in the table: a model judged only on its training target looks usable while being off by $116k on the average home.

### Features

16 attributes, in the order the model expects them:

`sqft_living` · `sqft_lot` · `bedrooms` · `bathrooms` · `floors` · `waterfront` · `view` · `condition` · `grade` · `sqft_above` · `sqft_basement` · `yr_built` · `lat` · `long` · `sqft_living15` · `sqft_lot15`

Top drivers by importance: **latitude (31%)**, **construction grade (30%)**, **living area (23%)**. Location outweighs any single physical attribute — an unsurprising result that the dashboard makes concrete.

### Prediction intervals

Rather than a fixed ±8% margin, intervals come from the standard deviation of held-out residuals in log space, converted back into multiplicative price bounds. Interval width is bucketed into a high/medium/low confidence label the UI colour-codes, and predictions for homes built after 2015 — beyond the training range — are explicitly flagged as extrapolations.

**Measured coverage is 91.3% against a nominal 90%** — slightly conservative rather than exactly calibrated. The [model report](docs/MODEL_REPORT.md#4-calibrated-prediction-intervals) explains why, and what the few-line fix is.

### Where the model is weak

Aggregate metrics hide the shape of the error. Broken out, the model **regresses to the mean** — overpricing the cheapest decile by ~$24k and underpricing the top decile by ~$102k — and its worst segment by a distance is **waterfront**, at 21% median error on 33 held-out sales. Full breakdown by price decile and segment in the **[model report](docs/MODEL_REPORT.md#5-error-structure--where-the-model-is-actually-weak)**.

---

## API reference

Base URL `http://localhost:8000`. Full interactive docs at `/docs`; full written reference in **[docs/API.md](docs/API.md)**.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service index |
| `GET` | `/api/health` | Model + database readiness, active data source |
| `POST` | `/api/predict` | Price a property, with interval, breakdown and comparables |
| `GET` | `/api/feature-importance` | Ranked price drivers (`?limit=N`) |
| `GET` | `/api/model/metrics` | Held-out accuracy of the deployed model |
| `GET` | `/api/properties` | Filter, sort, paginate sale records |
| `GET` | `/api/properties/{id}` | One property |
| `GET` | `/api/stats` | Every dashboard aggregate in one round trip |
| `GET` | `/api/stats/by-zipcode` | Median price, $/sqft and volume per ZIP code |

<details>
<summary><b>Example: predicting a price</b></summary>

```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "sqft_living": 2200, "sqft_lot": 7500,
    "bedrooms": 3, "bathrooms": 2.5, "floors": 2,
    "waterfront": 0, "view": 0, "condition": 3, "grade": 8,
    "sqft_above": 1800, "sqft_basement": 400, "yr_built": 1995,
    "lat": 47.5112, "long": -122.257
  }'
```

```jsonc
{
  "predicted_price": 399379,
  "price_formatted": "$399,379",
  "margin_of_error": 107940,
  "price_low": 305769,
  "price_high": 521649,
  "confidence_percent": 90.0,
  "confidence_level": "medium",
  "percentile": 40.9,
  "breakdown": [
    { "label": "Baseline: typical King County home", "value": 534169, "percent": 133.7 },
    { "label": "Size & Layout",       "value":   23231, "percent":   5.8 },
    { "label": "Quality & Condition", "value":   32438, "percent":   8.1 },
    { "label": "Location",            "value": -243213, "percent": -60.9 },
    { "label": "Combined effects",    "value":   53373, "percent":  13.4 }
  ],
  "model_used": "GradientBoostingRegressor",
  "model_r2": 0.9036,
  "extrapolated": false
}
```

The breakdown starts from a typical King County home and records what changes when each group of the user's inputs is swapped in. Because a boosted model is not additive, the residual is reported openly as *Combined effects* rather than being silently spread across the other rows. The column sums to the final estimate.

The response also carries `comparables` — five real nearby sales with distance, similarity score and sale date.

</details>

<details>
<summary><b>Error format</b></summary>

Every failure uses one envelope, so the client has a single error path:

```jsonc
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields failed validation.",
    "details": [
      { "field": "grade", "message": "Input should be less than or equal to 13", "type": "less_than_equal" }
    ],
    "request_id": "94e4e00d890e4a3d"
  }
}
```

`request_id` is echoed in the `X-Request-ID` response header and attached to every log line for that request, so a user-reported failure traces to a specific log entry.

</details>

---

## Interface engineering

Four problems from the frontend worth calling out. The **[project report](docs/PROJECT_REPORT.md#7-uiux-problems-and-how-they-were-solved)** covers twelve in full.

**Controls that did nothing.** The predictor presented bedrooms and bathrooms as primary controls while neither was in the trained feature set — a 1-bed and a 10-bed home of identical size returned the same price. Adding them and retraining moved R² from 0.860 to 0.904, so the honest interface was also the more accurate one. CI now fails the build if either leaves the feature set.

**A map with no map.** The insights page shipped a pulsing-dot placeholder standing in for geography. It is now a real choropleth of all 70 ZIP codes with **no mapping library, no tile server and no API key** — Census boundaries simplified to 26.8 KB gzipped and projected to Web Mercator in about six lines. Shaded by **quantile, not equal interval**: prices span 8× and are right-skewed, so equal intervals would render 68 of the 70 ZIPs in the same shade.

**A floor plan that was not a floor plan.** A treemap tiled the footprint perfectly and looked nothing like a home — bathrooms between bedrooms, no circulation. A corridor template fixed plausibility and introduced rigidity. It is now a rules engine: the room programme grows with floor area, circulation changes with size, and bathrooms are *allocated* rather than counted. All 10,368 input/shuffle combinations are checked against layout invariants.

**A title sequence that costs nothing.** The drafting-table intro is a spacer with a sticky stage, with the dashboard beneath it in normal flow — so it costs no LCP and the content is in the document whether or not the sequence runs. The wordmark is **geometry, not type**: monoline letterforms with no web font, so the most important frame on the site cannot flash unstyled text.

### Design system

The palette is built from drafting materials rather than assembled from a UI kit, and every ramp is derived in HSL rather than hand-picked, so hue stays constant while saturation falls off as lightness rises.

| Role | Colour | Why |
|---|---|---|
| Neutrals | Hue 202, cyan-navy | Tailwind slate sits near 215 with a purple lean — the most recognisable default-palette tell in a dark UI |
| Ink | **Cyanotype** `#2F99DA` | The pigment of an actual blueprint. Hue 203 against blue-500's 217, saturation 70 against its 91 |
| Accent | **Aged brass** `#D0A74E` | Surveying instruments, not a warning triangle. Reserved for the primary action and nothing else |
| Positive | **Verdigris** `#3DAE91` | Weathered copper |
| Negative | **Iron oxide** `#D5533F` | |
| Data | 9-step sequential ramp | Kept clear of the accent, so a chart series is never mistaken for something interactive |

Two rules the components follow:

- **One accent, rationed.** Brass appears on exactly one control in the app. That is what makes it read as emphasis rather than decoration.
- **Quantities never borrow the UI palette.** Charts use the sequential ramp; interactive elements use ink.

Every text pairing is checked against WCAG before it ships — all pass AA, most exceed AAA. Contrast for the shipped palette runs from 6.0:1 (negative text on a card) to 17.2:1 (primary text on the page ground).

`prefers-reduced-motion` is honoured centrally rather than per-component, and all animation timing comes from one token file — coherence from a shared vocabulary rather than from animating more things.

---

## Data sources

Endpoints report a `source` field, and the UI renders it as a visible badge:

| `source` | Meaning |
|---|---|
| `database` | Real seeded sale records. |
| `demo` | The bundled showcase dataset. |

The demo dataset is deterministic — the same figures on every machine and in every run, so screenshots and recordings stay reproducible — and its individual rows are anchored to the same grade averages the charts display, so the table and the charts always agree. A test suite (`tests/test_demo_data.py`) fails if the sampled rows drift away from the published headline figures.

**Model accuracy is never sourced from demo data.** It is always read from the deployed model's own report.

---

## Testing

```bash
# Backend — 116 tests
cd propiq-backend
python -m pytest tests/ -v

# Backend lint
python -m ruff check app scripts tests

# Frontend
npm run lint
npx tsc --noEmit
npm run build
```

Or `make check` from the repository root, which runs all of it.

The suite covers the API contract, filtering and pagination, error envelopes, comparable-selection quality, demo-data integrity, and model behaviour — including regression tests for bugs that shipped in earlier versions: that bedrooms and bathrooms actually change the estimate, that the value breakdown reconciles to the final price, and that a post-2015 build is flagged rather than rejected.

### Last verified — 2026-09-14

| Check | Result |
|---|---|
| Backend tests | **116 passed** in 16.6 s |
| Backend lint (Ruff) | **All checks passed** |
| Frontend typecheck | **Clean** |
| Frontend lint | **0 errors**, 7 warnings (shadcn/ui boilerplate) |
| Production build | **Succeeded** in 6.9 s |
| API endpoints | **9/9 verified**, slowest under 100 ms — [log](docs/API.md#2-verification-log) |
| Model reproduction | R² 0.9036 / MAE $64,704 recomputed from the artifact, matching `metrics.json` exactly |

There are **no frontend tests** — the largest gap in the project, and [item 3 on the roadmap](docs/ROADMAP.md).

---

## Configuration

<details>
<summary><b>Backend</b> — <code>propiq-backend/.env</code></summary>

| Variable | Default | Description |
|---|---|---|
| `DEBUG` | `false` | Human-readable logs instead of JSON |
| `LOG_LEVEL` | `INFO` | `CRITICAL` … `DEBUG` |
| `DATABASE_URL` | `sqlite:///./data/propiq.db` | Any SQLAlchemy URL |
| `MODEL_PATH` | `./models/model.pkl` | Trained estimator |
| `METRICS_PATH` | `./models/metrics.json` | Source of all published accuracy figures |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | Comma-separated CORS origins |
| `ALLOWED_ORIGIN_REGEX` | *(empty)* | Additionally allow origins matching a regex — useful for testing from a phone on the same LAN. Leave unset anywhere the API is reachable from outside the machine |
| `ENABLE_DEMO_FALLBACK` | `true` | Serve demo data when the database is empty |

</details>

<details>
<summary><b>Frontend</b> — <code>.env</code></summary>

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL |

</details>

---

## Tech stack

**Frontend** — React 19 · TypeScript · TanStack Start/Router/Query · Tailwind CSS 4 · Recharts · Framer Motion · Vite 7

**Backend** — Python 3.11+ · FastAPI · Pydantic v2 · SQLAlchemy 2.0 · scikit-learn · pandas · NumPy

**Tooling** — pytest · Ruff · ESLint · Prettier · Docker · GitHub Actions

---

## Author

**Md. Tahmidur Rahman Nafees**
Full-stack development and machine learning implementation — data pipeline, model training and calibration, FastAPI backend, and React frontend.

Department of Electrical and Computer Engineering, North South University

[LinkedIn](https://www.linkedin.com/in/md-tahmidur-rahman-nafees-04a6a3227/) · [GitHub](https://github.com/tahmidnafees619/propiq-insights-explorer-main)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome.

## License

[MIT](LICENSE)

## Acknowledgements

Built on the [King County House Sales dataset](https://www.kaggle.com/datasets/harlfoxem/housesalesprediction) — 21,613 home sales from May 2014 to May 2015, published by King County, WA.

ZIP-code boundaries are US Census Bureau [TIGER/Line ZCTAs](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html), public domain, simplified to ~125 KB for the web.
