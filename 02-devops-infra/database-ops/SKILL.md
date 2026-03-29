---
name: database-ops
description: Operate databases in production with zero-downtime migrations, connection pooling, backup verification, and performance monitoring. Outputs migration workflow, pooler config, monitoring queries, and runbooks.
argument-hint: [database type, workload pattern, team size, RTO/RPO requirements]
allowed-tools: Read, Write, Bash
---

# Database Operations

Running a database in production requires more than backups. Zero-downtime migrations, connection pool management, query performance monitoring, and incident runbooks are the operational practices that keep databases healthy as applications scale.

## Zero-Downtime Migrations

```python
# Expand/contract pattern — never break existing code during migration

# STEP 1: Expand — add new column (backward compatible)
# Old code still works (column is nullable)
"""
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
"""

# STEP 2: Backfill — populate existing rows
"""
UPDATE users SET full_name = first_name || ' ' || last_name
WHERE full_name IS NULL;
"""

# STEP 3: Deploy new code that writes both old and new columns
# New code reads from full_name, old code still reads first_name/last_name

# STEP 4: Contract — once old code is fully deployed
"""
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;
"""

# alembic migration example
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Safe: adding nullable column is non-blocking
    op.add_column("users", sa.Column("full_name", sa.String(255), nullable=True))

def downgrade():
    op.drop_column("users", "full_name")
```

## Connection Pool Configuration (PgBouncer)

```ini
# pgbouncer.ini
[databases]
production = host=postgres-primary port=5432 dbname=app

[pgbouncer]
pool_mode = transaction          # Transaction pooling — most efficient
max_client_conn = 1000           # Max frontend connections
default_pool_size = 25           # Backend connections per pool
min_pool_size = 5
reserve_pool_size = 5
server_idle_timeout = 600        # Close idle server connections
client_idle_timeout = 0          # Don't close idle clients

# Auth
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Performance
server_round_robin = 1           # Round-robin across replica set
```

```python
# Application connection settings (with PgBouncer)
DATABASE_CONFIG = {
    "pool_size": 10,        # Connections to PgBouncer (not Postgres directly)
    "max_overflow": 5,
    "pool_timeout": 30,
    "pool_recycle": 1800,   # Recycle before PgBouncer idle timeout
    "pool_pre_ping": True,  # Test connection before use
}
```

## Performance Monitoring Queries

```sql
-- Slow queries right now
SELECT pid, now() - pg_stat_activity.query_start AS duration,
       query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - pg_stat_activity.query_start > INTERVAL '5 seconds'
ORDER BY duration DESC;

-- Index usage — find unused indexes
SELECT schemaname, tablename, indexname,
       idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Table bloat
SELECT tablename,
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) AS total,
       pg_size_pretty(pg_relation_size(tablename::regclass)) AS data,
       round(100 * (n_dead_tup::float / nullif(n_live_tup + n_dead_tup, 0)), 1) AS dead_pct
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Connection count by state
SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY 2 DESC;

-- Lock waits
SELECT waiting.pid AS waiting_pid, waiting.query AS waiting_query,
       blocking.pid AS blocking_pid, blocking.query AS blocking_query
FROM pg_stat_activity waiting
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(waiting.pid))
WHERE NOT waiting.granted;
```

## Backup Verification

```bash
#!/bin/bash
# verify-backup.sh — run daily in CI/CD

set -e

BACKUP_FILE=$1
TEST_DB="backup_verify_$(date +%Y%m%d%H%M%S)"

echo "Creating test database $TEST_DB..."
createdb $TEST_DB

echo "Restoring backup..."
pg_restore -d $TEST_DB -v $BACKUP_FILE

echo "Running verification queries..."
psql $TEST_DB -c "SELECT COUNT(*) FROM users;" | grep -E "[0-9]+" || exit 1
psql $TEST_DB -c "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '7 days';" | grep -E "[0-9]+" || exit 1

echo "Checking foreign key integrity..."
psql $TEST_DB -c "
SELECT COUNT(*) FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.id IS NULL;"  # Should return 0

echo "Backup verified ✓"
dropdb $TEST_DB
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Breaking migration in one step** | DROP COLUMN while old code runs → errors | Expand/contract pattern |
| **Direct connection to Postgres** | 100 app pods × 10 connections = 1000 | PgBouncer in transaction mode |
| **Unverified backups** | "We have backups" but restore never tested | Automated restore + verification daily |
| **No connection pool timeout** | Waiting forever for connection = request stuck | pool_timeout = 5-10 seconds |
| **Long-running migrations in transaction** | Locks table for minutes | Use `ALTER TABLE ... CONCURRENTLY`; batch updates |

## 10 Rules

1. Every schema migration follows expand/contract — backward compatible changes only.
2. PgBouncer (or equivalent) between application and Postgres — direct connections don't scale.
3. Backup restore verification runs daily — an untested backup is not a backup.
4. Monitor slow queries proactively — pg_stat_statements shows patterns before they become incidents.
5. VACUUM and ANALYZE scheduled regularly — autovacuum alone is insufficient for high-write tables.
6. Connection pool timeouts are set — never wait indefinitely for a database connection.
7. Large table changes use `CONCURRENTLY` — `CREATE INDEX CONCURRENTLY`, `ALTER TABLE` with care.
8. Lock monitoring alerts — unexpected lock waits are a leading indicator of performance incidents.
9. Replica lag is a metric — alert when lag exceeds 30 seconds.
10. Database operations are documented in runbooks — DBAs don't exist at 3am; the runbook does.
