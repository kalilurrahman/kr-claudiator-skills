---
name: api-mocking
description: Mock external APIs for development and testing. Outputs mock server setup, request/response matching rules, contract-driven mocks, and CI integration.
argument-hint: [external APIs to mock, test framework, languages used, contract format]
allowed-tools: Read, Write, Bash
---

# API Mocking

API mocking replaces real external services with controlled, predictable fakes during development and testing. Good mocks are fast, deterministic, and based on contracts — not implementation guesses.

## Python: unittest.mock

```python
from unittest.mock import patch, MagicMock, AsyncMock
import pytest

# Mock an HTTP client
@patch("services.payment_service.httpx.post")
def test_payment_success(mock_post):
    mock_post.return_value = MagicMock(
        status_code=200,
        json=lambda: {"status": "captured", "charge_id": "ch_abc123"},
    )
    result = payment_service.charge(amount=5000, card_token="tok_visa")
    assert result["charge_id"] == "ch_abc123"
    mock_post.assert_called_once_with(
        "https://api.stripe.com/v1/charges",
        data={"amount": 5000, "source": "tok_visa"},
        headers=pytest.approx({"Authorization": "Bearer sk_test_..."}),
    )

# Mock async functions
@patch("services.email_service.httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_email_sent(mock_post):
    mock_post.return_value = MagicMock(status_code=202)
    await email_service.send("user@test.com", "Welcome!")
    assert mock_post.called

# Side effects — simulate errors
@patch("services.payment_service.httpx.post")
def test_payment_network_error(mock_post):
    mock_post.side_effect = httpx.ConnectError("Connection refused")
    with pytest.raises(PaymentServiceUnavailableError):
        payment_service.charge(amount=5000, card_token="tok_visa")

# Multiple calls returning different values
mock.side_effect = [
    MagicMock(status_code=429),  # First call: rate limited
    MagicMock(status_code=429),  # Second call: still rate limited
    MagicMock(status_code=200, json=lambda: {"ok": True}),  # Third: success
]
```

## WireMock — Mock Server for Integration Tests

```yaml
# wiremock/mappings/stripe_charge.json
{
  "request": {
    "method": "POST",
    "url": "/v1/charges",
    "headers": {
      "Authorization": { "contains": "Bearer sk_test" }
    },
    "bodyPatterns": [
      { "contains": "amount=5000" }
    ]
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "id": "ch_mock_123",
      "status": "captured",
      "amount": 5000
    }
  }
}
```

```python
# pytest fixture — start WireMock before tests
import subprocess, requests, pytest, time

@pytest.fixture(scope="session")
def wiremock():
    proc = subprocess.Popen([
        "java", "-jar", "wiremock-standalone.jar",
        "--port", "8089", "--root-dir", "wiremock/"
    ])
    time.sleep(2)  # Wait for startup
    yield "http://localhost:8089"
    proc.terminate()

def test_stripe_integration(wiremock, monkeypatch):
    monkeypatch.setenv("STRIPE_BASE_URL", wiremock)
    result = payment_service.charge(5000, "tok_visa")
    assert result["id"] == "ch_mock_123"
```

## MSW (Mock Service Worker) — Frontend

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/products", () => {
    return HttpResponse.json([
      { id: "prod-1", name: "Widget", price: 29.99 },
      { id: "prod-2", name: "Gadget", price: 49.99 },
    ]);
  }),

  http.post("/api/orders", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { order_id: "ord-mock-123", status: "draft", ...body },
      { status: 201 }
    );
  }),

  // Simulate errors
  http.delete("/api/orders/:id", ({ params }) => {
    if (params.id === "protected-order") {
      return HttpResponse.json({ error: "Cannot delete paid order" }, { status: 409 });
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

// mocks/server.ts (Node.js / testing)
import { setupServer } from "msw/node";
export const server = setupServer(...handlers);

// vitest setup
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Contract-Driven Mocks with Pact

```python
# pact_test.py — consumer-driven contract testing
from pact import Consumer, Provider

pact = Consumer("OrderService").has_pact_with(Provider("PaymentAPI"))

def test_charge_creates_pact():
    expected_response = {
        "charge_id": pact.like("ch_abc123"),
        "status": "captured",
        "amount": 5000,
    }
    (pact
     .given("a valid card token")
     .upon_receiving("a charge request")
     .with_request("POST", "/v1/charges",
                   body={"amount": 5000, "source": "tok_visa"})
     .will_respond_with(200, body=expected_response)
    )
    with pact:
        result = payment_client.charge(5000, "tok_visa")
        assert result["status"] == "captured"
    # Pact file published to broker; provider verifies against it
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Mocking internals** | Tests break on refactor | Mock at integration boundaries (HTTP, DB) |
| **Tests pass on fake, fail on real** | Mock diverged from real API | Contract tests; record real responses |
| **Over-specified mocks** | Brittle — breaks when irrelevant details change | Match on essential fields only |
| **No error case mocks** | Tests only cover happy path | Explicit tests for 4xx, 5xx, timeouts |
| **Shared mutable mock state** | Tests interfere with each other | Reset mock state between tests |

## 10 Rules

1. Mock at the integration boundary — HTTP clients, not internal functions.
2. Contract tests ensure mocks match reality — run against real API periodically.
3. Test error cases explicitly — 429, 500, timeouts, and network failures.
4. Reset mock state between tests — shared state causes false positives.
5. Record real API responses to seed mocks — don't guess the response format.
6. Don't over-specify mocks — match essential fields; ignore irrelevant headers.
7. Use a mock server (WireMock/MSW) for integration tests — not just unit mocks.
8. Mock at the same level for all tests — consistent boundaries.
9. Document which external APIs each mock represents — aids onboarding.
10. Run "real API" tests in CI nightly — catches drift between mocks and reality.
