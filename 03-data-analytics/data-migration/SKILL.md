---
name: data-migration
description: Design and execute safe database migrations with zero downtime, rollback plans, and data validation. Outputs migration scripts, expand-contract patterns, backfill strategies, and cutover runbooks.
argument-hint: [database type, data volume, downtime tolerance, rollback requirements]
allowed-tools: Read, Write, Bash
---

# Data Migration

Database migrations are one of the highest-risk operations in production engineering. A migration that locks a table during peak traffic, drops a column still read by running code, or corrupts data silently is a serious incident. Design every migration to be reversible, observable, and zero-downtime.

## Process

1. **Classify the migration** — additive (safe), modifying (careful), destructive (dangerous).
2. **Use expand-contract for breaking changes** — add new, backfill, dual-write, cut over, remove old.
3. **Write the rollback first** — before writing the migration, write how to undo it.
4. **Test on a production data clone** — never estimate migration time from a dev dataset.
5. **Batch large data operations** — never update millions of rows in one transaction.
6. **Monitor lock wait times** — lock_timeout and statement_timeout prevent runaway locks.
7. **Validate data after migration** — count rows, sample values, check constraints.

## Output Format

### Migration Safety Classification

```
SAFE (deploy anytime):
  + Add nullable column
  + Add new table
  + Add index (CONCURRENTLY in Postgres)
  + Add non-unique constraint on empty table

CAREFUL (expand-contract required):
  ~ Rename column → Add new, backfill, dual-write, remove old
  ~ Rename table → Same pattern
  ~ Change column type → Add new column of new type, backfill, switch
  ~ Add NOT NULL constraint → Add nullable, backfill, add constraint

DANGEROUS (maintenance window or special technique):
  ✗ Drop column actively used by code
  ✗ Truncate table
  ✗ Add NOT NULL without default
  ✗ Change column type with full table rewrite
  ✗ Add unique constraint without CONCURRENTLY
```

### Alembic Migration (Python/SQLAlchemy)

```python
# migrations/versions/2024_01_add_discount_code.py
"""Add discount_code to orders table

Revision ID: a1b2c3d4e5f6
Down revision: previous_revision
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # SAFE: Add nullable column — old code ignores it, new code can use it
    op.add_column(
        'orders',
        sa.Column('discount_code', sa.String(50), nullable=True)
    )
    
    # Add index CONCURRENTLY — doesn't lock the table
    op.execute(
        'CREATE INDEX CONCURRENTLY idx_orders_discount_code ON orders(discount_code) WHERE discount_code IS NOT NULL'
    )

def downgrade():
    op.execute('DROP INDEX CONCURRENTLY IF EXISTS idx_orders_discount_code')
    op.drop_column('orders', 'discount_code')
```

```python
# migrations/versions/2024_02_rename_user_id_column.py
"""Rename user_id to customer_id (expand-contract, phase 1 of 3)

This migration: ADD new column
Next migration: REMOVE old column (after code switches to new name)
"""

def upgrade():
    # Phase 1: Add new column as alias
    op.add_column('orders', sa.Column('customer_id', sa.String(255), nullable=True))
    
    # Backfill in batches (don't lock the table with one massive UPDATE)
    op.execute("""
        DO $$
        DECLARE
            batch_size INT := 10000;
            offset_val INT := 0;
            rows_updated INT;
        BEGIN
            LOOP
                UPDATE orders
                SET customer_id = user_id
                WHERE id IN (
                    SELECT id FROM orders
                    WHERE customer_id IS NULL
                    LIMIT batch_size
                );
                
                GET DIAGNOSTICS rows_updated = ROW_COUNT;
                EXIT WHEN rows_updated = 0;
                
                PERFORM pg_sleep(0.1);  -- Brief pause between batches
            END LOOP;
        END $$;
    """)
    
    # After backfill, add NOT NULL constraint
    op.alter_column('orders', 'customer_id', nullable=False)

def downgrade():
    op.drop_column('orders', 'customer_id')
    # user_id still exists — safe rollback
```

### Backfill Script (Large Tables)

```python
# scripts/backfill_order_totals.py
"""
Backfill computed total_cents column from order items.
Run independently before/after migration, not as part of it.
"""

import psycopg2
import time
import logging
from contextlib import contextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BATCH_SIZE = 5000
SLEEP_BETWEEN_BATCHES = 0.05  # 50ms — reduce DB load

def backfill_order_totals(db_url: str, dry_run: bool = True):
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    
    try:
        with conn.cursor() as cur:
            # Count total rows to process
            cur.execute("SELECT COUNT(*) FROM orders WHERE total_cents IS NULL")
            total = cur.fetchone()[0]
            logger.info(f"Rows to backfill: {total:,}")
            
            if dry_run:
                logger.info("DRY RUN — no changes made")
                return
            
            processed = 0
            start = time.time()
            
            while True:
                with conn.cursor() as batch_cur:
                    batch_cur.execute("""
                        UPDATE orders o
                        SET total_cents = (
                            SELECT SUM(price_cents * quantity)
                            FROM order_items oi
                            WHERE oi.order_id = o.id
                        )
                        WHERE o.id IN (
                            SELECT id FROM orders
                            WHERE total_cents IS NULL
                            ORDER BY created_at DESC
                            LIMIT %s
                        )
                    """, (BATCH_SIZE,))
                    
                    rows = batch_cur.rowcount
                    conn.commit()
                    
                    if rows == 0:
                        break
                    
                    processed += rows
                    elapsed = time.time() - start
                    rate = processed / elapsed
                    remaining = (total - processed) / rate if rate > 0 else 0
                    
                    logger.info(
                        f"Progress: {processed:,}/{total:,} ({100*processed/total:.1f}%) "
                        f"| Rate: {rate:.0f} rows/s "
                        f"| ETA: {remaining/60:.1f}m"
                    )
                    
                    time.sleep(SLEEP_BETWEEN_BATCHES)
        
        logger.info(f"Backfill complete: {processed:,} rows updated")
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Backfill failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    
    backfill_order_totals(
        db_url=args.db_url,
        dry_run=not args.execute
    )
```

