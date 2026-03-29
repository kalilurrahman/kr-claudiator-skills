---
name: api-mocking-strategy
description: Design API mocking strategies for development, testing, and service isolation. Outputs mock server patterns, contract-based mocking, recording/playback, and team workflow guidelines.
argument-hint: [API types to mock, team workflow, test framework, provider/consumer setup]
allowed-tools: Read, Write, Bash
---

# API Mocking Strategy

API mocking replaces real API calls with controlled responses during development and testing. This decouples teams, enables testing without live services, and produces deterministic test results. The key decision: static mocks (hand-crafted responses), recorded mocks (captured real traffic), or contract-based mocks (derived from API specs).

## Mocking Approaches

```
STATIC MOCKS
  Hand-crafted response files or in-code fixtures
  Pros: Simple; fully controlled; no external dependencies
  Cons: Drift from real API; manual maintenance
  Use: Unit tests; when real API doesn't exist yet

RECORDED MOCKS (VCR Pattern)
  Record real API calls; replay in tests
  Pros: Accurate; realistic; no manual maintenance
  Cons: Need real API for first recording; recordings go stale
  Use: Integration tests; third-party API testing

CONTRACT-BASED MOCKS
  Mock generated from OpenAPI spec or Pact contracts
  Pros: Always in sync with API spec; consumer-driven
  Cons: Requires investment in contract tooling
  Use: Microservices; consumer-driven contract testing

MOCK SERVERS
  Wiremock, Mockoon, MSW — standalone mock server
  Pros: Realistic server; shared across team; supports all HTTP clients
  Cons: More setup; another process to manage
  Use: Front-end development; team-wide shared mocks
```

## Python: responses / pytest-httpx

```python
import responses
import httpx
import pytest

# responses: mock requests library
@responses.activate
def test_payment_service_charged():
    responses.add(
        method=responses.POST,
        url="https://api.stripe.com/v1/charges",
        json={
            "id": "ch_test_123",
            "status": "succeeded",
            "amount": 5000,
            "currency": "usd",
        },
        status=200,
    )

    result = payment_service.charge(amount=50.00, card_token="tok_visa")
    assert result["charge_id"] == "ch_test_123"
    assert result["status"] == "succeeded"

# pytest-httpx: mock httpx calls
@pytest.fixture
def mock_stripe(httpx_mock):
    httpx_mock.add_response(
        method="POST",
        url="https://api.stripe.com/v1/charges",
        json={"id": "ch_123", "status": "succeeded"},
        status_code=200,
    )
    return httpx_mock

def test_payment_with_httpx_mock(mock_stripe):
    client = PaymentClient()
    result = client.create_charge(amount=100, currency="usd")
    assert result["id"] == "ch_123"
```

## VCR Pattern (Record and Replay)

```python
import vcr
import pytest

# First run: records real HTTP calls to cassette file
# Subsequent runs: replays from cassette
@vcr.use_cassette("tests/fixtures/stripe_charge.yaml")
def test_create_stripe_charge():
    """
    On first run: makes real API call, records to cassette.
    On subsequent runs: replays cassette, no real API call.
    """
    import stripe
    charge = stripe.Charge.create(amount=1000, currency="usd", source="tok_visa")
    assert charge["status"] == "succeeded"

# pytest-recording wrapper (more ergonomic)
@pytest.mark.vcr()  # Uses cassette from tests/cassettes/test_name.yaml
def test_github_api_call():
    response = github_client.get_user("octocat")
    assert response["login"] == "octocat"
```

## Mock Server with WireMock

```python
import wiremock
from wiremock.client import WireMock, Mapping
from wiremock.server import WireMockServer

class MockPaymentServer:
    def __init__(self, port: int = 8089):
        self.server = WireMockServer(port=port)
        self.client = WireMock(host="localhost", port=port)

    def start(self):
        self.server.start()
        # Configure stubs
        self.client.stub_for(
            Mapping(
                request={
                    "method": "POST",
                    "url": "/v1/charges",
                    "bodyPatterns": [{"matchesJsonPath": "$.amount"}],
                },
                response={
                    "status": 200,
                    "jsonBody": {"id": "ch_test", "status": "succeeded"},
                    "headers": {"Content-Type": "application/json"},
                }
            )
        )

    def stop(self):
        self.server.stop()

# Docker compose for team-wide mock
# docker run -p 8089:8080 wiremock/wiremock --verbose
```

## MSW (Mock Service Worker — Frontend)

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/orders', () => {
    return HttpResponse.json({
      items: [
        { id: 'ord-1', status: 'paid', total: 59.99 },
        { id: 'ord-2', status: 'shipped', total: 29.99 },
      ],
      total: 2,
    });
  }),

  http.post('/api/v1/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ order_id: 'ord-new-123', status: 'draft' }, { status: 201 });
  }),

  http.get('/api/v1/orders/:id', ({ params }) => {
    if (params.id === 'ord-404') {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json({ id: params.id, status: 'paid' });
  }),
];

// src/mocks/setup.ts — runs in tests and development
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// In jest.config.ts or vitest setup:
// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Mocks that never verify** | Test passes even when calling wrong endpoint | Assert mock was called with correct params |
| **Static mocks for all tests** | Drift from real API undetected | VCR for integration tests; contract mocks for microservices |
| **Mocking too many layers** | Tests don't reflect real behaviour | Mock at the HTTP boundary; not inside service logic |
| **VCR cassettes never refreshed** | Test passes with stale API responses | Re-record cassettes when API changes |
| **No mock for error cases** | Only happy path tested | Add mocks for 4xx/5xx responses |

## 10 Rules

1. Mock at the HTTP boundary — not inside service classes.
2. Always mock error cases — not just the happy path.
3. Assert that mocks were called with the expected parameters.
4. VCR cassettes are refreshed when the underlying API changes.
5. Contract-based mocks for microservices — keeps consumer and provider in sync.
6. Shared mock servers (WireMock, Mockoon) for frontend teams — consistent API behaviour.
7. `onUnhandledRequest: "error"` in MSW — unmocked requests fail tests immediately.
8. Mock responses match the real API structure — validated against OpenAPI spec.
9. Don't mock code you own — use real implementations with test databases.
10. Mock granularity matches test level: unit tests mock at service boundary; E2E tests use real or sandbox APIs.
