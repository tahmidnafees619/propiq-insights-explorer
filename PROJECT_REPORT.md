# PropIQ — Project Report

**Real estate market intelligence for King County, WA**

| | |
|---|---|
| **Author** | Md. Tahmidur Rahman Nafees |
| **Affiliation** | Department of Electrical and Computer Engineering, North South University |
| **Role** | Full-stack development and machine learning implementation |
| **Repository** | https://github.com/tahmidnafees619/propiq-insights-explorer-main |
| **LinkedIn** | https://www.linkedin.com/in/md-tahmidur-rahman-nafees-04a6a3227/ |
| **Status** | v1.0.0 — feature complete, 116 tests passing |

---

## 1. Executive summary

PropIQ prices residential property in King County, Washington from 21,599 real sale records, and explains every number it produces.

Most home-value estimators return a price and nothing else. The premise here is that an unexplained estimate is close to worthless to the person who has to act on it, so every prediction ships with four things:

1. **A price** — gradient-boosted estimate from 16 property attributes
2. **A calibrated range** — a 90% prediction interval derived from the model's own held-out residuals, not a fixed percentage
3. **A breakdown** — the estimate decomposed by ablation into size, rooms, quality, location and waterfront
4. **Real comparables** — the five most similar sales nearby, with the estimate plotted against what those homes actually sold for

The deployed model scores **R² 0.904** with a **mean absolute error of $64,704** and a **median error of 8.3%** on a held-out split, measured on actual sale prices rather than the log-transformed training target.

**What distinguishes this project is not the model — it is the engineering discipline and the honesty around it.** Gradient boosting on the King County dataset is well-trodden ground. Calibrated intervals, explainability that reconciles arithmetically, published figures that cannot drift from the deployed artifact, and a test suite that encodes past bugs as regressions are considerably less common.

---

## 2. Problem statement

Residential pricing is opaque. Buyers, sellers and agents make six-figure decisions on rough comparables and instinct. Automated valuation models exist, but the mainstream ones are black boxes: they return a number and a range with no account of where either came from.

That opacity has a practical cost. At a listing appointment, an agent has to justify a price to a seller who believes their home is worth more. "The algorithm says $430,000" is not an argument. "It's $430,000 because location contributes this, build grade contributes that, and five comparable homes within half a mile sold between $415,000 and $450,000" is.

PropIQ targets that gap: a valuation that can be **defended**, not merely quoted.

---

## 3. Dataset

| Property | Value |
|---|---|
| Source | King County House Sales (published by King County, WA) |
| Raw records | 21,613 |
| After cleaning | 21,599 |
| Period | May 2014 – May 2015 |
| Geography | King County, WA (70 ZIP codes) |
| Target | Sale price ($78,000 – $7,700,000) |

**Cleaning steps:** dropped null and non-positive prices, de-duplicated on `(id, date)` keeping the latest, and excluded a known data-entry error (a 33-bedroom record) by bounding bedrooms to 1–15.

**Derived fields:** `year_sold`, `month_sold`, `house_age`, `was_renovated`.

**A stated limitation.** This data is from 2014–15. The application is a demonstration of method, not a current-market pricing service, and the interface says so wherever it matters — comparable sales carry their sale dates, and predictions for homes built after 2015 are flagged as extrapolations. Deploying this against today's market would require a current data source.

---

## 4. Modelling

### 4.1 Approach

The target is log-transformed (`log1p(price)`) to correct heavy right skew. Four candidates were trained and compared on an identical 80/20 split:

| Model | R² (dollars) | MAE | Median error |
|---|---|---|---|
| **Gradient Boosting** ⭐ | **0.904** | **$64,704** | **8.3%** |
| Random Forest | 0.885 | $69,200 | 9.0% |
| Ridge | 0.469 | $115,701 | 18.4% |
| Linear Regression | 0.469 | $115,701 | 18.4% |

57% of homes are priced within ±10% of actual sale price; 83% within ±20%.

**Metrics are reported in dollar space, not log space.** The log-space R² is a flattering 0.907, but that is not the error a user experiences. Reporting the inflated figure would be the single easiest way to overstate this project, so the training script computes both and the interface publishes the dollar-space number.

### 4.2 Features

Sixteen attributes, in the order the model expects them:

`sqft_living` · `sqft_lot` · `bedrooms` · `bathrooms` · `floors` · `waterfront` · `view` · `condition` · `grade` · `sqft_above` · `sqft_basement` · `yr_built` · `lat` · `long` · `sqft_living15` · `sqft_lot15`

Top drivers by importance: **latitude 31%**, **construction grade 30%**, **living area 23%**. Location outweighs any single physical attribute — an intuitive result the dashboard makes concrete.

