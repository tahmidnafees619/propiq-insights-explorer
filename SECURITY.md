# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report vulnerabilities through [GitHub's private advisory form](https://github.com/tahmidnafees619/propiq/security/advisories/new). Include:

- what the issue is and why it matters,
- steps to reproduce,
- affected version or commit,
- any suggested fix.

You can expect an acknowledgement within 72 hours and an assessment within a week. Please give us a reasonable window to ship a fix before disclosing publicly.

## Scope

PropIQ is a portfolio and demonstration project. It ships **without authentication** and is intended to run locally or behind your own access controls.

If you deploy it publicly, you are responsible for adding:

- authentication and authorisation,
- rate limiting on `/api/predict` (inference is the most expensive endpoint),
- a tightened `ALLOWED_ORIGINS` — the default permits localhost only, and should never be widened to `*` with `allow_credentials` enabled,
- TLS termination.

## Notes on the current design

A few deliberate choices worth understanding before deploying:

- **Model artifacts are unpickled at startup.** `pickle` executes arbitrary code on load, so `models/*.pkl` must be treated as trusted code, not data. Only load artifacts you produced yourself with `scripts/train_model.py`. Never point `MODEL_PATH` at a file from an untrusted source.
- **Error responses include a `request_id`** and a generic message. Internal exception details are logged server-side, not returned to the caller.
- **All query parameters are validated by Pydantic**, and sort fields are a closed `Literal` set rather than interpolated column names, so listing endpoints are not injectable through `sort_by`.
- **SQLite is the default** and is appropriate for a single-instance read-heavy workload. Point `DATABASE_URL` at PostgreSQL for anything concurrent.
