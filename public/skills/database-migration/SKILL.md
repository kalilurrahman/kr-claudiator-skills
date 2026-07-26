---
name: database-migration
description: Plan and execute database schema migrations safely — zero-downtime strategies, Alembic/Flyway configuration, backward-compatible changes, large table migrations, and rollback procedures.
argument-hint: [database engine, table sizes, deployment strategy, downtime tolerance]
allowed-tools: Read, Write, Bash
---

# Database Schema Migrations

Database migrations are the most dangerous operation in production software. They are irreversible (in practice), can lock tables under load, and can break running application versions that haven't yet deployed. Safe migrations require thinking backward: write the migration so old code and new code both work during the deployment window.

## Migration Safety Classification

| Change Type | Risk | Strategy |
|-------------|------|----------|
| Add nullable column | Low | Deploy migration first, then code |
| Add column with default | Medium | Use database default, not application default |
| Rename column | High | Add new + copy data + dual-write + remove old |
| Remove column | High | Remove from code first, then drop column |
| Add index (large table) | High | `CREATE INDEX CONCURRENTLY` |
| Add NOT NULL constraint | High | Backfill → add check constraint → convert |
| Change column type | Very High | New column + copy + swap |
| Add foreign key | Medium | Add without validation, validate separately |

## Process

1. **Classify the change** — is it backward compatible with the currently-deployed code?
2. **Expand-contract pattern** — expand (add new) → deploy code → contract (remove old).
3. **Test migration locally** — run against production-sized data snapshot.
4. **Estimate lock time** — small tables: seconds; large tables: must use CONCURRENTLY or batching.
5. **Write rollback plan** — every migration needs a documented revert path.
6. **Deploy in stages** — migration → deploy code → cleanup migration.

## Output Format

### Alembic Configuration

```python
# alembic/env.py
from alembic import context
from sqlalchemy import engine_from_config, pool
from logging.config import fileConfig
import os

config = context.config
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # No pooling for migration runs
    )
    
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            transaction_per_migration=True,  # Rollback individual failed migrations
            compare_type=True,
            compare_server_default=True,
        )
        
        with context.begin_transaction():
            context.run_migrations()
```

### Safe Migration Patterns

```python
# migrations/versions/001_add_user_preferences.py
"""Add user_preferences column — backward compatible"""
from alembic import op
import sqlalchemy as sa

revision = "001_add_user_preferences"
down_revision = "000_initial"

def upgrade():
    # Safe: nullable column, existing rows get NULL
    # Old code ignores this column; new code reads it
    op.add_column("users",
        sa.Column("preferences", sa.JSON(), nullable=True)
    )

def downgrade():
    op.drop_column("users", "preferences")
```

```python
# migrations/versions/002_rename_user_email.py
"""Rename email to email_address — UNSAFE direct rename, use expand-contract"""
from alembic import op
import sqlalchemy as sa

# STEP 1 of 3: Add new column (deploy this, then deploy code that dual-writes)
def upgrade():
    op.add_column("users",
        sa.Column("email_address", sa.String(320), nullable=True)
    )
    # Copy existing data
    op.execute("UPDATE users SET email_address = email WHERE email_address IS NULL")
    
    # Add trigger for dual-write during transition
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_email_columns()
        RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
                NEW.email_address := NEW.email;
            END IF;
            IF TG_OP = 'INSERT' OR NEW.email_address IS DISTINCT FROM OLD.email_address THEN
                NEW.email := NEW.email_address;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        CREATE TRIGGER sync_email
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION sync_email_columns();
    """)

def downgrade():
    op.execute("DROP TRIGGER IF EXISTS sync_email ON users")
    op.execute("DROP FUNCTION IF EXISTS sync_email_columns()")
    op.drop_column("users", "email_address")

# STEP 2: After deploying code that reads email_address, remove the old column
# STEP 3 migration:
# op.drop_column("users", "email")
# op.execute("DROP TRIGGER sync_email ON users")
```

### Large Table Index Migration

```python
# migrations/versions/003_add_orders_user_id_index.py
"""Add index on orders.user_id — CONCURRENTLY for zero-downtime"""
from alembic import op

def upgrade():
    # CREATE INDEX CONCURRENTLY does not hold a lock
    # Cannot run inside a transaction — requires connection-level execution
    op.execute("COMMIT")  # End Alembic's transaction
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id ON orders (user_id)"
    )
    # Note: Alembic will start a new transaction after this

def downgrade():
    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_orders_user_id")
```

### Large Table Backfill

```python
# scripts/backfill_orders_status.py
"""Safely backfill a new column in batches — never lock the whole table."""
import psycopg2
import time

def backfill_in_batches(dsn: str, batch_size: int = 1000, sleep_ms: int = 100):
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()
    
    cur.execute("SELECT MIN(id), MAX(id) FROM orders")
    min_id, max_id = cur.fetchone()
    
    total_updated = 0
    batch_start = min_id
    
    while batch_start <= max_id:
        batch_end = batch_start + batch_size
        
        cur.execute("""
            UPDATE orders
            SET status_v2 = CASE
                WHEN status = 'paid' THEN 'completed'
                WHEN status = 'refunded' THEN 'cancelled'
                ELSE status
            END
            WHERE id >= %s AND id < %s
              AND status_v2 IS NULL
        """, (batch_start, batch_end))
        
        rows = cur.rowcount
        total_updated += rows
        
        if rows > 0:
            print(f"Updated {total_updated:,} rows (batch {batch_start}-{batch_end})")
        
        batch_start = batch_end
        time.sleep(sleep_ms / 1000)
    
    print(f"Backfill complete: {total_updated:,} rows updated")
    cur.close()
    conn.close()

if __name__ == "__main__":
    import os
    backfill_in_batches(os.environ["DATABASE_URL"])
```

