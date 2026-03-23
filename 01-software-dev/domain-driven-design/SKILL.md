---
name: domain-driven-design
description: Apply Domain-Driven Design to model complex business domains. Outputs bounded contexts, aggregates, domain events, ubiquitous language glossary, and context maps for production systems.
argument-hint: [business domain, core subdomains, team structure, integration points]
allowed-tools: Read, Write
---

# Domain-Driven Design (DDD)

DDD is a software design approach that aligns code structure with business reality. Not an architecture pattern — a way of thinking that produces maintainable systems by putting the domain model at the centre.

**Use DDD when:** business logic is complex, multiple teams own different parts of the system, or the codebase has become a tangled mess of anemic models and service classes that nobody fully understands.

**Skip DDD when:** the system is primarily CRUD with simple rules, the team is small with a single bounded context, or time pressure prevents the discovery investment.

## Process

1. **Event storm the domain.** Run a collaborative session with domain experts and developers. Put domain events (orange stickies) on a wall in time order. Add commands, aggregates, policies, and read models. Surface the language experts actually use.
2. **Identify bounded contexts.** Cluster events and concepts where the language is consistent. A bounded context is a linguistic boundary — the same word means the same thing everywhere inside it.
3. **Draw the context map.** Show how bounded contexts relate: Shared Kernel, Customer/Supplier, Conformist, Anti-Corruption Layer, Open Host Service, Published Language.
4. **Define aggregates.** Within each context, find the consistency boundaries. An aggregate is a cluster of objects treated as a single unit for data changes. Every aggregate has a root entity.
5. **Model domain events.** Define the events that flow between aggregates and contexts. These become the integration contracts.
6. **Write the ubiquitous language glossary.** Document the agreed terms. Update code to match — class names, method names, variable names should reflect domain language exactly.
7. **Implement the tactical patterns.** Entities, Value Objects, Aggregates, Domain Services, Repositories, Factories, Domain Events.
8. **Protect boundaries.** Use Anti-Corruption Layers to translate between contexts. Never let domain models leak across context boundaries.

## Bounded Context Identification

```
Event Storming output → cluster by consistent language

GOOD boundary signals:
- Same word, different meaning in two areas → separate context
- Team owns end-to-end → natural context boundary  
- Different rate of change → separate context
- Clear upstream/downstream relationship → context map seam

BAD boundary signals:
- Based on technology (front-end vs back-end)
- Based on team org chart alone (Conway's Law trap)
- Too fine-grained (one aggregate per context)
```

## Context Map Patterns

| Pattern | When to Use | Integration Approach |
|---------|-------------|---------------------|
| **Shared Kernel** | Two teams share a small, stable model | Joint ownership, versioned, approval required |
| **Customer/Supplier** | Upstream/downstream with negotiated contract | Downstream specifies needs, upstream commits |
| **Conformist** | Upstream has no interest in downstream needs | Downstream conforms to upstream model |
| **Anti-Corruption Layer (ACL)** | Integrating with legacy or external system | Translate at the boundary, never pollute domain |
| **Open Host Service** | Upstream serves many downstreams | Publish a well-documented protocol |
| **Published Language** | Multiple teams, complex integration | Shared schema (e.g. JSON Schema, Protobuf) |

```
Example Context Map — E-Commerce Platform:

┌─────────────────┐         ┌─────────────────┐
│   Order Context │────────▶│Inventory Context│
│  (Customer)     │  C/S    │  (Supplier)     │
└────────┬────────┘         └─────────────────┘
         │                           ▲
         │ ACL                       │ OHS
         ▼                           │
┌─────────────────┐         ┌─────────────────┐
│  Payment Context│         │ Warehouse Legacy │
│  (Conformist)   │─────────│  ERP System     │
└─────────────────┘  ACL    └─────────────────┘
```

## Aggregate Design

