---
name: api-analytics
description: Implement API analytics to measure usage, performance, errors, and consumer behaviour. Outputs instrumentation design, metric taxonomy, dashboard specifications, and alerting strategy.
argument-hint: [API type, traffic volume, consumer types, observability stack, business goals]
allowed-tools: Read, Write
---

# API Analytics

API analytics gives you visibility into how your API is being used: which endpoints are popular, which consumers are most active, where latency is highest, and which errors are most common. This data drives product decisions, SLA negotiations, and capacity planning.

## Metric Taxonomy

```
REQUEST METRICS
  api_requests_total{endpoint, method, status_code, consumer_id, version}
  api_request_duration_seconds{endpoint, method, version} — histogram
  api_request_size_bytes{endpoint, method}
  api_response_size_bytes{endpoint, method}

CONSUMER METRICS
  api_consumer_requests_total{consumer_id, endpoint}
  api_consumer_rate_limit_hits_total{consumer_id}
  api_consumer_errors_total{consumer_id, error_type}

BUSINESS METRICS
  api_revenue_generated{endpoint, consumer_id}   -- if trackable
  api_unique_consumers_active{endpoint, period}
  api_feature_adoption{feature_flag, endpoint}

ERROR METRICS
  api_errors_total{endpoint, error_code, error_type}
  api_timeout_total{endpoint, upstream}
  api_validation_errors_total{endpoint, field}
```

## Instrumentation Middleware

```python
import time
import hashlib
from prometheus_client import Counter, Histogram, Gauge
from fastapi import FastAPI, Request, Response

app = FastAPI()

# Prometheus metrics
requests_total = Counter(
    "api_requests_total",
    "Total API requests",
    ["endpoint", "method", "status_code", "consumer_tier", "version"]
)

request_duration = Histogram(
    "api_request_duration_seconds",
    "API request latency",
    ["endpoint", "method", "version"],
    buckets=[.005, .01, .025, .05, .1, .25, .5, 1.0, 2.5, 5.0, 10.0]
)

@app.middleware("http")
async def api_analytics_middleware(request: Request, call_next):
    start = time.monotonic()
    correlation_id = request.headers.get("x-correlation-id", "")

    # Identify consumer tier (from JWT or API key lookup)
    consumer_tier = await get_consumer_tier(request)
    version = extract_api_version(request.url.path)

    # Normalise endpoint path: /orders/123 → /orders/{id}
    endpoint_template = normalise_path(request.url.path)

    response = await call_next(request)

    duration = time.monotonic() - start

    # Record metrics
    requests_total.labels(
        endpoint=endpoint_template,
        method=request.method,
        status_code=str(response.status_code),
        consumer_tier=consumer_tier,
        version=version,
    ).inc()

    request_duration.labels(
        endpoint=endpoint_template,
        method=request.method,
        version=version,
    ).observe(duration)

    # Structured log for analytics pipeline (BigQuery, Redshift)
    import structlog
    structlog.get_logger("api.analytics").info(
        "api_request",
        endpoint=endpoint_template,
        method=request.method,
        status_code=response.status_code,
        duration_ms=round(duration * 1000, 2),
        consumer_tier=consumer_tier,
        version=version,
        correlation_id=correlation_id,
        # Hash consumer ID for privacy
        consumer_hash=hashlib.sha256(
            request.headers.get("x-api-key", "").encode()
        ).hexdigest()[:16],
    )

    return response

def normalise_path(path: str) -> str:
    """Replace UUIDs and numeric IDs with placeholders."""
    import re
    path = re.sub(r"/[0-9a-f]{8}-[0-9a-f-]{27}", "/{uuid}", path)
    path = re.sub(r"/\d+", "/{id}", path)
    return path
```

## Analytics Dashboard Specifications

```markdown
## API Health Dashboard

### Panel 1: Traffic Overview
- Total requests per minute (time series)
- Requests by version (v1 vs v2 adoption)
- Top 10 endpoints by volume (bar chart)

### Panel 2: Error Analysis
- Error rate by endpoint (heat map)
- 4xx breakdown: 400, 401, 403, 404, 429
- 5xx breakdown: 500, 502, 503, 504
- Top 10 error-producing endpoints

### Panel 3: Latency
- p50, p95, p99 latency by endpoint (time series)
- Slowest endpoints by p99 (bar chart)
- Latency distribution histogram

### Panel 4: Consumer Analytics
- Active consumers (unique API keys/JWTs, 24h)
- Top 10 consumers by request volume
- Rate limit hits by consumer
- Consumer error rate heat map

### Panel 5: Business Metrics (if trackable)
- API-driven revenue per endpoint
- Feature adoption by endpoint
- Consumer growth trend (new consumers per week)
```

## Consumer Usage Reports (Automated)

```python
async def generate_consumer_report(consumer_id: str,
                                   period_days: int = 30) -> dict:
    """Generate usage report for API consumer (for billing, SLA review)."""
    report = await db.execute("""
        SELECT
            endpoint,
            COUNT(*) AS requests,
            SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS server_errors,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms,
            COUNT(DISTINCT DATE(timestamp)) AS active_days
        FROM api_request_log
        WHERE consumer_hash = $1
          AND timestamp > NOW() - INTERVAL '$2 days'
        GROUP BY endpoint
        ORDER BY requests DESC
        LIMIT 20
    """, [consumer_id, period_days])

    return {
        "consumer_id": consumer_id,
        "period_days": period_days,
        "total_requests": sum(r["requests"] for r in report),
        "endpoints": report,
        "report_generated_at": datetime.utcnow().isoformat(),
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Not normalising paths** | /orders/123 and /orders/456 are separate metrics | Replace IDs with {id} template |
| **Logging raw API keys** | Security risk; PII in logs | Hash API key before logging |
| **No consumer attribution** | Can't track who is calling what | Attach consumer_id from auth token to every metric |
| **Only tracking happy path** | Errors invisible | Include 4xx and 5xx in all metrics |
| **Dashboard without alerts** | Degradation discovered by users | Alert on error rate >1%, p99 latency >2x baseline |

## 10 Rules

1. Normalise endpoint paths before recording — `/orders/123` → `/orders/{id}`.
2. Include consumer attribution in every metric and log record.
3. Track all status codes — 4xx errors are often more informative than 5xx.
4. Hash or pseudonymise consumer identifiers in logs — raw API keys are secrets.
5. Rate limit hits are a metric — high rates indicate a product or pricing issue.
6. p99 latency is the primary latency metric — p50 hides tail latency problems.
7. Version metrics — track adoption of new API versions vs deprecated ones.
8. Consumer usage reports automate billing and SLA review conversations.
9. Alerts are derived from analytics metrics — not separate instrumentation.
10. API analytics feeds product decisions: which endpoints to invest in, which to deprecate.
