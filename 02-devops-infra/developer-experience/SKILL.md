---
name: developer-experience
description: Improve developer experience through faster feedback loops, better local dev environments, reduced cognitive load, and tooling that gets out of the way. Outputs dev environment setup, pre-commit hooks, inner loop optimization, and DX metrics.
argument-hint: [team size, tech stack, main pain points, current build times]
allowed-tools: Read, Write, Bash
---

# Developer Experience (DX)

Developer experience is the sum of everything that affects a developer's ability to do their job. Poor DX manifests as slow build times, flaky tests, complex local setup, unclear errors, and cognitive overhead that isn't core engineering work. Good DX compounds: faster feedback loops make developers more confident and more productive.

## DX Health Indicators

| Metric | Target | Concerning |
|--------|--------|------------|
| Time from `git clone` to first `git push` | <30 min | >2 hours |
| CI build time (median) | <10 min | >30 min |
| Local test suite (unit) | <60 sec | >5 min |
| PR cycle time | <1 day | >3 days |
| Flaky test rate | <1% | >5% |
| Onboarding satisfaction | >4/5 | <3/5 |

## Process

1. **Audit the inner loop** — time every step from code change to feedback (local test, lint, build, run).
2. **Fix local dev environment** — reproducible, fast, works on first try.
3. **Optimize CI pipeline** — caching, parallelism, selective test execution.
4. **Add pre-commit hooks** — catch issues before CI; seconds vs. minutes.
5. **Improve error messages** — the best DX is a clear error message that tells you what to do.
6. **Reduce cognitive load** — fewer tools to learn, fewer configs to manage, better defaults.
7. **Measure and track** — DX metrics in dashboards; developer satisfaction surveys.

## Output Format

### One-Command Dev Environment

```bash
#!/bin/bash
# scripts/dev-setup.sh — Run once after cloning
set -euo pipefail

echo "Setting up development environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker required. Install: https://docs.docker.com/get-docker/"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3.11+ required."; exit 1; }

# Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]" --quiet

# Pre-commit hooks
pip install pre-commit --quiet
pre-commit install

# Environment variables
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example — review and update values"
fi

# Start services (database, cache, etc.)
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services..."
timeout 60 bash -c 'until docker compose exec -T db pg_isready -q; do sleep 2; done'
echo "Database ready"

# Run database migrations
python -m alembic upgrade head

# Seed development data
python scripts/seed_dev_data.py

echo ""
echo "Setup complete! Start the server:"
echo "  source .venv/bin/activate"
echo "  uvicorn src.main:app --reload"
echo ""
echo "Run tests:"
echo "  pytest tests/unit/ --no-header -q"
```

### Docker Compose for Local Dev

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d myapp_dev"]
      interval: 5s
      timeout: 5s
      retries: 10
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --save "" --appendonly no  # No persistence for dev
  
  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    # All emails captured — no accidental sends in dev

  # Hot-reload app (alternative to running locally)
  app:
    build:
      context: .
      target: development
    volumes:
      - .:/app          # Mount source for hot-reload
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://dev:dev@db:5432/myapp_dev
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
    command: uvicorn src.main:app --reload --host 0.0.0.0

volumes:
  pg_data:
```

### Pre-Commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-merge-conflict
      - id: check-added-large-files
        args: ["--maxkb=500"]
      - id: detect-private-key
      - id: no-commit-to-branch
        args: ["--branch", "main", "--branch", "production"]
  
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: ["--fix"]
      - id: ruff-format
  
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
        args: ["--ignore-missing-imports"]
  
  - repo: local
    hooks:
      - id: unit-tests
        name: Fast unit tests (no I/O)
        entry: pytest tests/unit/ -x -q --no-header
        language: system
        pass_filenames: false
        types: [python]
        stages: [pre-push]   # Only on push, not every commit
      
      - id: secrets-check
        name: Check for secrets
        entry: gitleaks detect --source . --no-git -v
        language: system
        pass_filenames: false
```

### CI Pipeline Optimization

