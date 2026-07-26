---
name: test-automation-framework
description: Build a scalable test automation framework with shared utilities, reporting, and CI integration. Outputs framework architecture, base classes, fixtures, parallel execution setup, and reporting pipeline.
argument-hint: [language, test types, team size, CI platform, reporting requirements]
allowed-tools: Read, Write, Bash
---

# Test Automation Framework

A test automation framework provides the infrastructure that makes tests easier to write, maintain, and execute. It standardises patterns, provides shared utilities, handles setup/teardown, and produces consistent reporting. Without it, each team member writes tests differently and shared problems are solved repeatedly.

## Framework Architecture

```
tests/
├── framework/                  # Shared framework code
│   ├── clients/                # API clients, DB helpers
│   │   ├── api_client.py
│   │   └── db_client.py
│   ├── factories/              # Test data factories
│   │   ├── user_factory.py
│   │   └── order_factory.py
│   ├── fixtures/               # Pytest fixtures
│   │   ├── auth.py
│   │   ├── database.py
│   │   └── environment.py
│   ├── assertions/             # Custom assertions
│   │   └── api_assertions.py
│   └── reporting/              # Report generation
│       └── html_reporter.py
│
├── unit/                       # Unit tests
├── integration/                # Integration tests
├── api/                        # API tests
├── e2e/                        # End-to-end tests
│
├── conftest.py                 # Root fixtures
├── pytest.ini                  # Configuration
└── requirements-test.txt       # Test dependencies
```

## Base API Client

```python
# framework/clients/api_client.py
import httpx
import json
import logging
from typing import Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class APIResponse:
    status_code: int
    body: Any
    headers: dict
    elapsed_ms: float
    
    def assert_status(self, expected: int):
        assert self.status_code == expected, \
            f"Expected {expected}, got {self.status_code}. Body: {self.body}"
        return self
    
    def assert_field(self, field: str, expected=None):
        assert field in self.body, f"Field '{field}' missing from response: {self.body}"
        if expected is not None:
            assert self.body[field] == expected, \
                f"Field '{field}': expected {expected!r}, got {self.body[field]!r}"
        return self
    
    def assert_schema(self, required_fields: list):
        missing = [f for f in required_fields if f not in self.body]
        assert not missing, f"Missing required fields: {missing}. Got: {list(self.body.keys())}"
        return self

class APIClient:
    def __init__(self, base_url: str, default_headers: dict = None, timeout: float = 30.0):
        self.base_url = base_url.rstrip('/')
        self._default_headers = default_headers or {"Content-Type": "application/json"}
        self._timeout = timeout
        self._client = httpx.Client(timeout=timeout)
    
    def set_auth(self, token: str):
        self._default_headers["Authorization"] = f"Bearer {token}"
        return self
    
    def request(self, method: str, path: str, **kwargs) -> APIResponse:
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {**self._default_headers, **kwargs.pop("headers", {})}
        
        logger.debug(f"{method} {url}")
        response = self._client.request(method, url, headers=headers, **kwargs)
        
        try:
            body = response.json()
        except Exception:
            body = response.text
        
        elapsed = response.elapsed.total_seconds() * 1000
        return APIResponse(response.status_code, body, dict(response.headers), elapsed)
    
    def get(self, path: str, **kwargs) -> APIResponse:
        return self.request("GET", path, **kwargs)
    
    def post(self, path: str, json: dict = None, **kwargs) -> APIResponse:
        return self.request("POST", path, json=json, **kwargs)
    
    def put(self, path: str, json: dict = None, **kwargs) -> APIResponse:
        return self.request("PUT", path, json=json, **kwargs)
    
    def patch(self, path: str, json: dict = None, **kwargs) -> APIResponse:
        return self.request("PATCH", path, json=json, **kwargs)
    
    def delete(self, path: str, **kwargs) -> APIResponse:
        return self.request("DELETE", path, **kwargs)
```

## Test Data Factories

```python
# framework/factories/order_factory.py
from dataclasses import dataclass, field
from typing import Optional
import uuid
from datetime import datetime

@dataclass
class OrderItemData:
    product_id: str = None
    quantity: int = 1
    unit_price: float = 29.99
    
    def __post_init__(self):
        if self.product_id is None:
            self.product_id = f"prod-{uuid.uuid4().hex[:8]}"

@dataclass
class OrderData:
    customer_id: str = None
    items: list = field(default_factory=list)
    shipping_address: str = "123 Test St, Springfield, US 12345"
    status: str = "draft"
    notes: Optional[str] = None
    
    def __post_init__(self):
        if self.customer_id is None:
            self.customer_id = f"cust-{uuid.uuid4().hex[:8]}"
        if not self.items:
            self.items = [OrderItemData()]

class OrderFactory:
    def __init__(self, api_client: APIClient):
        self.api = api_client
        self._created_ids = []
    
    def build(self, **overrides) -> dict:
        """Build order payload without creating it."""
        data = OrderData(**overrides)
        return {
            "customer_id": data.customer_id,
            "items": [
                {"product_id": i.product_id, "quantity": i.quantity}
                for i in data.items
            ],
            "shipping_address": data.shipping_address,
            "notes": data.notes,
        }
    
    def create(self, **overrides) -> dict:
        """Create an order via API and track for cleanup."""
        payload = self.build(**overrides)
        response = self.api.post("/api/v1/orders", json=payload)
        response.assert_status(201)
        order = response.body
        self._created_ids.append(order["order_id"])
        return order
    
    def create_paid(self, **overrides) -> dict:
        """Create an order in PAID state."""
        order = self.create(**overrides)
        # Transition to paid via test endpoint
        self.api.post(f"/api/v1/test/orders/{order['order_id']}/pay")
        return {**order, "status": "paid"}
    
    def cleanup(self):
        """Delete all created orders (called in teardown)."""
        for order_id in self._created_ids:
            self.api.delete(f"/api/v1/orders/{order_id}")
        self._created_ids.clear()
```

