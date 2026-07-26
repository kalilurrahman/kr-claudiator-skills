---
name: cdc-patterns
description: Design a Change Data Capture (CDC) pipeline to stream database changes to downstream consumers. Outputs connector config, schema design, consumer patterns, ordering guarantees, and failure handling.
argument-hint: [source database, downstream systems, latency requirements, ordering needs]
allowed-tools: Read, Write, Bash
---

# Change Data Capture (CDC) Design

CDC streams row-level changes (INSERT, UPDATE, DELETE) from a source database to downstream systems in near real-time. It enables event-driven architectures, cache invalidation, search indexing, analytics pipelines, and microservice data sync without polling or dual-writes.

## When to Use CDC

| Use case | CDC advantage |
|----------|---------------|
| Sync to search index (Elasticsearch) | Real-time indexing without app-layer coupling |
| Populate read replicas / caches | Consistent eventual sync without dual-writes |
| Feed analytics warehouse | Low-latency data replication |
| Microservice event sourcing | Source of truth stays in DB; events derived |
| Audit logging | Capture all changes without app-layer instrumentation |
| Cross-region replication | DB-level replication without distributed transactions |

## CDC Approaches

| Approach | How it works | Latency | Ordering | Impact on source |
|----------|-------------|---------|----------|-----------------|
| Log-based (WAL/binlog) | Reads DB transaction log directly | <1s | Total order per table | Near-zero |
| Trigger-based | DB triggers write to outbox table | <1s | Per-row | Moderate write overhead |
| Query-based (polling) | SELECT WHERE updated_at > last_run | Seconds–minutes | None | Read load on DB |
| Outbox pattern | App writes events to outbox table | <1s | Per-aggregate | App change required |

**Default recommendation: log-based CDC** (Debezium for Postgres/MySQL, DynamoDB Streams for DynamoDB).

## Process

1. **Choose the source connector** — Debezium for RDBMS, DynamoDB Streams, MongoDB Change Streams, etc.
2. **Enable WAL/binlog** on the source database with appropriate retention.
3. **Design the topic/stream layout** — one topic per table is the standard; consider partitioning strategy.
4. **Define the schema** — use Avro or JSON Schema with a schema registry for evolution.
5. **Handle the initial snapshot** — CDC connectors snapshot existing data before streaming changes.
6. **Design consumer patterns** — idempotent consumers, ordering guarantees, exactly-once semantics.
7. **Plan for failures** — connector restarts, consumer lag, schema evolution, source DB failover.
8. **Set up monitoring** — consumer lag, connector status, error rates, replication latency.
9. **Test with realistic load** — high-write tables, schema changes, source restarts.
10. **Save** configs to `cdc/connectors/` and `cdc/consumers/`.

## Output Format

### Debezium Connector Config (Postgres → Kafka)

```json
{
  "name": "postgres-cdc-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres.internal",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "${file:/secrets/debezium.properties:db.password}",
    "database.dbname": "app_db",
    "database.server.name": "app",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_slot",
    "publication.name": "debezium_pub",

    "table.include.list": "public.orders,public.users,public.products",

    "topic.prefix": "cdc",
    "topic.creation.enable": "true",
    "topic.creation.default.replication.factor": "3",
    "topic.creation.default.partitions": "6",

    "key.converter": "io.confluent.kafka.serializers.KafkaAvroSerializer",
    "value.converter": "io.confluent.kafka.serializers.KafkaAvroSerializer",
    "key.converter.schema.registry.url": "http://schema-registry:8081",
    "value.converter.schema.registry.url": "http://schema-registry:8081",

    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.delete.handling.mode": "rewrite",
    "transforms.unwrap.add.fields": "op,ts_ms,source.table",

    "heartbeat.interval.ms": "10000",
    "snapshot.mode": "initial",
    "snapshot.isolation.mode": "repeatable_read",

    "errors.tolerance": "all",
    "errors.deadletterqueue.topic.name": "cdc.dlq",
    "errors.deadletterqueue.context.headers.enable": "true"
  }
}
```

### Postgres WAL Configuration

```sql
-- postgresql.conf
wal_level = logical
max_replication_slots = 10
max_wal_senders = 10
wal_keep_size = 1GB   -- retain WAL for connector restart recovery

-- Create replication user
CREATE USER debezium WITH REPLICATION LOGIN PASSWORD 'secret';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO debezium;

-- Create publication (log-based CDC)
CREATE PUBLICATION debezium_pub FOR TABLE
  public.orders,
  public.users,
  public.products;
```

### CDC Event Schema (Avro)

```json
{
  "type": "record",
  "name": "OrderChangeEvent",
  "namespace": "com.example.cdc",
  "fields": [
    {"name": "id",          "type": "long"},
    {"name": "user_id",     "type": "long"},
    {"name": "status",      "type": "string"},
    {"name": "total_cents", "type": "long"},
    {"name": "updated_at",  "type": {"type": "long", "logicalType": "timestamp-millis"}},
    {"name": "__op",        "type": "string", "doc": "c=create, u=update, d=delete, r=read(snapshot)"},
    {"name": "__ts_ms",     "type": "long",   "doc": "Debezium processing timestamp"},
    {"name": "__deleted",   "type": "boolean","default": false}
  ]
}
```

### Consumer: Idempotent Elasticsearch Indexer

