---
name: hexagonal-architecture
description: Design hexagonal (ports and adapters) architecture to isolate business logic from infrastructure. Outputs port definitions, adapter implementations, dependency flow diagram, and testing strategy.
argument-hint: [application type, external dependencies, testing requirements, team size]
allowed-tools: Read, Write
---

# Hexagonal Architecture (Ports & Adapters)

Hexagonal architecture puts business logic at the centre and isolates it from all external concerns — databases, HTTP, message queues, email services — via ports (interfaces) and adapters (implementations). The core domain has zero knowledge of infrastructure. This makes it independently testable, independently deployable, and easy to swap any adapter.

## Structure

```
        ┌─────────────────────────────────────┐
        │              CORE                    │
        │   (Domain entities + use cases)      │
        │                                      │
        │  ┌──────────┐    ┌────────────────┐  │
        │  │  Domain  │    │  Application   │  │
        │  │ Entities │◄───│   Services     │  │
        │  └──────────┘    └───────┬────────┘  │
        │                         │            │
        │              ┌──────────┘            │
        │         Ports (ABCs)                 │
        └──────────────┼──────────────────────┘
                       │
         ┌─────────────┼──────────────────┐
         │             │                  │
    ┌────▼────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │  HTTP   │  │  PostgreSQL │  │   Kafka     │
    │ Adapter │  │   Adapter   │  │   Adapter   │
    └─────────┘  └─────────────┘  └─────────────┘
    (Driving)       (Driven)         (Driven)
```

## Port Definitions (Core Layer)

```python
# core/ports.py — pure interfaces, zero infrastructure imports
from abc import ABC, abstractmethod
from typing import Optional
from .domain import Order, Customer, Money

# DRIVING PORTS (called by outside world to trigger core)
class OrderApplicationService(ABC):
    @abstractmethod
    def place_order(self, customer_id: str, items: list, address: str) -> Order: ...
    @abstractmethod
    def cancel_order(self, order_id: str, reason: str) -> Order: ...
    @abstractmethod
    def get_order(self, order_id: str) -> Optional[Order]: ...

# DRIVEN PORTS (core calls these to interact with infrastructure)
class OrderRepository(ABC):
    @abstractmethod
    def save(self, order: Order) -> None: ...
    @abstractmethod
    def get(self, order_id: str) -> Optional[Order]: ...
    @abstractmethod
    def find_by_customer(self, customer_id: str) -> list[Order]: ...

class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, amount: Money, payment_token: str) -> str: ...  # returns tx_id
    @abstractmethod
    def refund(self, transaction_id: str, amount: Money) -> None: ...

class NotificationService(ABC):
    @abstractmethod
    def notify_order_placed(self, order: Order) -> None: ...
    @abstractmethod
    def notify_order_cancelled(self, order: Order) -> None: ...
```

## Core Application Service

```python
# core/services.py — business logic with zero infrastructure imports
from .ports import OrderRepository, PaymentGateway, NotificationService
from .domain import Order, OrderStatus
from .events import OrderPlaced, OrderCancelled

class OrderService:
    def __init__(
        self,
        order_repo: OrderRepository,
        payment_gateway: PaymentGateway,
        notifications: NotificationService,
    ):
        self._orders = order_repo
        self._payments = payment_gateway
        self._notifications = notifications

    def place_order(self, customer_id: str, items: list, address: str) -> Order:
        order = Order.create(customer_id=customer_id, items=items, address=address)
        
        tx_id = self._payments.charge(order.total, order.payment_token)
        order.mark_paid(transaction_id=tx_id)
        
        self._orders.save(order)
        self._notifications.notify_order_placed(order)
        return order

    def cancel_order(self, order_id: str, reason: str) -> Order:
        order = self._orders.get(order_id)
        if not order: raise ValueError(f"Order {order_id} not found")
        if not order.can_cancel(): raise ValueError(f"Order {order_id} cannot be cancelled")
        
        if order.is_paid:
            self._payments.refund(order.transaction_id, order.total)
        
        order.cancel(reason=reason)
        self._orders.save(order)
        self._notifications.notify_order_cancelled(order)
        return order
```

