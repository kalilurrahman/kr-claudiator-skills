---
name: database-schema
description: Design a relational database schema from requirements. Produces entity-relationship model, table definitions, indexes, constraints, and migration SQL with normalization analysis.
argument-hint: [domain entities, relationships, query patterns, database engine]
allowed-tools: Read, Write
---

# Database Schema Design

A schema is one of the hardest things to change after launch — every bad decision compounds. Good schema design front-loads the thinking: normalise correctly, index for your actual query patterns, and enforce constraints at the database layer.

## Design Process

1. **Identify entities** — the nouns in the domain: users, orders, products, invoices.
2. **Identify relationships** — one-to-many, many-to-many, one-to-one.
3. **Choose primary keys** — UUID vs. auto-increment (prefer UUID for distributed systems).
4. **Normalise to 3NF** — eliminate redundancy; denormalise deliberately only for performance.
5. **Define constraints** — NOT NULL, UNIQUE, CHECK, FOREIGN KEY — enforce at DB layer.
6. **Design indexes** — index foreign keys, index columns used in WHERE/JOIN/ORDER BY.
7. **Choose column types** — smallest type that fits; money as integer cents; timestamps as TIMESTAMPTZ.
8. **Write migration SQL** — idempotent, reversible, tested against staging.
9. **Validate with query patterns** — run EXPLAIN on your most critical queries.
10. **Document** — every table and non-obvious column gets a comment.

## Naming Conventions

```sql
-- Tables: snake_case, plural nouns
users, orders, order_items, payment_methods

-- Columns: snake_case
user_id, created_at, is_active, total_amount_cents

-- Primary keys: id (UUID)
-- Foreign keys: {table_singular}_id
-- Timestamps: created_at, updated_at, deleted_at
-- Booleans: is_{state} or has_{thing}
-- Amounts: {name}_amount_cents (never float)
```

## Column Type Reference

| Data | Type | Notes |
|------|------|-------|
| Primary key | UUID | `gen_random_uuid()` in Postgres |
| Foreign key | UUID | Matches PK type |
| Short text | VARCHAR(255) | With length constraint |
| Long text | TEXT | No length limit |
| Integer | INTEGER / BIGINT | BIGINT for large counters |
| Money | INTEGER | Store cents — never FLOAT or DECIMAL for money |
| Decimal | NUMERIC(10,2) | For non-money decimals |
| Boolean | BOOLEAN | NOT NULL DEFAULT false |
| Timestamp | TIMESTAMPTZ | Always with timezone |
| JSON | JSONB | Postgres — supports indexing |
| Enum | VARCHAR + CHECK | Or native ENUM type |
| IP address | INET | Postgres native |

## Output Format

```sql
-- ============================================================
-- Schema: [Domain Name]
-- Database: PostgreSQL 15+
-- Generated: [Date]
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    email_verified  BOOLEAN     NOT NULL DEFAULT false,
    display_name    VARCHAR(100),
    password_hash   VARCHAR(255),              -- NULL for SSO-only accounts
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ             -- soft delete
);

COMMENT ON TABLE users IS 'Registered user accounts';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash. NULL for SSO-only users.';
COMMENT ON COLUMN users.status IS 'active: normal, suspended: blocked, deleted: soft-deleted';

-- Indexes
CREATE UNIQUE INDEX users_email_unique
    ON users (LOWER(email))
    WHERE deleted_at IS NULL;               -- case-insensitive unique email for non-deleted users

CREATE INDEX users_status_idx ON users (status) WHERE deleted_at IS NULL;

-- ============================================================
-- ORGANISATIONS
-- ============================================================
CREATE TABLE organisations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    plan            VARCHAR(20)  NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    owner_id        UUID        NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX organisations_slug_unique ON organisations (slug);
CREATE INDEX organisations_owner_idx ON organisations (owner_id);

-- ============================================================
-- ORGANISATION MEMBERS (many-to-many: users <-> organisations)
-- ============================================================
CREATE TABLE organisation_members (
    organisation_id UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20)  NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by      UUID        REFERENCES users(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organisation_id, user_id)
);

CREATE INDEX org_members_user_idx ON organisation_members (user_id);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID        NOT NULL REFERENCES organisations(id),
    customer_id     UUID        NOT NULL REFERENCES users(id),
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    -- Money stored as cents; currency stored alongside
    subtotal_cents  INTEGER     NOT NULL CHECK (subtotal_cents >= 0),
    tax_cents       INTEGER     NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    total_cents     INTEGER     NOT NULL CHECK (total_cents >= 0),
    currency        CHAR(3)     NOT NULL DEFAULT 'USD',
    shipping_address_id UUID   REFERENCES addresses(id),
    notes           TEXT,
    confirmed_at    TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN orders.subtotal_cents IS 'Pre-tax order total in smallest currency unit (cents for USD)';

CREATE INDEX orders_organisation_idx  ON orders (organisation_id);
CREATE INDEX orders_customer_idx      ON orders (customer_id);
CREATE INDEX orders_status_idx        ON orders (status);
CREATE INDEX orders_created_at_idx    ON orders (created_at DESC);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID        NOT NULL REFERENCES products(id),
    quantity        INTEGER     NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER    NOT NULL CHECK (unit_price_cents >= 0),
    total_cents     INTEGER     GENERATED ALWAYS AS (quantity * unit_price_cents) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_items_order_idx   ON order_items (order_id);
CREATE INDEX order_items_product_idx ON order_items (product_id);

-- ============================================================
-- ADDRESSES
-- ============================================================
CREATE TABLE addresses (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    line1           VARCHAR(255) NOT NULL,
    line2           VARCHAR(255),
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100),
    postal_code     VARCHAR(20),
    country         CHAR(2)     NOT NULL,  -- ISO 3166-1 alpha-2
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX addresses_user_idx ON addresses (user_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Migration Template

```sql
-- Migration: 0023_add_order_notes_column.sql
-- Author: [Name]
-- Date: [Date]
-- Description: Add notes field to orders table for customer comments

