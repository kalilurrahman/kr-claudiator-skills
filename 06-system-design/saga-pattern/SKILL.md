---
name: saga-pattern
description: Design distributed transactions using the Saga pattern to maintain data consistency across microservices without two-phase commit. Covers choreography vs orchestration, compensating transactions, failure handling, and implementation examples.
argument-hint: [transaction scope, services involved, consistency requirements, preferred coordination style]
allowed-tools: Read, Write, Bash
---

# Saga Pattern

A saga is a sequence of local transactions where each step publishes an event or message that triggers the next step. If any step fails, the saga executes compensating transactions to undo the work already done. Sagas solve the distributed transaction problem without the availability cost of two-phase commit (2PC).

## Saga vs 2PC

| Aspect | Two-Phase Commit (2PC) | Saga |
|--------|----------------------|------|
| Consistency | Strong (ACID) | Eventual (BASE) |
| Availability | Coordinator is single point of failure | High — no global lock |
| Coupling | All services must implement XA | Services communicate via events |
| Failure handling | Coordinator blocks until recovery | Explicit compensating transactions |
| Use case | Single-DB transactions | Cross-service distributed transactions |

## Coordination Styles

### Choreography — services react to events

Each service listens for events and decides what to do. No central coordinator.

```
OrderService  →  OrderPlaced →  InventoryService
                                  →  InventoryReserved →  PaymentService
                                                           →  PaymentCharged →  ShippingService
                                  ←  InventoryFailed  ←  (rollback chain)
```

**Pros:** Loose coupling; no single point of failure; services fully autonomous.  
**Cons:** Hard to track saga state; event chains are difficult to visualise and debug.

### Orchestration — a central saga orchestrator drives the flow

```
SagaOrchestrator:
  1. Reserve inventory   → InventoryService
  2. Charge payment      → PaymentService
  3. Schedule shipment   → ShippingService
  (on failure: run compensating transactions in reverse)
```

**Pros:** Explicit flow in one place; easy to monitor state; clear failure handling.  
**Cons:** Orchestrator is a new service to build and maintain; can become a bottleneck.

**Guidance:** Prefer orchestration for complex sagas with many steps or conditional branching. Use choreography for simple two-step sagas.

## Process

1. **Identify the saga boundary** — which cross-service operations need to succeed or roll back together?
2. **List each step and its compensating transaction** — every forward action needs an undo action.
3. **Choose choreography or orchestration** — orchestration for complex flows; choreography for simple ones.
4. **Design for idempotency** — every step must be safe to retry; use idempotency keys.
5. **Handle partial failures explicitly** — define what happens if a compensating transaction also fails.
6. **Implement the saga state machine** — track state: STARTED, STEP_N_COMPLETED, COMPENSATING, FAILED, COMPLETED.
7. **Add observability** — every saga transition should be logged with saga ID, step, and outcome.
8. **Test failure scenarios** — inject failures at each step; verify compensating transactions execute correctly.
9. **Define a dead-letter strategy** — sagas that cannot complete or compensate must be surfaced to operators.
10. **Monitor saga duration** — sagas stuck in intermediate states indicate a problem.

## Saga Steps and Compensating Transactions

```python
# Define the saga steps and their compensations
from dataclasses import dataclass
from typing import Callable, Optional

@dataclass
class SagaStep:
    name:        str
    action:      Callable       # forward transaction
    compensation: Callable      # undo transaction

# Order fulfilment saga
ORDER_SAGA_STEPS = [
    SagaStep(
        name="reserve_inventory",
        action=      lambda ctx: inventory_service.reserve(ctx["order_id"], ctx["items"]),
        compensation=lambda ctx: inventory_service.release(ctx["reservation_id"]),
    ),
    SagaStep(
        name="charge_payment",
        action=      lambda ctx: payment_service.charge(ctx["order_id"], ctx["amount"], ctx["card_token"]),
        compensation=lambda ctx: payment_service.refund(ctx["charge_id"]),
    ),
    SagaStep(
        name="schedule_shipment",
        action=      lambda ctx: shipping_service.schedule(ctx["order_id"], ctx["address"]),
        compensation=lambda ctx: shipping_service.cancel(ctx["shipment_id"]),
    ),
    SagaStep(
        name="confirm_order",
        action=      lambda ctx: order_service.confirm(ctx["order_id"]),
        compensation=lambda ctx: order_service.cancel(ctx["order_id"], reason="saga_failed"),
    ),
]
```

## Saga Orchestrator Implementation

```python
import uuid, logging
from enum import Enum
from datetime import datetime

class SagaState(Enum):
    STARTED       = "started"
    COMPENSATING  = "compensating"
    COMPLETED     = "completed"
    FAILED        = "failed"        # compensation also failed — needs manual intervention

class SagaOrchestrator:
    def __init__(self, steps: list[SagaStep], saga_repo):
        self.steps     = steps
        self.repo      = saga_repo
        self.log       = logging.getLogger(__name__)

    def execute(self, initial_context: dict) -> dict:
        saga_id  = str(uuid.uuid4())
        context  = {**initial_context, "saga_id": saga_id}
        completed_steps = []

        self.repo.save(saga_id, {"state": SagaState.STARTED, "started_at": datetime.utcnow()})
        self.log.info(f"Saga {saga_id} started")

        # Forward pass — execute each step in order
        for step in self.steps:
            try:
                self.log.info(f"Saga {saga_id}: executing {step.name}")
                result  = step.action(context)
                context.update(result or {})
                completed_steps.append(step)
                self.repo.save(saga_id, {"state": f"completed_{step.name}", "context": context})
            except Exception as e:
                self.log.error(f"Saga {saga_id}: step {step.name} failed — {e}")
                self._compensate(saga_id, context, completed_steps)
                raise SagaFailedError(f"Saga {saga_id} failed at {step.name}: {e}") from e

        self.repo.save(saga_id, {"state": SagaState.COMPLETED})
        self.log.info(f"Saga {saga_id} completed")
        return context

    def _compensate(self, saga_id: str, context: dict, completed_steps: list[SagaStep]) -> None:
        self.repo.save(saga_id, {"state": SagaState.COMPENSATING})
        self.log.info(f"Saga {saga_id}: beginning compensation ({len(completed_steps)} steps)")

        # Compensate in reverse order
        for step in reversed(completed_steps):
            try:
                self.log.info(f"Saga {saga_id}: compensating {step.name}")
                step.compensation(context)
            except Exception as e:
                # Compensation failed — this saga is now in an inconsistent state
                self.log.critical(
                    f"Saga {saga_id}: compensation of {step.name} FAILED — manual intervention required. Error: {e}"
                )
                self.repo.save(saga_id, {"state": SagaState.FAILED, "failed_step": step.name})
                # Alert on-call; do not re-raise — continue compensating other steps
                alert_oncall(saga_id, step.name, e)

class SagaFailedError(Exception):
    pass
```