### Migration Validation

```python
# scripts/validate_migration.py
"""Run after migration to validate data integrity."""

import psycopg2
import sys

def validate(conn):
    checks = []
    
    with conn.cursor() as cur:
        # Row count sanity check
        cur.execute("SELECT COUNT(*) FROM orders")
        count = cur.fetchone()[0]
        checks.append(("orders_row_count", count > 0, f"Count: {count}"))
        
        # No nulls in required fields
        cur.execute("SELECT COUNT(*) FROM orders WHERE customer_id IS NULL")
        nulls = cur.fetchone()[0]
        checks.append(("no_null_customer_ids", nulls == 0, f"Null count: {nulls}"))
        
        # Data consistency: total_cents matches sum of items
        cur.execute("""
            SELECT COUNT(*)
            FROM orders o
            WHERE o.total_cents != (
                SELECT COALESCE(SUM(price_cents * quantity), 0)
                FROM order_items WHERE order_id = o.id
            )
            LIMIT 100
        """)
        mismatches = cur.fetchone()[0]
        checks.append(("total_cents_consistent", mismatches == 0, f"Mismatches: {mismatches}"))
        
        # Foreign key integrity
        cur.execute("""
            SELECT COUNT(*) FROM orders o
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = o.customer_id)
        """)
        orphans = cur.fetchone()[0]
        checks.append(("no_orphaned_orders", orphans == 0, f"Orphans: {orphans}"))
    
    print("\n=== Migration Validation ===")
    all_passed = True
    for name, passed, detail in checks:
        status = "✅" if passed else "❌"
        print(f"{status} {name}: {detail}")
        if not passed:
            all_passed = False
    
    if not all_passed:
        print("\nVALIDATION FAILED — do not proceed with migration")
        sys.exit(1)
    else:
        print("\nAll checks passed ✅")
```

### Cutover Runbook

```markdown
# Migration Cutover Runbook: orders.user_id → orders.customer_id

## Prerequisites
- [ ] Migration phase 1 (add column) deployed and verified
- [ ] Backfill complete (0 rows with customer_id IS NULL)
- [ ] Application code updated to read from customer_id
- [ ] Staging tested end-to-end

## Timeline (estimated 30 minutes total)

### T-0: Begin cutover
- [ ] Announce in #deployments: "Starting orders.customer_id cutover"
- [ ] Confirm database replica lag < 1s
- [ ] Start monitoring dashboard: orders.error_rate

### T+5: Deploy application update
- [ ] Deploy new application version (reads customer_id, writes both)
- [ ] Verify health checks green
- [ ] Watch error rate — rollback if >1% errors

### T+15: Verify dual-write
- [ ] Sample 10 recent orders: confirm customer_id == user_id
- [ ] Query: SELECT COUNT(*) FROM orders WHERE customer_id != user_id → expect 0

### T+20: Stop writing to user_id
- [ ] Deploy application version that writes only customer_id
- [ ] Verify health checks

### T+25: Validate then remove user_id (migration phase 2)
- [ ] Run validate_migration.py
- [ ] Run migration: alembic upgrade head (drops user_id)

### T+30: Post-cutover
- [ ] Announce in #deployments: "Cutover complete"
- [ ] Monitor for 30 minutes

## Rollback
- Phase 1 active: `alembic downgrade -1` (drops customer_id, user_id still exists)
- Phase 2 active: restore from pre-migration snapshot (within 1h window)
```

## Rules

- **Never drop columns in the same deploy that removes code using them** — always a two-step process.
- **Test migration timing on production-scale data** — 1M rows migrates differently than 100 rows.
- **Set `lock_timeout` on DDL** — `SET lock_timeout = '2s'` before ALTER TABLE prevents runaway locks.
- **Batch all DML** — UPDATE 10,000 rows × N times, not 10,000,000 at once.
- **Write the rollback before the migration** — if you can't write the rollback, you shouldn't run the migration.
- **Validate after every phase** — don't assume backfills completed correctly; count and sample.
- **Announce and coordinate cutovers** — surprise migrations in production destroy trust.
- **Keep old column for at least one deploy cycle** — gives you rollback time.
- **Monitor active connections and locks** — `pg_stat_activity` and `pg_locks` during migration.
- **Never run migrations during peak traffic** — schedule for lowest traffic window.


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

