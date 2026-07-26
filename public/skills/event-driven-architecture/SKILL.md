---
name: event-driven-architecture
description: Design event-driven systems with producers, consumers, event schemas, and delivery guarantees. Outputs event catalog, topology diagram, schema contracts, and consumer group strategy.
argument-hint: [business domain, event volume, consistency requirements, broker choice]
allowed-tools: Read, Write
---

# Event-Driven Architecture (EDA)

EDA decouples producers from consumers through asynchronous events. Producers emit facts; consumers react. Neither knows about the other. This enables independent scaling, deployment, and evolution — at the cost of eventual consistency and increased operational complexity.

## Process

1. **Identify domain events.** Run event storming. Capture facts in past tense: `OrderPlaced`, `PaymentFailed`, `InventoryReserved`.
2. **Classify events.** Domain events (business facts), integration events (cross-service), system events (infrastructure).
3. **Design event schemas.** Schema-first. Include event ID, type, version, timestamp, source, correlation ID, and payload.
4. **Choose broker.** Kafka for ordered, durable, high-throughput streams. RabbitMQ/SQS for simple work queues. EventBridge for cloud-native fan-out.
5. **Define topics/exchanges.** One topic per event type, or domain-partitioned topics. Choose partition key for ordering guarantees.
6. **Design consumer groups.** Which services consume which events. Decide competing consumers vs fan-out.
7. **Handle failures.** Dead letter queues, retry policies, idempotent consumers.
8. **Version the schema.** Forward/backward compatibility rules. Schema registry.

## Event Schema Design

```json
// Standard envelope — wrap every event
{
  "eventId": "01HQ7K2X3Y4Z5A6B7C8D9E0F1G",
  "eventType": "order.placed",
  "eventVersion": "1.2",
  "occurredAt": "2024-03-15T14:30:00.000Z",
  "source": "order-service",
  "correlationId": "req-abc123",
  "causationId": "cmd-xyz789",
  "payload": {
    "orderId": "ord-456",
    "customerId": "cust-789",
    "items": [
      { "productId": "prod-101", "quantity": 2, "unitPrice": 29.99 }
    ],
    "totalAmount": 59.98,
    "currency": "USD"
  }
}
```

```python
# Python event schema with Pydantic
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

class EventEnvelope(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    event_version: str = "1.0"
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    source: str
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None
    payload: Any

class OrderPlacedPayload(BaseModel):
    order_id: str
    customer_id: str
    total_amount: float
    currency: str

# Produce
def publish_order_placed(order, correlation_id: str):
    event = EventEnvelope(
        event_type="order.placed",
        event_version="1.2",
        source="order-service",
        correlation_id=correlation_id,
        payload=OrderPlacedPayload(
            order_id=order.id,
            customer_id=order.customer_id,
            total_amount=float(order.total.amount) / 100,
            currency=order.total.currency,
        ).dict()
    )
    kafka_producer.send("orders", key=order.id, value=event.json())
```

## Kafka Topic Design

```
Topic naming: {domain}.{entity}.{event-type}
  orders.order.placed
  orders.order.cancelled
  payments.payment.captured
  inventory.stock.reserved

Partition strategy:
- Partition key = entity ID (order_id, customer_id)
- Events for same entity always go to same partition → ordering guaranteed
- Number of partitions = max consumer parallelism needed

Retention:
- 7 days default for operational events
- Indefinite for audit/compliance events (use log compaction for latest-value topics)
- Separate topics for high-volume metrics (shorter retention)

Example Kafka setup:
```

```python
from confluent_kafka import Producer, Consumer, KafkaError
from confluent_kafka.admin import AdminClient, NewTopic

# Create topics
admin = AdminClient({'bootstrap.servers': 'kafka:9092'})
topics = [
    NewTopic('orders.order.placed',    num_partitions=12, replication_factor=3),
    NewTopic('payments.payment.result', num_partitions=6,  replication_factor=3),
    NewTopic('inventory.stock.reserved', num_partitions=6, replication_factor=3),
]
admin.create_topics(topics)

# Producer with reliability settings
producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'acks': 'all',              # All replicas must ack
    'retries': 5,
    'enable.idempotence': True, # Exactly-once producer semantics
    'compression.type': 'snappy',
})

def publish_event(topic: str, key: str, event: EventEnvelope):
    producer.produce(
        topic=topic,
        key=key.encode(),
        value=event.json().encode(),
        on_delivery=_delivery_report,
    )
    producer.flush()

def _delivery_report(err, msg):
    if err:
        logger.error(f'Event delivery failed: {err}')
        # Alert and dead-letter
    else:
        logger.debug(f'Event delivered to {msg.topic()} [{msg.partition()}]')
```

## Consumer Patterns

