# Contributing to PropIQ

Thanks for your interest in improving PropIQ. This document covers how to get set up, what the code expects of you, and how changes get reviewed.

## Getting set up

Follow the [Quick start](README.md#quick-start) in the README. You do not need the King County dataset to develop against: the API serves a bundled demo dataset until a real one is loaded.

For development you will also want the dev dependencies:

```bash
cd propiq-backend
pip install -r requirements-dev.txt
```

## Before you open a pull request

Run everything CI runs:

```bash
# Backend
cd propiq-backend
ruff check app scripts tests
pytest tests/ -v

# Frontend (from the repository root)
npm run lint
npx tsc --noEmit
npm run build
```

All of these must pass. CI runs the same commands.

## Architecture rules

The backend is layered, and the layering is what keeps it testable:

```
router  →  service  →  model
```

- **Routers** own the HTTP contract: path, query parameters, status codes, response schemas. They must not query the ORM directly.
- **Services** own business logic. They take a `Session` and plain arguments, never a `Request`, so they can be tested without a client.
- **Models** own persistence only.

If you find yourself importing `fastapi` into a service, or `sqlalchemy` into a router, something belongs in the layer between them.

## Things that are easy to get wrong here

A few constraints exist because breaking them has caused real bugs in this codebase:

**The feature contract is binding.** `FEATURE_COLUMNS` in `scripts/train_model.py` is persisted alongside the model and is what `MLService` reindexes payloads against. If you change it, you must retrain — a mismatch between the scaler and the feature list produces confident nonsense. `MLService._validate_contract()` refuses to start on a mismatch, and CI asserts the list stays consistent with the display labels and the breakdown baseline.

**Every UI control must reach the model.** An earlier version omitted `bedrooms` and `bathrooms` from the feature set while the predictor form presented them as primary inputs, so those controls silently did nothing. There are regression tests for this (`test_bedrooms_change_the_estimate`). Do not remove a feature from the model without removing its control, or vice versa.

**Published accuracy comes from `metrics.json`, never from markup.** Every R², MAE and error figure the UI displays is read from the deployed model's own report. If you need a new figure on a page, add it to the training script's report and read it through `/api/model/metrics` — do not type it into a component.

**Report dollar-space metrics.** The model trains on `log1p(price)`. An R² of 0.91 in log space is not the same claim as 0.90 on actual sale prices, and the latter is what a user experiences. Publish the dollar figure.

**API bounds must be a superset of UI bounds.** A valid form submission should never be rejected by the API. When you add or tighten a constraint in `PredictionInput`, check the corresponding control in `PropertyForm.tsx`.

**Demo data must stay labelled and consistent.** Anything served from the demo dataset carries `source: "demo"` and renders a visible badge. Its individual rows are anchored to the same aggregates the charts display; `tests/test_demo_data.py` fails if they drift apart.

## Style

**Python** — Ruff enforces formatting and import order (`line-length = 100`, config in `pyproject.toml`). Type-annotate public functions. Write docstrings that explain *why*, not what the code already says.

**TypeScript** — ESLint and Prettier are configured; run `npm run format`. Prefer explicit types on exported functions and props. Types in `src/types/` mirror the Pydantic schemas — keep the two in step.

**Commits** — Conventional Commits, e.g. `feat: add zipcode filter`, `fix: guard optional zipcode in table search`, `docs: clarify seeding steps`.

## Tests

New behaviour needs a test. Bug fixes need a regression test that fails without the fix.

Tests run against a throwaway in-memory SQLite database (see `tests/conftest.py`), so they never touch your local `data/propiq.db`. Use the `client` fixture for demo-fallback behaviour and `seeded_client` for a database with known, hand-checkable rows.

Prefer asserting on values over asserting that a key exists. `assert body["total"] == 6` catches regressions that `assert "total" in body` never will.

## Reporting bugs

Open an issue with what you expected, what happened, and how to reproduce it. If the API returned an error, include the `request_id` — it ties the response to a specific log line.

## Security

Please do not open public issues for security problems. See [SECURITY.md](SECURITY.md).

## License

Contributions are licensed under the [MIT License](LICENSE).
