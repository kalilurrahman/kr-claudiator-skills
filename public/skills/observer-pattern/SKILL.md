---
name: observer-pattern
description: Implement the Observer pattern for event-driven decoupled communication. Outputs event bus implementations, typed event systems, and async observer patterns.
argument-hint: [language, event types, synchronous vs async, existing pub/sub infrastructure]
allowed-tools: Read, Write
---

# Observer Pattern

The Observer pattern defines a one-to-many dependency so that when one object changes state, all dependents are notified automatically. It decouples event producers from consumers — neither knows about the other.

## Core Implementation

```python
from abc import ABC, abstractmethod
from typing import Callable, Any
from collections import defaultdict
import asyncio
import logging

# Typed event system
from dataclasses import dataclass
from datetime import datetime

@dataclass
class OrderPlacedEvent:
    order_id: str
    customer_id: str
    total_cents: int
    occurred_at: datetime

@dataclass
class PaymentCapturedEvent:
    order_id: str
    amount_cents: int
    payment_id: str
    occurred_at: datetime

# Type-safe event bus
class EventBus:
    def __init__(self):
        self._handlers: dict[type, list[Callable]] = defaultdict(list)
        self._logger = logging.getLogger(__name__)

    def subscribe(self, event_type: type, handler: Callable) -> None:
        self._handlers[event_type].append(handler)
        self._logger.debug(f"Subscribed {handler.__name__} to {event_type.__name__}")

    def unsubscribe(self, event_type: type, handler: Callable) -> None:
        self._handlers[event_type].remove(handler)

    def publish(self, event: Any) -> None:
        event_type = type(event)
        handlers = self._handlers.get(event_type, [])
        if not handlers:
            self._logger.warning(f"No handlers for {event_type.__name__}")
            return
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                self._logger.error(f"Handler {handler.__name__} failed: {e}")
                # Don't stop other handlers

bus = EventBus()

# Handlers
def send_confirmation_email(event: OrderPlacedEvent):
    email_service.send(event.customer_id, "Order confirmed", event.order_id)

def reserve_inventory(event: OrderPlacedEvent):
    inventory_service.reserve(event.order_id)

def create_fulfilment_request(event: PaymentCapturedEvent):
    fulfilment_service.create(event.order_id)

# Wire up
bus.subscribe(OrderPlacedEvent, send_confirmation_email)
bus.subscribe(OrderPlacedEvent, reserve_inventory)
bus.subscribe(PaymentCapturedEvent, create_fulfilment_request)

# Usage
bus.publish(OrderPlacedEvent(
    order_id="ord-123",
    customer_id="cust-456",
    total_cents=4999,
    occurred_at=datetime.utcnow(),
))
```

## Async Observer

```python
class AsyncEventBus:
    def __init__(self):
        self._handlers: dict[type, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: type, handler: Callable) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, event: Any) -> None:
        handlers = self._handlers.get(type(event), [])
        # Run all handlers concurrently
        results = await asyncio.gather(
            *[self._call(h, event) for h in handlers],
            return_exceptions=True,
        )
        for h, r in zip(handlers, results):
            if isinstance(r, Exception):
                logging.error(f"Async handler {h.__name__} failed: {r}")

    async def _call(self, handler: Callable, event: Any):
        if asyncio.iscoroutinefunction(handler):
            return await handler(event)
        return handler(event)

async_bus = AsyncEventBus()

async def async_send_email(event: OrderPlacedEvent):
    await email_client.send_async(event.customer_id, "Order confirmed")

async_bus.subscribe(OrderPlacedEvent, async_send_email)
```

## Decorator-Based Registration

```python
class EventBusWithDecorators(EventBus):
    def on(self, event_type: type):
        def decorator(fn: Callable) -> Callable:
            self.subscribe(event_type, fn)
            return fn
        return decorator

bus = EventBusWithDecorators()

@bus.on(OrderPlacedEvent)
def handle_order_placed(event: OrderPlacedEvent):
    print(f"Order {event.order_id} placed for {event.total_cents} cents")

@bus.on(OrderPlacedEvent)
def notify_analytics(event: OrderPlacedEvent):
    analytics.track("order_placed", {"order_id": event.order_id})
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Catching exceptions silently** | Failed handlers hide bugs | Log all errors; consider retry or dead letter |
| **Order-dependent handlers** | Brittle; implicit coupling | Handlers must be independent and order-agnostic |
| **Leaking domain objects in events** | Consumers coupled to domain internals | Events carry only primitive data or IDs |
| **Synchronous long-running handlers** | Slow handlers block publisher | Async handlers or queue for slow work |
| **Global mutable event bus** | Testing nightmare | Inject bus; reset between tests |

## 10 Rules

1. Events are immutable value objects — past-tense, data-only, no behaviour.
2. Handlers are independent — the order handlers run in must not matter.
3. Publisher knows nothing about subscribers — and vice versa.
4. Failed handlers don't block other handlers — catch and log per handler.
5. Async handlers for I/O-bound work — don't block the event loop.
6. Events carry data (IDs, primitives) — not live domain objects.
7. Unsubscribe when done — prevent memory leaks from long-lived objects.
8. Test handlers in isolation — inject the bus; no global state.
9. Log all published events at DEBUG level — essential for debugging.
10. Consider persistence for critical events — in-memory buses lose events on crash.

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

The canonical workflow for **Observer Pattern** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement the Observer pattern for event-driven decoupled communication. Outputs event bus implementations, typed event systems, and async observer patterns.
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
