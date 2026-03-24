---
name: state-machine-design
description: Model complex workflows as explicit state machines. Outputs state diagrams, transition tables, guard conditions, and production-ready implementations with audit trails.
argument-hint: [entity being modelled, states, triggering events, side effects needed]
allowed-tools: Read, Write
---

# State Machine Design

State machines make implicit workflow logic explicit. Instead of scattered `if status == 'x'` checks, you get a single source of truth: a defined set of states, valid transitions, and guards that enforce business rules. Invalid transitions become impossible, not just unexpected.

## Process

1. **List all states.** Every distinct situation the entity can be in. Include terminal states (completed, cancelled, failed).
2. **List all events/triggers.** What causes transitions? User actions, timeouts, external callbacks, system events.
3. **Define transitions.** For each (state, event) pair: what's the target state? What guards apply? What side effects fire?
4. **Draw the state diagram.** Visualise. Missing arrows reveal undefined behaviour. Unreachable states reveal dead code.
5. **Define entry/exit actions.** What happens automatically when entering or leaving a state?
6. **Add guards.** Conditions that must be true for a transition to be allowed.
7. **Implement.** Persist current state. Apply transitions atomically. Log every transition with actor and timestamp.
8. **Handle invalid transitions.** Explicit error, not silent no-op.

## State Diagram — Order Lifecycle

```
                    ┌─────────┐
                    │  DRAFT  │◄─────────────────────────────┐
                    └────┬────┘                               │
                         │ submit()                           │
                         ▼                                    │
                  ┌────────────┐                              │
                  │  PENDING   │                              │
                  └─────┬──────┘                              │
          ┌─────────────┼──────────────┐                      │
          │             │              │                      │
    pay() │    reject() │    cancel()  │                      │
          ▼             ▼              ▼                      │
    ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
    │  PAID    │  │ REJECTED │  │CANCELLED │                 │
    └────┬─────┘  └──────────┘  └──────────┘                 │
         │                                                    │
  ship() │                                        refund()   │
         ▼                                                    │
  ┌────────────┐         payment_failed()                     │
  │  SHIPPED   │──────────────────────────────────────────────┘
  └─────┬──────┘  (refund → DRAFT for retry)
        │
 deliver() │
        ▼
  ┌────────────┐
  │ DELIVERED  │  ← terminal
  └────────────┘
```

## Transition Table

| Current State | Event | Guard | Next State | Actions |
|---|---|---|---|---|
| DRAFT | submit | items.count > 0 | PENDING | notify_ops |
| PENDING | pay | payment.valid | PAID | capture_payment, reserve_stock |
| PENDING | reject | fraud_score > 80 | REJECTED | notify_customer |
| PENDING | cancel | — | CANCELLED | release_hold |
| PAID | ship | stock_reserved | SHIPPED | create_tracking, notify_customer |
| SHIPPED | deliver | — | DELIVERED | release_funds, request_review |
| SHIPPED | payment_failed | — | DRAFT | refund, release_stock |
| * | any | — | — | raise InvalidTransition |

## Implementation

