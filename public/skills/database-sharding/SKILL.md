---
name: database-sharding
description: Design a horizontal database sharding strategy to scale beyond the limits of a single database node. Covers shard key selection, sharding strategies, cross-shard queries, rebalancing, and operational challenges.
argument-hint: [database type, data model, query patterns, current scale, target scale]
allowed-tools: Read, Write, Bash
---

# Database Sharding

Sharding is horizontal partitioning — splitting data across multiple database nodes (shards) so that each node holds a subset of the total data. It is the path to scale when vertical scaling (bigger hardware) is no longer cost-effective and read replicas alone cannot handle write throughput.

## When to Shard

| Signal | Threshold to act |
|--------|-----------------|
| Write throughput | Single master cannot sustain writes (>10k writes/sec typical) |
| Dataset size | Dataset exceeds what fits cost-effectively on one node (>5TB typical) |
| Query latency | Even with indexes and caching, latency is unacceptable |
| Connection limits | PostgreSQL max_connections or MySQL thread limits hit |

**Before sharding, exhaust these alternatives:**
1. Query optimisation and indexes
2. Read replicas (offload reads)
3. Caching (Redis/Memcached)
4. Vertical scaling (bigger instance)
5. Table partitioning (within a single node)

Sharding adds massive operational complexity. It is a last resort, not a first choice.

## Sharding Strategies

### Hash Sharding — Uniform distribution

```
shard_id = hash(shard_key) % num_shards

Example: user_id 12345
  MD5(12345) = "827ccb0eea8a706c4c34a16891f84e7b"
  int("827c...") % 4 = shard 2
```

**Pros:** Even data distribution; simple to implement.  
**Cons:** Range queries span all shards; rebalancing requires rehashing all data.

### Range Sharding — Contiguous key ranges per shard

```
Shard 0: user_id 0       – 9,999,999
Shard 1: user_id 10,000,000 – 19,999,999
Shard 2: user_id 20,000,000 – 29,999,999
```

**Pros:** Range queries efficient within a shard; easy to add new ranges.  
**Cons:** Hot spots when recent data concentrates on the latest shard (e.g., time-based keys).

### Directory Sharding — Lookup table maps key → shard

```
shard_map["tenant_42"] = shard_3
shard_map["tenant_99"] = shard_1
```

**Pros:** Flexible; can rebalance individual keys without resharding; supports non-uniform distribution.  
**Cons:** Lookup table is a single point of failure; must be highly available and low-latency.

### Geo Sharding — Region-based shards

```
EU users → eu-west shard cluster
US users → us-east shard cluster
APAC users → ap-southeast shard cluster
```

**Pros:** Data residency compliance; low latency for regional users.  
**Cons:** Cross-region queries are expensive; uneven growth by region causes imbalance.

## Shard Key Selection — the most important decision

A bad shard key is impossible to fix without a full data migration.

```
Good shard keys:
  user_id         — high cardinality; evenly distributed; most queries are per-user
  tenant_id       — natural isolation for SaaS; even if tenant sizes vary
  order_id        — high cardinality; write-heavy workloads

Bad shard keys:
  created_at      — all new writes go to the "current" shard (hot spot)
  country_code    — low cardinality; US shard will be much larger than others
  status          — very low cardinality; active/inactive creates massive imbalance
  random UUID     — good distribution but cross-shard joins on all other fields
```

Checklist for a good shard key:
- [ ] High cardinality (thousands of distinct values minimum)
- [ ] Even distribution (no value holds > 10% of data)
- [ ] Appears in the WHERE clause of most high-volume queries
- [ ] Minimises cross-shard queries for the primary access pattern
- [ ] Immutable after row creation (or near-immutable)

## Process

