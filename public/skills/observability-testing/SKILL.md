---
name: observability-testing
description: Test that observability signals — logs, metrics, and traces — are correctly emitted and contain the right data. Outputs observability test patterns, signal verification, and alert testing approaches.
argument-hint: [observability stack, criticality of signals, testing framework, production monitoring tools]
allowed-tools: Read, Write
---

# Observability Testing

Observability signals (logs, metrics, traces) are production code. If your metrics are wrong, your alerts fire incorrectly — or don't fire when they should. Testing observability ensures that the signals you rely on for incident response are accurate.

## What to Test

```
LOGS
  Correct fields present (correlation ID, user ID, level)
  Sensitive data NOT logged (PII, passwords, tokens)
  Log level appropriate for event severity
  Structured JSON format (parseable by log aggregator)

METRICS
  Metric emitted when expected
  Labels correct and complete
  Values in expected range
  Counters only increment; gauges can go either direction

TRACES
  Spans created for key operations
  Span attributes correct
  Parent-child relationships correct
  Errors recorded on failing spans

ALERTS
  Alert fires on threshold breach
  Alert recovers when threshold clears
  Alert message contains actionable information
```

## Log Testing

```python
import logging
import pytest
import json

class CapturingHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records = []

    def emit(self, record):
        self.records.append({
            "level": record.levelname,
            "message": record.getMessage(),
            "extra": {k: v for k, v in record.__dict__.items()
                     if k not in logging.LogRecord.__dict__}
        })

@pytest.fixture
def captured_logs():
    handler = CapturingHandler()
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    yield handler.records
    root_logger.removeHandler(handler)

def test_order_creation_logs_correct_fields(captured_logs):
    """Order creation must log correlation_id, order_id, and user_id."""
    create_order(user_id="usr-123", items=["item-1"])

    order_logs = [l for l in captured_logs if "order" in l["message"].lower()]
    assert len(order_logs) >= 1, "No order creation log found"

    log = order_logs[0]
    assert "correlation_id" in log["extra"], "Missing correlation_id in log"
    assert "order_id" in log["extra"], "Missing order_id in log"
    assert "user_id" in log["extra"], "Missing user_id in log"
    assert log["level"] == "INFO"

def test_payment_failure_does_not_log_card_number(captured_logs):
    """Card numbers must NEVER appear in logs."""
    try:
        process_payment(card_number="4111111111111111", amount=99.99)
    except Exception:
        pass

    all_log_text = " ".join(str(l) for l in captured_logs)
    assert "4111111111111111" not in all_log_text, "Card number found in logs!"
    assert "411111" not in all_log_text, "Partial card number in logs!"
```

## Metrics Testing

```python
from prometheus_client import REGISTRY, Counter, Histogram
import pytest

@pytest.fixture(autouse=True)
def reset_metrics():
    """Reset prometheus metrics between tests."""
    collectors = list(REGISTRY._names_to_collectors.values())
    for collector in collectors:
        REGISTRY.unregister(collector)
    yield
    # Cleanup happens via fixture teardown

def test_order_metrics_emitted():
    """Order creation must increment the orders counter."""
    from prometheus_client import REGISTRY

    # Get metric before
    counter_before = get_metric_value("orders_created_total", {"status": "success"})

    create_order(user_id="usr-1", items=["item-1"])

    # Get metric after
    counter_after = get_metric_value("orders_created_total", {"status": "success"})
    assert counter_after == counter_before + 1, "Order creation counter not incremented"

def test_payment_duration_histogram_updated():
    """Payment processing must record duration in histogram."""
    histogram_before = get_histogram_count("payment_duration_seconds")

    process_payment(amount=50.0)

    histogram_after = get_histogram_count("payment_duration_seconds")
    assert histogram_after > histogram_before, "Payment duration not recorded"

def get_metric_value(metric_name: str, labels: dict) -> float:
    for metric in REGISTRY.collect():
        if metric.name == metric_name:
            for sample in metric.samples:
                if all(sample.labels.get(k) == v for k, v in labels.items()):
                    return sample.value
    return 0.0
```

## Trace Testing

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
import pytest

@pytest.fixture
def trace_exporter():
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(
        __import__('opentelemetry.sdk.trace.export', fromlist=['SimpleSpanProcessor'])
        .SimpleSpanProcessor(exporter)
    )
    trace.set_tracer_provider(provider)
    yield exporter
    exporter.clear()

def test_order_creates_trace_span(trace_exporter):
    create_order(user_id="usr-1", items=["item-1"])

    spans = trace_exporter.get_finished_spans()
    order_spans = [s for s in spans if s.name == "create_order"]
    assert len(order_spans) == 1, "create_order span not found"

    span = order_spans[0]
    assert span.attributes.get("order.customer_id") == "usr-1"
    assert span.status.is_ok

def test_payment_failure_records_error_on_span(trace_exporter):
    with pytest.raises(PaymentError):
        process_payment(card="declined", amount=99.99)

    spans = trace_exporter.get_finished_spans()
    payment_spans = [s for s in spans if s.name == "process_payment"]
    assert payment_spans[0].status.status_code.name == "ERROR"
    events = payment_spans[0].events
    assert any(e.name == "exception" for e in events)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Not testing observability** | Broken metrics discovered during incident | Test that signals are emitted correctly |
| **Testing log strings** | Brittle; log messages change frequently | Test log fields and structure |
| **No PII-in-logs test** | Data leak discovered in audit | Explicit test: sensitive values must not appear in logs |
| **Alert testing in production only** | Alert failure discovered during real incident | Test alert logic against synthetic data |
| **Skipping trace tests** | Distributed tracing broken silently | Test span creation for critical operations |

## 10 Rules

1. Observability signals are production code — test them like production code.
2. Test that required fields are present in logs — not just that something was logged.
3. Explicitly test that PII, tokens, and secrets do NOT appear in logs.
4. Metrics tests verify increment counts and label values — not just that metrics exist.
5. Trace tests verify span names, attributes, and error recording.
6. Alert rule logic is unit-testable — test threshold conditions with synthetic data.
7. Reset metrics state between tests — accumulated state from previous tests pollutes results.
8. Use in-memory exporters for trace testing — no real OTLP endpoint required.
9. Correlation ID propagation is tested end-to-end — trace a request across services.
10. Observability tests run in CI — broken signals are caught before deployment.
