# PropIQ developer tasks.
# Run `make help` for the list.

BACKEND := propiq-backend
PY      := python

.DEFAULT_GOAL := help
.PHONY: help install install-api install-web dev-api dev-web test test-api lint lint-api lint-web \
        typecheck build train seed check clean docker-up docker-down

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: install-api install-web ## Install all dependencies

install-api: ## Install backend dependencies
	cd $(BACKEND) && $(PY) -m pip install -r requirements-dev.txt

install-web: ## Install frontend dependencies
	npm install

dev-api: ## Run the API with reload
	cd $(BACKEND) && uvicorn app.main:app --reload --port 8000

dev-web: ## Run the frontend dev server
	npm run dev

train: ## Train the model and write models/metrics.json
	cd $(BACKEND) && $(PY) scripts/train_model.py

seed: ## Load the King County dataset into SQLite
	cd $(BACKEND) && $(PY) scripts/seed_db.py

test: test-api ## Run all tests

test-api: ## Run the backend test suite
	cd $(BACKEND) && $(PY) -m pytest tests/ -v

lint: lint-api lint-web ## Lint everything

lint-api: ## Lint the backend
	cd $(BACKEND) && $(PY) -m ruff check app scripts tests

lint-web: ## Lint the frontend
	npm run lint

typecheck: ## Type check the frontend
	npx tsc --noEmit

build: ## Build the frontend for production
	npm run build

check: lint typecheck test build ## Everything CI runs

docker-up: ## Start both services in Docker
	docker compose up --build

docker-down: ## Stop and remove the Docker stack
	docker compose down

clean: ## Remove build output and caches
	rm -rf dist .output .vite node_modules/.vite
	find $(BACKEND) -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf $(BACKEND)/.pytest_cache $(BACKEND)/.ruff_cache $(BACKEND)/.mypy_cache