1. **Confirm sharding is necessary** — exhaust all single-node alternatives first.
2. **Analyse query patterns** — which queries run most often? Which tables are largest?
3. **Choose the shard key** — use the checklist above; get sign-off from the team before proceeding.
4. **Choose the sharding strategy** — hash for even distribution; range for ordered scans; directory for flexibility.
5. **Design the shard routing layer** — how does the application know which shard to query?
6. **Plan the migration** — dual-write period; backfill; cutover; verification.
7. **Handle cross-shard queries** — scatter-gather or denormalise data to avoid them.
8. **Plan rebalancing** — how will you move data when a shard becomes too large?
9. **Update the data access layer** — application code must route queries to the right shard.
10. **Instrument and monitor** — per-shard query rates, latency, connection counts, row counts.

## Shard Routing Layer

```python
import hashlib
from typing import Optional
from dataclasses import dataclass

@dataclass
class ShardConfig:
    shard_id: int
    host:     str
    port:     int
    database: str

class ShardRouter:
    def __init__(self, shards: list[ShardConfig], num_shards: int):
        self._shards     = {s.shard_id: s for s in shards}
        self._num_shards = num_shards

    def shard_for_key(self, shard_key: str | int) -> ShardConfig:
        """Hash-based routing — consistent for the same key."""
        key_bytes = str(shard_key).encode()
        hash_val  = int(hashlib.md5(key_bytes).hexdigest(), 16)
        shard_id  = hash_val % self._num_shards
        return self._shards[shard_id]

    def all_shards(self) -> list[ShardConfig]:
        """Return all shards — for scatter-gather queries."""
        return list(self._shards.values())

router = ShardRouter(
    shards=[
        ShardConfig(0, "db-shard-0.example.com", 5432, "app"),
        ShardConfig(1, "db-shard-1.example.com", 5432, "app"),
        ShardConfig(2, "db-shard-2.example.com", 5432, "app"),
        ShardConfig(3, "db-shard-3.example.com", 5432, "app"),
    ],
    num_shards=4,
)

# Usage in application code
def get_user(user_id: int) -> dict:
    shard = router.shard_for_key(user_id)   # always the same shard for the same user_id
    conn  = get_connection(shard)
    return conn.query("SELECT * FROM users WHERE id = %s", [user_id]).fetchone()

def get_all_users_matching(status: str) -> list[dict]:
    """Cross-shard query — scatter-gather pattern."""
    results = []
    for shard in router.all_shards():
        conn     = get_connection(shard)
        partial  = conn.query("SELECT * FROM users WHERE status = %s", [status]).fetchall()
        results.extend(partial)
    return results   # merge and sort application-side
```

## Cross-Shard Query Patterns

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Scatter-gather: fan out to all shards, merge results
async def scatter_gather_query(query: str, params: list, merge_fn=None) -> list:
    async def query_shard(shard: ShardConfig) -> list:
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as pool:
            return await loop.run_in_executor(
                pool,
                lambda: get_connection(shard).query(query, params).fetchall()
            )

    tasks   = [query_shard(s) for s in router.all_shards()]
    results = await asyncio.gather(*tasks)

    merged = [row for shard_result in results for row in shard_result]
    return merge_fn(merged) if merge_fn else merged

# Aggregate across shards — application-side aggregation
async def count_active_users() -> int:
    counts = await scatter_gather_query(
        "SELECT COUNT(*) as cnt FROM users WHERE status = 'active'",
        []
    )
    return sum(row["cnt"] for row in counts)

# Avoid cross-shard JOINs — denormalise instead
# BAD:  SELECT o.*, u.name FROM orders o JOIN users u ON o.user_id = u.id
#       (orders and users may be on different shards)
# GOOD: Store user_name directly on the orders row (denormalised)
#       SELECT order_id, total, user_name FROM orders WHERE user_id = %s
```

## Migration Strategy — Adding Sharding to an Existing System

```python
# Phase 1: Dual-write — write to both old DB and new sharded DB
class DualWriteRepository:
    def __init__(self, legacy_db, sharded_db, router):
        self.legacy    = legacy_db
        self.sharded   = sharded_db
        self.router    = router

    def create_user(self, user: dict) -> dict:
        # Write to legacy first (source of truth during migration)
        result = self.legacy.insert("users", user)
        try:
            shard = self.router.shard_for_key(user["id"])
            get_connection(shard).insert("users", user)
        except Exception as e:
            # Log for backfill but do not fail the request
            logger.error(f"Sharded write failed for user {user['id']}: {e}")
        return result

