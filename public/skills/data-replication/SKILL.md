---
name: data-replication
description: Design data replication strategies for high availability, read scaling, and disaster recovery. Outputs replication topology, consistency model, failover procedures, and lag monitoring setup.
argument-hint: [database type, consistency requirements, read/write ratio, RTO/RPO targets, geographic distribution]
allowed-tools: Read, Write
---

# Data Replication

Data replication maintains copies of data across multiple nodes to achieve read scaling, high availability, and disaster recovery. The fundamental tension is between consistency (all replicas have the same data) and availability (reads and writes succeed even when nodes fail).

## Replication Topologies

```
1. Single-leader (Primary/Replica)
   Primary: all writes
   Replicas: read scale + failover
   Consistency: eventual (async) or synchronous (1+ replica)
   
2. Multi-leader
   Multiple nodes accept writes
   Conflict resolution required
   Use: multi-datacenter, offline-capable clients
   
3. Leaderless (Dynamo-style)
   Any node accepts reads and writes
   Quorum: W + R > N for consistency
   Use: Cassandra, DynamoDB, Riak
```

## PostgreSQL Streaming Replication

```sql
-- Primary: postgresql.conf
wal_level = replica
max_wal_senders = 5
max_replication_slots = 5
wal_keep_size = 1GB
synchronous_commit = on           -- 'off' for async, 'remote_write' for semi-sync
synchronous_standby_names = ''    -- '' = async; '1 (replica1)' = sync to 1

-- Primary: pg_hba.conf
host replication replicator replica1_ip/32 scram-sha-256
host replication replicator replica2_ip/32 scram-sha-256

-- Primary: create replication user
CREATE USER replicator REPLICATION LOGIN ENCRYPTED PASSWORD 'strong_password';

-- Replica: recovery.conf / postgresql.conf
primary_conninfo = 'host=primary_ip port=5432 user=replicator password=strong_password'
primary_slot_name = 'replica1_slot'
hot_standby = on               -- Allow reads on replica
hot_standby_feedback = on      -- Prevent bloat on primary from long-running replica queries

-- Check replication status
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
       (sent_lsn - replay_lsn) AS replication_lag_bytes,
       extract(epoch from (now() - replay_lag)) AS lag_seconds
FROM pg_stat_replication;

-- Replication slot (prevents primary from discarding WAL before replica consumes)
SELECT pg_create_physical_replication_slot('replica1_slot');
SELECT slot_name, active, pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS lag_bytes
FROM pg_replication_slots;
```

## Consistency Levels

```python
# Application-level read routing
class DBRouter:
    """Route reads to replica when eventual consistency acceptable."""
    
    def __init__(self, primary_url: str, replica_urls: list):
        self.primary = create_engine(primary_url, pool_size=10)
        self.replicas = [create_engine(url, pool_size=20) for url in replica_urls]
        self._replica_idx = 0
    
    def get_primary(self):
        """For writes and strong-consistency reads."""
        return self.primary
    
    def get_replica(self):
        """For reads where eventual consistency is acceptable."""
        # Round-robin across replicas
        replica = self.replicas[self._replica_idx % len(self.replicas)]
        self._replica_idx += 1
        return replica

router = DBRouter(
    primary_url=PRIMARY_DB_URL,
    replica_urls=[REPLICA1_URL, REPLICA2_URL]
)

# Strong consistency required (read-your-writes)
def get_just_updated_order(order_id: str) -> dict:
    return router.get_primary().execute(
        "SELECT * FROM orders WHERE id = %s", [order_id]
    ).fetchone()

# Eventual consistency acceptable
def get_product_catalog() -> list:
    return router.get_replica().execute(
        "SELECT * FROM products WHERE active = true"
    ).fetchall()

# Context manager for explicit primary reads
from contextlib import contextmanager

_use_primary = threading.local()

@contextmanager
def read_from_primary():
    _use_primary.value = True
    try:
        yield
    finally:
        _use_primary.value = False

def get_connection():
    if getattr(_use_primary, 'value', False):
        return router.get_primary()
    return router.get_replica()
```

