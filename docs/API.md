# API Reference

Base URL `http://localhost:8000` · interactive docs at `/docs` · OpenAPI at `/openapi.json`

All responses are JSON. Every failure uses one error envelope (§4), so a client
needs exactly one error path.

---

## 1. Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Service index — version and endpoint map |
| `GET` | `/api/health` | Model and database readiness, active data source |
| `POST` | `/api/predict` | Price a property: estimate, interval, breakdown, comparables |
| `GET` | `/api/feature-importance` | Ranked price drivers (`?limit=N`) |
| `GET` | `/api/model/metrics` | Held-out accuracy of the deployed model |
| `GET` | `/api/properties` | Filter, search, sort and paginate sale records |
| `GET` | `/api/properties/{id}` | A single property |
| `GET` | `/api/stats` | Every dashboard aggregate in one round trip |
| `GET` | `/api/stats/by-zipcode` | Median price, $/sqft and volume per ZIP code |

---

## 2. Verification log

Every endpoint was exercised against a running instance backed by the full
seeded database (21,599 records), on 2026-09-14.

| Endpoint | Status | Time | Payload | Notes |
|---|---|---|---|---|
| `GET /` | 200 | 25 ms | 352 B | Endpoint map correct |
| `GET /api/health` | 200 | 10 ms | 273 B | `model_loaded: true`, `data_source: "database"`, `property_count: 21599` |
| `GET /api/model/metrics` | 200 | 3 ms | 963 B | Matches `metrics.json` exactly |
| `GET /api/feature-importance?limit=5` | 200 | 25 ms | 471 B | Ranked, with display labels |
| `GET /api/stats` | 200 | 50 ms | 22.5 KB | Median $450,000 · MAE $64,704 from the model, not hardcoded |
| `GET /api/stats/by-zipcode` | 200 | 87 ms | 7.2 KB | All 70 ZIPs |
| `GET /api/properties?limit=2` | 200 | 12 ms | 892 B | `total: 21599`, pagination metadata complete |
| `GET /api/properties/1` | 200 | 8 ms | 384 B | Full record |
| `POST /api/predict` | 200 | — | — | Estimate, interval, 5-row breakdown, 5 comparables |

Slowest endpoint under 100 ms on SQLite with no cache.

### Error paths

| Case | Expected | Actual | Response |
|---|---|---|---|
| `grade: 99` | 422 | **422** | `validation_error`, field-level: *"Input should be less than or equal to 13"* |
| `sqft_above` 9,000 in a 1,000 sqft home | 422 | **422** | Cross-field geometry check fires with a readable message |
| `GET /api/properties/999999` | 404 | **404** | `not_found` — *"No property with id 999999."* |
| `GET /api/nope` | 404 | **404** | Same envelope as domain errors, not FastAPI's default |
| `yr_built: 2024` | 200 + flag | **200** | `extrapolated: true`, `confidence_level: "low"`, explanatory note — priced, not rejected |

### Cross-cutting

```
x-request-id: fbc8c030396b4e62
x-response-time-ms: 2.26
```

Every response carries a correlation ID; it is echoed in error payloads and
attached to every log line for that request, so a user-reported failure traces
to a specific log entry.

CORS preflight from `http://localhost:5173`:

```
access-control-allow-origin: http://localhost:5173
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-credentials: true
access-control-max-age: 600
```

Methods are restricted to what the API actually serves rather than `*`.

---

## 3. `POST /api/predict`

### Request

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

| Field | Type | Bounds |
|---|---|---|
| `sqft_living` | number | 300 – 15,000 |
| `sqft_lot` | number | 500 – 2,000,000 |
| `bedrooms` | int | 1 – 15 |
| `bathrooms` | number | 0.5 – 10 |
| `floors` | number | 1 – 4 |
| `waterfront` | 0 \| 1 | |
| `view` | int | 0 – 4 |
| `condition` | int | 1 – 5 |
| `grade` | int | 1 – 13 |
| `sqft_above` | number | ≥ 0 |
| `sqft_basement` | number | ≥ 0 |
| `yr_built` | int | 1900 – current year |
| `lat` | number | King County bounds |
| `long` | number | King County bounds |

**Cross-field rule:** `sqft_above + sqft_basement` must not exceed
`sqft_living`. The predictor form derives above-ground area from the other two
inputs, so this error is unreachable through the UI — it exists for direct API
callers.

### Response (abridged)

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
  "extrapolated": false,
  "notes": [],

  "comparables": [
    {
      "id": 1634, "price": 415000, "price_formatted": "$415,000",
      "bedrooms": 3, "bathrooms": 1.75, "sqft_living": 2380, "grade": 8,
      "yr_built": 1956, "zipcode": "98118", "waterfront": 0,
      "distance_miles": 0.11, "similarity": 94.2,
      "price_per_sqft": 174.37, "sold": "Nov 2014"
    }
  ]
}
```

**`breakdown`** is computed by ablation and reconciles to `predicted_price`. The
non-additive remainder is reported as *Combined effects* rather than hidden —
see [the model report](MODEL_REPORT.md#6-explainability).

**`price_low` / `price_high`** are a 90% interval derived from held-out
residuals, not a fixed percentage. Measured empirical coverage is 91.3%.

**`comparables`** are the five most similar real sales nearby: bounding-box
prefilter in SQL, then exact haversine distance, scored on distance (40%), size
(30%), grade (20%) and room count (10%). The search widens 2 mi → 5 mi → 15 mi
only when it must. **Waterfront is a hard filter, never a scored dimension.**

**`extrapolated`** is `true` for homes built after 2015, the last year in the
training data. The request is priced and flagged, not rejected.

---

## 4. Error envelope

```jsonc
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields failed validation.",
    "details": [
      {
        "field": "grade",
        "message": "Input should be less than or equal to 13",
        "type": "less_than_equal"
      }
    ],
    "request_id": "94e4e00d890e4a3d"
  }
}
```

| `code` | HTTP | Meaning |
|---|---|---|
| `validation_error` | 422 | Field or cross-field validation failed; `details` is populated |
| `not_found` | 404 | No such resource, and unmatched routes |
| `model_not_ready` | 503 | Artifacts missing or failed to load |
| `internal_error` | 500 | Unexpected failure; details are logged, never returned |

Internal exception text never reaches the caller. It is logged server-side
against the same `request_id`.

---

## 5. `GET /api/properties` — querying

| Parameter | Type | Notes |
|---|---|---|
| `search` | string | Free text across zipcode and attributes |
| `min_price` / `max_price` | number | |
| `bedrooms` / `bathrooms` | number | |
| `min_sqft` / `max_sqft` | number | |
| `grade` | int | |
| `zipcode` | string | |
| `sort_by` | enum | A closed `Literal` set — never an interpolated column name |
| `sort_dir` | `asc` \| `desc` | |
| `limit` / `offset` | int | Response carries `total`, `count`, `has_more` |

---

## 6. Data source signalling

Collection endpoints return a `source` field, rendered in the UI as a visible
badge:

| `source` | Meaning |
|---|---|
| `database` | Real seeded sale records |
| `demo` | The bundled showcase dataset |

The fallback is two-sided: the API serves a bundled dataset when its table is
empty, and the frontend serves its own copy when the API is unreachable. The
dashboard is therefore never blank on a fresh clone — and never silently
pretends demo figures are real.

**Model accuracy is never sourced from demo data.** It always comes from the
deployed model's own report.

---

*See also: [Project report](PROJECT_REPORT.md) · [Model report](MODEL_REPORT.md) · [Roadmap](ROADMAP.md)*