# Phase 2: Backfill existing data to shards
def backfill_users(batch_size: int = 1000) -> None:
    cursor = 0
    while True:
        users = legacy_db.query(
            "SELECT * FROM users WHERE id > %s ORDER BY id LIMIT %s",
            [cursor, batch_size]
        ).fetchall()
        if not users:
            break
        for user in users:
            shard = router.shard_for_key(user["id"])
            get_connection(shard).upsert("users", user)   # idempotent
        cursor = users[-1]["id"]
        logger.info(f"Backfilled to user ID {cursor}")

# Phase 3: Verify counts match between legacy and sharded
def verify_migration() -> bool:
    legacy_count  = legacy_db.query("SELECT COUNT(*) FROM users").scalar()
    sharded_count = sum(
        get_connection(s).query("SELECT COUNT(*) FROM users").scalar()
        for s in router.all_shards()
    )
    match = legacy_count == sharded_count
    logger.info(f"Legacy: {legacy_count}, Sharded: {sharded_count}, Match: {match}")
    return match

# Phase 4: Switch reads to sharded DB
# Phase 5: Remove legacy writes; decommission legacy DB
```

## Monitoring

```python
# Per-shard metrics to track
METRICS = [
    "shard.row_count",          # detect imbalance early
    "shard.query_rate",         # queries per second per shard
    "shard.write_rate",         # writes per second per shard
    "shard.latency_p99",        # latency distribution per shard
    "shard.connection_count",   # connections in use
    "shard.disk_usage_gb",      # disk growth rate
]

# Alert thresholds
ALERTS = {
    "shard_imbalance": "max_shard_rows / avg_shard_rows > 2.0",   # one shard 2× average
    "shard_overload":  "shard.write_rate > 0.8 * max_write_rate",  # approaching limit
    "hot_key":         "single_key_queries / total_queries > 0.5",  # one key dominates
}
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Sharding prematurely | Enormous complexity for no benefit | Exhaust all single-node options first |
| Low-cardinality shard key | Uneven distribution; hot shards | Always validate cardinality before choosing the key |
| Time-based shard key | All new writes go to one shard | Use user_id or tenant_id; not timestamps |
| Cross-shard JOIN in the DB | Impossible or extremely slow | Denormalise; scatter-gather in application; or co-locate related data |
| Not planning rebalancing | Shards fill unevenly over time | Design the rebalancing procedure before you need it |
| Single shard router instance | Router is now a SPOF | Run the router as a stateless layer with replicas |

## Rules

- **Sharding is a last resort** — it multiplies operational complexity; exhaust all single-node options first.
- **The shard key is permanent** — choose it before writing any data; migrating a shard key requires a full data rebuild.
- **High cardinality shard keys only** — low-cardinality keys guarantee hot spots.
- **Never shard on a timestamp** — all new writes concentrate on the current shard.
- **Design for cross-shard queries from day one** — scatter-gather or denormalisation; decide before the schema is built.
- **Route at the application layer, not the DB layer** — application-side routing is simpler, more portable, and easier to debug.
- **Monitor per-shard balance continuously** — rebalancing a hot shard is expensive; detect imbalance early.
- **Test rebalancing before you need it** — practice the rebalancing procedure in staging quarterly.
- **Keep shard count a power of two** — when you add shards you can split existing shards cleanly.
- **Each shard must be independently operable** — failover, maintenance, and backup must work per-shard without affecting others.