```python
from kafka import KafkaConsumer
from elasticsearch import Elasticsearch
import json, logging

consumer = KafkaConsumer(
    'cdc.app.public.orders',
    bootstrap_servers=['kafka:9092'],
    group_id='orders-es-indexer',
    auto_offset_reset='earliest',
    enable_auto_commit=False,       # manual commit for exactly-once
    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
    max_poll_records=500,
)

es = Elasticsearch(['http://elasticsearch:9200'])

def upsert_order(record):
    op = record.get('__op', 'c')
    order_id = str(record['id'])

    if op == 'd' or record.get('__deleted'):
        es.delete(index='orders', id=order_id, ignore=[404])
        return

    # Idempotent upsert — safe to replay
    es.index(
        index='orders',
        id=order_id,
        document={
            'id':          record['id'],
            'user_id':     record['user_id'],
            'status':      record['status'],
            'total_cents': record['total_cents'],
            'updated_at':  record['updated_at'],
        }
    )

BATCH_SIZE = 100
batch = []

for msg in consumer:
    batch.append(msg)
    if len(batch) >= BATCH_SIZE:
        for m in batch:
            try:
                upsert_order(m.value)
            except Exception as e:
                logging.error(f"Failed to index order {m.value.get('id')}: {e}")
                # Route to DLQ or alert — do not lose the message
                raise
        consumer.commit()
        batch.clear()
```

### Consumer Lag Monitoring (Prometheus)

```yaml
# kafka-lag-exporter config
clusters:
  - name: app-cluster
    bootstrap-brokers: kafka:9092
    consumer-groups:
      - orders-es-indexer
      - orders-cache-invalidator
      - orders-analytics-sink

# Alert rule
- alert: CDCConsumerLagHigh
  expr: kafka_consumer_group_lag{group=~"cdc-.*"} > 10000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "CDC consumer {{ $labels.group }} is lagging {{ $value }} messages"
```

## Ordering Guarantees

| Guarantee | How to achieve |
|-----------|---------------|
| Per-row ordering | Partition by primary key (default Debezium behavior) |
| Per-table ordering | Single partition per table (limits throughput) |
| Cross-table ordering | Use transaction metadata; complex — avoid if possible |
| Global ordering | Single partition; not scalable — do not use |

```
Topic: cdc.app.public.orders
Partition key: orders.id (primary key)
→ All changes to order #1234 always go to the same partition
→ Consumer sees changes to order #1234 in order
→ Changes to different orders may interleave — design consumers to handle this
```

## Failure Scenarios

| Scenario | Impact | Mitigation |
|----------|--------|-----------|
| Connector restart | Resumes from last committed offset | WAL retention must cover downtime window |
| Source DB failover | Replication slot on old primary is lost | Use logical replication slots on replica; configure `slot.drop.on.stop=false` |
| Consumer restart | Resumes from committed offset | Idempotent consumers handle re-delivery |
| Schema change (add column) | Avro schema evolution; compatible change | Use schema registry with FORWARD_TRANSITIVE compatibility |
| Schema change (drop column) | Breaking change | Add new topic; migrate consumers; deprecate old topic |
| Consumer lag spike | Downstream is behind | Scale consumer instances; check for slow ES/DB writes |
| DLQ message | Poison pill or processing error | Alert; replay after fix; never silently drop |

## Schema Evolution Rules

```
SAFE (FORWARD_TRANSITIVE compatible):
  - Add optional field with default value
  - Add new enum value (at end)

UNSAFE (requires migration):
  - Remove field
  - Rename field  
  - Change field type
  - Change primary key

Migration pattern for breaking changes:
  1. Create new topic: cdc.app.public.orders.v2
  2. Deploy new consumer reading v2
  3. Run dual-write period (old + new topic)
  4. Decommission old topic after all consumers migrated
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Polling with updated_at | Misses deletes; late-arriving updates lost | Use log-based CDC |
| No replication slot retention | Connector restart loses position | Set `wal_keep_size` and monitor slot lag |
| Non-idempotent consumers | Duplicate events cause double-processing | Design consumers to be idempotent (upsert, not insert) |
| Global ordering requirement | Forces single partition; kills throughput | Design data model to not require cross-entity ordering |
| Schema changes without registry | Consumer breaks on producer schema change | Always use schema registry with compatibility checks |
| Large WAL lag unmonitored | Disk fills up; source DB crashes | Alert on replication slot lag > threshold |
| Transforming events in connector | Complex transform logic in Kafka Connect is hard to test | Move transforms to consumer; keep connector thin |

## Rules

- **Log-based CDC is almost always correct** — triggers and polling are workarounds; use WAL/binlog when possible.
- **Partition by primary key** — guarantees per-entity ordering without sacrificing parallelism.
- **Idempotent consumers are mandatory** — CDC delivers at-least-once; consumers must handle duplicates.
- **Monitor replication slot lag** — an unconsumed slot holds WAL forever and will crash the source DB disk.
- **Use a schema registry** — uncontrolled schema evolution breaks consumers silently.
- **Never drop a replication slot without checking consumers** — it causes connector to lose position.
- **WAL retention must cover your maximum connector downtime** — if connector is down 2 hours, retain 3 hours of WAL.
- **Test schema changes in staging** — breaking changes must be coordinated across producer and all consumers.
- **Route failures to a DLQ** — never silently drop a CDC event; every message must be accounted for.
- **Design for eventual consistency** — downstream systems lag behind source; consumers must tolerate stale reads.
