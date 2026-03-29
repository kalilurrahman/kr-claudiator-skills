---
name: functional-programming
description: Apply functional programming principles to write predictable, testable code. Outputs pure function patterns, immutability strategies, composition pipelines, and FP-style refactoring examples.
argument-hint: [language, codebase style, team FP experience, areas to apply FP]
allowed-tools: Read, Write
---

# Functional Programming

Functional programming (FP) treats computation as the evaluation of mathematical functions. The core properties — pure functions, immutability, and function composition — make code easier to test, reason about, and parallelise. You don't need a functional language to apply FP principles; they improve code in any language.

## Core Principles

```
PURE FUNCTIONS
  Same inputs always produce same outputs
  No side effects (no mutation, no I/O, no state changes)
  Referentially transparent: can replace with its return value

IMMUTABILITY
  Data is never modified after creation
  Create new values instead of changing existing ones
  Prevents shared mutable state bugs

FUNCTION COMPOSITION
  Build complex behaviour from small, composable functions
  Data flows through a pipeline of transformations

HIGHER-ORDER FUNCTIONS
  Functions that take or return other functions
  map, filter, reduce, compose, curry
```

## Pure Functions

```python
# IMPURE — depends on external state, has side effects
total_discount = 0  # external state

def apply_discount(price: float, pct: float) -> float:
    global total_discount
    discount = price * pct
    total_discount += discount  # side effect: mutates global
    return price - discount

# PURE — same inputs, same output, no side effects
def apply_discount(price: float, pct: float) -> tuple[float, float]:
    discount = price * pct
    return price - discount, discount  # return everything the caller needs

# Track total at the call site, not inside the function
prices = [100.0, 200.0, 50.0]
discounted, discounts = zip(*[apply_discount(p, 0.10) for p in prices])
total_discount = sum(discounts)
```

## Immutability

```python
from dataclasses import dataclass, replace
from typing import FrozenSet

# MUTABLE — dangerous with shared references
class Order:
    def __init__(self, items, status):
        self.items = items      # mutable list
        self.status = status

def add_item(order, item):
    order.items.append(item)    # mutates in place — caller's order changes too!

# IMMUTABLE — safe with sharing
@dataclass(frozen=True)
class Order:
    items: tuple          # immutable tuple, not list
    status: str
    customer_id: str

def add_item(order: Order, item: str) -> Order:
    return replace(order, items=order.items + (item,))  # new Order

def confirm(order: Order) -> Order:
    return replace(order, status="confirmed")

# Chaining immutable transformations
order = Order(items=(), status="draft", customer_id="cust-1")
order = add_item(order, "widget")
order = add_item(order, "gadget")
order = confirm(order)
# Original order object unchanged
```

## Function Composition

```python
from functools import reduce
from typing import Callable, TypeVar

T = TypeVar("T")

def compose(*fns: Callable) -> Callable:
    """Right-to-left composition: compose(f, g, h)(x) == f(g(h(x)))"""
    return reduce(lambda f, g: lambda x: f(g(x)), fns)

def pipe(*fns: Callable) -> Callable:
    """Left-to-right composition: pipe(f, g, h)(x) == h(g(f(x)))"""
    return reduce(lambda f, g: lambda x: g(f(x)), fns)

# Pure transformation functions
def strip_whitespace(s: str) -> str: return s.strip()
def to_lowercase(s: str) -> str: return s.lower()
def remove_punctuation(s: str) -> str:
    import re; return re.sub(r'[^\w\s]', '', s)
def split_words(s: str) -> list[str]: return s.split()

# Compose a pipeline
normalize_text = pipe(
    strip_whitespace,
    to_lowercase,
    remove_punctuation,
    split_words,
)

result = normalize_text("  Hello, World!  ")  # ['hello', 'world']
```

## Higher-Order Functions

```python
from typing import Callable

# Partial application / currying
def multiply(x: float) -> Callable[[float], float]:
    return lambda y: x * y

double = multiply(2)
triple = multiply(3)

prices = [10.0, 20.0, 30.0]
doubled_prices = list(map(double, prices))   # [20.0, 40.0, 60.0]

# Decorator as higher-order function
def memoize(fn: Callable) -> Callable:
    cache = {}
    def wrapper(*args):
        if args not in cache:
            cache[args] = fn(*args)
        return cache[args]
    return wrapper

@memoize
def fibonacci(n: int) -> int:
    if n <= 1: return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# map / filter / reduce — the FP trinity
orders = [
    {"id": 1, "amount": 50.0,  "status": "paid"},
    {"id": 2, "amount": 120.0, "status": "paid"},
    {"id": 3, "amount": 30.0,  "status": "pending"},
    {"id": 4, "amount": 200.0, "status": "paid"},
]

total_paid = reduce(
    lambda acc, o: acc + o["amount"],
    filter(lambda o: o["status"] == "paid", orders),
    0.0
)  # 370.0
```

