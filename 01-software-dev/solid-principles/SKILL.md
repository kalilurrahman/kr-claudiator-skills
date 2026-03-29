---
name: solid-principles
description: Apply SOLID principles to write maintainable, extensible object-oriented code. Outputs principle-by-principle analysis, refactoring examples, and design decision guidelines.
argument-hint: [codebase language, identified violations, team OOP experience level]
allowed-tools: Read, Write
---

# SOLID Principles

SOLID is five design principles that make object-oriented code easier to understand, extend, and maintain. Each principle targets a specific category of design rot: rigidity, fragility, immobility, viscosity, and needless complexity.

## S — Single Responsibility Principle

A class should have one reason to change. One responsibility, one axis of change.

```python
# BAD — UserService has too many responsibilities
class UserService:
    def create_user(self, data): ...
    def send_welcome_email(self, user): ...     # Email concern
    def generate_report(self, users): ...       # Reporting concern
    def hash_password(self, password): ...      # Security concern
    def export_to_csv(self, users): ...         # Export concern

# GOOD — each class has one job
class UserService:
    def __init__(self, user_repo, email_service):
        self._repo = user_repo
        self._email = email_service

    def create(self, data: dict) -> User:
        user = User(**data)
        self._repo.save(user)
        self._email.send_welcome(user)
        return user

class EmailService:
    def send_welcome(self, user: User): ...

class UserReportGenerator:
    def generate(self, users: list[User]) -> Report: ...

class PasswordHasher:
    def hash(self, plain: str) -> str: ...
```

## O — Open/Closed Principle

Open for extension, closed for modification. Add new behaviour without changing existing code.

```python
# BAD — must modify existing code to add new discount types
class OrderPricer:
    def calculate(self, order, discount_type: str) -> float:
        if discount_type == "percentage":
            return order.total * 0.9
        elif discount_type == "fixed":
            return order.total - 10
        elif discount_type == "bogo":          # Must modify class each time
            return order.total * 0.5

# GOOD — add new discount types without touching OrderPricer
from abc import ABC, abstractmethod

class DiscountStrategy(ABC):
    @abstractmethod
    def apply(self, total: float) -> float: ...

class PercentageDiscount(DiscountStrategy):
    def __init__(self, pct: float): self._pct = pct
    def apply(self, total: float) -> float: return total * (1 - self._pct)

class FixedDiscount(DiscountStrategy):
    def __init__(self, amount: float): self._amount = amount
    def apply(self, total: float) -> float: return total - self._amount

class BuyOneGetOne(DiscountStrategy):
    def apply(self, total: float) -> float: return total * 0.5

class OrderPricer:
    def calculate(self, order, discount: DiscountStrategy) -> float:
        return discount.apply(order.total)   # Never changes
```

## L — Liskov Substitution Principle

Subtypes must be substitutable for their base types without altering program correctness.

```python
# BAD — Square breaks Rectangle contract (classic violation)
class Rectangle:
    def set_width(self, w): self.width = w
    def set_height(self, h): self.height = h
    def area(self) -> float: return self.width * self.height

class Square(Rectangle):
    def set_width(self, w):
        self.width = w
        self.height = w   # Breaks: caller expects independent dimensions

def resize(rect: Rectangle):
    rect.set_width(5)
    rect.set_height(10)
    assert rect.area() == 50   # Fails for Square!

# GOOD — separate abstractions
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Rectangle(Shape):
    def __init__(self, w, h): self.width = w; self.height = h
    def area(self): return self.width * self.height

class Square(Shape):
    def __init__(self, side): self.side = side
    def area(self): return self.side ** 2
```

## I — Interface Segregation Principle

Clients should not depend on interfaces they don't use. Prefer small, focused interfaces.

```python
# BAD — fat interface forces all implementors to implement unused methods
class Worker(ABC):
    @abstractmethod
    def work(self): ...
    @abstractmethod
    def eat(self): ...     # Robots don't eat!
    @abstractmethod
    def sleep(self): ...   # Robots don't sleep!

class Robot(Worker):
    def work(self): ...
    def eat(self): raise NotImplementedError   # Forced to implement nonsense
    def sleep(self): raise NotImplementedError

# GOOD — segregated interfaces
class Workable(ABC):
    @abstractmethod
    def work(self): ...

class Eatable(ABC):
    @abstractmethod
    def eat(self): ...

class HumanWorker(Workable, Eatable):
    def work(self): ...
    def eat(self): ...

class RobotWorker(Workable):
    def work(self): ...   # Only implements what it needs
```

## D — Dependency Inversion Principle

High-level modules should not depend on low-level modules. Both should depend on abstractions.

```python
# BAD — high-level OrderProcessor depends on concrete MySQLRepository
class OrderProcessor:
    def __init__(self):
        self._repo = MySQLOrderRepository()   # Concrete dependency — hard to test, swap

    def process(self, order_id: str):
        order = self._repo.get(order_id)      # Tied to MySQL forever

# GOOD — depend on abstraction
class OrderRepository(ABC):
    @abstractmethod
    def get(self, order_id: str) -> Order: ...
    @abstractmethod
    def save(self, order: Order): ...

class OrderProcessor:
    def __init__(self, repo: OrderRepository):  # Depends on abstraction
        self._repo = repo

    def process(self, order_id: str):
        order = self._repo.get(order_id)

# Inject any implementation
class MySQLOrderRepository(OrderRepository):
    def get(self, order_id): ...

class InMemoryOrderRepository(OrderRepository):  # For tests
    def get(self, order_id): ...

# Production
processor = OrderProcessor(MySQLOrderRepository())

# Test
processor = OrderProcessor(InMemoryOrderRepository())
```

## Anti-Patterns to Avoid

| Principle | Violation | Fix |
|---|---|---|
| SRP | God class with 20+ methods | Extract into focused collaborators |
| OCP | Long if/elif chains for type dispatch | Strategy or visitor pattern |
| LSP | Subclass throws NotImplementedError | Restructure hierarchy; use composition |
| ISP | Interface with 10+ methods | Split into role-specific interfaces |
| DIP | `new ConcreteClass()` inside business logic | Constructor injection; depend on ABC |

## 10 Rules

1. A class that needs to import from 5+ modules to function is violating SRP.
2. If adding a feature requires editing existing code (not just adding new code), OCP is being violated.
3. If a unit test needs to set up 10 things to test one thing, DIP is probably violated.
4. LSP: if you ever check `isinstance(x, SubClass)` in the base class logic, LSP is broken.
5. ISP: interfaces with "does not apply" methods in implementations need splitting.
6. DIP makes testing possible — you can inject test doubles without monkeypatching.
7. SOLID is a spectrum, not a binary — apply judgment; over-engineering is also a failure mode.
8. Apply OCP to the most likely change axes — not every possible extension.
9. Small interfaces (2-3 methods) are almost always better than large ones.
10. SOLID principles work together — DIP without ISP leads to bloated injected interfaces.