### Migration CI Gate

```bash
#!/bin/bash
# scripts/check_migration_safety.sh
# Block migrations that take exclusive locks on large tables

set -e

MIGRATION_FILE=$1
TABLE_SIZE_THRESHOLD=1000000  # 1M rows

# Check for dangerous patterns
if grep -q "ALTER TABLE.*ALTER COLUMN.*TYPE" "$MIGRATION_FILE"; then
    echo "WARNING: Column type change detected — this locks the table."
    echo "Use add column + copy + swap pattern instead."
    exit 1
fi

if grep -q "CREATE INDEX" "$MIGRATION_FILE" && ! grep -q "CONCURRENTLY" "$MIGRATION_FILE"; then
    echo "ERROR: CREATE INDEX without CONCURRENTLY will lock the table."
    exit 1
fi

if grep -q "ADD CONSTRAINT.*NOT NULL" "$MIGRATION_FILE"; then
    echo "WARNING: Adding NOT NULL constraint scans the entire table."
    echo "Ensure all rows have a value before adding this constraint."
fi

echo "Migration safety check passed"
```

## Rules

- **Expand-contract for all renames and removals** — deploy the expand (additive) migration, update code, then deploy the contract (removal) migration.
- **Never deploy code and migration simultaneously** — deploy the backward-compatible migration first, then the new code.
- **`CREATE INDEX CONCURRENTLY` always on tables >100k rows** — standard index creation locks the table.
- **Backfill in batches with sleep** — bulk updates on large tables create replication lag and lock contention.
- **Test on production-sized data** — a migration that takes 2 seconds on 10k rows takes 20 minutes on 100M rows.
- **Every migration has a rollback** — write `downgrade()` that actually works, not a placeholder comment.
- **No multi-statement DDL in one transaction** — if one statement fails mid-migration, partial DDL is hard to recover.
- **NOT NULL requires a backfill first** — adding NOT NULL to an existing column with NULLs fails immediately.
- **Document the deployment sequence** — migrations that span multiple deployments need a written playbook.
- **Never run migrations automatically at deploy time in production** — run them manually with a human watching, then deploy code.
## Worked Example: Adding a Required Column Safely

**Situation:** Add `email_verified BOOLEAN NOT NULL DEFAULT false` to a `users` table with 2M rows in production, zero downtime.

**Wrong approach (locks the table):**
```sql
-- This takes an exclusive lock on all 2M rows for minutes
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
```

**Right approach (Expand-Contract pattern):**

```sql
-- Step 1: Add nullable (instant, no lock)
ALTER TABLE users ADD COLUMN email_verified BOOLEAN;

-- Step 2: Backfill in batches (no lock, background process)
DO $$
DECLARE
  batch_size INT := 10000;
  last_id BIGINT := 0;
  max_id BIGINT;
BEGIN
  SELECT MAX(id) INTO max_id FROM users;
  WHILE last_id < max_id LOOP
    UPDATE users
    SET email_verified = false
    WHERE id > last_id AND id <= last_id + batch_size
      AND email_verified IS NULL;
    last_id := last_id + batch_size;
    PERFORM pg_sleep(0.05);  -- rate limit to avoid lock contention
  END LOOP;
END$$;

-- Step 3: Add NOT NULL constraint (fast once column is fully populated)
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;
```

## Migration Checklist

Before running any migration in production:
- [ ] Tested on a copy of production data
- [ ] Estimated row count and lock duration
- [ ] Rollback script written and tested
- [ ] Maintenance window or zero-downtime strategy confirmed
- [ ] Monitoring alert set for slow migration or lock wait
- [ ] Post-migration verification query prepared
- [ ] Application code handles both old and new schema (dual-write period)

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| ALTER TABLE on large table in peak hours | Table lock during migration | Batch backfills; schedule off-peak |
| No rollback plan | Breaking migration with no way back | Write down migration every time |
| Deploying app and migration simultaneously | Race condition during deploy | Deploy app first (reads/writes both schemas), then migrate |
| Assuming migration is fast | 10M-row table can take 30+ min | Test against production-scale data copy first |
| Dropping columns immediately after code change | Old code version still references column | Deprecate, then remove in next deploy cycle |

## Rules

- **Expand before contract** -- add nullable first; make non-null after backfill; remove old in a later deploy.
- **Never ALTER in production without testing on a data copy first** -- row count matters; 1K rows != 1M rows.
- **Batch large backfills** -- never UPDATE 10M rows in one transaction; use loops with sleep intervals.
- **Write the rollback before the migration** -- if you cannot write a rollback, the migration is not safe.
- **Version-control every migration** -- Alembic, Flyway, Liquibase, or plain numbered SQL files.
- **Keep migrations and code deploys separate** -- deploy code that handles both schemas, then run the migration.
- **Always test with realistic data volume** -- performance issues only appear at production scale.
- **Monitor during migration** -- watch for lock waits, replication lag, and connection count.
- **Use advisory locks for coordination** -- prevent concurrent migration runs across replicas.
- **Archive, do not delete, when removing data** -- soft deletes with archive tables are safer than permanent drops.
