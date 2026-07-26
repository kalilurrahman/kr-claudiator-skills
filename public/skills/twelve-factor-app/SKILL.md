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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Twelve Factor App** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Apply the Twelve-Factor App methodology to build scalable, maintainable cloud-native applications. Outputs compliance checklist, configuration audit, and refact
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
