---
name: twelve-factor-app
description: Apply the Twelve-Factor App methodology to build scalable, maintainable cloud-native applications. Outputs compliance checklist, configuration audit, and refactoring recommendations.
argument-hint: [application type, deployment target, current violations, team maturity]
allowed-tools: Read, Write, Bash
---

# Twelve-Factor App

The Twelve-Factor App is a methodology for building software-as-a-service apps that are portable, scalable, and maintainable. Violating the factors creates operational complexity, deployment friction, and scaling barriers.

## The Twelve Factors

| # | Factor | Core Principle |
|---|--------|---------------|
| I | Codebase | One codebase, many deploys |
| II | Dependencies | Explicitly declare and isolate |
| III | Config | Store config in the environment |
| IV | Backing Services | Treat as attached resources |
| V | Build, Release, Run | Strictly separate stages |
| VI | Processes | Execute as stateless processes |
| VII | Port Binding | Export services via port binding |
| VIII | Concurrency | Scale out via process model |
| IX | Disposability | Fast startup, graceful shutdown |
| X | Dev/Prod Parity | Keep environments as similar as possible |
| XI | Logs | Treat as event streams |
| XII | Admin Processes | Run as one-off processes |

## Config (Factor III)

```python
# BAD — config in code
DATABASE_URL = "postgresql://prod-db:5432/app"
API_KEY = "sk_live_abc123"

# GOOD — config from environment
import os
DATABASE_URL = os.environ["DATABASE_URL"]  # Raise if missing — fail fast
API_KEY = os.environ["API_KEY"]
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Use pydantic-settings for typed config
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    api_key: str
    debug: bool = False
    max_workers: int = 4

    class Config:
        env_file = ".env"  # Local dev only; production reads from real env

settings = Settings()
```

## Processes (Factor VI) — Stateless

```python
# BAD — in-memory state between requests
class OrderService:
    _pending_orders = {}  # Dies on restart; wrong on multiple instances

    def add_order(self, order_id, data):
        self._pending_orders[order_id] = data  # Lost on pod restart

# GOOD — all state in backing services
class OrderService:
    def __init__(self, redis_client, db):
        self._redis = redis_client
        self._db = db

    def add_order(self, order_id, data):
        self._redis.setex(f"order:{order_id}", 3600, json.dumps(data))  # Survives restart
```

## Disposability (Factor IX)

```python
import signal
import sys
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — fast (target < 5 seconds)
    await db_pool.connect()
    await cache.ping()
    print("Application started")
    yield
    # Shutdown — graceful
    print("Shutting down: finishing in-flight requests...")
    await db_pool.close()
    await cache.close()
    print("Shutdown complete")

app = FastAPI(lifespan=lifespan)

# Handle SIGTERM for Kubernetes graceful shutdown
def handle_sigterm(*args):
    print("SIGTERM received — initiating graceful shutdown")
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
```

## Logs (Factor XI) — Treat as Streams

```python
import logging
import sys
import json

# BAD — writing log files (twelve-factor violation)
logging.basicConfig(filename="/var/log/app.log")

# GOOD — write to stdout; infrastructure handles routing
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(message)s",
)

# Structured JSON logs for machine parsing
import structlog
logger = structlog.get_logger()
logger.info("order_placed", order_id="ord-123", amount=5999, currency="USD")
# → {"event": "order_placed", "order_id": "ord-123", "amount": 5999, "timestamp": "..."}
```

## Compliance Checklist

```bash
# I. One codebase
git remote -v  # Should be exactly one canonical remote

# II. Dependencies declared
cat requirements.txt || cat pyproject.toml  # All deps explicit; no system-installed packages

# III. Config in environment
grep -r "hardcoded_password\|api_key = " src/  # Should return nothing

# V. Build/Release/Run separated
# Build: docker build -t app:v1.2.3 .
# Release: tag image + config = release artifact
# Run: docker run app:v1.2.3

# VI. Stateless processes
# Test: kill the process, restart it — does it work? Does data survive?

# IX. Disposability
time docker run app:v1.2.3  # Startup target: < 5 seconds
# Send SIGTERM → app should finish in-flight requests and exit cleanly

# XI. Logs to stdout
docker logs <container_id>  # Should show structured logs
```

## Anti-Patterns to Avoid

| Anti-Pattern | Factor | Fix |
|---|---|---|
| Config in code or config files committed to git | III | Environment variables only |
| Session stored in process memory | VI | Redis/DB for session state |
| Writing log files inside container | XI | stdout only; use log aggregator |
| Long container startup (>30s) | IX | Lazy connect; health check with startupProbe |
| Dependency installed at runtime | II | All deps in requirements.txt; baked into image |

## 10 Rules

1. One codebase — multiple deploys use the same code with different config.
2. All dependencies declared explicitly — no implicit system packages.
3. Config is in environment variables — never in code or committed files.
4. Backing services (DB, cache, queue) are attached resources — swappable via URL.
5. Build artifacts are immutable — same image deploys to staging and prod.
6. Processes are stateless — any instance handles any request.
7. The app binds to a port and receives requests — no app server required.
8. Scale by adding processes — not by making a single process bigger.
9. Fast startup (<5s), graceful SIGTERM handling — essential for Kubernetes.
10. Log to stdout only — routing, aggregation, and storage are infrastructure concerns.
