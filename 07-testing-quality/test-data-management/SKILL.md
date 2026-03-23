---
name: test-data-management
description: Design and implement a test data strategy that provides consistent, realistic, and isolated data for all test levels. Covers factories, fixtures, seeding, anonymisation, synthetic data, and database-per-test patterns.
argument-hint: [test types, database technology, PII sensitivity, team size, CI setup]
allowed-tools: Read, Write, Bash
---

# Test Data Management

Bad test data is the leading cause of flaky tests. Tests that share mutable state, rely on production data snapshots, or hard-code IDs that drift over time are fragile, slow to debug, and actively harmful. Good test data management gives each test the precise data it needs, in a known state, every time.

## Test Data Strategies by Test Level

| Level | Strategy | Isolation | Speed |
|-------|---------|-----------|-------|
| Unit tests | In-memory objects; no DB | Complete | Very fast |
| Integration tests | Factories + DB transaction rollback | Per-test | Fast |
| E2E tests | Seed scripts + DB reset between runs | Per-suite | Moderate |
| Performance tests | Large anonymised dataset; dedicated environment | Environment | Slow |
| Manual / exploratory | Seeded realistic dataset | Shared (careful) | N/A |

## Process

1. **Never use production data in tests** — even anonymised copies pose GDPR risk and create hard-to-reproduce failures.
2. **Build a factory library** — programmatic object creation with sensible defaults and easy overrides.
3. **Isolate tests with transactions** — wrap each integration test in a transaction; rollback at teardown.
4. **Use database-per-test for parallelism** — create a fresh schema per test worker; destroy after.
5. **Separate fixtures by scope** — global seed data (once per suite), local data (per test), dynamic data (factory-built).
6. **Anonymise production-like data** — generate realistic but fake data with Faker; never copy real PII.
7. **Version-control seed scripts** — seed scripts in the repo; applied as part of CI setup.
8. **Name test data clearly** — `user@example.com`, `test-order-12345`; identifiable as test data at a glance.
9. **Audit test data leakage** — periodically check non-production environments for real email addresses, phone numbers.
10. **Document the data model in tests** — tests are the best documentation of valid data states.

## Factory Pattern

```python
# tests/factories.py
import factory
from factory.django import DjangoModelFactory
from faker import Faker
from myapp.models import User, Order, Product

fake = Faker()

class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    # Sensible defaults — every field has a value; no test fails due to missing required fields
    email      = factory.LazyAttribute(lambda o: f"user-{fake.uuid4()[:8]}@example.com")
    name       = factory.LazyAttribute(lambda _: fake.name())
    status     = "active"
    created_at = factory.LazyFunction(datetime.utcnow)

    class Params:
        # Traits — apply a preset collection of fields
        inactive = factory.Trait(status="inactive")
        admin    = factory.Trait(is_staff=True, is_superuser=True)
        verified = factory.Trait(email_verified_at=factory.LazyFunction(datetime.utcnow))

class ProductFactory(DjangoModelFactory):
    class Meta:
        model = Product

    name     = factory.LazyAttribute(lambda _: fake.word().capitalize())
    price    = factory.LazyAttribute(lambda _: round(fake.pyfloat(min_value=1, max_value=999, right_digits=2), 2))
    sku      = factory.LazyAttribute(lambda _: f"SKU-{fake.uuid4()[:8].upper()}")
    in_stock = True

class OrderFactory(DjangoModelFactory):
    class Meta:
        model = Order

    user     = factory.SubFactory(UserFactory)    # creates a User automatically
    product  = factory.SubFactory(ProductFactory)
    quantity = 1
    status   = "pending"
    total    = factory.LazyAttribute(lambda o: o.product.price * o.quantity)

# Usage in tests
def test_order_discount_applied():
    product = ProductFactory(price=100.0)
    user    = UserFactory(status="premium")
    order   = OrderFactory(user=user, product=product, quantity=10)

    result = apply_discount(order)

    assert result.total == 90.0    # 10% discount for premium users

# Batch creation
def test_pagination():
    ProductFactory.create_batch(25, in_stock=True)
    ProductFactory.create_batch(5,  in_stock=False)

    result = list_products(page=1, per_page=20, in_stock_only=True)
    assert len(result.items) == 20
    assert result.total == 25
```

## TypeScript / Jest — Custom Factories

```typescript
// tests/factories/user.factory.ts
import { faker } from "@faker-js/faker";

interface User {
  id:          string;
  email:       string;
  name:        string;
  status:      "active" | "inactive" | "suspended";
  createdAt:   Date;
  permissions: string[];
}

type PartialUser = Partial<User>;

export function buildUser(overrides: PartialUser = {}): User {
  return {
    id:          faker.string.uuid(),
    email:       `user-${faker.string.alphanumeric(8)}@example.com`,
    name:        faker.person.fullName(),
    status:      "active",
    createdAt:   faker.date.past(),
    permissions: [],
    ...overrides,    // caller overrides only what they care about
  };
}

// Trait helpers — pre-baked variations
export const buildAdminUser   = (o: PartialUser = {}) => buildUser({ permissions: ["admin"], ...o });
export const buildSuspendedUser = (o: PartialUser = {}) => buildUser({ status: "suspended", ...o });

// Usage in test
it("blocks suspended users from checking out", () => {
  const user = buildSuspendedUser();
  expect(() => checkout(user, cart)).toThrow("Account suspended");
});
```

## Database Transaction Rollback (per-test isolation)

