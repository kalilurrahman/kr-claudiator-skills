---
name: observability-platform
description: Build a unified observability platform integrating metrics, logs, and traces (the three pillars). Outputs OpenTelemetry instrumentation, Prometheus + Grafana stack, centralized logging, and alerting runbooks.
argument-hint: [tech stack, current tooling, team size, SLO requirements, cloud provider]
allowed-tools: Read, Write, Bash
---

# Observability Platform

Observability is the ability to understand what a system is doing from the outside by examining its outputs. The three pillars — metrics, logs, and traces — answer different questions: metrics tell you *something is wrong*, traces tell you *where*, and logs tell you *why*.

## Three Pillars

| Pillar | Tool | Answers | Retention |
|--------|------|---------|-----------|
| Metrics | Prometheus + Grafana | Is the system healthy? What are the trends? | 15 days hot, 1 year cold |
| Logs | Loki / ELK / CloudWatch | What exactly happened? What did the error say? | 30-90 days |
| Traces | Jaeger / Tempo | Which service caused the latency? Where is the bottleneck? | 7 days |

## Process

1. **Instrument with OpenTelemetry** — standard SDK; swap backends without code changes.
2. **Define SLIs and SLOs** — what does "working" mean for each service?
3. **Set up metrics collection** — Prometheus scraping + recording rules.
4. **Centralize logs** — structured JSON logs, consistent field names, correlation IDs.
5. **Enable distributed tracing** — trace context propagated across service boundaries.
6. **Build dashboards** — RED (Rate, Errors, Duration) per service; USE (Utilization, Saturation, Errors) per resource.
7. **Create alerts with runbooks** — every alert must have a linked runbook.
8. **Set up on-call rotation** — alerts page humans; humans need runbooks to respond.

## Output Format

### OpenTelemetry Instrumentation (Python)

```python
# observability/setup.py
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
import os

def setup_observability(service_name: str, service_version: str):
    """Initialize OpenTelemetry with OTLP export."""
    
    otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
    
    # Traces
    tracer_provider = TracerProvider(
        resource=Resource.create({
            "service.name": service_name,
            "service.version": service_version,
            "deployment.environment": os.environ.get("ENV", "production"),
        })
    )
    tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint))
    )
    trace.set_tracer_provider(tracer_provider)
    
    # Metrics
    reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=otlp_endpoint),
        export_interval_millis=15000
    )
    metrics.set_meter_provider(MeterProvider(metric_readers=[reader]))
    
    # Auto-instrument common libraries
    FastAPIInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()

# Custom business metrics
meter = metrics.get_meter("order-service")

order_counter = meter.create_counter(
    "orders.created",
    description="Number of orders created",
    unit="orders"
)
order_value = meter.create_histogram(
    "orders.value_usd",
    description="Order value in USD",
    unit="USD"
)
checkout_duration = meter.create_histogram(
    "checkout.duration",
    description="Checkout flow duration",
    unit="s"
)

# Custom trace spans
tracer = trace.get_tracer("order-service")

async def create_order(user_id: str, items: list) -> Order:
    with tracer.start_as_current_span("create_order") as span:
        span.set_attribute("user.id", user_id)
        span.set_attribute("order.item_count", len(items))
        
        with tracer.start_as_current_span("validate_inventory"):
            await check_inventory(items)
        
        with tracer.start_as_current_span("charge_payment") as pay_span:
            total = sum(item.price for item in items)
            pay_span.set_attribute("payment.amount_usd", total)
            await charge(user_id, total)
        
        order = await save_order(user_id, items)
        span.set_attribute("order.id", order.id)
        
        # Record business metrics
        order_counter.add(1, {"plan": user.plan, "channel": "web"})
        order_value.record(total, {"currency": "USD"})
        
        return order
```

### Prometheus Configuration

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

rule_files:
  - "rules/slo_alerts.yml"
  - "rules/infrastructure.yml"

scrape_configs:
  - job_name: "kubernetes-pods"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
