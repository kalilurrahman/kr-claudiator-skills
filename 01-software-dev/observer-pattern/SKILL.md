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
