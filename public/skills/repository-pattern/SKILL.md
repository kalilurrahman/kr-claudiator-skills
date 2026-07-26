---
name: repository-pattern
description: Implement the Repository pattern to abstract data access from business logic. Outputs repository interfaces, implementations, unit-of-work pattern, and testing with fakes.
argument-hint: [language, database type, ORM usage, testing strategy]
allowed-tools: Read, Write
---

# Repository Pattern

The Repository pattern provides a collection-like interface for accessing domain objects, hiding the underlying storage mechanism. Business logic works against the interface; storage implementation is swappable. Result: testable domain logic, portable persistence.

## Interface Definition

```python
from abc import ABC, abstractmethod
from typing import Optional, List
from uuid import UUID
from domain.entities.order import Order

class OrderRepository(ABC):
    @abstractmethod
    def get(self, order_id: UUID) -> Optional[Order]:
        """Return Order or None if not found."""
        ...

    @abstractmethod
    def find_by_customer(self, customer_id: UUID,
                          status: Optional[str] = None) -> List[Order]:
        ...

    @abstractmethod
    def save(self, order: Order) -> None:
        """Insert or update the order."""
        ...

    @abstractmethod
    def delete(self, order_id: UUID) -> None:
        ...

    @abstractmethod
    def next_id(self) -> UUID:
        """Generate a new unique ID."""
        ...
```

## PostgreSQL Implementation

```python
import psycopg2
from uuid import UUID, uuid4
from domain.entities.order import Order, OrderLine

class PostgresOrderRepository(OrderRepository):
    def __init__(self, conn):
        self._conn = conn

    def get(self, order_id: UUID) -> Optional[Order]:
        with self._conn.cursor() as cur:
            cur.execute("""
                SELECT o.id, o.customer_id, o.status,
                       ol.product_id, ol.quantity, ol.unit_price_cents
                FROM orders o
                LEFT JOIN order_lines ol ON ol.order_id = o.id
                WHERE o.id = %s
            """, [str(order_id)])
            rows = cur.fetchall()
        if not rows:
            return None
        return self._reconstruct(rows)

    def save(self, order: Order) -> None:
        with self._conn.cursor() as cur:
            cur.execute("""
                INSERT INTO orders (id, customer_id, status)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                  SET status = EXCLUDED.status,
                      updated_at = NOW()
            """, [str(order._id), str(order._customer_id), order._status])
            cur.execute("DELETE FROM order_lines WHERE order_id = %s", [str(order._id)])
            for line in order._lines:
                cur.execute("""
                    INSERT INTO order_lines (order_id, product_id, quantity, unit_price_cents)
                    VALUES (%s, %s, %s, %s)
                """, [str(order._id), str(line.product_id), line.quantity, line.unit_price_cents])
        self._conn.commit()

    def next_id(self) -> UUID:
        return uuid4()

    def _reconstruct(self, rows) -> Order:
        order = Order.__new__(Order)
        order._id = UUID(rows[0][0])
        order._customer_id = UUID(rows[0][1])
        order._status = rows[0][2]
        order._lines = []
        order._events = []
        for row in rows:
            if row[3]:
                order._lines.append(OrderLine(
                    product_id=UUID(row[3]),
                    quantity=row[4],
                    unit_price_cents=row[5],
                ))
        return order
```

## In-Memory Fake (for Tests)

```python
from copy import deepcopy

class InMemoryOrderRepository(OrderRepository):
    """Fast, in-memory implementation for unit tests."""

    def __init__(self):
        self._store: dict[UUID, Order] = {}

    def get(self, order_id: UUID) -> Optional[Order]:
        order = self._store.get(order_id)
        return deepcopy(order) if order else None  # Return copy — prevent mutation

    def find_by_customer(self, customer_id: UUID, status=None) -> List[Order]:
        return [
            deepcopy(o) for o in self._store.values()
            if o._customer_id == customer_id
            and (status is None or o._status == status)
        ]

    def save(self, order: Order) -> None:
        self._store[order._id] = deepcopy(order)

    def delete(self, order_id: UUID) -> None:
        self._store.pop(order_id, None)

    def next_id(self) -> UUID:
        return uuid4()

    def count(self) -> int:
        return len(self._store)

    def all(self) -> List[Order]:
        return list(deepcopy(o) for o in self._store.values())
```

## Unit of Work Pattern

```python
# Coordinate multiple repositories in one transaction
from contextlib import contextmanager

class UnitOfWork:
    def __init__(self, connection_factory):
        self._factory = connection_factory

    @contextmanager
    def __call__(self):
        conn = self._factory()
        try:
            orders = PostgresOrderRepository(conn)
            customers = PostgresCustomerRepository(conn)
            yield orders, customers
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

uow = UnitOfWork(get_connection)

# Usage — both repos share the same transaction
with uow() as (order_repo, customer_repo):
    customer = customer_repo.get(customer_id)
    order = Order(order_repo.next_id(), customer.id)
    order.add_line(...)
    order.confirm()
    order_repo.save(order)
    customer.increment_order_count()
    customer_repo.save(customer)
    # Commits atomically
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Generic repository (save anything)** | No domain semantics; anemic interface | Domain-specific methods: `find_overdue_orders()` |
| **Returning DB model objects** | Domain leaks persistence concerns | Map DB rows → domain entities in repository |
| **Business logic in repository** | Repository becomes service layer | Repositories are storage only |
| **Repository per table** | Misses aggregate boundaries | Repository per aggregate root |
| **No fake for tests** | Integration tests required for every use case | Always provide an in-memory fake |

## 10 Rules

1. Repositories are collection-like interfaces — `get`, `save`, `find_by_*`, `delete`.
2. One repository per aggregate root — not per database table.
3. The interface lives in the domain layer — implementations in infrastructure.
4. Always provide an in-memory fake for unit testing.
5. Return domain entities from repositories — not ORM models or raw rows.
6. Business logic never goes in repositories — they are pure storage abstraction.
7. Unit of Work coordinates transactions across multiple repositories.
8. Repository methods have domain semantics: `find_pending_orders_for_fulfilment()` not `findByStatus("pending")`.
9. Return `Optional` (not exceptions) for "not found" — exceptions for infrastructure errors.
10. The fake must match the real implementation's behaviour — test with both.