```

### SLO Alerts

```yaml
# rules/slo_alerts.yml
groups:
  - name: slo_order_service
    rules:
      # Error rate SLO: 99.9% success rate
      - alert: OrderServiceErrorRateHigh
        expr: |
          sum(rate(http_requests_total{job="order-service", status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="order-service"}[5m]))
          > 0.001
        for: 2m
        labels:
          severity: critical
          slo: error_rate
        annotations:
          summary: "Order service error rate above 0.1% SLO"
          description: "Error rate is {{ $value | humanizePercentage }} (SLO: 0.1%)"
          runbook: "https://runbooks.example.com/order-service/high-error-rate"
          dashboard: "https://grafana.example.com/d/order-service"
      
      # Latency SLO: p99 < 500ms
      - alert: OrderServiceLatencyHigh
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{job="order-service"}[5m])) by (le)
          ) > 0.5
        for: 5m
        labels:
          severity: warning
          slo: latency
        annotations:
          summary: "Order service p99 latency above 500ms SLO"
          description: "p99 latency is {{ $value | humanizeDuration }}"
          runbook: "https://runbooks.example.com/order-service/high-latency"
      
      # Availability SLO: 99.9% uptime
      - alert: OrderServiceDown
        expr: up{job="order-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Order service is down"
          runbook: "https://runbooks.example.com/order-service/service-down"
```

### Structured Logging

```python
# logging/structured.py
import logging
import json
import time
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="")

class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "logger": record.name,
            "request_id": request_id_var.get(""),
            "tenant_id": tenant_id_var.get(""),
            "service": "order-service",
        }
        
        # Include exception info
        if record.exc_info:
            log_data["error"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }
        
        # Include extra fields from logger.info("msg", extra={"key": "value"})
        for key, value in record.__dict__.items():
            if key not in {"args", "asctime", "created", "exc_info", "exc_text",
                          "filename", "funcName", "levelname", "levelno", "lineno",
                          "message", "module", "msecs", "msg", "name", "pathname",
                          "process", "processName", "relativeCreated", "stack_info",
                          "thread", "threadName"}:
                log_data[key] = value
        
        return json.dumps(log_data)

# Setup
handler = logging.StreamHandler()
handler.setFormatter(StructuredFormatter())
logging.basicConfig(handlers=[handler], level=logging.INFO)
```

### Grafana Dashboard (RED Method)

```json
{
  "title": "Order Service — RED Dashboard",
  "panels": [
    {
      "title": "Request Rate (req/s)",
      "type": "stat",
      "targets": [{"expr": "sum(rate(http_requests_total{job='order-service'}[5m]))"}]
    },
    {
      "title": "Error Rate (%)",
      "type": "stat",
      "targets": [{"expr": "sum(rate(http_requests_total{job='order-service',status=~'5..'}[5m])) / sum(rate(http_requests_total{job='order-service'}[5m])) * 100"}],
      "thresholds": [{"value": 0.1, "color": "yellow"}, {"value": 1.0, "color": "red"}]
    },
    {
      "title": "P99 Duration (ms)",
      "type": "timeseries",
      "targets": [{"expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job='order-service'}[5m])) by (le)) * 1000"}]
    },
    {
      "title": "Active Traces",
      "type": "logs",
      "datasource": "Loki",
      "targets": [{"expr": "{app='order-service'} | json | level='error'"}]
    }
  ]
}
```

## Rules

- **Instrument with OpenTelemetry** — vendor-neutral; never instrument directly against Datadog, Jaeger, or any single vendor.
- **Correlation IDs are mandatory** — every request gets a unique ID; it appears in every log line, metric label, and span.
- **Structured JSON logs, always** — grep on free-text logs does not scale; machine-parseable logs enable querying.
- **Every alert needs a runbook** — an alert without a runbook teaches nothing; the on-call engineer is left guessing.
- **RED metrics for services, USE for infrastructure** — Rate/Errors/Duration per service; Utilization/Saturation/Errors per resource.
- **SLOs before alerts** — define what "working" means before alerting on it; alert on error budget burn, not thresholds.
- **Cardinality kills Prometheus** — high-cardinality label values (user_id, request_id) in metrics will OOM your Prometheus.
- **Sample traces, not all** — 1-5% sampling in production; 100% only in development.
- **Logs are for debugging, not for dashboards** — use metrics for dashboards; use logs for investigating specific incidents.
- **Test your observability** — inject errors and verify alerts fire; test that runbooks are accurate quarterly.

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

