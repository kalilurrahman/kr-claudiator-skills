---
name: time-series-database
description: Design time-series database systems for metrics, events, and sensor data. Outputs storage architecture, retention policies, query patterns, aggregation strategies, and tool selection guide.
argument-hint: [data volume, write rate, query patterns, retention requirements, cardinality]
allowed-tools: Read, Write
---

# Time-Series Database Design

Time-series data is append-only, ordered by timestamp, and queried by time range. Specialised storage engines — columnar compression, time-based partitioning, automatic downsampling — outperform relational databases by 10-100x for time-series workloads.

## Tool Selection

```
InfluxDB   — Purpose-built TSDB; Flux query language; cloud-native
TimescaleDB — PostgreSQL extension; SQL; easy migration from Postgres
Prometheus  — Metrics only; pull-based; excellent Kubernetes integration
ClickHouse  — OLAP; excellent for analytics on event data
QuestDB    — High-performance; SQL; low-latency financial use cases

Choose TimescaleDB when: Already use PostgreSQL; need SQL; mixed workloads
Choose InfluxDB when: Pure metrics; need a managed cloud service
Choose Prometheus when: Kubernetes metrics; Grafana integration; short retention
```

## Data Model Design

```python
# Time-series data model: measurement + tags + fields + timestamp

# BAD: High cardinality tags — each unique combination creates a new series
metrics.write(
    measurement="http_requests",
    tags={"user_id": "usr-12345", "trace_id": "abc-xyz"},  # Unbounded!
    fields={"count": 1}
)

# GOOD: Tags are low-cardinality; high-cardinality goes in fields
metrics.write(
    measurement="http_requests",
    tags={
        "service":     "api-service",  # ~10 values
        "endpoint":    "/orders",      # ~50 values
        "status_code": "200",          # ~20 values
        "region":      "us-east-1",   # ~5 values
    },
    fields={
        "count":          1,
        "duration_ms":    145.2,
        "response_bytes": 2048,
    },
    time=datetime.utcnow()
)
```

## TimescaleDB Schema

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE metrics (
    time        TIMESTAMPTZ NOT NULL,
    service     TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    status_code SMALLINT NOT NULL,
    duration_ms DOUBLE PRECISION,
    count       INTEGER DEFAULT 1
);

-- Convert to hypertable: automatic time-based partitioning
SELECT create_hypertable('metrics', 'time', chunk_time_interval => INTERVAL '1 day');

-- Indexes for common query patterns
CREATE INDEX ON metrics (service, time DESC);
CREATE INDEX ON metrics (endpoint, time DESC);

-- Continuous aggregate: pre-computed 1-minute rollups
CREATE MATERIALIZED VIEW metrics_1min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket,
    service,
    endpoint,
    COUNT(*) AS request_count,
    AVG(duration_ms) AS avg_duration,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration
FROM metrics
GROUP BY bucket, service, endpoint;

-- Retention: auto-delete raw data after 90 days
SELECT add_retention_policy('metrics', INTERVAL '90 days');

-- Compression: compress chunks older than 7 days (80-95% size reduction)
ALTER TABLE metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'service,endpoint'
);
SELECT add_compression_policy('metrics', INTERVAL '7 days');

-- Query: p99 latency over last hour by service
SELECT
    time_bucket('5 minutes', time) AS bucket,
    service,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms
FROM metrics
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket, service
ORDER BY bucket DESC;
```

## Prometheus Metrics Pattern

```python
from prometheus_client import Counter, Histogram, Gauge

# Counters: always increasing
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    labelnames=['service', 'endpoint', 'status_code']
)

# Histograms: latency with percentile buckets
http_request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    labelnames=['service', 'endpoint'],
    buckets=[.005, .01, .025, .05, .1, .25, .5, 1.0, 2.5, 5.0]
)

# Gauges: can go up or down
active_connections = Gauge(
    'active_connections',
    'Current active connections',
    labelnames=['service']
)

# Recording
def record_request(service, endpoint, status_code, duration_s):
    http_requests_total.labels(
        service=service, endpoint=endpoint, status_code=str(status_code)
    ).inc()
    http_request_duration.labels(
        service=service, endpoint=endpoint
    ).observe(duration_s)
```

## Downsampling Strategy

```sql
-- Raw data: 1s resolution, kept 7 days
-- 1-min rollup: kept 30 days
-- 1-hour rollup: kept 1 year
-- 1-day rollup: kept forever

-- Refresh policy for continuous aggregates
SELECT add_continuous_aggregate_policy('metrics_1min',
    start_offset => INTERVAL '2 minutes',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **High-cardinality tags** | Millions of series; memory exhaustion | Tags are low-cardinality; user IDs in fields |
| **No retention policy** | Disk fills indefinitely | Automatic retention + downsampling |
| **No pre-aggregation** | Dashboards scan billions of raw rows | Continuous aggregates for common time buckets |
| **Storing logs as time-series** | TSDBs optimised for numbers, not text | Loki/Elasticsearch for logs; TSDB for metrics |
| **PostgreSQL for >10k writes/sec** | 10-100x slower than TSDB at scale | TimescaleDB or native TSDB |

## 10 Rules

1. Tags are for filtering; fields are for measuring — tags must be low-cardinality.
2. Define a retention policy on day one — time-series data grows indefinitely.
3. Pre-aggregate at write time or via continuous aggregates — don't scan raw data for dashboards.
4. Downsampling: 1s raw → 1min → 1hour → 1day as data ages.
5. Never store unbounded cardinality in tags — user IDs, request IDs break TSDBs.
6. Timestamps in UTC; nanosecond precision for high-frequency metrics.
7. Compression is automatic in modern TSDBs — enable it for 80-95% storage savings.
8. Cardinality limits protect the system — alert when series count approaches limits.
9. Prometheus is for alerting and current-state; long-term storage needs a separate TSDB.
10. Schema changes are hard in TSDBs — design the tag set carefully before writing data.

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

The canonical workflow for **Time Series Database** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design time-series database systems for metrics, events, and sensor data. Outputs storage architecture, retention policies, query patterns, aggregation strategi
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