## Functors and Monads (Optional / Result Types)

```python
from typing import Generic, TypeVar, Callable, Optional
from dataclasses import dataclass

T = TypeVar("T")
E = TypeVar("E")
U = TypeVar("U")

@dataclass
class Result(Generic[T]):
    """
    Represent either a success value or an error.
    Eliminates try/except chains in pure functional code.
    """
    _value: Optional[T] = None
    _error: Optional[Exception] = None

    @classmethod
    def ok(cls, value: T) -> "Result[T]":
        return cls(_value=value)

    @classmethod
    def err(cls, error: Exception) -> "Result[T]":
        return cls(_error=error)

    @property
    def is_ok(self) -> bool:
        return self._error is None

    def map(self, fn: Callable[[T], U]) -> "Result[U]":
        """Apply fn to value if ok; propagate error otherwise."""
        if self.is_ok:
            try:
                return Result.ok(fn(self._value))
            except Exception as e:
                return Result.err(e)
        return Result.err(self._error)

    def flat_map(self, fn: Callable[[T], "Result[U]"]) -> "Result[U]":
        if self.is_ok:
            return fn(self._value)
        return Result.err(self._error)

    def unwrap(self, default: T = None) -> T:
        return self._value if self.is_ok else default

# Chain operations that might fail — no nested try/except
def parse_amount(s: str) -> Result[float]:
    try:
        return Result.ok(float(s))
    except ValueError:
        return Result.err(ValueError(f"Not a number: {s}"))

def validate_positive(amount: float) -> Result[float]:
    if amount > 0:
        return Result.ok(amount)
    return Result.err(ValueError("Amount must be positive"))

def apply_tax(amount: float) -> Result[float]:
    return Result.ok(amount * 1.1)

# Clean pipeline — no try/except
final = (parse_amount("49.99")
         .flat_map(validate_positive)
         .flat_map(apply_tax))

print(final.unwrap())  # 54.989

# Error propagates cleanly
bad = parse_amount("not-a-number").flat_map(validate_positive)
print(bad.is_ok)  # False
```

## Refactoring to FP Style

```python
# BEFORE — imperative, stateful
def process_orders(orders):
    results = []
    for order in orders:
        if order['status'] == 'paid':
            total = 0
            for item in order['items']:
                total += item['price'] * item['quantity']
            if total > 100:
                results.append({
                    'order_id': order['id'],
                    'total': total,
                    'discount': total * 0.1
                })
    return results

# AFTER — functional, composable
def calculate_total(order: dict) -> float:
    return sum(item['price'] * item['quantity'] for item in order['items'])

def is_paid(order: dict) -> bool:
    return order['status'] == 'paid'

def is_high_value(total: float) -> bool:
    return total > 100

def to_summary(order: dict, total: float) -> dict:
    return {'order_id': order['id'], 'total': total, 'discount': total * 0.1}

def process_orders(orders: list) -> list:
    paid_orders = filter(is_paid, orders)
    with_totals = ((o, calculate_total(o)) for o in paid_orders)
    high_value = ((o, t) for o, t in with_totals if is_high_value(t))
    return [to_summary(o, t) for o, t in high_value]
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Functions with hidden state** | Same input, different output — untestable | Move state to parameters or return values |
| **Mutating function arguments** | Callers' data changes unexpectedly | Return new values; use `copy()` or frozen types |
| **Overusing exceptions for control flow** | Exceptions are side effects | Use Result/Option types for expected failure cases |
| **Deep nesting instead of composition** | Hard to read, test each step separately | Extract named functions; compose them |
| **FP for everything** | I/O, databases, and UI are inherently imperative | Apply FP to pure business logic; accept imperative at boundaries |

## 10 Rules

1. Pure functions first — if a function can be pure, make it pure.
2. Immutable data by default — return new values instead of mutating.
3. Side effects at the boundaries — I/O, state, external calls belong at the edge of your system.
4. Small, named functions compose better than large anonymous lambdas.
5. map/filter/reduce over imperative loops for transformations.
6. Result/Option types eliminate try/except chains in pure logic.
7. Function composition creates readable pipelines without temporary variables.
8. Test pure functions in isolation — no mocks, no setup, just inputs and outputs.
9. Don't force FP on teams unfamiliar with it — introduce incrementally through pure functions.
10. FP and OOP coexist — use FP for transformations, OOP for modelling.