## Choreography with Domain Events

```python
# Inventory service — listens for OrderPlaced, publishes InventoryReserved or InventoryFailed
import json

class InventoryEventHandler:
    def on_order_placed(self, event: dict) -> None:
        order_id = event["order_id"]
        items    = event["items"]

        try:
            reservation_id = self._reserve_stock(order_id, items)
            self._publish("inventory.reserved", {
                "order_id":       order_id,
                "reservation_id": reservation_id,
                "saga_id":        event["saga_id"],
            })
        except InsufficientStockError as e:
            self._publish("inventory.reservation_failed", {
                "order_id": order_id,
                "reason":   str(e),
                "saga_id":  event["saga_id"],
            })

    def on_order_cancelled(self, event: dict) -> None:
        """Compensating transaction — triggered by downstream failure."""
        if reservation_id := event.get("reservation_id"):
            self._release_stock(reservation_id)
            self._publish("inventory.released", {
                "order_id":       event["order_id"],
                "reservation_id": reservation_id,
            })

    def _publish(self, topic: str, payload: dict) -> None:
        # Publish to message broker (Kafka / RabbitMQ / SNS)
        broker.publish(topic, json.dumps(payload))
```

## Idempotency — Critical for Safe Retries

```python
import hashlib

class IdempotentSagaStep:
    def __init__(self, db):
        self.db = db

    def execute_once(self, idempotency_key: str, action: Callable, context: dict):
        """Execute action exactly once, even if called multiple times."""
        existing = self.db.get(f"saga_step:{idempotency_key}")
        if existing:
            return json.loads(existing)   # return cached result

        result = action(context)

        # Store result before returning — safe to retry if storage fails
        self.db.set(
            f"saga_step:{idempotency_key}",
            json.dumps(result),
            ex=86400   # expire after 24 hours
        )
        return result

def make_idempotency_key(saga_id: str, step_name: str) -> str:
    return hashlib.sha256(f"{saga_id}:{step_name}".encode()).hexdigest()[:32]
```

## Saga State Persistence (Postgres)

```sql
CREATE TABLE sagas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_type   VARCHAR(100) NOT NULL,
    state       VARCHAR(50)  NOT NULL DEFAULT 'started',
    context     JSONB        NOT NULL DEFAULT '{}',
    started_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    failed_step  VARCHAR(100)
);

CREATE INDEX ON sagas (state) WHERE state NOT IN ('completed', 'failed');
-- Query for stuck sagas (started > 30 minutes ago, not complete)
CREATE INDEX ON sagas (started_at) WHERE state IN ('started', 'compensating');
```

```python
# Monitor for stuck sagas — alert if any saga has been running > 5 minutes
def find_stuck_sagas(db) -> list[dict]:
    return db.query("""
        SELECT id, saga_type, state, started_at,
               EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 AS minutes_running
        FROM sagas
        WHERE state NOT IN ('completed', 'failed')
          AND started_at < NOW() - INTERVAL '5 minutes'
        ORDER BY started_at
    """)
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No compensating transactions | Partial failure leaves data inconsistent permanently | Define a compensation for every step before writing any code |
| Non-idempotent steps | Retries double-charge, double-ship | Idempotency keys on every external call |
| No saga state persistence | Crash loses track of which steps completed | Persist state to DB after every step transition |
| Ignoring compensation failures | Compensation failure silently ignored | Alert immediately; compensation failures require manual intervention |
| No stuck-saga monitoring | Sagas hang indefinitely without alert | Alert on sagas older than 2× expected duration |
| Mixing choreography and orchestration | Confusing flow that is hard to debug | Pick one coordination style per saga; document the choice |

## Rules

- **Every forward step needs a compensating transaction** — define the undo before writing the forward action.
- **Every step must be idempotent** — the system must be safe to retry any step without side effects.
- **Persist saga state after every transition** — a crash must not leave the saga in an unknown state.
- **Compensation failures are critical alerts** — a saga that cannot compensate requires immediate human intervention.
- **Orchestration for complex flows, choreography for simple ones** — choose deliberately, not by default.
- **Never use 2PC across microservices** — it sacrifices availability for consistency; sagas give you eventual consistency with high availability.
- **Correlate every event with a saga ID** — distributed tracing across saga steps requires a consistent correlation ID.
- **Monitor saga duration** — sagas stuck in intermediate states indicate a bug or external service outage.
- **Test every failure scenario** — inject failures at each step in integration tests; verify compensations fire correctly.
- **Eventual consistency is a business decision** — ensure the product team understands and accepts the consistency model before implementation.
