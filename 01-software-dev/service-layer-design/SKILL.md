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