```python
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Callable, Dict, Tuple

class OrderState(str, Enum):
    DRAFT     = "draft"
    PENDING   = "pending"
    PAID      = "paid"
    SHIPPED   = "shipped"
    DELIVERED = "delivered"
    REJECTED  = "rejected"
    CANCELLED = "cancelled"

class OrderEvent(str, Enum):
    SUBMIT   = "submit"
    PAY      = "pay"
    REJECT   = "reject"
    CANCEL   = "cancel"
    SHIP     = "ship"
    DELIVER  = "deliver"
    REFUND   = "refund"

class InvalidTransition(Exception):
    def __init__(self, state, event):
        super().__init__(f"Cannot apply '{event}' in state '{state}'")

@dataclass
class TransitionResult:
    previous_state: OrderState
    new_state: OrderState
    event: OrderEvent
    occurred_at: datetime
    actor: str

class OrderStateMachine:
    # (current_state, event) → (next_state, guard, action)
    _transitions: Dict[Tuple, tuple] = {
        (OrderState.DRAFT,    OrderEvent.SUBMIT):  (OrderState.PENDING,   '_guard_has_items',  '_on_submit'),
        (OrderState.PENDING,  OrderEvent.PAY):     (OrderState.PAID,      '_guard_payment_ok', '_on_pay'),
        (OrderState.PENDING,  OrderEvent.REJECT):  (OrderState.REJECTED,  None,                '_on_reject'),
        (OrderState.PENDING,  OrderEvent.CANCEL):  (OrderState.CANCELLED, None,                '_on_cancel'),
        (OrderState.PAID,     OrderEvent.SHIP):    (OrderState.SHIPPED,   '_guard_stock_ready','_on_ship'),
        (OrderState.SHIPPED,  OrderEvent.DELIVER): (OrderState.DELIVERED, None,                '_on_deliver'),
        (OrderState.SHIPPED,  OrderEvent.REFUND):  (OrderState.DRAFT,     None,                '_on_refund'),
    }
    
    def __init__(self, order, services):
        self._order = order
        self._services = services
        self._history = []
    
    def apply(self, event: OrderEvent, actor: str, **kwargs) -> TransitionResult:
        key = (self._order.state, event)
        if key not in self._transitions:
            raise InvalidTransition(self._order.state, event)
        
        next_state, guard_name, action_name = self._transitions[key]
        
        # Check guard
        if guard_name:
            guard = getattr(self, guard_name)
            if not guard(**kwargs):
                raise InvalidTransition(
                    self._order.state,
                    f"{event} (guard '{guard_name}' failed)"
                )
        
        previous = self._order.state
        self._order.state = next_state
        
        # Fire action
        if action_name:
            getattr(self, action_name)(**kwargs)
        
        result = TransitionResult(
            previous_state=previous,
            new_state=next_state,
            event=event,
            occurred_at=datetime.utcnow(),
            actor=actor,
        )
        self._history.append(result)
        return result
    
    # Guards
    def _guard_has_items(self, **_):
        return len(self._order.items) > 0
    
    def _guard_payment_ok(self, payment=None, **_):
        return payment is not None and payment.is_valid
    
    def _guard_stock_ready(self, **_):
        return self._services.inventory.is_reserved(self._order.id)
    
    # Actions
    def _on_submit(self, **_):
        self._services.notifications.notify_ops(self._order)
    
    def _on_pay(self, payment=None, **_):
        self._services.payments.capture(payment)
        self._services.inventory.reserve(self._order)
    
    def _on_ship(self, **_):
        tracking = self._services.shipping.create_shipment(self._order)
        self._order.tracking_number = tracking.number
        self._services.notifications.notify_customer(self._order, "shipped")
    
    def _on_deliver(self, **_):
        self._services.payments.release_to_merchant(self._order)
        self._services.reviews.request(self._order.customer_id)
    
    def _on_reject(self, **_):
        self._services.notifications.notify_customer(self._order, "rejected")
    
    def _on_cancel(self, **_):
        self._services.inventory.release_hold(self._order.id)
    
    def _on_refund(self, **_):
        self._services.payments.refund(self._order)
        self._services.inventory.release_stock(self._order)
    
    def can_apply(self, event: OrderEvent) -> bool:
        return (self._order.state, event) in self._transitions
    
    def available_events(self) -> list:
        return [e for (s, e) in self._transitions if s == self._order.state]
```

## Persisted State with Audit Trail

