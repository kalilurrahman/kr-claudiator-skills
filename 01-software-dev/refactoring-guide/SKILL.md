---
name: refactoring-guide
description: Safely refactor existing code to improve structure, readability, and maintainability without changing behavior. Covers detection of code smells, refactoring techniques, safe execution steps, and validation.
argument-hint: [code smell type, language, test coverage level, risk tolerance]
allowed-tools: Read, Write, Bash
---

# Refactoring Guide

Refactoring is the discipline of improving code structure without changing its external behavior. The key word is safe -- every refactoring step must leave the code working. The mantra is: make it work, make it right, make it fast -- in that order.

## Code Smells and Their Refactorings

| Code smell | Signs | Refactoring |
|-----------|-------|-------------|
| Long method | > 40 lines; does multiple things | Extract Method |
| God class | > 500 lines; knows everything | Extract Class, Move Method |
| Long parameter list | > 4 parameters | Introduce Parameter Object |
| Duplicate code | Same logic in 2+ places | Extract Method / Extract Class |
| Dead code | Unused variables, functions | Remove Dead Code |
| Primitive obsession | Using int/string for domain concepts | Replace Primitive with Object |
| Feature envy | Method uses another class's data more than its own | Move Method |
| Data clumps | Same 3 fields always appear together | Extract Class |
| Shotgun surgery | One change requires edits in many places | Move Method, Inline Class |
| Divergent change | One class changes for different reasons | Extract Class |
| Speculative generality | Unused abstractions added "just in case" | Collapse Hierarchy |

## Process

1. **Ensure test coverage first** -- refactoring without tests is rearranging deck chairs on the Titanic.
2. **Identify the smell** -- name the specific code smell before choosing a refactoring.
3. **One refactoring at a time** -- do not mix multiple refactorings in one commit.
4. **Red-green-refactor cycle** -- tests pass → refactor → tests still pass → commit.
5. **Commit at every stable point** -- small commits make bisecting easy.
6. **Use automated refactoring tools** -- IDE rename/extract is safer than manual editing.
7. **Review diffs carefully** -- even automated refactorings can introduce subtle bugs.
8. **Do not change behavior** -- if tests break, you changed behavior, not just structure.
9. **Measure before and after** -- complexity metrics, test coverage, build time.
10. **Update documentation** -- docstrings and comments often outlive the code they describe.

## Core Refactoring Techniques

### Extract Method -- Break up long functions

```python
# BEFORE: one long method doing multiple things
def process_order(order_id: int) -> dict:
    # Validate
    order = db.get(order_id)
    if not order:
        raise ValueError(f"Order {order_id} not found")
    if order['status'] != 'pending':
        raise ValueError(f"Order {order_id} is not pending")
    if order['total'] <= 0:
        raise ValueError("Order total must be positive")

    # Calculate tax
    if order['country'] == 'US':
        tax = order['subtotal'] * 0.08
    elif order['country'] == 'GB':
        tax = order['subtotal'] * 0.20
    else:
        tax = order['subtotal'] * 0.15
    order['tax'] = tax
    order['total'] = order['subtotal'] + tax

    # Charge payment
    charge = payment_gateway.charge(order['card_token'], order['total'])
    if not charge['success']:
        raise PaymentError(charge['error'])

    # Update status
    db.update(order_id, {'status': 'paid', 'charge_id': charge['id']})
    email_service.send_receipt(order['email'], order)
    return order

# AFTER: extracted methods, each with one responsibility
def process_order(order_id: int) -> dict:
    order = _load_and_validate_order(order_id)
    order = _apply_tax(order)
    charge = _charge_payment(order)
    return _finalize_order(order, charge)

def _load_and_validate_order(order_id: int) -> dict:
    order = db.get(order_id)
    if not order:
        raise ValueError(f"Order {order_id} not found")
    if order['status'] != 'pending':
        raise ValueError(f"Order {order_id} is not pending")
    if order['total'] <= 0:
        raise ValueError("Order total must be positive")
    return order

TAX_RATES = {'US': 0.08, 'GB': 0.20}

def _apply_tax(order: dict) -> dict:
    rate = TAX_RATES.get(order['country'], 0.15)
    order['tax']   = order['subtotal'] * rate
    order['total'] = order['subtotal'] + order['tax']
    return order

def _charge_payment(order: dict) -> dict:
    charge = payment_gateway.charge(order['card_token'], order['total'])
    if not charge['success']:
        raise PaymentError(charge['error'])
    return charge

def _finalize_order(order: dict, charge: dict) -> dict:
    db.update(order['id'], {'status': 'paid', 'charge_id': charge['id']})
    email_service.send_receipt(order['email'], order)
    return order
```

### Replace Conditional with Polymorphism

```python
# BEFORE: type-switching anti-pattern
def calculate_area(shape: dict) -> float:
    if shape['type'] == 'circle':
        return 3.14159 * shape['radius'] ** 2
    elif shape['type'] == 'rectangle':
        return shape['width'] * shape['height']
    elif shape['type'] == 'triangle':
        return 0.5 * shape['base'] * shape['height']
    else:
        raise ValueError(f"Unknown shape: {shape['type']}")

# AFTER: polymorphism -- adding new shapes requires no changes to existing code
from abc import ABC, abstractmethod
import math

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Circle(Shape):
    def __init__(self, radius: float): self.radius = radius
    def area(self) -> float: return math.pi * self.radius ** 2

class Rectangle(Shape):
    def __init__(self, width: float, height: float):
        self.width, self.height = width, height
    def area(self) -> float: return self.width * self.height

class Triangle(Shape):
    def __init__(self, base: float, height: float):
        self.base, self.height = base, height
    def area(self) -> float: return 0.5 * self.base * self.height
```

