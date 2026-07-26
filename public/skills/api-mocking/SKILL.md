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

The canonical workflow for **Api Mocking** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Mock external APIs for development and testing. Outputs mock server setup, request/response matching rules, contract-driven mocks, and CI integration.
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