The feature list is persisted alongside the model and validated against the scaler at startup. A mismatch refuses to load rather than silently scaling the wrong columns, which would produce confident nonsense.

### 4.3 Prediction intervals

Rather than a fixed ±8% margin, intervals derive from the standard deviation of held-out residuals in log space, converted back to multiplicative price bounds. Interval width is bucketed into a high/medium/low confidence label the interface colour-codes.

This means a wider band genuinely indicates a less certain estimate, which a fixed percentage can never express.

### 4.4 Explainability

The value breakdown is computed by **ablation**: price a typical King County home, then substitute the user's values one feature group at a time and record each delta.

Gradient boosting is not additive, so those deltas do not sum exactly to the final price. The remainder is reported openly as *"Combined effects"* rather than being silently distributed across the other rows. The column reconciles to the estimate, and a test enforces that.

### 4.5 Comparable sales

Comps are selected by bounding-box prefilter in SQL, then scored on exact haversine distance in Python. Ranking weights: distance 40%, size 30%, grade 20%, room count 10%. The search widens only when it must — 2mi, then 5mi, then 15mi.

**Waterfront is a hard filter, never a scored dimension.** It carries a ~213% premium in this dataset; mixing across it makes the range meaningless. This was discovered in testing (§7.2).

---

## 5. System architecture

```
┌──────────────────────────┐         ┌───────────────────────────┐
│  React 19 + TanStack     │  HTTP   │  FastAPI                  │
│  Router · Query · Recharts│ ──────► │  routers → services → ORM │
└──────────────────────────┘  JSON   └────────────┬──────────────┘
         │                                        │
         │ falls back to                          ├──► SQLite (SQLAlchemy 2.0)
         ▼                                        │
   bundled demo dataset                           └──► scikit-learn artifacts
   (never a blank screen)                              model · scaler · metrics
```

### 5.1 Layering

`router` → `service` → `model`, enforced by convention and reviewable in code:

- **Routers** own the HTTP contract — paths, query parameters, status codes, response schemas. They never touch the ORM.
- **Services** own business logic. They accept a `Session` and plain arguments, never a `Request`, which is what makes them testable without a client.
- **Models** own persistence only.

### 5.2 Operational concerns

| Concern | Implementation |
|---|---|
| Error handling | One JSON envelope for every failure, with field-level validation detail |
| Traceability | Per-request correlation ID, echoed in `X-Request-ID` and embedded in error payloads |
| Logging | Structured JSON in production, human-readable in debug |
| Configuration | Environment-driven; relative paths resolve against the backend root |
| Validation | Pydantic bounds plus cross-field geometry checks |
| Degradation | Serves a curated dataset when the database is empty, always labelled |

### 5.3 The demo fallback

The application renders completely on a fresh clone with no database and no backend running. This is a two-sided fallback — the API serves a bundled dataset when its table is empty, and the frontend serves its own copy when the API is unreachable.

The dataset is deterministic (fixed-seed PRNG), so figures are identical on every machine and every run. Its rows are anchored to the same aggregates the charts display, and a test suite fails if the two drift apart.

**Model accuracy is never sourced from the fallback.** It always comes from the deployed model's own report.

---

## 6. Interface

Four routes: **Dashboard** (market aggregates and KPIs), **Predictor** (estimate, interval, breakdown, comparables), **Market Insights** (feature importance, price choropleth, seasonality), and **Model Report** (published accuracy, methodology).

### 6.1 The choropleth

Median price across all 70 King County ZIP codes, drawn from US Census TIGER/Line ZCTA boundaries.

The raw boundary file is 21 MB. It was filtered to the ZIPs present in the data and simplified with an iterative Douglas-Peucker implementation (recursion overflows the stack on long coastlines), then truncated to ~11 m precision — **123 KB, 32 KB gzipped**, code-split into the route that uses it.

Web Mercator projection is computed in-component in roughly six lines. There is **no mapping library, no tile server and no API key** — once the page loads, the map needs no network at all.

Shading uses **quantile bins rather than equal intervals**. Prices span 8× and are heavily right-skewed; equal intervals would render 68 of the 70 ZIPs in the same shade.

### 6.2 Honest signalling

Design decisions that cost visual polish and were kept anyway:

- Demo data is labelled with a visible badge rather than passed off as live
- Comparable sales display their 2014–15 sale dates
- Post-2015 builds are flagged as extrapolations rather than silently priced
- When the estimate falls outside the comparable range, the interface says so

---

## 7. Engineering practice

### 7.1 Testing

**116 tests**, asserting on values rather than key existence. `assert body["total"] == 6` catches regressions that `assert "total" in body` never will.

