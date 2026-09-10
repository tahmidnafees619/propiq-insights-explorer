# syntax=docker/dockerfile:1

# ---- Builder -----------------------------------------------------------
# Dependencies are built into a venv here so the runtime image carries no
# compilers or build headers.
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

# ---- Runtime -----------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Run as a non-root user.
RUN useradd --create-home --uid 1000 propiq

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=propiq:propiq . .

# Writable paths for the SQLite file and any retrained artifacts.
RUN mkdir -p /app/data /app/models && chown -R propiq:propiq /app/data /app/models

USER propiq

EXPOSE 8000

# Reports "degraded" rather than failing when the model is absent, so the
# container stays healthy while serving read-only endpoints.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