```python
# Database schema
"""
CREATE TABLE orders (
    id          UUID PRIMARY KEY,
    state       VARCHAR(20) NOT NULL DEFAULT 'draft',
    updated_at  TIMESTAMP NOT NULL,
    version     INTEGER NOT NULL DEFAULT 0  -- optimistic locking
);

CREATE TABLE order_state_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    previous_state  VARCHAR(20),
    new_state       VARCHAR(20) NOT NULL,
    event           VARCHAR(50) NOT NULL,
    actor           VARCHAR(255),
    metadata        JSONB,
    occurred_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
"""

# Repository with optimistic locking
class OrderRepository:
    def transition(self, order_id: str, event: OrderEvent, actor: str, **kwargs):
        with self.db.transaction():
            # Lock row for update
            order = self.db.query(
                "SELECT * FROM orders WHERE id = %s FOR UPDATE",
                [order_id]
            ).fetchone()
            
            sm = OrderStateMachine(order, self.services)
            result = sm.apply(event, actor, **kwargs)
            
            # Update with optimistic lock
            rows = self.db.execute(
                """UPDATE orders SET state = %s, updated_at = NOW(), version = version + 1
                   WHERE id = %s AND version = %s""",
                [result.new_state, order_id, order.version]
            )
            if rows == 0:
                raise ConcurrentModificationError(order_id)
            
            # Record history
            self.db.execute(
                """INSERT INTO order_state_history 
                   (order_id, previous_state, new_state, event, actor, occurred_at)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                [order_id, result.previous_state, result.new_state,
                 event, actor, result.occurred_at]
            )
            return result
```

## XState — JavaScript State Machine

```typescript
import { createMachine, interpret } from 'xstate';

const orderMachine = createMachine({
  id: 'order',
  initial: 'draft',
  states: {
    draft:     { on: { SUBMIT: { target: 'pending', guard: 'hasItems' } } },
    pending: {
      on: {
        PAY:    { target: 'paid',      guard: 'paymentValid', actions: 'capturePayment' },
        REJECT: { target: 'rejected',  actions: 'notifyRejected' },
        CANCEL: { target: 'cancelled', actions: 'releaseHold' },
      }
    },
    paid:      { on: { SHIP:    { target: 'shipped',   guard: 'stockReady' } } },
    shipped:   { on: { DELIVER: { target: 'delivered', actions: 'releaseFunds' },
                       REFUND:  { target: 'draft',     actions: 'issueRefund' } } },
    delivered: { type: 'final' },
    rejected:  { type: 'final' },
    cancelled: { type: 'final' },
  },
}, {
  guards: {
    hasItems: ({ context }) => context.items.length > 0,
    paymentValid: ({ context, event }) => event.payment?.isValid,
    stockReady: ({ context }) => context.stockReserved,
  },
  actions: {
    capturePayment: ({ context, event }) => paymentService.capture(event.payment),
    notifyRejected: ({ context }) => emailService.send(context.customerId, 'rejected'),
    releaseFunds: ({ context }) => paymentService.release(context.orderId),
    issueRefund: ({ context }) => paymentService.refund(context.orderId),
    releaseHold: ({ context }) => inventoryService.release(context.orderId),
  }
});
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Status flags scattered in code** | `if status == 'x' and is_paid and not cancelled` everywhere | Single state field, machine enforces validity |
| **Missing terminal states** | State can loop forever | Model DELIVERED, CANCELLED, FAILED explicitly |
| **Side effects outside actions** | Logic outside the machine bypasses guards | All state changes go through machine |
| **No audit trail** | Can't reconstruct what happened or when | Log every transition with actor and timestamp |
| **Concurrent transitions without locking** | Race conditions put entity in invalid state | Optimistic or pessimistic locking on state change |
| **Too many states** | Machine becomes unreadable | Nested/hierarchical states for complex sub-flows |
| **Transition without event** | State mutated directly: `order.state = 'paid'` | Always apply named events |

## 10 Rules

1. States are nouns; events are verbs. `PAID` is a state. `pay()` is an event.
2. Undefined (state, event) pairs are always errors — never silent no-ops.
3. Every transition is atomic — state change and side effects succeed or fail together.
4. Guards are pure functions with no side effects.
5. Actions fire after the state has changed — never before.
6. Persist audit history alongside state — who triggered what transition and when.
7. Terminal states have no outgoing transitions.
8. Draw the diagram first. If you can't draw it, you don't understand it yet.
9. Use optimistic locking to prevent concurrent transitions corrupting state.
10. Expose `available_events()` from the machine to drive UI — button enable/disable comes from machine, not from scattered `if` logic.