| Suite | Coverage |
|---|---|
| `test_prediction.py` | Contract, monotonicity, validation, importances, metrics |
| `test_comparables.py` | Selection quality, similarity ranking, waterfront matching, summary integrity |
| `test_properties.py` | Filtering, sorting, pagination, demo fallback |
| `test_stats.py` | Aggregates against hand-computed values |
| `test_zipcode_stats.py` | Choropleth contract, median arithmetic, ZIP key format |
| `test_demo_data.py` | Determinism, internal consistency |
| `test_health.py` | Readiness, error envelope, request IDs |

Tests run against an in-memory database and never touch local data. CI runs lint, type check, tests and build on every push, plus a guard asserting the feature contract stays consistent between training and inference.

### 7.2 Two bugs worth reporting

Both were found by building the feature that exposed them, and both are now regression tests.

**Inert model inputs.** The predictor exposed bedrooms and bathrooms as primary controls, but neither was in the trained feature set. A 1-bedroom and a 10-bedroom home of identical size returned the same price. Adding them and retraining improved R² from 0.860 to 0.904 and cut MAE from $79,553 to $64,704.

**Comparables crossing the waterfront line.** A waterfront home in Medina priced at $3.53M against a comparable range of $1.95M–$2.68M — apparently a model failure. Inspection showed every comparable returned was *inland*. Waterfront was being scored as one dimension among several rather than filtered on. After making it a hard filter:

| | Comparable range | Estimate $3,526,571 |
|---|---|---|
| Before | $1.95M – $2.68M | outside |
| After | $2.57M – $3.65M | inside |

The nearest waterfront comparable, 1.0 mi away, had sold for $3,640,900 — within 3% of the estimate. The model was right; the comparison set was built from the wrong houses.

### 7.3 Published figures cannot drift

Every accuracy number the interface displays is read from `models/metrics.json`, written by the training script and exposed through `/api/model/metrics`. Nothing is typed into markup.

This matters because an earlier version advertised R² 0.883 and MAE $42,100 while the deployed model actually scored 0.860 and $79,553. The case study had drifted from the artifact. It structurally cannot now.

---

## 8. Technology

**Frontend** — React 19 · TypeScript · TanStack Start/Router/Query · Tailwind CSS 4 · Recharts · Framer Motion · Vite 7

**Backend** — Python 3.11 · FastAPI · Pydantic v2 · SQLAlchemy 2.0 · scikit-learn · pandas · NumPy

**Tooling** — pytest · Ruff · mypy · ESLint · Prettier · Docker · GitHub Actions

---

## 9. Results

| Metric | Value |
|---|---|
| Model R² (dollars) | 0.904 |
| Mean absolute error | $64,704 |
| Median absolute error | 8.3% |
| Within ±10% | 57% |
| Within ±20% | 83% |
| Interval coverage | 90% (calibrated on held-out residuals) |
| Records served | 21,599 |
| Test suite | 116 passing |
| API endpoints | 8 |
| Choropleth payload | 32 KB gzipped |

---

## 10. Limitations and further work

**Known limitations**

- Data is from 2014–15; this demonstrates method, not current market pricing
- Single county; the model does not generalise beyond King County
- No authentication — intended to run locally or behind access controls
- SQLite by default, appropriate for single-instance read-heavy use

**Natural extensions**

- A market-conditions index to adjust historic comparables toward the present
- Renovation ROI: the ablation engine already computes "add a bathroom → +$X"
- Exportable CMA report, the actual deliverable in real estate practice
- Batch valuation for portfolio underwriting
- Model monitoring and drift detection

---

## 11. Running it

```bash
git clone https://github.com/tahmidnafees619/propiq-insights-explorer-main.git
cd propiq-insights-explorer-main

# Backend
cd propiq-backend
python -m venv venv && source venv/bin/activate   # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (second terminal, from the repository root)
npm install && npm run dev
```

The application runs immediately with its bundled dataset. To load the full 21,599 records, place `kc_house_data.csv` in `propiq-backend/data/raw/` and run `python scripts/seed_db.py`.

Docker: `docker compose up --build`

---

## 12. Author

**Md. Tahmidur Rahman Nafees**
Department of Electrical and Computer Engineering, North South University

Full-stack development and machine learning implementation — the data pipeline, model training and calibration, explainability, the FastAPI service, and the React dashboard.

[LinkedIn](https://www.linkedin.com/in/md-tahmidur-rahman-nafees-04a6a3227/) · [GitHub](https://github.com/tahmidnafees619/propiq-insights-explorer-main)

---

*Built on the King County House Sales dataset. ZIP boundaries from US Census TIGER/Line (public domain). Licensed MIT.*