BEGIN;

-- Forward migration
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN orders.notes IS 'Optional customer-provided notes for the order';

-- Verify
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'notes'
    ) THEN
        RAISE EXCEPTION 'Migration failed: notes column not created';
    END IF;
END $$;

COMMIT;

-- Rollback (run separately if needed)
-- ALTER TABLE orders DROP COLUMN IF EXISTS notes;
```

## Index Design Decisions

```sql
-- Index foreign keys — always
CREATE INDEX orders_customer_idx ON orders (customer_id);

-- Index columns in WHERE clauses
CREATE INDEX orders_status_created_idx ON orders (status, created_at DESC);

-- Partial index for common filtered queries
CREATE INDEX active_users_idx ON users (email) WHERE status = 'active';

-- Covering index to avoid table lookup (index-only scan)
CREATE INDEX orders_summary_idx ON orders (organisation_id, status, total_cents)
    INCLUDE (created_at, currency);

-- GIN index for JSONB or full-text search
CREATE INDEX products_metadata_idx ON products USING GIN (metadata);
CREATE INDEX products_name_search ON products USING GIN (to_tsvector('english', name));

-- Check index usage — drop unused indexes (write overhead, no read benefit)
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

## Normalization Quick Guide

| Normal Form | Rule | Violation example |
|-------------|------|------------------|
| 1NF | Atomic values, no repeating groups | `tags: "red,blue,green"` in one column |
| 2NF | No partial dependency on composite PK | Non-key column depends on part of composite PK |
| 3NF | No transitive dependency | `city` stored on `orders` when it depends on `zip_code` |

Deliberate denormalization examples (OK with documentation):
- Store `total_cents` on orders even though it can be derived from order_items — avoids expensive aggregation
- Store `user_email` on audit_log even though it can be joined — preserves historical state

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| FLOAT for money | Rounding errors: 0.1 + 0.2 ≠ 0.3 | Use INTEGER cents |
| VARCHAR without length | Unconstrained input | Add appropriate length limits |
| No foreign key constraints | Orphaned records accumulate | Define FK constraints; cascade appropriately |
| Storing comma-separated lists | Cannot index, join, or query | Normalise to junction table |
| Generic columns | `field1`, `field2`, `extra_data TEXT` | Use JSONB for flexible data; name columns clearly |
| No indexes on FKs | Full table scans on joins | Index every foreign key column |
| Single global sequence for IDs | Bottleneck in distributed systems | Use UUID or per-table sequences |

## Rules

- **Money as integer cents always** — never FLOAT or DECIMAL for currency values.
- **TIMESTAMPTZ not TIMESTAMP** — always store with timezone; convert at display layer.
- **UUID primary keys for distributed systems** — auto-increment leaks record counts and is a sharding bottleneck.
- **NOT NULL by default** — explicitly allow NULL only when absence is semantically meaningful.
- **Constraints at the database layer** — application can be bypassed; the database cannot.
- **Index every foreign key** — unindexed FKs cause full table scans on every join.
- **Soft delete with deleted_at** — never hard delete audit-trail data; filter in queries.
- **Comments on every table and non-obvious column** — schemas outlive their authors.
- **Reversible migrations** — every migration needs a documented rollback procedure.
- **Test EXPLAIN ANALYZE on critical queries** — index design is validated against actual query plans.


## Worked Example and Anti-Patterns

### Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No runbook | On-call engineer has no guidance during incident | Write runbook before going to production |
| Single point of failure | One component down takes everything with it | Design for redundancy at every layer |
| No monitoring | Problems discovered by users, not engineers | Instrument before launch |
| Manual toil | Repeated manual steps slow down and introduce errors | Automate anything done more than twice |
| Undocumented decisions | Next engineer repeats the same mistakes | Use Architecture Decision Records (ADRs) |

### Rules

- **Start with the simplest thing that works** -- complexity should be earned, not assumed.
- **Make it observable before making it complex** -- logs, metrics, and traces first.
- **Automate toil** -- anything done manually more than twice should be scripted.
- **Document decisions** -- use ADRs; future engineers will thank you.
- **Test failure modes** -- chaos engineering starts small; break one thing at a time.
- **Prefer reversible decisions** -- irreversible architecture decisions need the most careful thought.
- **Own your runbooks** -- every service needs a runbook before it goes to production.
- **Measure before optimizing** -- do not optimize what you have not profiled.
- **Design for the 99th percentile user** -- the average case is not the hard case.
- **Keep it boring** -- stable, predictable, well-understood technology over cutting-edge.

