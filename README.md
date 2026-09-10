<div align="center">

# PropIQ

**Real estate market intelligence for King County, WA**

A production-grade ML application that prices homes from 21,000+ real sales — and shows its working: what drove the number, how confident it is, and how accurate the model actually is.

[![CI](https://github.com/tahmidnafees619/propiq/actions/workflows/ci.yml/badge.svg)](https://github.com/tahmidnafees619/propiq/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3B82F6.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

[Quick start](#quick-start) · [Architecture](#architecture) · [API](#api-reference) · [Model](#the-model) · [Testing](#testing)

</div>

---

## What it does

Most home-value estimators hand you a number and nothing else. PropIQ is built around the idea that an unexplained estimate is not worth much, so every prediction ships with three things:

| | |
|---|---|
| **A price** | A gradient-boosted estimate from 16 property attributes. |
| **A calibrated range** | A 90% prediction interval derived from the model's held-out residuals — not a fixed percentage. A wider band genuinely means a less certain estimate. |
| **A breakdown** | The estimate decomposed by ablation into size, rooms, quality, location and waterfront/view, so you can see *why* it landed where it did. |
| **Real comparables** | The five most similar sales nearby, with the estimate shown against what those homes actually sold for. Comps never cross the waterfront line. |

Alongside the predictor sits a market dashboard: price distributions, per-bedroom and per-grade breakdowns, seasonal trends, and a filterable table of sale records.

### Design principles

- **Published numbers must be real.** Every accuracy figure in the UI is read from `models/metrics.json`, written by the training script. Nothing is typed into the markup, so the case study cannot drift out of step with the deployed model.
- **The demo must never be blank.** A curated showcase dataset ships with the project, so the dashboard renders fully on a fresh clone with no data and no backend. It is always visibly labelled.
- **Every control must matter.** If the UI exposes an input, the model uses it.

---

## Quick start

**Prerequisites:** Python 3.11+, Node 20+

```bash
git clone https://github.com/tahmidnafees619/propiq.git
cd propiq
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
python scripts/seed_db.py         # loads 21k sales into SQLite
```

Restart the API. `/api/health` will now report `"data_source": "database"` and every endpoint switches to live aggregates.

</details>

### Docker

```bash
docker compose up --build
```

Backend on `:8000`, frontend on `:5173`.

---

## Architecture

```
┌──────────────────────────┐         ┌───────────────────────────┐
│  React 19 + TanStack     │  HTTP   │  FastAPI                  │
│                          │ ──────► │                           │
│  Router · Query · Recharts│  JSON   │  routers → services → ORM │
└──────────────────────────┘         └────────────┬──────────────┘
         │                                        │
         │ falls back to                          ├──► SQLite (SQLAlchemy 2.0)
         ▼                                        │
   bundled demo dataset                           └──► scikit-learn artifacts
   (never a blank screen)                              model · scaler · metrics
```

**Request path:** `router` (HTTP contract, validation) → `service` (business logic) → `model` (persistence). Routers never touch the ORM directly and services never see a `Request`, which is what keeps the services unit-testable without a client.

<details>
<summary><b>Project layout</b></summary>

```
propiq/
├── src/                              # React frontend
│   ├── routes/                       # File-based routes (dashboard, predictor, insights, about)
│   ├── components/
│   │   ├── charts/                   # Recharts visualisations
│   │   ├── dashboard/                # KPI cards, property table
│   │   ├── predictor/                # Form, result, breakdown, gauge
│   │   ├── layout/                   # Navbar, sidebar, page wrapper
│   │   └── shared/                   # Empty/error/loading states, data-source badge
│   ├── hooks/                        # One hook per endpoint, each with demo fallback
│   ├── data/                         # Simplified Census ZCTA boundaries (~120 KB)
│   ├── lib/
│   │   ├── api.ts                    # Typed client, error normalisation, timeouts
│   │   └── demo-data.ts              # Bundled showcase dataset
│   └── types/                        # Shared contracts, mirroring the API schemas
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
│   │   └── services/                 # ml_service · property · stats · demo_data
│   ├── scripts/
│   │   ├── train_model.py            # Trains, compares, calibrates, persists
│   │   └── seed_db.py                # Loads the CSV into SQLite
│   ├── tests/                        # 89 tests
│   └── models/                       # model.pkl · scaler.pkl · metrics.json
│
└── .github/workflows/ci.yml          # Lint, typecheck, test, build
```

</details>

---

## The model

A `GradientBoostingRegressor` trained on 21,599 cleaned sales, predicting `log1p(price)` to correct the heavy right skew in house prices.

### Performance

Scored on a 20% held-out split. **All figures are on actual sale prices, not the log-transformed target** — reporting the log-space R² alone is flattering and not what a user experiences.

| Model | R² (dollars) | MAE | Median error |
|---|---|---|---|
| **Gradient Boosting** ⭐ | **0.904** | **$64,704** | **8.3%** |
| Random Forest | 0.885 | $69,200 | 9.0% |
| Ridge | 0.469 | $115,701 | 18.4% |
| Linear Regression | 0.469 | $115,701 | 18.4% |

57% of homes are priced within ±10% of their actual sale price; 83% within ±20%.

### Features

16 attributes, in the order the model expects them:

`sqft_living` · `sqft_lot` · `bedrooms` · `bathrooms` · `floors` · `waterfront` · `view` · `condition` · `grade` · `sqft_above` · `sqft_basement` · `yr_built` · `lat` · `long` · `sqft_living15` · `sqft_lot15`

Top drivers by importance: **latitude (31%)**, **construction grade (30%)**, **living area (23%)**. Location outweighs any single physical attribute — an unsurprising result that the dashboard makes concrete.

### Prediction intervals

Rather than a fixed ±8% margin, intervals come from the standard deviation of held-out residuals in log space, converted back into multiplicative price bounds. The interval width is then bucketed into a high/medium/low confidence label the UI colour-codes, and predictions for homes built after 2015 — beyond the training range — are explicitly flagged as extrapolations.

---

## API reference

Base URL `http://localhost:8000`. Full interactive docs at `/docs`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service index |
| `GET` | `/api/health` | Model + database readiness, active data source |
| `POST` | `/api/predict` | Price a property, with interval and breakdown |
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
  "predicted_price": 427804,
  "price_formatted": "$427,804",
  "margin_of_error": 115622,
  "price_low": 327531,
  "price_high": 558775,
  "confidence_percent": 90.0,
  "confidence_level": "medium",
  "percentile": 46.2,
  "breakdown": [
    { "label": "Baseline: typical King County home", "value": 534169, "percent": 124.9 },
    { "label": "Size & Layout",       "value":   23231, "percent":   5.4 },
    { "label": "Quality & Condition", "value":   32438, "percent":   7.6 },
    { "label": "Location",            "value": -221408, "percent": -51.8 },
    { "label": "Combined effects",    "value":   59992, "percent":  14.0 }
  ],
  "model_used": "GradientBoostingRegressor",
  "model_r2": 0.9036,
  "extrapolated": false
}
```

The breakdown starts from a typical King County home and records what changes when each group of the user's inputs is swapped in. Because a boosted model is not additive, the residual is reported openly as *Combined effects* rather than being silently spread across the other rows. The column sums to the final estimate.

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
    "request_id": "f850deaed2ad4704"
  }
}
```

`request_id` is echoed in the `X-Request-ID` response header and attached to every log line for that request, so a user-reported failure traces to a specific log entry.

</details>

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
# Backend — 89 tests
cd propiq-backend
python -m pytest tests/ -v

# Backend lint
python -m ruff check app scripts tests

# Frontend
npm run lint
npx tsc --noEmit
npm run build
```

The suite covers the API contract, filtering and pagination, error envelopes, demo-data integrity, and model behaviour — including regression tests for bugs that shipped in earlier versions: that bedrooms and bathrooms actually change the estimate, that the value breakdown reconciles to the final price, and that a post-2015 build is flagged rather than rejected.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome.

## License

[MIT](LICENSE)

## Acknowledgements

Built on the [King County House Sales dataset](https://www.kaggle.com/datasets/harlfoxem/housesalesprediction) — 21,613 home sales from May 2014 to May 2015, published by King County, WA.

ZIP-code boundaries are US Census Bureau [TIGER/Line ZCTAs](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html), public domain, simplified to ~120 KB for the web.
