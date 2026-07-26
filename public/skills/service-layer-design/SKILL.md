---
name: service-layer-design
description: Design the service layer that coordinates business logic, transactions, and cross-cutting concerns between controllers and domain models. Outputs service interfaces, transaction boundaries, and orchestration patterns.
argument-hint: [application architecture, transaction requirements, cross-cutting concerns, team conventions]
allowed-tools: Read, Write
---

# Service Layer Design

The service layer sits between the presentation layer (HTTP, CLI) and the domain/data layer. It coordinates use cases, defines transaction boundaries, and handles cross-cutting concerns like logging, authorisation, and event publishing. A well-designed service layer makes business operations explicit and testable.

## Process

1. **One method per use case.** Each service method represents a complete business operation. Not CRUD — business actions: `placeOrder`, `processRefund`, `activateAccount`.
2. **Define transaction boundaries.** Each service method is one transaction. If it fails, everything rolls back.
3. **Coordinate, don't implement.** Services orchestrate domain objects and repositories. Business rules live in the domain.
4. **Keep services thin.** If a service method exceeds 20 lines, the domain model needs richer behaviour.
5. **Test service methods as units.** Mock repositories and external services; test the orchestration.

## Service Interface Pattern

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

# Input/output types (DTOs — not domain objects)
@dataclass
class PlaceOrderCommand:
    customer_id: str
    items: list
    payment_method_id: str
    shipping_address: str

@dataclass
class OrderResult:
    order_id: str
    status: str
    total_amount: float
    estimated_delivery: str

class OrderService(ABC):
    @abstractmethod
    async def place_order(self, cmd: PlaceOrderCommand) -> OrderResult: ...
    
    @abstractmethod
    async def cancel_order(self, order_id: str, reason: str) -> None: ...
    
    @abstractmethod
    async def process_refund(self, order_id: str) -> None: ...
```

## Service Implementation

```python
from core.domain import Order, OrderItem
from core.repositories import OrderRepository, CustomerRepository
from core.events import EventPublisher
from infrastructure.payments import PaymentGateway

class OrderServiceImpl(OrderService):
    def __init__(
        self,
        order_repo: OrderRepository,
        customer_repo: CustomerRepository,
        payment: PaymentGateway,
        events: EventPublisher,
    ):
        self._orders = order_repo
        self._customers = customer_repo
        self._payment = payment
        self._events = events
    
    async def place_order(self, cmd: PlaceOrderCommand) -> OrderResult:
        # 1. Load and validate domain objects
        customer = await self._customers.get(cmd.customer_id)
        if not customer:
            raise CustomerNotFoundError(cmd.customer_id)
        if not customer.can_place_orders():
            raise CustomerSuspendedError(cmd.customer_id)
        
        # 2. Build domain object (business rules enforced inside Order)
        order = Order.create(
            customer_id=cmd.customer_id,
            items=[OrderItem(pid, qty) for pid, qty in cmd.items],
            shipping_address=cmd.shipping_address,
        )
        
        # 3. External call
        charge = await self._payment.charge(order.total, cmd.payment_method_id)
        if not charge.success:
            raise PaymentDeclinedError(charge.error)
        
        # 4. Complete the operation
        order.confirm(transaction_id=charge.transaction_id)
        await self._orders.save(order)
        
        # 5. Publish event (via outbox or direct)
        await self._events.publish("order.placed", {"order_id": order.id})
        
        return OrderResult(
            order_id=order.id,
            status=order.status,
            total_amount=float(order.total),
            estimated_delivery=order.estimated_delivery_date.isoformat(),
        )
```

## Transaction Management

```python
# Decorator-based transaction boundary
from functools import wraps

def transactional(fn):
    @wraps(fn)
    async def wrapper(self, *args, **kwargs):
        async with self._session.begin():
            return await fn(self, *args, **kwargs)
    return wrapper

class OrderServiceImpl(OrderService):
    @transactional
    async def place_order(self, cmd: PlaceOrderCommand) -> OrderResult:
        # Entire method runs in one transaction
        ...

# Or context manager pattern
class OrderServiceImpl(OrderService):
    async def place_order(self, cmd: PlaceOrderCommand) -> OrderResult:
        async with self._unit_of_work as uow:
            order = Order.create(...)
            await uow.orders.save(order)
            await uow.commit()
            # Auto-rollback on exception
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **CRUD service methods** | `createOrder`, `updateOrder` — no business meaning | Business verbs: `placeOrder`, `confirmOrder` |
| **Business logic in service** | Domain rules scattered outside domain | Domain objects enforce their own invariants |
| **Service calling other services** | Tangled dependencies, hard to test | Services coordinate domain + infra only |
| **No transaction boundary** | Partial writes on failure | One service method = one transaction |
| **Returning domain objects** | Leaks internals; tight coupling | Return DTOs; map in service layer |

## 10 Rules

1. One service method = one business use case = one transaction.
2. Services orchestrate; domain objects implement business rules.
3. Service inputs and outputs are DTOs — never expose domain objects across the layer boundary.
4. Services depend on interfaces (repositories, gateways) — not concrete implementations.
5. Cross-cutting concerns (logging, auth checks) go in middleware or decorators — not in service methods.
6. A service method that calls another service method is a smell — consolidate into one method or extract a use case.
7. Services are stateless — all state lives in repositories.
8. Test service methods by mocking infrastructure — not by hitting the database.
9. Error types are domain errors (CustomerSuspended, PaymentDeclined) — not generic exceptions.
10. Event publishing happens at the end of the service method — after all state changes succeed.

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

The canonical workflow for **Service Layer Design** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design the service layer that coordinates business logic, transactions, and cross-cutting concerns between controllers and domain models. Outputs service interf
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
