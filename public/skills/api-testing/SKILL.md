---
name: api-testing
description: Build comprehensive API test suites covering functional, contract, security, and performance aspects. Outputs test collections, automation scripts, CI integration, and coverage reports.
argument-hint: [API type, authentication method, test framework, existing coverage, CI system]
allowed-tools: Read, Write, Bash
---

# API Testing

API testing validates that endpoints behave correctly for both valid and invalid inputs, handle authentication properly, perform within SLAs, and satisfy their documented contracts. It catches regressions before users do.

## Test Pyramid for APIs

```
        ┌─────────────────────┐
        │   E2E / Integration │  ← Full workflow tests (slow, few)
        └─────────────────────┘
      ┌───────────────────────────┐
      │  Contract / Schema Tests  │  ← API contract validation (medium)
      └───────────────────────────┘
    ┌─────────────────────────────────┐
    │     Functional API Tests        │  ← Endpoint behaviour (fast, many)
    └─────────────────────────────────┘
  ┌───────────────────────────────────────┐
  │     Unit Tests (handlers/services)    │  ← Business logic (fastest)
  └───────────────────────────────────────┘
```

## Pytest + HTTPX — API Test Suite

```python
# tests/api/conftest.py
import pytest
import httpx
from app.main import app
from app.db import get_db
from tests.factories import UserFactory, OrderFactory

@pytest.fixture(scope="session")
def client():
    with httpx.Client(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
def auth_headers(client):
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "Test1234!"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_headers(client):
    response = client.post("/auth/login", json={
        "email": "admin@example.com",
        "password": "Admin1234!"
    })
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
```

```python
# tests/api/test_orders.py
import pytest

class TestCreateOrder:
    def test_creates_order_with_valid_data(self, client, auth_headers):
        response = client.post("/api/v1/orders", headers=auth_headers, json={
            "items": [{"product_id": "prod-1", "quantity": 2}],
            "shipping_address": "123 Main St, Springfield, US 12345"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert len(data["items"]) == 1
        assert "order_id" in data
        assert "created_at" in data

    def test_returns_400_with_empty_items(self, client, auth_headers):
        response = client.post("/api/v1/orders", headers=auth_headers, json={
            "items": [],
            "shipping_address": "123 Main St"
        })
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("items" in str(e) for e in errors)

    def test_returns_401_without_auth(self, client):
        response = client.post("/api/v1/orders", json={
            "items": [{"product_id": "prod-1", "quantity": 1}]
        })
        assert response.status_code == 401

    def test_returns_422_with_invalid_quantity(self, client, auth_headers):
        response = client.post("/api/v1/orders", headers=auth_headers, json={
            "items": [{"product_id": "prod-1", "quantity": 0}]
        })
        assert response.status_code == 422

    def test_rate_limit_enforced(self, client, auth_headers):
        """POST /orders limited to 10/minute."""
        responses = [
            client.post("/api/v1/orders", headers=auth_headers, json={
                "items": [{"product_id": "prod-1", "quantity": 1}],
                "shipping_address": "123 Main St"
            })
            for _ in range(15)
        ]
        status_codes = [r.status_code for r in responses]
        assert 429 in status_codes

class TestGetOrder:
    def test_owner_can_access_own_order(self, client, auth_headers, test_order):
        response = client.get(f"/api/v1/orders/{test_order.id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["order_id"] == str(test_order.id)

    def test_bola_other_user_cannot_access(self, client, other_auth_headers, test_order):
        """BOLA: User B cannot access User A's order."""
        response = client.get(f"/api/v1/orders/{test_order.id}", headers=other_auth_headers)
        assert response.status_code in [403, 404]

    def test_returns_404_for_nonexistent_order(self, client, auth_headers):
        response = client.get("/api/v1/orders/00000000-0000-0000-0000-000000000000",
                              headers=auth_headers)
        assert response.status_code == 404

    def test_response_schema(self, client, auth_headers, test_order):
        response = client.get(f"/api/v1/orders/{test_order.id}", headers=auth_headers)
        data = response.json()
        required_fields = ["order_id", "status", "items", "created_at", "total_amount"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

class TestOrderPagination:
    def test_default_pagination(self, client, auth_headers):
        response = client.get("/api/v1/orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert len(data["items"]) <= 20  # Default page size

    def test_custom_page_size(self, client, auth_headers):
        response = client.get("/api/v1/orders?page_size=5", headers=auth_headers)
        assert len(response.json()["items"]) <= 5

    def test_max_page_size_enforced(self, client, auth_headers):
        response = client.get("/api/v1/orders?page_size=9999", headers=auth_headers)
        # Either 422 or capped at max
        if response.status_code == 200:
            assert len(response.json()["items"]) <= 100
```

## Security-Focused Tests

