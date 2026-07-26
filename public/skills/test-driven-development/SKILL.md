---
name: test-driven-development
description: Apply Test-Driven Development (TDD) to design and build production code. Outputs test suites, refactored implementations, and coverage strategies using the Red-Green-Refactor cycle.
argument-hint: [feature to implement, programming language, test framework, existing test coverage]
allowed-tools: Read, Write, Bash
---

# Test-Driven Development (TDD)

TDD is a development discipline, not a testing technique. Write a failing test, write just enough code to pass it, refactor. The tests drive the design — they force you to write code that is modular, testable, and decoupled before it becomes entangled.

**Use TDD when:** implementing new features, fixing bugs (write a failing test that reproduces the bug first), or refactoring complex logic that needs a safety net.

**Don't TDD:** exploratory spike code, UI layout, third-party integration glue code (use integration tests instead), or infrastructure configuration.

## The Red-Green-Refactor Cycle

```
    ┌──────────────────────────────────────────┐
    │                                          │
    ▼                                          │
  RED ──── Write smallest failing test         │
    │      that specifies desired behaviour    │
    │                                          │
    ▼                                          │
 GREEN ─── Write minimum code to pass.         │
    │      Hardcode if needed. Just pass.      │
    │                                          │
    ▼                                          │
REFACTOR ─ Clean up. No new behaviour.  ───────┘
           Tests must stay green.
```

**Cycle time target:** 2–5 minutes per red-green-refactor. If a cycle takes longer, the test is too large — break it down.

## Process

1. **Understand the requirement.** Write it as a list of concrete behaviours, not implementation steps. "Given X, when Y, then Z."
2. **Pick the smallest behaviour.** Start with the simplest case, often the happy path or an edge case that exposes the core logic.
3. **Write a failing test.** Run it. Confirm it fails for the right reason (assertion failure, not compilation error).
4. **Write the minimum implementation.** Resist over-engineering. Hardcoding return values to pass is legitimate in early cycles — the next test will force generalisation.
5. **Run all tests.** New test passes. Existing tests still pass.
6. **Refactor.** Extract duplication, improve names, simplify logic. Run tests after every change.
7. **Repeat.** Next smallest failing test. Let the test list grow as you discover cases.

## Test Structure — GIVEN / WHEN / THEN

```python
# Python + pytest

def test_given_empty_cart_when_item_added_then_total_reflects_item_price():
    # GIVEN
    cart = ShoppingCart()
    item = Item(name="Widget", price=Decimal("9.99"))
    
    # WHEN
    cart.add(item, quantity=2)
    
    # THEN
    assert cart.total == Decimal("19.98")
```

```typescript
// TypeScript + Jest

describe('ShoppingCart', () => {
  describe('when adding items', () => {
    it('calculates total for a single item', () => {
      // Given
      const cart = new ShoppingCart();
      const item = new Item({ name: 'Widget', price: 9.99 });
      
      // When
      cart.add(item, { quantity: 2 });
      
      // Then
      expect(cart.total).toBe(19.98);
    });
  });
});
```

## Worked Example: Password Validator

Full TDD session from scratch.

### Step 1: Write test list (before any code)
```
Behaviours to implement:
- [ ] Password of 8+ chars is valid
- [ ] Password under 8 chars is invalid
- [ ] Password with no uppercase is invalid  
- [ ] Password with no number is invalid
- [ ] Password with no special char is invalid
- [ ] Empty string is invalid
- [ ] All rules passing returns valid with no errors
- [ ] Multiple failures reported together, not just first
```

### Step 2: First failing test — minimum case
```python
# test_password_validator.py

def test_short_password_is_invalid():
    result = validate_password("abc123")
    assert result.is_valid is False
```

Run: `FAILED — NameError: name 'validate_password' is not defined` ✓ (fails for right reason)

### Step 3: Minimum code to pass
```python
# password_validator.py

def validate_password(password: str):
    class Result:
        is_valid = False
    return Result()
```

Run: `PASSED` ✓