### Replace Primitive with Value Object

```python
# BEFORE: primitives represent domain concepts
def create_user(email: str, age: int, country_code: str):
    if '@' not in email:
        raise ValueError("Invalid email")
    if age < 0 or age > 150:
        raise ValueError("Invalid age")
    if len(country_code) != 2:
        raise ValueError("Invalid country code")
    ...

# AFTER: domain types encapsulate validation
from dataclasses import dataclass
import re

@dataclass(frozen=True)  # immutable value object
class Email:
    value: str
    def __post_init__(self):
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', self.value):
            raise ValueError(f"Invalid email: {self.value!r}")
    def __str__(self): return self.value

@dataclass(frozen=True)
class CountryCode:
    value: str
    def __post_init__(self):
        if not re.match(r'^[A-Z]{2}$', self.value.upper()):
            raise ValueError(f"Invalid country code: {self.value!r}")
    def __str__(self): return self.value.upper()

def create_user(email: Email, age: int, country_code: CountryCode):
    # No validation needed here -- types guarantee correctness
    ...
```

### Strangler Fig -- Incremental replacement of a legacy system

```python
# Legacy endpoint still exists; new implementation grows alongside it
# Route traffic progressively from old to new

# Phase 1: New code behind a feature flag
@app.route('/api/orders', methods=['POST'])
def create_order():
    if feature_flags.is_enabled('new_order_service', request.user_id):
        return new_order_service.create(request.json)  # new path
    return legacy_order_handler(request.json)           # old path

# Phase 2: New code handles 50% of traffic
# Phase 3: New code handles 100%; old code removed
# Phase 4: Strangler route removed; only new code remains

# Key principle: old and new code coexist until new is proven;
# rollback is always possible by changing the flag
```

### Introduce Parameter Object

```python
# BEFORE: long parameter list
def send_email(
    to_address: str,
    from_address: str,
    subject: str,
    body: str,
    cc: list = None,
    bcc: list = None,
    reply_to: str = None,
    html: bool = False,
):
    ...

# AFTER: parameter object groups related data
@dataclass
class EmailMessage:
    to: str
    subject: str
    body: str
    from_address: str = "noreply@example.com"
    cc: list = field(default_factory=list)
    bcc: list = field(default_factory=list)
    reply_to: str = None
    html: bool = False

def send_email(message: EmailMessage) -> None:
    ...

# Callers are clearer
send_email(EmailMessage(
    to="user@example.com",
    subject="Your order shipped",
    body="Track your order at...",
    html=True,
))
```

## Safe Refactoring Checklist

Before starting:
- [ ] Tests exist and pass (target: > 70% coverage of code being changed)
- [ ] Understand the current behavior (read tests if code is unclear)
- [ ] Identify ONE smell to address
- [ ] Create a branch; first commit is baseline with tests passing

During:
- [ ] One refactoring technique per commit
- [ ] Tests pass after every commit
- [ ] No behavior changes (API contracts unchanged)
- [ ] IDE rename/extract used where possible (safer than manual)

After:
- [ ] Run full test suite
- [ ] Review diff -- look for accidental logic changes
- [ ] Update docstrings and comments
- [ ] Check complexity metrics improved

## Metrics to Track

```bash
# Python: cyclomatic complexity
radon cc src/ -a          # average complexity (target: < 10)
radon mi src/             # maintainability index (target: > 20)

# JavaScript: complexity
npx eslint --rule '{"complexity": ["error", 10]}' src/

# Lines per function
awk '/def |function /{fn=$0; count=0} /}|^$/{if(count>40) print count, fn; count++} /./{count++}' src/*.py

# Code duplication
jscpd src/ --threshold 5  # JS/TS
pylint src/ --disable=all --enable=duplicate-code
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Refactor without tests | No way to verify behavior preserved | Write characterization tests first |
| Big-bang refactor | Huge PR impossible to review or roll back | Small incremental steps |
| Renaming as refactoring | Name change is not a structural improvement | Rename is fine but do not call it refactoring |
| Mixing refactor with feature | Diffs are impossible to review | Separate PRs: refactor first, then feature |
| Over-engineering the refactor | Simple code replaced with complex abstractions | Simpler is better; YAGNI |

## Rules

- **Tests first, refactoring second** -- without tests, refactoring is guessing.
- **One smell, one technique, one commit** -- atomic refactoring steps are safe; compound steps are risky.
- **Use IDE tools** -- automated rename and extract are faster and safer than manual edits.
- **Never change behavior in a refactoring commit** -- if tests break, stop and revert.
- **Small PRs, frequent merges** -- a refactoring PR > 400 lines is too large to review safely.
- **The boy scout rule** -- leave code cleaner than you found it; small improvements compound.
- **Strangler fig for legacy systems** -- never rewrite; strangle incrementally.
- **Measure complexity before and after** -- if complexity did not decrease, the refactoring may not have helped.
- **Separate refactor from feature** -- never mix structural changes and behavior changes in one commit.
- **Document the smell you fixed** -- a comment or commit message like "Extract method: split validate/calculate/persist" is invaluable.
