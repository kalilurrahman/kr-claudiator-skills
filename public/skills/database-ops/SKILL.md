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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Database Ops** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Operate databases in production with zero-downtime migrations, connection pooling, backup verification, and performance monitoring. Outputs migration workflow, 
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
