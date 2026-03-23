---
name: design-patterns
description: Apply the right design pattern to a software design problem. Covers creational, structural, and behavioral patterns with implementation examples, when-to-use guidance, and anti-pattern warnings.
argument-hint: [problem description, language, pattern type needed]
allowed-tools: Read, Write
---

# Design Patterns

Design patterns are reusable solutions to commonly recurring design problems. They are not copy-paste code — they are templates for thinking about structure. Knowing when NOT to use a pattern is as important as knowing how to implement it.

## Pattern Categories

| Category | Purpose | Patterns |
|----------|---------|----------|
| Creational | How objects are created | Singleton, Factory, Abstract Factory, Builder, Prototype |
| Structural | How objects are composed | Adapter, Decorator, Facade, Proxy, Composite, Bridge |
| Behavioral | How objects communicate | Observer, Strategy, Command, Iterator, State, Template Method |

## Process

1. **Name the problem** -- what design problem are you actually solving?
2. **Check if a pattern fits** -- match the problem structure, not the pattern name.
3. **Choose the simplest pattern** -- patterns add complexity; simpler code is often better.
4. **Implement in the language's idiom** -- a Python singleton differs from a Java singleton.
5. **Document the intent** -- leave a comment naming the pattern and why it was chosen.
6. **Test the abstraction boundaries** -- test through the interface, not the implementation.
7. **Review for over-engineering** -- if the pattern adds more complexity than it removes, skip it.

## Core Patterns with Implementation

### Singleton -- One instance, global access point

```python
# Thread-safe singleton using module-level instance (Pythonic)
class DatabasePool:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:  # double-checked locking
                    cls._instance = super().__new__(cls)
                    cls._instance._pool = create_pool()
        return cls._instance

# Simpler Pythonic approach: module-level instance
# db_pool.py
_pool = DatabasePool()
def get_pool(): return _pool
```

**Use when:** Shared resource (DB pool, config, logger) that must have exactly one instance.
**Avoid when:** Global state hides dependencies and makes testing hard. Prefer dependency injection.

---

### Factory Method -- Delegate instantiation to subclasses

```python
from abc import ABC, abstractmethod

class Notifier(ABC):
    @abstractmethod
    def send(self, message: str) -> None: ...

class EmailNotifier(Notifier):
    def send(self, message: str) -> None:
        print(f"Email: {message}")

class SlackNotifier(Notifier):
    def send(self, message: str) -> None:
        print(f"Slack: {message}")

class SMSNotifier(Notifier):
    def send(self, message: str) -> None:
        print(f"SMS: {message}")

def notifier_factory(channel: str) -> Notifier:
    registry = {
        "email": EmailNotifier,
        "slack": SlackNotifier,
        "sms":   SMSNotifier,
    }
    cls = registry.get(channel)
    if not cls:
        raise ValueError(f"Unknown channel: {channel!r}. Valid: {list(registry)}")
    return cls()

# Usage -- caller doesn't know which class is instantiated
notifier = notifier_factory(config["alert_channel"])
notifier.send("Deployment complete")
```

**Use when:** Object type is determined at runtime; want to isolate construction logic.
**Avoid when:** Only one type exists -- just instantiate it directly.

---

### Builder -- Construct complex objects step by step

```python
from dataclasses import dataclass, field
from typing import List

@dataclass
class Query:
    table: str
    conditions: List[str] = field(default_factory=list)
    columns: List[str] = field(default_factory=list)
    limit: int = None
    order_by: str = None

class QueryBuilder:
    def __init__(self, table: str):
        self._query = Query(table=table)

    def select(self, *columns: str) -> "QueryBuilder":
        self._query.columns = list(columns)
        return self

    def where(self, condition: str) -> "QueryBuilder":
        self._query.conditions.append(condition)
        return self

    def order_by(self, column: str) -> "QueryBuilder":
        self._query.order_by = column
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._query.limit = n
        return self

    def build(self) -> Query:
        if not self._query.table:
            raise ValueError("Table name is required")
        return self._query

# Fluent interface
query = (
    QueryBuilder("orders")
    .select("id", "user_id", "total")
    .where("status = 'active'")
    .where("total > 100")
    .order_by("created_at DESC")
    .limit(50)
    .build()
)
```

**Use when:** Object has many optional parameters; telescoping constructor anti-pattern appears.
**Avoid when:** Object is simple -- use keyword arguments instead.

---

### Observer -- Notify dependents when state changes

```python
from typing import Callable, Dict, List

class EventBus:
    """Simple observer / pub-sub implementation."""
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event: str, handler: Callable) -> None:
        self._subscribers.setdefault(event, []).append(handler)

    def unsubscribe(self, event: str, handler: Callable) -> None:
        self._subscribers.get(event, []).remove(handler)

    def publish(self, event: str, data: dict = None) -> None:
        for handler in self._subscribers.get(event, []):
            try:
                handler(data or {})
            except Exception as e:
                logger.error(f"Handler {handler.__name__} failed for {event}: {e}")

bus = EventBus()

# Subscribers register independently
def send_welcome_email(data): ...
def create_user_profile(data): ...
def notify_crm(data): ...

bus.subscribe("user.created", send_welcome_email)
bus.subscribe("user.created", create_user_profile)
bus.subscribe("user.created", notify_crm)

# Publisher does not know about subscribers
bus.publish("user.created", {"user_id": 42, "email": "user@example.com"})
```