```python
# BAD — anemic model, logic in services
class Order:
    def __init__(self):
        self.items = []
        self.status = "pending"
        self.total = 0

class OrderService:
    def add_item(self, order, item, qty):
        order.items.append({"item": item, "qty": qty})
        order.total += item.price * qty

# GOOD — rich aggregate with invariants enforced
from dataclasses import dataclass, field
from datetime import datetime
from typing import List
from uuid import UUID, uuid4

@dataclass
class Money:
    """Value Object — immutable, equality by value"""
    amount: int  # cents
    currency: str
    
    def __add__(self, other: 'Money') -> 'Money':
        assert self.currency == other.currency
        return Money(self.amount + other.amount, self.currency)
    
    def __mul__(self, qty: int) -> 'Money':
        return Money(self.amount * qty, self.currency)

@dataclass
class OrderLine:
    """Value Object"""
    product_id: UUID
    product_name: str
    unit_price: Money
    quantity: int
    
    @property
    def line_total(self) -> Money:
        return self.unit_price * self.quantity

class Order:
    """Aggregate Root — enforces all Order invariants"""
    MAX_ITEMS = 50
    
    def __init__(self, order_id: UUID, customer_id: UUID):
        self._id = order_id
        self._customer_id = customer_id
        self._lines: List[OrderLine] = []
        self._status = "draft"
        self._events = []
    
    @property
    def id(self) -> UUID:
        return self._id
    
    @property
    def total(self) -> Money:
        if not self._lines:
            return Money(0, "USD")
        return sum((line.line_total for line in self._lines[1:]),
                   self._lines[0].line_total)
    
    def add_item(self, product_id: UUID, name: str,
                 price: Money, qty: int) -> None:
        """Business invariant: draft orders only, max 50 items"""
        if self._status != "draft":
            raise ValueError("Cannot modify a confirmed order")
        if len(self._lines) >= self.MAX_ITEMS:
            raise ValueError(f"Order cannot exceed {self.MAX_ITEMS} items")
        if qty <= 0:
            raise ValueError("Quantity must be positive")
        
        # Merge if product already exists
        for line in self._lines:
            if line.product_id == product_id:
                self._lines.remove(line)
                self._lines.append(OrderLine(
                    product_id, name, price, line.quantity + qty))
                return
        
        self._lines.append(OrderLine(product_id, name, price, qty))
    
    def confirm(self) -> None:
        """Raise domain event on state transition"""
        if not self._lines:
            raise ValueError("Cannot confirm empty order")
        if self._status != "draft":
            raise ValueError("Order already confirmed")
        
        self._status = "confirmed"
        self._events.append(OrderConfirmed(
            order_id=self._id,
            customer_id=self._customer_id,
            total=self.total,
            occurred_at=datetime.utcnow()
        ))
    
    def pull_events(self) -> list:
        """Collect and clear domain events after persistence"""
        events = list(self._events)
        self._events.clear()
        return events

@dataclass
class OrderConfirmed:
    """Domain Event — immutable fact"""
    order_id: UUID
    customer_id: UUID
    total: Money
    occurred_at: datetime
```

## Value Objects

```python
# Value Objects: no identity, equality by value, immutable
@dataclass(frozen=True)
class EmailAddress:
    value: str
    
    def __post_init__(self):
        import re
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', self.value):
            raise ValueError(f"Invalid email: {self.value}")

@dataclass(frozen=True)
class PostalAddress:
    street: str
    city: str
    country_code: str  # ISO 3166-1 alpha-2
    postal_code: str
    
    def is_domestic(self, country: str) -> bool:
        return self.country_code == country

# Use value objects in entities
class Customer:
    def __init__(self, id: UUID, email: EmailAddress):
        self._id = id
        self._email = email  # Value Object, not str
    
    def change_email(self, new_email: EmailAddress) -> None:
        # Business rule: can't change to same email
        if self._email == new_email:
            raise ValueError("New email is the same as current")
        self._email = new_email
        self._events.append(CustomerEmailChanged(self._id, new_email))
```

## Repository Pattern

```python
from abc import ABC, abstractmethod

class OrderRepository(ABC):
    """Interface in domain layer — implementation in infrastructure"""
    
    @abstractmethod
    def get(self, order_id: UUID) -> Order:
        """Raise OrderNotFound if not present"""
        ...
    
    @abstractmethod
    def save(self, order: Order) -> None:
        """Persist aggregate and publish domain events"""
        ...
    
    @abstractmethod
    def next_id(self) -> UUID:
        """Generate next aggregate ID"""
        ...

# Infrastructure implementation
class PostgresOrderRepository(OrderRepository):
    def __init__(self, session, event_publisher):
        self._session = session
        self._event_publisher = event_publisher
    
    def get(self, order_id: UUID) -> Order:
        record = self._session.query(OrderRecord).get(order_id)
        if not record:
            raise OrderNotFound(order_id)
        return self._reconstruct(record)
    
    def save(self, order: Order) -> None:
        record = self._to_record(order)
        self._session.merge(record)
        self._session.flush()
        
        # Publish domain events after persistence
        events = order.pull_events()
        for event in events:
            self._event_publisher.publish(event)
    
    def next_id(self) -> UUID:
        return uuid4()
    
    def _reconstruct(self, record) -> Order:
        # Rebuild aggregate from persisted state
        ...
    
    def _to_record(self, order: Order):
        # Map aggregate to persistence model
        ...
```

## Domain Services