```python
# tests/api/test_security.py
class TestAuthenticationSecurity:
    def test_expired_token_rejected(self, client, expired_token):
        response = client.get("/api/v1/me",
                              headers={"Authorization": f"Bearer {expired_token}"})
        assert response.status_code == 401

    def test_tampered_token_rejected(self, client, valid_token):
        tampered = valid_token[:-5] + "XXXXX"
        response = client.get("/api/v1/me",
                              headers={"Authorization": f"Bearer {tampered}"})
        assert response.status_code == 401

    def test_sql_injection_in_search(self, client, auth_headers):
        payloads = [
            "' OR '1'='1",
            "'; DROP TABLE orders; --",
            "1 UNION SELECT * FROM users--",
        ]
        for payload in payloads:
            response = client.get(f"/api/v1/orders?q={payload}", headers=auth_headers)
            # Should return 200 with empty results or 422 — not 500
            assert response.status_code in [200, 422, 400], \
                f"Possible SQL injection with payload: {payload}"
            assert response.status_code != 500

    def test_xss_in_response(self, client, auth_headers):
        response = client.post("/api/v1/orders", headers=auth_headers, json={
            "notes": "<script>alert('xss')</script>",
            "items": [{"product_id": "prod-1", "quantity": 1}],
            "shipping_address": "123 Main St"
        })
        if response.status_code == 201:
            body = response.text
            assert "<script>" not in body

    def test_response_does_not_leak_internal_info(self, client):
        response = client.get("/api/v1/orders/invalid-id")
        body = response.text.lower()
        assert "stack trace" not in body
        assert "traceback" not in body
        assert "sqlalchemy" not in body
        assert "psycopg2" not in body

class TestInputValidation:
    def test_rejects_oversized_payload(self, client, auth_headers):
        large_notes = "A" * 100000
        response = client.post("/api/v1/orders", headers=auth_headers,
                               json={"notes": large_notes, "items": [], "shipping_address": "x"})
        assert response.status_code in [413, 422]

    def test_content_type_enforced(self, client, auth_headers):
        response = client.post(
            "/api/v1/orders",
            headers={**auth_headers, "Content-Type": "text/plain"},
            content='{"items": []}'
        )
        assert response.status_code in [415, 422]
```

## Performance Tests

```python
# tests/api/test_performance.py
import time
import statistics
import concurrent.futures

def test_order_list_p99_latency(client, auth_headers):
    """p99 latency for GET /orders must be < 500ms."""
    latencies = []
    for _ in range(100):
        start = time.time()
        response = client.get("/api/v1/orders", headers=auth_headers)
        latencies.append((time.time() - start) * 1000)
        assert response.status_code == 200
    
    p99 = sorted(latencies)[int(len(latencies) * 0.99)]
    assert p99 < 500, f"p99 latency {p99:.0f}ms exceeds 500ms threshold"

def test_concurrent_order_creation(client, auth_headers):
    """10 concurrent order creations should all succeed."""
    def create_order():
        return client.post("/api/v1/orders", headers=auth_headers, json={
            "items": [{"product_id": "prod-1", "quantity": 1}],
            "shipping_address": "123 Main St"
        })
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(create_order) for _ in range(10)]
        results = [f.result() for f in futures]
    
    status_codes = [r.status_code for r in results]
    assert all(c == 201 for c in status_codes), \
        f"Some concurrent requests failed: {status_codes}"
```

## Newman / Postman CLI

```bash
# Run Postman collection in CI
npm install -g newman newman-reporter-htmlextra

newman run \
  postman/api-tests.json \
  --environment postman/staging.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export reports/api-test-report.html \
  --bail failure \
  --timeout-request 5000

# Environment file (postman/staging.json)
{
  "name": "Staging",
  "values": [
    {"key": "base_url", "value": "https://api.staging.example.com"},
    {"key": "api_key",  "value": "{{$processEnv.STAGING_API_KEY}}"}
  ]
}
```

## CI Integration

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: testdb }
      redis:
        image: redis:7

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r requirements-dev.txt

      - name: Run API tests
        run: pytest tests/api/ -v --tb=short
             --junitxml=reports/api-tests.xml
             --html=reports/api-tests.html
        env:
          DATABASE_URL: postgresql://postgres:test@localhost/testdb
          REDIS_URL: redis://localhost:6379

      - name: Security scan (OWASP ZAP)
        if: github.ref == 'refs/heads/main'
        run: |
          docker run --network host zaproxy/zap-stable \
            zap-api-scan.py -t http://localhost:8080/openapi.json \
            -f openapi -I -r zap-report.html

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-reports
          path: reports/
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Testing only happy path** | Validation, auth, and error cases untested | Test 4xx responses as rigorously as 200s |
| **Using production data in tests** | PII exposure; tests not reproducible | Fixtures and factories for all test data |
| **No BOLA/IDOR tests** | Security holes missed | Explicit cross-user access tests for every resource endpoint |
| **Ignoring response schema** | Breaking changes not caught | Assert all required fields present on every response |
| **No performance baseline** | Regressions not caught | p99 latency assertion on critical endpoints |
| **Sequential-only concurrency test** | Race conditions invisible | Concurrent request tests for write endpoints |
| **Flaky rate limit tests** | Timing-sensitive; false failures | Use precise request counts with known limits |

## 10 Rules

1. Test every 4xx case as rigorously as every 200 — most bugs live in error paths.
2. BOLA (cross-user resource access) test is mandatory for every endpoint that takes an object ID.
3. Assert response schema, not just status code — a 200 with wrong structure is a bug.
4. Authentication tests include expired tokens, invalid signatures, and missing auth headers.
5. SQL injection test every search and filter parameter — parameterised queries don't test themselves.
6. Performance tests with a p99 assertion run in CI — latency regressions caught before production.
7. Concurrent request tests for all write endpoints — race conditions are hard to catch manually.
8. Never use production data or credentials in tests.
9. API tests run on every PR — not just before releases.
10. Contract tests validate the OpenAPI spec matches actual behaviour — spec drift causes client bugs.
