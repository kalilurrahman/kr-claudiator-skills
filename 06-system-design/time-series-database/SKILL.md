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