### Step 4: Next test forces real logic
```python
def test_password_8_chars_with_requirements_is_valid():
    result = validate_password("Secure1!")
    assert result.is_valid is True
```

Run: `FAILED — is_valid is False` ✓

### Step 5: Generalise implementation
```python
from dataclasses import dataclass, field
from typing import List
import re

@dataclass
class ValidationResult:
    errors: List[str] = field(default_factory=list)
    
    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

def validate_password(password: str) -> ValidationResult:
    result = ValidationResult()
    
    if len(password) < 8:
        result.errors.append("Must be at least 8 characters")
    
    if not re.search(r'[A-Z]', password):
        result.errors.append("Must contain at least one uppercase letter")
    
    if not re.search(r'\d', password):
        result.errors.append("Must contain at least one number")
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        result.errors.append("Must contain at least one special character")
    
    return result
```

Run all tests: `PASSED` ✓

### Step 6: Add edge cases from test list
```python
def test_empty_password_is_invalid():
    result = validate_password("")
    assert result.is_valid is False

def test_multiple_failures_all_reported():
    result = validate_password("abc")
    assert "at least 8 characters" in result.errors[0]
    assert len(result.errors) >= 3  # short + no upper + no special

def test_returns_no_errors_when_valid():
    result = validate_password("Secure1!")
    assert result.errors == []
```

### Step 7: Refactor — extract constants, improve readability
```python
MIN_LENGTH = 8
SPECIAL_CHARS = r'[!@#$%^&*(),.?":{}|<>]'

RULES = [
    (lambda p: len(p) >= MIN_LENGTH,          "Must be at least 8 characters"),
    (lambda p: bool(re.search(r'[A-Z]', p)),  "Must contain at least one uppercase letter"),
    (lambda p: bool(re.search(r'\d', p)),     "Must contain at least one number"),
    (lambda p: bool(re.search(SPECIAL_CHARS, p)), "Must contain at least one special character"),
]

def validate_password(password: str) -> ValidationResult:
    result = ValidationResult()
    for rule_passes, error_message in RULES:
        if not rule_passes(password):
            result.errors.append(error_message)
    return result
```

All tests still pass. Cleaner design emerged from TDD pressure.

## Test Doubles — When to Use Each

| Double | What it is | When to use |
|--------|-----------|-------------|
| **Stub** | Returns canned values | Isolate from slow/external dependencies |
| **Mock** | Verifies interactions were called | Assert side effects (email sent, DB written) |
| **Spy** | Records calls, real implementation runs | Partial verification without full mock |
| **Fake** | Lightweight real implementation | In-memory DB, local file system |
| **Dummy** | Placeholder, never used | Fill required parameters |

```python
# Stub — return controlled value
class StubEmailService:
    def send(self, to, subject, body): 
        return True  # always succeeds

# Mock — verify behaviour
from unittest.mock import MagicMock

def test_confirmation_email_sent_on_registration():
    email_service = MagicMock()
    user_service = UserService(email_service=email_service)
    
    user_service.register("user@example.com", "SecurePass1!")
    
    email_service.send.assert_called_once_with(
        to="user@example.com",
        subject="Welcome!",
        body=unittest.mock.ANY
    )

# Fake — in-memory implementation for tests
class InMemoryUserRepository:
    def __init__(self):
        self._store = {}
    
    def save(self, user): 
        self._store[user.id] = user
    
    def get(self, user_id): 
        return self._store.get(user_id)
    
    def exists_by_email(self, email):
        return any(u.email == email for u in self._store.values())
```

## TDD Patterns

### Triangulation — force generalisation with multiple examples
```python
# One test could be satisfied by hardcoding
def test_add_1_plus_1():
    assert add(1, 1) == 2

# Add a second — forces real implementation
def test_add_2_plus_3():
    assert add(2, 3) == 5

# Now hardcoding is impossible — real add() must exist
```

### Obvious Implementation vs Fake It
```python
# "Fake it till you make it" — hardcode to pass first test
def add(a, b):
    return 2  # passes test_add_1_plus_1

# After triangulation — obvious implementation
def add(a, b):
    return a + b
```