```python
# conftest.py — pytest
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture(scope="session")
def engine():
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope="session")
def tables(engine):
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture
def db_session(engine, tables):
    """Each test gets a clean transaction that is rolled back after the test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()

    yield session

    session.close()
    transaction.rollback()    # undo everything this test did
    connection.close()

# Tests are fully isolated — each sees only the data it creates
def test_create_user(db_session):
    user = UserFactory(session=db_session)
    assert db_session.query(User).count() == 1    # always 1, regardless of test order
```

```typescript
// Jest + Prisma — transaction rollback per test
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
});

beforeEach(async () => {
  // Truncate tables before each test — fast with small datasets
  await prisma.$transaction([
    prisma.order.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Synthetic Data Generation

```python
from faker import Faker
import random, json

fake = Faker()
Faker.seed(42)   # reproducible results; same seed = same data

def generate_order_dataset(n: int = 10_000) -> list[dict]:
    statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
    weights  = [0.1, 0.15, 0.2, 0.45, 0.1]   # realistic distribution

    return [
        {
            "id":           i,
            "user_id":      random.randint(1, 1000),
            "email":        fake.email(),           # realistic-looking but fake
            "total":        round(random.uniform(5, 500), 2),
            "status":       random.choices(statuses, weights=weights)[0],
            "items":        random.randint(1, 8),
            "created_at":   fake.date_time_this_year().isoformat(),
            "country_code": fake.country_code(),
        }
        for i in range(1, n + 1)
    ]

# Write to seed file
orders = generate_order_dataset(10_000)
with open("tests/fixtures/orders.json", "w") as f:
    json.dump(orders, f, indent=2)
```

## Seed Scripts for E2E Tests

```bash
#!/bin/bash
# tests/seed.sh — run before E2E test suite
# Creates a known state: 3 users, products, and a mix of orders

set -euo pipefail
DB="$TEST_DATABASE_URL"

echo "Clearing test data..."
psql "$DB" -c "TRUNCATE orders, products, users RESTART IDENTITY CASCADE;"

echo "Seeding users..."
psql "$DB" << 'SQL'
INSERT INTO users (email, name, status) VALUES
  ('admin@example.com',    'Test Admin',    'active'),
  ('customer@example.com', 'Test Customer', 'active'),
  ('inactive@example.com', 'Inactive User', 'inactive');
SQL

echo "Seeding products..."
psql "$DB" << 'SQL'
INSERT INTO products (name, price, sku, in_stock) VALUES
  ('Widget A', 29.99, 'SKU-001', true),
  ('Widget B', 49.99, 'SKU-002', true),
  ('Gadget X', 99.99, 'SKU-003', false);
SQL

echo "Seeding orders..."
psql "$DB" << 'SQL'
INSERT INTO orders (user_id, product_id, quantity, status, total) VALUES
  (2, 1, 2, 'delivered', 59.98),
  (2, 2, 1, 'pending',   49.99),
  (2, 1, 1, 'cancelled', 29.99);
SQL

echo "Seed complete."
```

## PII Anonymisation for Staging

```python
import re

def anonymise_user(user: dict) -> dict:
    """Replace real PII with realistic-looking but fake values."""
    fake = Faker()
    return {
        **user,
        "email":   f"user-{user['id']}@example.com",     # deterministic fake
        "name":    fake.name(),
        "phone":   fake.phone_number(),
        "address": fake.address(),
        "ip":      fake.ipv4_private(),
        # Preserve: id, created_at, status, plan_type (non-PII structural fields)
    }

def anonymise_production_dump(input_path: str, output_path: str) -> None:
    """Anonymise a production database dump for use in staging."""
    import json
    with open(input_path) as f:
        users = json.load(f)
    anonymised = [anonymise_user(u) for u in users]
    with open(output_path, "w") as f:
        json.dump(anonymised, f, indent=2)
    print(f"Anonymised {len(anonymised)} users → {output_path}")
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Shared mutable test database | Tests interfere with each other; flaky results | Transaction rollback or DB-per-test isolation |
| Hard-coded IDs in tests | IDs change; tests break on fresh databases | Use factory-built objects; reference by object, not by ID |
| Copying production data to test environments | GDPR risk; tests fail on data shape changes | Generate synthetic data with Faker |
| No factory library | Every test hand-builds objects differently; duplication everywhere | Centralised factory library with sensible defaults |
| God-seed scripts | Everyone depends on the same fragile global state | Minimal global seed; tests create their own specific data |
| Not cleaning up between E2E runs | State accumulates; tests fail non-deterministically | Truncate or rebuild schema before each E2E run |

## Rules

- **Never use real production data in tests** — not even anonymised copies without explicit PII review.
- **Every test must create the specific data it needs** — do not rely on data left by other tests.
- **Factories are the unit of test data creation** — centralise; all tests use the same factory with selective overrides.
- **Transaction rollback is the fastest isolation mechanism** — wrap integration tests in a transaction; rollback at teardown.
- **Name test data as test data** — `@example.com` emails, `SKU-TEST-` prefixes; never identifiable as real.
- **Sensible factory defaults mean minimal test setup** — a test should only set the fields that matter for that test.
- **Seed scripts are version-controlled** — treat them as source code; review changes; run them in CI.
- **Synthetic data must have realistic distributions** — `random.choice(["a", "b"])` 50/50 is not realistic; use weighted distributions.
- **PII anonymisation must be automated** — manual anonymisation is error-prone; script it and audit it.
- **Test data isolation enables parallelism** — isolated tests can run in parallel; shared-state tests cannot.