## Automated Failover

```bash
# Patroni — HA Postgres with automatic failover
# patroni.yml
scope: postgres-cluster
namespace: /service/
name: node1

restapi:
  listen: 0.0.0.0:8008
  connect_address: node1_ip:8008

etcd3:
  hosts: etcd1:2379,etcd2:2379,etcd3:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 30
    maximum_lag_on_failover: 1048576  # 1MB max lag for failover candidacy
    postgresql:
      use_pg_rewind: true
      parameters:
        max_connections: 200
        shared_buffers: 2GB
        wal_level: replica
        hot_standby: on

postgresql:
  listen: 0.0.0.0:5432
  connect_address: node1_ip:5432
  data_dir: /var/lib/postgresql/data
  authentication:
    replication:
      username: replicator
      password: replicator_password
    superuser:
      username: postgres
      password: postgres_password

# Check cluster status
patronictl -c patroni.yml list
# NAME    HOST         ROLE    STATE   TL  LAG IN MB
# node1   10.0.0.1     Leader  running  1   0
# node2   10.0.0.2     Replica running  1   0
# node3   10.0.0.3     Replica running  1   0

# Manual switchover
patronictl -c patroni.yml switchover postgres-cluster --master node1 --candidate node2
```

## Replication Lag Monitoring

```python
import psycopg2
from datetime import datetime

def check_replication_health(primary_dsn: str, alert_threshold_seconds: int = 30):
    conn = psycopg2.connect(primary_dsn)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                application_name,
                client_addr,
                state,
                EXTRACT(EPOCH FROM replay_lag)::int AS lag_seconds,
                pg_wal_lsn_diff(sent_lsn, replay_lsn) / 1024 / 1024 AS lag_mb
            FROM pg_stat_replication
            ORDER BY lag_seconds DESC
        """)
        replicas = cur.fetchall()
    
    for name, addr, state, lag_s, lag_mb in replicas:
        if state != 'streaming':
            alert(f"CRITICAL: Replica {name} state={state} (not streaming)")
        elif lag_s > alert_threshold_seconds:
            alert(f"WARNING: Replica {name} lag={lag_s}s ({lag_mb:.1f}MB)")
        else:
            print(f"OK: {name} lag={lag_s}s")

# Prometheus metrics via pg_stat_replication
# Alert: replication_lag_seconds > 60 for 5 minutes → page on-call
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Unbounded replication slots** | Slot not consumed → WAL accumulates → disk full | Set max_slot_wal_keep_size; monitor slot lag |
| **Reading own writes from replica** | User submits form, sees stale state | Read-your-writes consistency on primary after writes |
| **No lag monitoring** | Replica silently falls behind | Alert on lag >30s; page on lag >5 min |
| **Promoting lag replica to primary** | Data loss during failover | max_lag_on_failover Patroni setting |
| **Manual failover only** | RTO measured in minutes to hours | Automatic failover with Patroni or RDS Multi-AZ |
| **Same AZ for primary and replica** | AZ failure takes out both | Primary and all replicas in different AZs |

## 10 Rules

1. Primary handles all writes; replicas handle reads — never write to a replica.
2. Set `maximum_lag_on_failover` — a lagging replica promoted to primary causes data loss.
3. Monitor replication lag continuously — alert at 30s, page at 5 minutes.
4. Replication slots must be monitored — an unused slot prevents WAL cleanup and fills disk.
5. Replicas in different AZs or regions from primary — same-AZ replication is not HA.
6. Automatic failover reduces RTO from minutes to seconds — Patroni, RDS Multi-AZ, or Aurora.
7. Application must be aware of eventual consistency — reads after writes go to primary.
8. Test failover quarterly — untested failover is not failover.
9. Semi-synchronous replication for zero-data-loss requirements — async replication can lose committed transactions.
10. Read replicas are not backups — they replicate deletes and corruption too.