### Test One Thing
```python
# BAD — tests multiple behaviours, hard to diagnose failures
def test_user_registration():
    user = register("user@test.com", "Pass1!")
    assert user.id is not None
    assert user.email == "user@test.com"
    assert user.is_email_verified is False
    assert email_service.send.called
    assert db.find(user.id) is not None

# GOOD — separate tests, each tests one behaviour
def test_registration_generates_user_id():
    user = register("user@test.com", "Pass1!")
    assert user.id is not None

def test_registration_stores_email():
    user = register("user@test.com", "Pass1!")
    assert user.email == "user@test.com"

def test_registration_sends_confirmation_email():
    register("user@test.com", "Pass1!")
    assert email_service.send.called
```

## Test File Structure

```
project/
├── src/
│   ├── domain/
│   │   ├── order.py
│   │   └── pricing.py
│   └── services/
│       └── checkout.py
└── tests/
    ├── unit/                  # Fast, no I/O, one class at a time
    │   ├── domain/
    │   │   ├── test_order.py
    │   │   └── test_pricing.py
    │   └── services/
    │       └── test_checkout.py
    ├── integration/           # Real DB, real services, slower
    │   └── test_checkout_flow.py
    └── conftest.py            # Shared fixtures, fakes
```

```python
# conftest.py — shared test infrastructure
import pytest
from tests.fakes import InMemoryOrderRepository, FakeEmailService

@pytest.fixture
def order_repo():
    return InMemoryOrderRepository()

@pytest.fixture
def email_service():
    return FakeEmailService()

@pytest.fixture
def checkout_service(order_repo, email_service):
    return CheckoutService(
        order_repo=order_repo,
        email_service=email_service
    )
```

## Coverage Strategy

```bash
# Python — run with coverage
pytest --cov=src --cov-report=term-missing --cov-fail-under=80

# JavaScript — Jest
jest --coverage --coverageThreshold='{"global":{"lines":80}}'

# What to target
# - Core domain logic: 90%+
# - Service layer: 80%+
# - Infrastructure/adapters: integration tests, not unit tests
# - UI components: snapshot + interaction tests
# - Generated code: exclude from coverage
```

**Coverage is a floor, not a ceiling.** 100% coverage with bad tests is worse than 80% with excellent tests. Measure branch coverage, not just line coverage.

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Test after** | Code is untestable by design; tests verify implementation not behaviour | Write tests first, always |
| **Testing implementation** | Tests break on refactor even when behaviour is correct | Test public API and observable behaviour |
| **Too-large tests** | Slow cycles, hard to diagnose, tests too much at once | Each test: one behaviour, one assertion (or closely related set) |
| **Mocking everything** | Tests are tightly coupled to internal structure | Mock at the boundary (I/O, external services), use fakes for repositories |
| **Ignoring the refactor step** | Accumulated duplication, poor names, messy code | Refactor is mandatory, not optional |
| **Skipping the test list** | Missing cases discovered late | Write the full test list before starting |
| **Integration tests for unit logic** | Slow feedback loop, hard to isolate failures | Use unit tests for logic, integration tests for wiring |
| **Brittle assertions** | `assert result == "<html>...exact string..."` | Assert semantic properties, not serialized output |

## 10 Rules

1. Never write production code without a failing test. No exceptions.
2. Write only enough test to make it fail. One assertion per test cycle.
3. Write only enough production code to pass the failing test.
4. Refactor relentlessly. If it's ugly after going green, it stays ugly forever.
5. Test behaviour, not implementation. A passing refactor means tests stay green.
6. Keep tests fast. If a test suite takes more than 10 seconds, something is wrong.
7. Treat test code with the same care as production code. It rots too.
8. One fake/stub/mock per test boundary. Real logic everywhere else.
9. A test that can never fail has no value. Verify it fails before making it pass.
10. The test list is the design. Writing it reveals missing requirements before a line of code is written.