**Use when:** One event triggers multiple independent reactions; loose coupling needed.
**Avoid when:** Debugging event chains is critical -- event-driven code is hard to trace.

---

### Strategy -- Swap algorithms at runtime

```python
from typing import Protocol, List

class SortStrategy(Protocol):
    def sort(self, data: List[int]) -> List[int]: ...

class QuickSort:
    def sort(self, data: List[int]) -> List[int]:
        if len(data) <= 1: return data
        pivot = data[len(data) // 2]
        left  = [x for x in data if x < pivot]
        mid   = [x for x in data if x == pivot]
        right = [x for x in data if x > pivot]
        return self.sort(left) + mid + self.sort(right)

class TimSort:
    def sort(self, data: List[int]) -> List[int]:
        return sorted(data)  # Python's built-in timsort

class Sorter:
    def __init__(self, strategy: SortStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: SortStrategy) -> None:
        self._strategy = strategy

    def sort(self, data: List[int]) -> List[int]:
        return self._strategy.sort(data)

# Switch strategy without changing Sorter
sorter = Sorter(QuickSort())
result = sorter.sort([3, 1, 4, 1, 5, 9])

sorter.set_strategy(TimSort())
result = sorter.sort([3, 1, 4, 1, 5, 9])
```

**Use when:** Multiple algorithms for the same task; algorithm selection at runtime.
**Avoid when:** Only one algorithm exists, or `if/elif` is simpler and not growing.

---

### Decorator -- Add behavior without subclassing

```python
from functools import wraps
import time, logging

# Function decorator (most common Python usage)
def retry(max_attempts: int = 3, delay: float = 1.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_err = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_err = e
                    if attempt < max_attempts - 1:
                        time.sleep(delay * (2 ** attempt))  # exponential backoff
            raise last_err
        return wrapper
    return decorator

def log_calls(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        logging.info(f"Calling {func.__name__}")
        result = func(*args, **kwargs)
        logging.info(f"{func.__name__} returned {result!r}")
        return result
    return wrapper

# Stack decorators -- applied bottom-up
@retry(max_attempts=3, delay=0.5)
@log_calls
def fetch_user(user_id: int) -> dict:
    return requests.get(f"/api/users/{user_id}").json()
```

**Use when:** Cross-cutting concerns (logging, retry, caching, auth) added to functions.
**Avoid when:** Too many decorators stack up and order becomes confusing.

---

### Facade -- Simplified interface to a complex subsystem

```python
class PaymentFacade:
    """Hides complexity of fraud check + payment processing + receipt."""

    def __init__(self):
        self._fraud    = FraudDetectionService()
        self._gateway  = PaymentGateway()
        self._receipts = ReceiptService()
        self._ledger   = AccountingLedger()

    def charge(self, user_id: int, amount_cents: int, card_token: str) -> dict:
        # Client calls one method; facade orchestrates the subsystem
        fraud_result = self._fraud.check(user_id, amount_cents)
        if not fraud_result.approved:
            raise PaymentDeclinedError(f"Fraud check failed: {fraud_result.reason}")

        charge = self._gateway.charge(card_token, amount_cents)
        self._ledger.record(charge)
        receipt = self._receipts.generate(charge)
        return {"charge_id": charge.id, "receipt_url": receipt.url}

# Caller sees one simple method
facade = PaymentFacade()
result = facade.charge(user_id=42, amount_cents=9900, card_token="tok_xxx")
```

**Use when:** Subsystem is complex; want a simple entry point for clients.
**Avoid when:** Facade becomes a God object that does everything.

## Pattern Selection Guide

| Problem | Pattern |
|---------|---------|
| Need exactly one instance | Singleton (or module-level variable) |
| Create object based on runtime config | Factory Method |
| Object has many optional fields | Builder |
| One change notifies many listeners | Observer |
| Swap algorithms at runtime | Strategy |
| Add cross-cutting behavior without subclassing | Decorator |
| Simplify a complex subsystem | Facade |
| Make incompatible interfaces work together | Adapter |
| Expensive object creation | Prototype |
| Tree structures (UI, file systems) | Composite |

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Pattern fetishism | Using a pattern because it sounds impressive | Only use patterns that solve a real problem you have now |
| Premature abstraction | Adding Factory before there is more than one type | YAGNI -- add the pattern when the second case appears |
| Singleton overuse | Everything is a singleton; hidden global state | Prefer dependency injection; pass dependencies explicitly |
| Observer hell | 20 subscribers; impossible to trace what fires what | Use structured logging; limit subscribers per event |
| Decorator overstack | 6 decorators on one function; order matters subtly | Extract into a named wrapper function instead |

## Rules

- **Name the pattern in the code** -- a comment `# Observer pattern` tells the next engineer your intent.
- **Prefer composition over inheritance** -- most structural patterns are composition-based for a reason.
- **Apply patterns to existing problems, not anticipated ones** -- do not add Factory until you have two types.
- **Test through the interface, not the implementation** -- the pattern should be an invisible implementation detail.
- **Simpler code beats elegant pattern** -- if `if/elif` does the job, use it.
- **Python has built-in pattern support** -- decorators, generators, context managers often replace classic patterns.
- **Document the trade-off** -- every pattern adds indirection; note why the trade-off was worth it.
- **Singleton is a code smell at scale** -- makes testing hard; use DI containers instead.
- **Factory registry beats long if/elif chains** -- maintain a dict mapping keys to classes.
- **Observer needs error isolation** -- one failing subscriber must not prevent others from being notified.