## Fixtures

```python
# framework/fixtures/environment.py
import pytest
import os
from framework.clients.api_client import APIClient
from framework.factories.order_factory import OrderFactory

@pytest.fixture(scope="session")
def base_url() -> str:
    return os.environ.get("API_BASE_URL", "http://localhost:8080")

@pytest.fixture(scope="session")
def api_client(base_url) -> APIClient:
    return APIClient(base_url)

@pytest.fixture
def auth_client(api_client) -> APIClient:
    """Authenticated API client. Re-authenticates per test for isolation."""
    response = api_client.post("/auth/login", json={
        "email": os.environ["TEST_USER_EMAIL"],
        "password": os.environ["TEST_USER_PASSWORD"],
    })
    token = response.body["access_token"]
    
    # Create new client instance with auth to avoid polluting shared client
    client = APIClient(api_client.base_url)
    client.set_auth(token)
    return client

@pytest.fixture
def order_factory(auth_client) -> OrderFactory:
    factory = OrderFactory(auth_client)
    yield factory
    factory.cleanup()  # Auto-cleanup after each test

@pytest.fixture
def created_order(order_factory) -> dict:
    """Convenience fixture: create a standard test order."""
    return order_factory.create()

@pytest.fixture
def paid_order(order_factory) -> dict:
    """Convenience fixture: create a paid test order."""
    return order_factory.create_paid()
```

## Parallel Execution

```ini
# pytest.ini
[pytest]
addopts =
    -n auto                    # Use all CPU cores
    --dist=loadscope           # Group by module to reduce fixture overhead
    --reruns=2                 # Retry flaky tests
    --reruns-delay=1
    -v
    --tb=short
    --strict-markers

markers =
    smoke: Critical path
    regression: Full suite
    nightly: Slow tests
    serial: Must not run in parallel
    flaky: Known flaky — track but don't block
```

```python
# Mark tests that must run serially (e.g., modifying shared state)
@pytest.mark.serial
def test_modifies_global_config():
    ...

# Worker-scoped fixtures for parallel safety
@pytest.fixture(scope="function")
def isolated_db(worker_id):
    """Create worker-specific database to avoid parallel test interference."""
    db_name = f"test_db_{worker_id}"
    create_database(db_name)
    yield get_db_connection(db_name)
    drop_database(db_name)
```

## Reporting

```python
# framework/reporting/html_reporter.py
import json
from pathlib import Path
from jinja2 import Template
from datetime import datetime

def generate_report(results: list, output_path: str):
    summary = {
        "total": len(results),
        "passed": sum(1 for r in results if r["outcome"] == "passed"),
        "failed": sum(1 for r in results if r["outcome"] == "failed"),
        "skipped": sum(1 for r in results if r["outcome"] == "skipped"),
        "duration_s": sum(r.get("duration", 0) for r in results),
        "generated_at": datetime.now().isoformat(),
    }
    summary["pass_rate"] = summary["passed"] / summary["total"] if summary["total"] else 0
    
    failures = [r for r in results if r["outcome"] == "failed"]
    slowest = sorted(results, key=lambda r: r.get("duration", 0), reverse=True)[:10]
    
    # Write JSON for downstream processing
    Path(output_path).with_suffix(".json").write_text(
        json.dumps({"summary": summary, "failures": failures, "slowest": slowest})
    )
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No shared client/factory** | Every developer writes their own test setup | Base client and factories in framework/ |
| **Tests with global state** | Parallel execution causes races | Isolated fixtures; per-test cleanup |
| **No cleanup after tests** | Test data accumulates; tests interfere | Factory.cleanup() in fixture teardown |
| **Hardcoded test data** | Tests break when data changes | Factories with generated data |
| **Copy-paste test setup** | 50 tests each with 20 lines of setup | Reusable fixtures; base test classes |
| **No retry for flaky tests** | CI noise from transient failures | `--reruns=2` with delay; fix underlying flakiness |
| **Reporting only in CI** | Local test failures lack context | HTML report generated locally and in CI |

## 10 Rules

1. Framework code is production code — test it, review it, document it.
2. Every test is self-contained — it creates and cleans up all its own data.
3. Factories generate unique data per test — no hardcoded IDs or emails.
4. Authentication is per-test, not per-session — token expiry shouldn't cause cascade failures.
5. Parallel execution is the default — tests that can't run in parallel must be explicitly marked.
6. Cleanup always runs, even when tests fail — use fixtures with yield for guaranteed teardown.
7. Assertions are descriptive — failure messages tell you what went wrong, not just that it did.
8. Framework changes require team approval — breaking shared code breaks everyone's tests.
9. Report generation is automatic — every CI run produces an HTML report as an artifact.
10. Framework version is pinned — automatic updates break tests in surprising ways.
