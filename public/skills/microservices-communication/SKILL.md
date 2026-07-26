---
name: microservices-communication
description: Design communication patterns between microservices. Outputs synchronous vs asynchronous decision framework, service discovery approach, circuit breaker configuration, and observability strategy.
argument-hint: [service count, latency requirements, consistency requirements, team structure]
allowed-tools: Read, Write
---

# Microservices Communication

Microservices need to communicate. The choice between synchronous (HTTP/gRPC) and asynchronous (events/queues) has profound implications for coupling, resilience, and data consistency. Get this wrong and you end up with a distributed monolith — the worst of both worlds.

## Communication Decision Framework

```
USE SYNCHRONOUS (HTTP/gRPC) when:
  ✓ Response needed to continue (payment result, auth check)
  ✓ Simple request-response with immediate answer
  ✓ Strong consistency required within the request
  ✓ Low latency is critical (<100ms)

USE ASYNCHRONOUS (events/messages) when:
  ✓ Caller doesn't need the result immediately
  ✓ Multiple services need the same event (fan-out)
  ✓ Durability matters (don't lose the message)
  ✓ Services should be decoupled (publisher doesn't know subscribers)
  ✓ Handling spiky load (queue absorbs bursts)

NEVER:
  ✗ Synchronous chains of 5+ services — cascading failures
  ✗ Async where strong consistency is required — use sagas instead
  ✗ Both patterns for the same domain without clear rules
```

## Synchronous Communication (HTTP)

```python
# Service client with circuit breaker and retry
import httpx
from circuitbreaker import circuit
import tenacity

class InventoryServiceClient:
    BASE_URL = "http://inventory-service:8080"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=httpx.Timeout(connect=1.0, read=3.0),
            headers={"Content-Type": "application/json"},
        )
    
    @circuit(failure_threshold=5, recovery_timeout=30)
    @tenacity.retry(
        stop=tenacity.stop_after_attempt(3),
        wait=tenacity.wait_exponential(multiplier=0.5, max=5),
        retry=tenacity.retry_if_exception_type(httpx.TransientError),
    )
    async def reserve_stock(self, product_id: str, quantity: int,
                             order_id: str) -> dict:
        response = await self.client.post(
            "/api/v1/reservations",
            json={
                "product_id": product_id,
                "quantity": quantity,
                "reference_id": order_id,  # Idempotency
            },
        )
        response.raise_for_status()
        return response.json()
    
    async def get_stock_level(self, product_id: str) -> int:
        """Non-critical read — degrade gracefully on failure."""
        try:
            response = await self.client.get(f"/api/v1/products/{product_id}/stock")
            return response.json()["available"]
        except Exception:
            return -1  # Unknown — UI shows "Check availability"
```

## Async Communication (Events)

```python
# Event-driven: OrderService emits, InventoryService and NotificationService consume
# No direct dependency between services

from confluent_kafka import Producer, Consumer

# Order service — produces event
class OrderService:
    def __init__(self, producer: Producer):
        self._producer = producer
    
    async def place_order(self, order_data: dict) -> dict:
        order = await self._create_order(order_data)
        
        # Emit event — don't call inventory or notifications directly
        self._producer.produce(
            "orders.order.placed",
            key=order["id"],
            value=json.dumps({
                "eventType": "order.placed",
                "orderId": order["id"],
                "customerId": order["customer_id"],
                "items": order["items"],
                "totalAmount": order["total"],
                "occurredAt": datetime.utcnow().isoformat(),
            }),
        )
        return order

# Inventory service — consumes event
class InventoryEventConsumer:
    def handle_order_placed(self, event: dict):
        for item in event["items"]:
            self.reserve_stock(item["product_id"], item["quantity"],
                               reference=event["orderId"])
```

## Service Discovery

```yaml
# Kubernetes: service DNS is automatic
# inventory-service.production.svc.cluster.local:8080

# For service mesh (Istio) — traffic management, retries, circuit breaking
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: inventory-service
spec:
  hosts: [inventory-service]
  http:
    - timeout: 3s
      retries:
        attempts: 3
        perTryTimeout: 1s
        retryOn: gateway-error,connect-failure,retriable-4xx
      route:
        - destination:
            host: inventory-service
            port:
              number: 8080
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Synchronous chain >3 deep** | Cascading timeouts; one slow service fails all | Async for non-critical paths; saga for multi-step |
| **Direct DB access across services** | Tight coupling; breaks service ownership | API calls only; never shared DB |
| **Chatty services** | Too many small calls; high latency | Batch requests; aggregate data at caller |
| **Missing circuit breakers** | One failing service takes down callers | Circuit breaker on every synchronous client |
| **No correlation IDs** | Can't trace request across services | Propagate correlation ID in every call |

## 10 Rules

1. Synchronous only when the caller needs the result to continue processing.
2. Never chain more than 3 synchronous service calls — use async or saga patterns.
3. Every synchronous client has a circuit breaker and timeout.
4. Services own their data — no direct database access across service boundaries.
5. Propagate correlation IDs through every call — async and synchronous.
6. Async events are the integration contract — producers don't know their consumers.
7. Idempotency is required for all async message consumers — messages are delivered at-least-once.
8. Service clients are libraries — encapsulate retry, circuit breaking, and serialization.
9. Monitor inter-service latency and error rates as first-class SLIs.
10. Design for failure of any upstream service — every dependency can and will fail.

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

The canonical workflow for **Microservices Communication** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design communication patterns between microservices. Outputs synchronous vs asynchronous decision framework, service discovery approach, circuit breaker configu
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