```yaml
# .github/workflows/ci.yml — optimized for speed
name: CI

on: [push, pull_request]

jobs:
  fast-checks:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Cache Python packages
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
      
      - run: pip install ruff mypy --quiet
      - run: ruff check . && ruff format --check .
      - run: mypy src/ --ignore-missing-imports
  
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
      
      - run: pip install -e ".[dev]" --quiet
      
      # Run tests in parallel
      - run: pytest tests/unit/ -n auto --no-header -q
  
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [fast-checks, unit-tests]   # Only run if fast checks pass
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
      
      - run: pip install -e ".[dev]" --quiet
      - run: pytest tests/integration/ -n 4 --no-header
        env:
          DATABASE_URL: postgresql://postgres:test@localhost/test
```

### Makefile for Common Tasks

```makefile
# Makefile — self-documenting common tasks
.DEFAULT_GOAL := help

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "[36m%-20s[0m %s
", $$1, $$2}'

setup:  ## Set up development environment
	./scripts/dev-setup.sh

run:  ## Start development server with hot reload
	source .venv/bin/activate && uvicorn src.main:app --reload

test:  ## Run unit tests
	pytest tests/unit/ -n auto -q

test-all:  ## Run all tests including integration
	pytest tests/ -n auto

lint:  ## Run linting and type checks
	ruff check . && ruff format --check . && mypy src/

fix:  ## Auto-fix linting issues
	ruff check --fix . && ruff format .

db-upgrade:  ## Run database migrations
	alembic upgrade head

db-rollback:  ## Rollback last migration
	alembic downgrade -1

db-reset:  ## Reset database (dev only)
	alembic downgrade base && alembic upgrade head && python scripts/seed_dev_data.py

logs:  ## Show application logs
	docker compose logs -f app

clean:  ## Remove build artifacts and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; 	rm -rf .pytest_cache dist build .mypy_cache
```

## Rules

- **Setup must work on first try** — if the README has "if you get this error, try..." it's a bug in the setup, not the user.
- **Hot reload is non-negotiable** — developers cannot iterate on a 60-second rebuild cycle.
- **Pre-commit hooks must be fast** — hooks that take >10 seconds will be disabled by developers.
- **Make CI feedback actionable** — "linting failed" is useless; "line 42: unused import 'os'" is actionable.
- **Cache aggressively in CI** — uncached pip install on every CI run wastes 2-3 minutes per run.
- **Fail fast in CI** — lint and type checks run first; no point running tests if the code doesn't even parse.
- **One command to run tests** — `pytest` or `make test`, not 4 environment variables and 3 flags.
- **Dev data must be seeded automatically** — developers should not manually create test data to work with the system.
- **Fix flaky tests immediately** — a test that sometimes fails is a tax on every developer's time; quarantine and fix within a week.
- **Measure and report DX metrics** — track build times and PR cycle time in a dashboard; what gets measured gets improved.

## Worked Example and Anti-Patterns

### Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No runbook | On-call engineer has no guidance during incident | Write runbook before going to production |
| Single point of failure | One component down takes everything with it | Design for redundancy at every layer |
| No monitoring | Problems discovered by users, not engineers | Instrument before launch |
| Manual toil | Repeated manual steps slow down and introduce errors | Automate anything done more than twice |
| Undocumented decisions | Next engineer repeats the same mistakes | Use Architecture Decision Records (ADRs) |

### Rules

- **Start with the simplest thing that works** -- complexity should be earned, not assumed.
- **Make it observable before making it complex** -- logs, metrics, and traces first.
- **Automate toil** -- anything done manually more than twice should be scripted.
- **Document decisions** -- use ADRs; future engineers will thank you.
- **Test failure modes** -- chaos engineering starts small; break one thing at a time.
- **Prefer reversible decisions** -- irreversible architecture decisions need the most careful thought.
- **Own your runbooks** -- every service needs a runbook before it goes to production.
- **Measure before optimizing** -- do not optimize what you have not profiled.
- **Design for the 99th percentile user** -- the average case is not the hard case.
- **Keep it boring** -- stable, predictable, well-understood technology over cutting-edge.

