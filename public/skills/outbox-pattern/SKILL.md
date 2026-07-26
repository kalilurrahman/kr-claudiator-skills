---
name: outbox-pattern
description: Implement the Transactional Outbox pattern to reliably publish events alongside database writes. Outputs outbox table schema, message relay implementation, and at-least-once delivery guarantees.
argument-hint: [database type, message broker, event volume, consistency requirements]
allowed-tools: Read, Write
---

# Transactional Outbox Pattern

The outbox pattern solves the dual-write problem: you need to save data to the database AND publish an event, but they can't be in one atomic transaction. Without the outbox, events get lost on crash between the two operations. With it, both happen atomically or not at all.

## The Problem

```
NAIVE APPROACH (broken):
1. Save order to database  ← can succeed
2. Publish OrderPlaced to Kafka ← can fail independently
→ If step 2 fails, event is lost. If you retry, you might double-save.

OUTBOX APPROACH (reliable):
1. Save order + outbox message in ONE database transaction (atomic)
2. Background relay reads outbox and publishes to Kafka
3. Mark message as sent
→ If relay crashes, it retries from the outbox. At-least-once delivery guaranteed.
```

## Outbox Table

```sql
CREATE TABLE outbox_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  VARCHAR(100) NOT NULL,   -- 'Order', 'Customer'
    aggregate_id    VARCHAR(255) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,   -- 'order.placed'
    event_version   VARCHAR(10)  NOT NULL DEFAULT '1.0',
    payload         JSONB        NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    -- pending | processing | sent | failed
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ,
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    last_error      TEXT,
    locked_until    TIMESTAMPTZ  -- Pessimistic locking for concurrent relays
);

CREATE INDEX ON outbox_messages (status, created_at)
    WHERE status IN ('pending', 'failed');
CREATE INDEX ON outbox_messages (aggregate_id);
```

## Write Side — Atomic Save

```python
from sqlalchemy.ext.asyncio import AsyncSession
import json, uuid
from datetime import datetime

class OrderService:
    def __init__(self, session: AsyncSession):
        self._session = session
    
    async def place_order(self, customer_id: str, items: list) -> dict:
        async with self._session.begin():
            # 1. Save the order
            order_id = str(uuid.uuid4())
            await self._session.execute(
                """INSERT INTO orders (id, customer_id, status, created_at)
                   VALUES (:id, :customer_id, 'confirmed', NOW())""",
                {"id": order_id, "customer_id": customer_id}
            )
            
            # 2. Write outbox message IN THE SAME TRANSACTION
            await self._session.execute(
                """INSERT INTO outbox_messages
                   (aggregate_type, aggregate_id, event_type, payload)
                   VALUES (:agg_type, :agg_id, :event_type, :payload)""",
                {
                    "agg_type": "Order",
                    "agg_id": order_id,
                    "event_type": "order.placed",
                    "payload": json.dumps({
                        "order_id": order_id,
                        "customer_id": customer_id,
                        "items": items,
                        "occurred_at": datetime.utcnow().isoformat(),
                    }),
                }
            )
            # Both commit or both roll back — atomicity guaranteed
        
        return {"order_id": order_id}
```

## Message Relay (Poller)