```python
# Idempotent consumer — safe to process same event twice
class OrderPlacedConsumer:
    def __init__(self, order_repo, processed_events_repo):
        self._orders = order_repo
        self._processed = processed_events_repo
    
    def handle(self, event: EventEnvelope) -> None:
        # Check idempotency key before processing
        if self._processed.exists(event.event_id):
            logger.info(f"Already processed {event.event_id} — skipping")
            return
        
        payload = OrderPlacedPayload(**event.payload)
        self._create_fulfilment_request(payload)
        
        # Mark as processed atomically with business action
        self._processed.record(event.event_id, processed_at=datetime.utcnow())
    
    def _create_fulfilment_request(self, payload):
        ...

# Consumer group setup
consumer = Consumer({
    'bootstrap.servers': 'kafka:9092',
    'group.id': 'fulfilment-service',  # All instances share group
    'auto.offset.reset': 'earliest',
    'enable.auto.commit': False,        # Manual commit after processing
    'max.poll.interval.ms': 300000,
})

consumer.subscribe(['orders.order.placed'])

while True:
    msg = consumer.poll(timeout=1.0)
    if msg is None: continue
    if msg.error():
        if msg.error().code() == KafkaError._PARTITION_EOF: continue
        logger.error(f"Consumer error: {msg.error()}")
        continue
    
    try:
        event = EventEnvelope.parse_raw(msg.value())
        handler.handle(event)
        consumer.commit(message=msg)  # Commit after successful processing
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        send_to_dlq(msg)  # Don't commit — send to dead letter queue
        consumer.commit(message=msg)  # Commit anyway to advance offset
```

## Dead Letter Queue Strategy

```python
# DLQ handler — inspect, alert, replay
DLQ_TOPIC = "dlq.fulfilment-service"

def send_to_dlq(original_msg, error: Exception):
    dlq_event = {
        "original_topic": original_msg.topic(),
        "original_partition": original_msg.partition(),
        "original_offset": original_msg.offset(),
        "original_key": original_msg.key().decode(),
        "original_value": original_msg.value().decode(),
        "error_type": type(error).__name__,
        "error_message": str(error),
        "failed_at": datetime.utcnow().isoformat(),
        "consumer_group": "fulfilment-service",
    }
    producer.produce(DLQ_TOPIC, value=json.dumps(dlq_event))

# Replay from DLQ after fix
def replay_dlq():
    dlq_consumer = Consumer({'group.id': 'dlq-replay', ...})
    dlq_consumer.subscribe([DLQ_TOPIC])
    while True:
        msg = dlq_consumer.poll(1.0)
        if msg:
            dlq_event = json.loads(msg.value())
            # Re-publish to original topic
            producer.produce(
                dlq_event['original_topic'],
                key=dlq_event['original_key'],
                value=dlq_event['original_value']
            )
```

## Event Catalog Template

```markdown
## Event: order.placed (v1.2)

**Producer:** order-service  
**Consumers:** fulfilment-service, notification-service, analytics-service  
**Topic:** orders.order.placed  
**Partition key:** orderId  
**Retention:** 7 days  
**Volume:** ~5,000/day peak  

### Schema
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| orderId | string | yes | UUID of order |
| customerId | string | yes | UUID of customer |
| totalAmount | number | yes | In major currency unit |
| currency | string | yes | ISO 4217 code |
| items | array | yes | Line items array |

### Changelog
- v1.2: Added `currency` field (backward compatible)
- v1.1: Added `items` array
- v1.0: Initial release
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Event as command** | `PlaceOrder` event — couples producer and consumer | Events are facts: `OrderPlaced` |
| **Fat events** | Entire object in payload — any change breaks consumers | Include IDs + changed fields; consumers fetch what they need |
| **No schema registry** | Producers change schema silently, consumers break | Confluent Schema Registry or AWS Glue Schema Registry |
| **Non-idempotent consumers** | Duplicate delivery causes duplicate side effects | Idempotency key stored in DB |
| **Missing correlation ID** | Impossible to trace request across services | Always propagate correlationId through event chain |
| **Synchronous in-band events** | Publishing event in same DB transaction as business action | Transactional outbox pattern |
| **Ignoring ordering** | Events processed out of order cause inconsistency | Partition by entity ID; use sequence numbers |

## 10 Rules

1. Events are immutable facts in the past tense — they record what happened, not what to do.
2. Every event needs a unique ID, timestamp, source, and version. No exceptions.
3. Consumers must be idempotent — assume every event can be delivered more than once.
4. Partition by entity ID to maintain ordering guarantees for a given entity.
5. Use the transactional outbox pattern when publishing events from within a database transaction.
6. Schema changes must be backward compatible — add fields, never remove or rename them under the same version.
7. Every consumer group needs a dead letter queue with alerting.
8. Correlation IDs are mandatory — without them distributed tracing is impossible.
9. Start with fewer, broader topics. You can split later; merging is painful.
10. Eventual consistency is a feature, not a bug — design consumers to handle stale reads gracefully.
