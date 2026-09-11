# PropIQ Backend

FastAPI service for King County real estate intelligence: a gradient-boosted price model plus the market aggregates that give an estimate context.

For the full project overview, see the [root README](../README.md).

---

## Quick start

```bash
python -m venv venv
source venv/bin/activate          # Windows: .\venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env

uvicorn app.main:app --reload --port 8000
```

- API — http://localhost:8000
- Swagger UI — http://localhost:8000/docs
- ReDoc — http://localhost:8000/redoc

The service starts and serves useful responses even with no dataset and no trained model. `/api/health` reports exactly what is missing and the command that fixes it.

### Loading real data

The King County dataset is not redistributed here. Download `kc_house_data.csv` ([Kaggle](https://www.kaggle.com/datasets/harlfoxem/housesalesprediction)) into `data/raw/`, then:

```bash
python scripts/train_model.py     # ~2 min: trains 4 models, keeps the best
python scripts/seed_db.py         # loads 21k sales into SQLite
```

| Script | Flags |
|---|---|
| `train_model.py` | `--data PATH` |
| `seed_db.py` | `--csv PATH` · `--force` (replace existing rows) · `--limit N` |

---

## Layout

```
app/
├── main.py            App factory, middleware, lifespan
├── config.py          Env-driven settings, path resolution
├── database.py        Engine, session factory, schema bootstrap
├── exceptions.py      Domain errors and the JSON error envelope
├── middleware.py      Request IDs, timing, access logging
├── logging_config.py  JSON logs in production, readable in debug
├── models/            SQLAlchemy ORM
├── schemas/           Pydantic request/response contracts
├── routers/           health · prediction · properties · stats
├── services/          ml_service · property · stats · demo_data
└── utils/             Formatting helpers

scripts/               train_model.py · seed_db.py
tests/                 89 tests
models/                model.pkl · scaler.pkl · feature_columns.pkl · metrics.json
data/                  raw/ (your CSV) · propiq.db
```

**Layering:** `router` → `service` → `model`. Routers own the HTTP contract and never touch the ORM; services take a `Session` and plain arguments and never see a `Request`, which is what makes them testable without a client.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Service index |
| `GET` | `/api/health` | Model and database readiness, active data source |
| `POST` | `/api/predict` | Price a property, with interval and breakdown |
| `GET` | `/api/feature-importance` | Ranked price drivers (`?limit=N`) |
| `GET` | `/api/model/metrics` | Held-out accuracy of the deployed model |
| `GET` | `/api/properties` | Filter, sort, paginate sale records |
| `GET` | `/api/properties/{id}` | One property |
| `GET` | `/api/stats` | Every dashboard aggregate in one round trip |
| `GET` | `/api/stats/by-zipcode` | Median price, $/sqft and volume per ZIP code |

### Prediction input

`POST /api/predict` accepts 16 attributes. Bounds are deliberately a superset of what the UI exposes, so a valid form submission is never rejected.

| Field | Type | Range | Notes |
|---|---|---|---|
| `sqft_living` | float | 200–20000 | Interior living area |
| `sqft_lot` | float | 200–2000000 | Lot area |
| `bedrooms` | int | 0–15 | |
| `bathrooms` | float | 0–10 | Quarter increments |
| `floors` | float | 1–4 | |
| `waterfront` | int | 0–1 | |
| `view` | int | 0–4 | 0 none … 4 excellent |
| `condition` | int | 1–5 | Maintenance condition |
| `grade` | int | 1–13 | King County construction grade |
| `sqft_above` | float | 0–20000 | Must fit within `sqft_living` |
| `sqft_basement` | float | 0–10000 | Must fit within `sqft_living` |
| `yr_built` | int | 1900–*next year* | Post-2015 is flagged as extrapolation |
| `sqft_living15` | float | 200–20000 | Mean of 15 nearest homes |
| `sqft_lot15` | float | 200–2000000 | Mean of 15 nearest homes |
| `lat` | float | 47.0–47.9 | Strongest single driver |
| `long` | float | -122.6–-121.3 | |

`sqft_above + sqft_basement` may not exceed `sqft_living` (5% tolerance). Without this check the model happily prices a 1,000 sqft home with a 9,000 sqft ground floor.

### Filtering properties

```
GET /api/properties
  ?limit=100&offset=0
  &min_price=&max_price=
  &min_bedrooms=&max_bedrooms=&min_bathrooms=
  &min_sqft=&max_sqft=
  &min_grade=&max_grade=
  &waterfront=0|1
  &zipcode=98115
  &search=<zipcode | price | bedrooms>
  &sort_by=price|sqft_living|bedrooms|bathrooms|grade|condition|yr_built|id
  &sort_order=asc|desc
```

### Errors

One envelope for every failure:

```jsonc
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields failed validation.",
    "details": [{ "field": "grade", "message": "Input should be less than or equal to 13", "type": "less_than_equal" }],
    "request_id": "f850deaed2ad4704"
  }
}
```

| Code | Status | Meaning |
|---|---|---|
| `validation_error` | 422 | Field-level validation failed |
| `not_found` | 404 | No such resource |
| `model_unavailable` | 503 | Model artifacts missing — run `train_model.py` |
| `internal_error` | 500 | Unexpected failure; details are logged, not returned |

`request_id` is echoed in `X-Request-ID` and attached to every log line for that request.

---

## The model

`GradientBoostingRegressor` on 21,599 cleaned sales, predicting `log1p(price)` to correct the heavy right skew.

| Model | R² (dollars) | MAE | Median error |
|---|---|---|---|
| **Gradient Boosting** ⭐ | **0.904** | **$64,704** | **8.3%** |
| Random Forest | 0.885 | $69,200 | 9.0% |
| Ridge | 0.469 | $115,701 | 18.4% |
| Linear Regression | 0.469 | $115,701 | 18.4% |

Metrics are reported on **actual sale prices**, not the log-transformed target — the log-space R² is a flattering 0.907.

### The feature contract

`FEATURE_COLUMNS` in `scripts/train_model.py` is persisted to `feature_columns.pkl` and is what `MLService` reindexes payloads against, so its **order is binding**. Change it and you must retrain: `MLService._validate_contract()` refuses to start if the scaler and the feature list disagree, because a silent mismatch would scale the wrong columns and produce confident nonsense.

`bedrooms` and `bathrooms` are in the set deliberately — the predictor UI exposes them as primary controls, and an earlier version that omitted them made those controls silently inert.

### Prediction intervals

Intervals come from the standard deviation of held-out residuals in log space, converted into multiplicative price bounds — not a fixed percentage. `metrics.json` carries the calibration data, so intervals track the deployed model's real error.

### Comparable sales

Every prediction carries the five most similar real sales, because an agent
reasons in comps rather than feature importances — and because it is the
cheapest sanity check available on the model's number.

Selection runs a bounding-box prefilter in SQL, then scores exact haversine
distance in Python. Candidates are ranked on a weighted similarity score:
distance 40%, size 30%, grade 20%, room count 10%. Distance dominates because
location is the model's strongest signal.

The search widens only when it has to — 2 miles, then 5, then 15 — relaxing
size and grade tolerance at each step until it finds enough matches.

**Waterfront is a hard filter, never a scored dimension.** It commands a ~213%
premium in this dataset, so a mixed set would make the range meaningless in
whichever direction it was mixed. An earlier version scored it, and priced a
Medina waterfront home against inland comps: the estimate landed $850k above a
range built from the wrong houses.

`comparables_summary.estimate_within_range` reports whether the estimate falls
between the cheapest and priciest comp. It is deliberately allowed to come back
false — that disagreement is information, not a bug to hide.

### Value breakdown

Computed by ablation: price a typical King County home, then swap in the user's values one group at a time and record each delta. A boosted model is not additive, so the deltas will not sum exactly to the final price; the remainder is reported openly as "Combined effects" rather than being spread across the other rows.

---

## Configuration

Every value can be set in `.env` or the environment. Relative paths resolve against the backend root, so the server behaves identically regardless of the working directory.

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `PropIQ Backend` | |
| `DEBUG` | `false` | Readable logs instead of JSON |
| `LOG_LEVEL` | `INFO` | `CRITICAL` … `DEBUG` |
| `DATABASE_URL` | `sqlite:///./data/propiq.db` | Any SQLAlchemy URL |
| `MODEL_PATH` | `./models/model.pkl` | |
| `SCALER_PATH` | `./models/scaler.pkl` | |
| `FEATURES_PATH` | `./models/feature_columns.pkl` | |
| `METRICS_PATH` | `./models/metrics.json` | Source of all published accuracy figures |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS origins |
| `API_PREFIX` | `/api` | |
| `ENABLE_DEMO_FALLBACK` | `true` | Serve demo data when the table is empty |

---

## Demo fallback

With an empty `properties` table, `/api/stats` and `/api/properties` serve a curated showcase dataset and mark it `"source": "demo"`. This is why the dashboard renders fully on a fresh clone.

It is deterministic — identical on every machine and run, so screenshots stay reproducible — and its rows are anchored to the same grade averages the charts display, so the table and charts always agree. `tests/test_demo_data.py` fails if they drift apart.

**Model accuracy is never sourced from demo data.** It always comes from `metrics.json`.

Set `ENABLE_DEMO_FALLBACK=false` to return real (possibly empty) results only.

---

## Testing

```bash
pytest tests/ -v                       # 89 tests
pytest tests/test_prediction.py -v     # one file
ruff check app scripts tests           # lint
mypy app                               # types
```

Tests run against a throwaway in-memory SQLite database, so your local `data/propiq.db` is never touched. Use the `client` fixture for demo-fallback behaviour and `seeded_client` for known, hand-checkable rows.

Prediction tests skip automatically when model artifacts are absent, so the suite passes on a clean checkout.

| File | Covers |
|---|---|
| `test_health.py` | Service index, readiness, error envelope, request IDs |
| `test_prediction.py` | Prediction contract, monotonicity, validation, importances, metrics |
| `test_properties.py` | Filtering, sorting, pagination, detail lookup, demo fallback |
| `test_stats.py` | Aggregate correctness against hand-computed values |
| `test_demo_data.py` | Determinism, internal consistency, row integrity |

---

## Docker

```bash
docker build -t propiq-api .
docker run -p 8000:8000 propiq-api
```

Or run the full stack from the repository root with `docker compose up --build`.

The image is multi-stage — dependencies build in a throwaway layer so the runtime carries no compilers — and runs as a non-root user.

---

## Author

**Md. Tahmidur Rahman Nafees** — full-stack development and machine learning implementation.
Department of Electrical and Computer Engineering, North South University.
[LinkedIn](https://www.linkedin.com/in/md-tahmidur-rahman-nafees-04a6a3227/) · [GitHub](https://github.com/tahmidnafees619/propiq-insights-explorer-main)

---

## Notes for deployment

- **SQLite is the default** and is fine for a single-instance read-heavy workload. Point `DATABASE_URL` at PostgreSQL for anything concurrent.
- **`pickle` executes arbitrary code on load.** Treat `models/*.pkl` as trusted code; only load artifacts you produced yourself.
- **There is no authentication.** See [SECURITY.md](../SECURITY.md) before exposing this publicly.