```python
import asyncio
from datetime import datetime, timedelta
from confluent_kafka import Producer

class OutboxRelay:
    """Background process: reads outbox, publishes to Kafka, marks sent."""
    
    BATCH_SIZE = 100
    LOCK_DURATION_SECONDS = 30
    RETRY_DELAY_SECONDS = [5, 30, 120, 600]  # Exponential backoff
    MAX_RETRIES = 4
    
    def __init__(self, session_factory, kafka_producer: Producer):
        self._session_factory = session_factory
        self._producer = kafka_producer
        self._relay_id = str(uuid.uuid4())  # Unique per relay instance
    
    async def run(self):
        """Continuous relay loop."""
        while True:
            processed = await self._process_batch()
            if processed == 0:
                await asyncio.sleep(1)  # Back off when no messages
    
    async def _process_batch(self) -> int:
        async with self._session_factory() as session:
            async with session.begin():
                # Lock a batch of pending messages (skip locked = no blocking)
                messages = await session.execute(
                    """SELECT id, aggregate_type, aggregate_id,
                              event_type, payload, retry_count
                       FROM outbox_messages
                       WHERE status = 'pending'
                         AND (locked_until IS NULL OR locked_until < NOW())
                         AND retry_count < :max_retries
                       ORDER BY created_at
                       LIMIT :batch_size
                       FOR UPDATE SKIP LOCKED""",
                    {"max_retries": self.MAX_RETRIES,
                     "batch_size": self.BATCH_SIZE}
                )
                messages = messages.fetchall()
                
                if not messages:
                    return 0
                
                # Lock the messages
                ids = [m.id for m in messages]
                await session.execute(
                    """UPDATE outbox_messages
                       SET status = 'processing',
                           locked_until = NOW() + INTERVAL ':seconds seconds'
                       WHERE id = ANY(:ids)""",
                    {"seconds": self.LOCK_DURATION_SECONDS, "ids": ids}
                )
            
            # Publish outside transaction (Kafka publish is not transactional with DB)
            sent_ids = []
            failed = {}
            
            for msg in messages:
                try:
                    topic = self._topic_for(msg.aggregate_type, msg.event_type)
                    self._producer.produce(
                        topic=topic,
                        key=msg.aggregate_id,
                        value=msg.payload,
                        headers={"event_type": msg.event_type},
                    )
                    sent_ids.append(msg.id)
                except Exception as e:
                    failed[msg.id] = str(e)
            
            self._producer.flush()
            
            # Update status
            async with self._session_factory() as session:
                async with session.begin():
                    if sent_ids:
                        await session.execute(
                            """UPDATE outbox_messages
                               SET status = 'sent', sent_at = NOW()
                               WHERE id = ANY(:ids)""",
                            {"ids": sent_ids}
                        )
                    for msg_id, error in failed.items():
                        msg = next(m for m in messages if m.id == msg_id)
                        delay = self.RETRY_DELAY_SECONDS[
                            min(msg.retry_count, len(self.RETRY_DELAY_SECONDS)-1)
                        ]
                        await session.execute(
                            """UPDATE outbox_messages
                               SET status = 'pending',
                                   retry_count = retry_count + 1,
                                   last_error = :error,
                                   locked_until = NOW() + INTERVAL ':delay seconds'
                               WHERE id = :id""",
                            {"error": error, "delay": delay, "id": msg_id}
                        )
            
            return len(messages)
    
    def _topic_for(self, aggregate_type: str, event_type: str) -> str:
        return f"{aggregate_type.lower()}s.{event_type}"
```

## CDC-Based Relay (Debezium Alternative)

```yaml
# Instead of polling, use Change Data Capture
# Debezium watches the outbox table and publishes changes to Kafka

# debezium-connector.json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "${DB_PASSWORD}",
    "database.dbname": "production",
    "table.include.list": "public.outbox_messages",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.payload": "payload",
    "transforms.outbox.table.field.event.type": "event_type"
  }
}
```

## Cleanup Job

```sql
-- Daily cleanup of old sent messages
DELETE FROM outbox_messages
WHERE status = 'sent'
  AND sent_at < NOW() - INTERVAL '7 days';

-- Alert on failed messages
SELECT COUNT(*), MAX(retry_count), MIN(created_at)
FROM outbox_messages
WHERE status = 'failed' OR retry_count >= 4;
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Writing outbox after transaction commit** | Crash between commit and outbox write = lost event | Write outbox INSIDE the same transaction |
| **Single relay without locking** | Multiple relay instances double-publish | `FOR UPDATE SKIP LOCKED` on batch selection |
| **No retry with backoff** | Failed publishes spam Kafka/retry loop | Exponential backoff with max retry count |
| **Never deleting sent messages** | Outbox table grows forever | Clean up sent messages after 7 days |
| **Relying on exactly-once** | Kafka doesn't guarantee it by default | Consumers must be idempotent (at-least-once) |

## 10 Rules

1. Write the outbox message in the same database transaction as the business data — never after.
2. The relay is idempotent: publishing the same message twice is safe because consumers are idempotent.
3. Use `FOR UPDATE SKIP LOCKED` — prevents multiple relay instances from processing the same message.
4. Retry with exponential backoff — failed messages don't flood the broker.
5. Alert on messages stuck in failed status — they indicate a systematic problem.
6. Clean up sent messages on a schedule — unbounded tables degrade performance.
7. CDC (Debezium) relay is preferred over polling for high-volume, low-latency requirements.
8. The outbox is internal infrastructure — consumers don't know it exists.
9. Kafka topic naming follows the aggregate: `orders.order.placed`, not `outbox-messages`.
10. Test relay failure scenarios — what happens when Kafka is down? When the relay crashes mid-batch?
