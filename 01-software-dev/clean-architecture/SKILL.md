---
name: clean-architecture
description: Structure codebases using Clean Architecture principles with clear layer separation, dependency inversion, and domain-centric design. Outputs folder structure, layer contracts, and dependency rules.
argument-hint: [language, project size, existing codebase, team experience]
allowed-tools: Read, Write
---

# Clean Architecture

Clean Architecture (Robert C. Martin) organises code so that business rules are independent of frameworks, databases, and UI. The core rule: dependencies point inward — outer layers depend on inner layers, never the reverse. This makes business logic testable, portable, and long-lived.

## The Layers

```
┌─────────────────────────────────────┐
│         Frameworks & Drivers        │  ← Web, DB, UI, External APIs
│  ┌───────────────────────────────┐  │
│  │    Interface Adapters          │  │  ← Controllers, Presenters, Gateways
│  │  ┌─────────────────────────┐  │  │
│  │  │    Application Layer     │  │  │  ← Use Cases / Application Services
│  │  │  ┌───────────────────┐  │  │  │
│  │  │  │   Domain Layer     │  │  │  │  ← Entities, Value Objects, Domain Services
│  │  │  └───────────────────┘  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
        Dependencies point INWARD →
```

## Project Structure

```
src/
├── domain/                    # No external dependencies
│   ├── entities/
│   │   └── order.py
│   ├── value_objects/
│   │   └── money.py
│   ├── repositories/          # Interfaces (abstractions)
│   │   └── order_repository.py
│   └── services/
│       └── pricing_service.py
│
├── application/               # Depends on domain only
│   ├── use_cases/
│   │   ├── place_order.py
│   │   └── cancel_order.py
│   └── dtos/
│       └── order_dto.py
│
├── infrastructure/            # Implements domain interfaces
│   ├── persistence/
│   │   └── postgres_order_repository.py
│   ├── external/
│   │   └── stripe_payment_gateway.py
│   └── messaging/
│       └── kafka_event_publisher.py
│
└── interfaces/                # Depends on application layer
    ├── api/
    │   ├── routers/
    │   └── schemas/
    └── cli/
```

## Domain Layer — No Dependencies

```python
# domain/entities/order.py — pure Python, zero imports from outside domain
from dataclasses import dataclass, field
from datetime import datetime
from typing import List
from uuid import UUID

@dataclass
class OrderLine:
    product_id: UUID
    quantity: int
    unit_price_cents: int

    @property
    def total_cents(self) -> int:
        return self.quantity * self.unit_price_cents

class Order:
    def __init__(self, order_id: UUID, customer_id: UUID):
        self._id = order_id
        self._customer_id = customer_id
        self._lines: List[OrderLine] = []
        self._status = "draft"
        self._events = []

    def add_line(self, line: OrderLine) -> None:
        if self._status != "draft":
            raise ValueError("Cannot modify confirmed order")
        self._lines.append(line)

    def confirm(self) -> None:
        if not self._lines:
            raise ValueError("Cannot confirm empty order")
        self._status = "confirmed"
        self._events.append({"type": "OrderConfirmed", "order_id": str(self._id)})

    @property
    def total_cents(self) -> int:
        return sum(l.total_cents for l in self._lines)

    def pull_events(self) -> list:
        evts, self._events = self._events, []
        return evts

# domain/repositories/order_repository.py — interface only
from abc import ABC, abstractmethod
from uuid import UUID

class OrderRepository(ABC):
    @abstractmethod
    def get(self, order_id: UUID) -> Order: ...
    @abstractmethod
    def save(self, order: Order) -> None: ...
    @abstractmethod
    def next_id(self) -> UUID: ...
```

## Application Layer — Use Cases

```python
# application/use_cases/place_order.py
from dataclasses import dataclass
from uuid import UUID
from domain.entities.order import Order, OrderLine
from domain.repositories.order_repository import OrderRepository
from domain.repositories.product_repository import ProductRepository

@dataclass
class PlaceOrderCommand:
    customer_id: UUID
    items: list[dict]  # [{product_id, quantity}]

@dataclass
class PlaceOrderResult:
    order_id: UUID
    total_cents: int

class PlaceOrderUseCase:
    def __init__(
        self,
        order_repo: OrderRepository,        # Interface — injected
        product_repo: ProductRepository,    # Interface — injected
        event_publisher,                    # Interface — injected
    ):
        self._orders = order_repo
        self._products = product_repo
        self._publisher = event_publisher

    def execute(self, cmd: PlaceOrderCommand) -> PlaceOrderResult:
        order = Order(
            order_id=self._orders.next_id(),
            customer_id=cmd.customer_id,
        )
        for item in cmd.items:
            product = self._products.get(item["product_id"])
            order.add_line(OrderLine(
                product_id=product.id,
                quantity=item["quantity"],
                unit_price_cents=product.price_cents,
            ))
        order.confirm()
        self._orders.save(order)

        for event in order.pull_events():
            self._publisher.publish(event)

        return PlaceOrderResult(order_id=order._id, total_cents=order.total_cents)
```