## Adapters (Infrastructure Layer)

```python
# adapters/postgres_order_repo.py
import psycopg2
from core.ports import OrderRepository
from core.domain import Order

class PostgresOrderRepository(OrderRepository):
    def __init__(self, db_url: str):
        self._conn = psycopg2.connect(db_url)

    def save(self, order: Order) -> None:
        # Map domain object to DB columns
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO orders (id, customer_id, status, total_cents) "
                "VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO UPDATE "
                "SET status = EXCLUDED.status",
                [order.id, order.customer_id, order.status.value, order.total.cents]
            )
        self._conn.commit()

    def get(self, order_id: str) -> Order | None:
        with self._conn.cursor() as cur:
            cur.execute("SELECT * FROM orders WHERE id = %s", [order_id])
            row = cur.fetchone()
            return self._to_domain(row) if row else None

# adapters/stripe_payment_gateway.py
import stripe
from core.ports import PaymentGateway
from core.domain import Money

class StripePaymentGateway(PaymentGateway):
    def __init__(self, api_key: str):
        stripe.api_key = api_key

    def charge(self, amount: Money, payment_token: str) -> str:
        intent = stripe.PaymentIntent.create(
            amount=amount.cents,
            currency=amount.currency.lower(),
            payment_method=payment_token,
            confirm=True,
        )
        return intent.id

# adapters/http_adapter.py (FastAPI)
from fastapi import FastAPI, Depends
from core.ports import OrderApplicationService

app = FastAPI()

@app.post("/api/v1/orders")
def place_order(request: PlaceOrderRequest, service: OrderApplicationService = Depends(get_service)):
    order = service.place_order(
        customer_id=request.customer_id,
        items=request.items,
        address=request.shipping_address,
    )
    return OrderResponse.from_domain(order)
```

## Dependency Wiring (Composition Root)

```python
# app.py — only place that knows about all adapters
def create_app() -> FastAPI:
    # Wire up all adapters
    order_repo = PostgresOrderRepository(os.environ["DB_URL"])
    payment = StripePaymentGateway(os.environ["STRIPE_KEY"])
    notifications = SendgridNotificationService(os.environ["SENDGRID_KEY"])

    # Inject into core service
    order_service = OrderService(
        order_repo=order_repo,
        payment_gateway=payment,
        notifications=notifications,
    )

    # Wire HTTP adapter
    app = FastAPI()
    setup_routes(app, order_service)
    return app

# For tests — swap real adapters for fakes
def create_test_app() -> FastAPI:
    order_repo = InMemoryOrderRepository()
    payment = FakePaymentGateway()
    notifications = FakeNotificationService()
    order_service = OrderService(order_repo, payment, notifications)
    # ...
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Import from infrastructure in domain** | `from sqlalchemy import Column` in domain entity | Domain entities are pure Python dataclasses |
| **Adapter logic in core** | SQL query inside application service | Extract to repository adapter |
| **Leaking HTTP concepts to core** | `request.headers` in use case | Parse at adapter; pass primitives to core |
| **One giant adapter** | Single class handles DB, email, and HTTP | One adapter per external system |
| **Skipping ports** | Adapters injected as concrete types | Always inject via ABC port |

## 10 Rules

1. The core (domain + application services) has zero imports from infrastructure packages.
2. Ports are abstract base classes in the core layer — adapters live outside it.
3. Every external system (DB, queue, email, HTTP) has exactly one adapter.
4. The composition root (main.py / app.py) is the only file that imports everything.
5. Core services are testable with in-memory fakes — no database required.
6. Domain entities are pure Python/Java/Go — no ORM decorators, no framework annotations.
7. HTTP request/response objects never enter the core — parse at the adapter boundary.
8. Each adapter is independently replaceable — swapping Postgres for Mongo touches only one file.
9. Driving adapters (HTTP, CLI, queues) call into core; driven adapters (DB, email) are called by core.
10. The architecture diagram should show the core having no outward arrows — all dependencies point inward.