```python
# Use a Domain Service when logic doesn't naturally belong to one aggregate
class PricingService:
    """Domain Service — stateless, operates on multiple aggregates"""
    
    def __init__(self, discount_repo: DiscountRepository):
        self._discounts = discount_repo
    
    def calculate_order_price(
        self, 
        order: Order, 
        customer: Customer
    ) -> Money:
        """Pricing logic that spans Order and Customer"""
        base = order.total
        
        discounts = self._discounts.find_applicable(
            customer_tier=customer.tier,
            order_value=base
        )
        
        total_discount = sum(d.amount for d in discounts)
        return Money(
            max(0, base.amount - total_discount),
            base.currency
        )
```

## Ubiquitous Language Glossary Template

```markdown
# [Domain] Ubiquitous Language — [Context Name]

Last updated: YYYY-MM-DD  
Context: [Bounded Context Name]

## Core Terms

| Term | Definition | NOT the same as | Used in code as |
|------|-----------|-----------------|-----------------|
| Order | A customer's intent to purchase items, from draft through fulfilment | Shopping Cart (pre-order intent) | `Order` class |
| Confirmation | The act of a customer committing to purchase, creating an obligation | Payment (separate step) | `order.confirm()` |
| Line Item | A single product+quantity combination within an order | Product (catalogue concept) | `OrderLine` |
| Fulfilment | The warehouse process of picking, packing, and shipping | Delivery (carrier action) | `FulfilmentRequest` |

## State Transitions

Draft → Confirmed → Fulfilling → Shipped → Delivered
                 ↘ Cancelled

## Events

| Event | Meaning | Triggers |
|-------|---------|---------|
| OrderConfirmed | Customer committed to purchase | → Payment processing, → Inventory reservation |
| PaymentCaptured | Money collected | → Fulfilment request |
| OrderCancelled | Order voided | → Inventory release, → Refund if paid |
```

## Worked Example: SaaS Subscription Platform

**Domain:** B2B SaaS with subscriptions, seats, billing, and access control.

**Event Storm findings:**
- Events: SubscriptionStarted, SeatAdded, SeatRevoked, InvoiceGenerated, PaymentFailed, SubscriptionCancelled, FeatureEnabled
- Clusters naturally form around: Subscription management, Billing, Access control, Notifications

**Bounded Contexts:**

```
┌──────────────────────┐    Published Language    ┌─────────────────────┐
│  Subscription Context│─────────────────────────▶│  Billing Context    │
│                      │   (SubscriptionStarted,  │                     │
│  Aggregate: Account  │    SeatChanged events)   │  Aggregate: Invoice │
│  Aggregate: Plan     │                          │  Aggregate: Payment │
└──────────┬───────────┘                          └─────────────────────┘
           │
           │ ACL (translates to internal permission model)
           ▼
┌──────────────────────┐
│   Access Context     │
│                      │
│  Aggregate: Seat     │
│  Aggregate: Feature  │
└──────────────────────┘
```

**Key design decisions:**
- "Account" in Subscription context = billing entity; "Account" in Access context = login credential. **Different things — separate models, no shared class.**
- Seat count enforced in Subscription aggregate (not Access). Access context subscribes to SeatRevoked events to disable login.
- Billing context is Conformist to Stripe's model for payment primitives.

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Anemic Domain Model** | Logic lives in services, entities are data bags | Move behaviour into aggregates |
| **Shared Database across contexts** | Tight coupling, impossible to evolve independently | One DB schema per context minimum |
| **God Aggregate** | One aggregate owns half the domain | Break on consistency boundaries, not convenience |
| **Leaking domain models** | Passing Order aggregate to external API controller | Map to DTOs at the boundary |
| **Skipping Ubiquitous Language** | Devs use technical names, experts use business terms | Rename code to match expert language |
| **Event Sourcing by default** | Adds complexity without clear benefit | Only use ES when audit trail or temporal queries required |
| **Too many bounded contexts** | Micro-contexts with single aggregates, integration overhead | Contexts should be team-sized, not class-sized |
| **Ignoring Conway's Law** | Context boundaries don't match team boundaries | Align contexts with team ownership |

## 10 Rules

1. Domain experts define the language — developers adopt it, not vice versa.
2. One Ubiquitous Language per bounded context. Different contexts may reuse words with different meanings.
3. Aggregates enforce invariants — if you can break a business rule without going through the root, the boundary is wrong.
4. Keep aggregates small. If an aggregate has more than 4–6 entities, break it down.
5. Reference other aggregates by ID only — never hold a direct object reference across aggregate roots.
6. Domain events are facts in past tense: `OrderConfirmed`, not `ConfirmOrder`.
7. Repositories return complete aggregates, not partial projections.
8. Domain Services are stateless. If they need state, they're probably an aggregate.
9. Anti-Corruption Layers translate foreign models at the boundary — never pollute the domain layer.
10. Refactor toward deeper insight. The first model is wrong. Continuous refinement is the method.