## Infrastructure Layer — Implements Interfaces

```python
# infrastructure/persistence/postgres_order_repository.py
from uuid import UUID, uuid4
from domain.entities.order import Order, OrderLine
from domain.repositories.order_repository import OrderRepository
import psycopg2

class PostgresOrderRepository(OrderRepository):
    def __init__(self, connection_string: str):
        self._conn = psycopg2.connect(connection_string)

    def get(self, order_id: UUID) -> Order:
        with self._conn.cursor() as cur:
            cur.execute("SELECT * FROM orders WHERE id = %s", [str(order_id)])
            row = cur.fetchone()
        if not row:
            raise ValueError(f"Order {order_id} not found")
        return self._reconstruct(row)

    def save(self, order: Order) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO orders (id, customer_id, status, total_cents) "
                "VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status",
                [str(order._id), str(order._customer_id), order._status, order.total_cents]
            )
        self._conn.commit()

    def next_id(self) -> UUID:
        return uuid4()

    def _reconstruct(self, row) -> Order:
        # rebuild Order from DB row
        ...
```

## Interface Layer — API Adapter

```python
# interfaces/api/routers/orders.py
from fastapi import APIRouter, Depends
from uuid import UUID
from application.use_cases.place_order import PlaceOrderCommand, PlaceOrderUseCase

router = APIRouter(prefix="/orders")

def get_use_case() -> PlaceOrderUseCase:
    # Dependency injection wiring — only here do we touch infrastructure
    from infrastructure.persistence.postgres_order_repository import PostgresOrderRepository
    from infrastructure.persistence.postgres_product_repository import PostgresProductRepository
    from infrastructure.messaging.kafka_event_publisher import KafkaEventPublisher
    import os
    return PlaceOrderUseCase(
        order_repo=PostgresOrderRepository(os.environ["DATABASE_URL"]),
        product_repo=PostgresProductRepository(os.environ["DATABASE_URL"]),
        event_publisher=KafkaEventPublisher(os.environ["KAFKA_URL"]),
    )

@router.post("/", status_code=201)
async def place_order(body: dict, use_case: PlaceOrderUseCase = Depends(get_use_case)):
    result = use_case.execute(PlaceOrderCommand(
        customer_id=UUID(body["customer_id"]),
        items=body["items"],
    ))
    return {"order_id": str(result.order_id), "total_cents": result.total_cents}
```

## Dependency Rule Test

```python
# Enforce dependency rule in CI — inner layers must not import outer layers
import ast, sys
from pathlib import Path

LAYER_ORDER = ["domain", "application", "infrastructure", "interfaces"]

def check_imports(filepath: Path) -> list:
    layer = next((l for l in LAYER_ORDER if l in filepath.parts), None)
    if not layer:
        return []
    layer_idx = LAYER_ORDER.index(layer)
    violations = []
    tree = ast.parse(filepath.read_text())
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = getattr(node, 'module', '') or ''
            for outer in LAYER_ORDER[layer_idx+1:]:
                if module.startswith(outer):
                    violations.append(f"{filepath}: imports from outer layer '{outer}'")
    return violations

all_violations = []
for py_file in Path("src").rglob("*.py"):
    all_violations.extend(check_imports(py_file))

if all_violations:
    print("DEPENDENCY RULE VIOLATIONS:")
    for v in all_violations: print(f"  {v}")
    sys.exit(1)
print("✓ No dependency rule violations")
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Framework imports in domain** | Domain coupled to Flask/Django; untestable in isolation | Domain layer: pure Python only |
| **Use cases depending on HTTP** | Business logic tied to delivery mechanism | Use cases accept DTOs/commands; know nothing of HTTP |
| **DB queries in use cases** | Business logic mixed with persistence | Use cases depend on repository interfaces |
| **Fat controllers** | Business logic in routers/views | Move to use cases; controllers only marshal data |
| **Circular layer dependencies** | Application imports from interfaces | Strict inward-only dependency enforcement in CI |

## 10 Rules

1. Dependencies point inward — outer layers depend on inner, never the reverse.
2. The domain layer has zero external imports — pure language only.
3. Use cases depend on interfaces (abstractions), not implementations.
4. Infrastructure implements domain interfaces — swappable without changing business logic.
5. The interface layer (API/CLI) is the wiring layer — it connects everything together.
6. Business rules are testable without a web server, database, or framework.
7. Entities enforce their own invariants — no anemic models.
8. The dependency rule is checked in CI — violations fail the build.
9. DTOs cross layer boundaries — entities never leak into the interface layer.
10. Framework upgrades touch only the outermost layer — business logic is unaffected.
