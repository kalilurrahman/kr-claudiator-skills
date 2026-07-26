---
name: real-time-analytics
description: Build real-time analytics pipelines with sub-second query latency. Outputs streaming architecture, OLAP store selection, aggregation strategy, and dashboard update patterns.
argument-hint: [event volume, query latency target, aggregation complexity, dashboard tool]
allowed-tools: Read, Write, Bash
---

# Real-Time Analytics

Real-time analytics delivers insights within seconds of events occurring. The challenge is bridging the gap between transactional systems (OLTP) optimised for writes and analytical systems (OLAP) optimised for aggregation reads — at low latency and high throughput.

## Process

1. **Define latency targets.** "Real-time" means different things: <100ms (streaming OLAP), <5s (micro-batch), <60s (near-real-time). Each requires different architecture.
2. **Identify the event stream.** Where do events originate? Kafka topics, CDC streams, application logs.
3. **Choose the OLAP store.** ClickHouse (fastest for time-series + aggregation), Apache Druid (streaming ingestion), Apache Pinot (sub-second at scale), DuckDB (small-medium scale).
4. **Design aggregation strategy.** Pre-aggregate in stream (lower query load, higher freshness latency) vs raw ingestion (higher query load, lower freshness latency).
5. **Build the ingestion pipeline.** Kafka → Flink/Spark Streaming → OLAP store.
6. **Design the query layer.** Materialized views for common aggregations; ad-hoc queries for exploration.
7. **Set up dashboard push.** WebSocket or SSE for live dashboard updates; polling for near-real-time.

## Architecture Patterns

```
Pattern 1: Streaming OLAP (sub-second latency)
Events → Kafka → ClickHouse/Druid (streaming ingest) → Dashboard (polling 1s)
Latency: 1-5 seconds end-to-end
Best for: High-volume metrics, dashboards, alerting

Pattern 2: Kappa Architecture (stream-only)
Events → Kafka → Flink (stateful aggregations) → Redis/ClickHouse → API
Latency: <1 second
Best for: Real-time aggregations, leaderboards, live counters

Pattern 3: Lambda (batch + stream)
Events → Kafka ──┬── Flink (stream layer) → Fast store
                 └── Spark (batch layer)  → Slow store (accurate)
                                         Merge at query time
Latency: Stream: <1s | Batch: hours
Best for: Historical accuracy + real-time estimates
(avoid if possible — operationally complex)
```

## ClickHouse — Real-Time OLAP

```sql
-- Table optimised for time-series events
CREATE TABLE events (
    event_id     UUID,
    event_type   LowCardinality(String),
    user_id      UInt64,
    session_id   String,
    page         LowCardinality(String),
    properties   String,   -- JSON
    event_time   DateTime64(3),  -- millisecond precision
    date         Date MATERIALIZED toDate(event_time),
    hour         UInt8 MATERIALIZED toHour(event_time)
) ENGINE = MergeTree()
PARTITION BY date                    -- Partition for fast date-range queries
ORDER BY (event_type, user_id, event_time)  -- Primary key / sort order
TTL date + INTERVAL 90 DAY          -- Auto-delete old data
SETTINGS index_granularity = 8192;

-- Materialized view: pre-aggregate by minute
CREATE MATERIALIZED VIEW events_1min_agg
ENGINE = SummingMergeTree()
PARTITION BY toDate(bucket)
ORDER BY (event_type, page, bucket)
AS
SELECT
    event_type,
    page,
    toStartOfMinute(event_time) AS bucket,
    count()                     AS event_count,
    uniq(user_id)               AS unique_users,
    uniq(session_id)            AS unique_sessions
FROM events
GROUP BY event_type, page, bucket;

-- Real-time dashboard query (runs in <100ms on billions of rows)
SELECT
    toStartOfMinute(event_time) AS minute,
    count()                     AS page_views,
    uniq(user_id)               AS unique_users,
    uniq(session_id)            AS sessions
FROM events
WHERE
    event_type = 'page_view'
    AND event_time >= now() - INTERVAL 1 HOUR
GROUP BY minute
ORDER BY minute;

-- Active users right now (last 5 minutes)
SELECT uniq(user_id) AS active_users
FROM events
WHERE event_time >= now() - INTERVAL 5 MINUTE;
```

## Kafka → ClickHouse Ingestion

```python
# Python: Consume from Kafka, batch-insert to ClickHouse
from confluent_kafka import Consumer
from clickhouse_driver import Client
import json
from datetime import datetime
from collections import deque
import threading
import time

class ClickHouseKafkaIngester:
    def __init__(self, kafka_config: dict, ch_host: str, batch_size: int = 10000):
        self.consumer = Consumer(kafka_config)
        self.ch = Client(ch_host)
        self.batch_size = batch_size
        self.batch = deque()
        self.lock = threading.Lock()
    
    def start(self, topics: list):
        self.consumer.subscribe(topics)
        
        # Flush thread — flush every second even if batch not full
        flush_thread = threading.Thread(target=self._flush_periodically, daemon=True)
        flush_thread.start()
        
        while True:
            msg = self.consumer.poll(timeout=0.1)
            if msg is None: continue
            if msg.error(): continue
            
            event = json.loads(msg.value())
            with self.lock:
                self.batch.append(self._transform(event))
                if len(self.batch) >= self.batch_size:
                    self._flush()
    
    def _transform(self, event: dict) -> tuple:
        return (
            event.get('event_id', ''),
            event.get('event_type', ''),
            int(event.get('user_id', 0)),
            event.get('session_id', ''),
            event.get('page', ''),
            json.dumps(event.get('properties', {})),
            datetime.fromisoformat(event['event_time'].replace('Z', '+00:00')),
        )
    
    def _flush(self):
        if not self.batch: return
        rows = list(self.batch)
        self.batch.clear()
        self.ch.execute(
            """INSERT INTO events 
               (event_id, event_type, user_id, session_id, page, properties, event_time)
               VALUES""",
            rows
        )
    
    def _flush_periodically(self):
        while True:
            time.sleep(1.0)
            with self.lock:
                self._flush()
```

## Apache Flink — Stateful Stream Processing

```python
# PyFlink — real-time aggregation
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.window import TumblingEventTimeWindows
from pyflink.common.time import Time
from pyflink.datastream.functions import AggregateFunction

env = StreamExecutionEnvironment.get_execution_environment()
env.set_parallelism(4)

class PageViewAggregator(AggregateFunction):
    def create_accumulator(self):
        return {"count": 0, "unique_users": set()}
    
    def add(self, value, accumulator):
        accumulator["count"] += 1
        accumulator["unique_users"].add(value["user_id"])
        return accumulator
    
    def get_result(self, accumulator):
        return {
            "count": accumulator["count"],
            "unique_users": len(accumulator["unique_users"])
        }
    
    def merge(self, a, b):
        return {
            "count": a["count"] + b["count"],
            "unique_users": a["unique_users"] | b["unique_users"]
        }

# 1-minute tumbling window aggregation
stream = (
    env.add_source(kafka_source)
    .filter(lambda e: e["event_type"] == "page_view")
    .key_by(lambda e: e["page"])
    .window(TumblingEventTimeWindows.of(Time.minutes(1)))
    .aggregate(PageViewAggregator())
    .add_sink(clickhouse_sink)
)

env.execute("page-view-aggregation")
```

## Real-Time Dashboard — WebSocket Push

```javascript
// Server: Node.js WebSocket + ClickHouse query
const WebSocket = require('ws');
const { createClient } = require('@clickhouse/client');

const wss = new WebSocket.Server({ port: 8080 });
const ch = createClient({ url: 'http://clickhouse:8123' });

async function getLiveMetrics() {
  const result = await ch.query({
    query: `
      SELECT
        uniq(user_id) AS active_users,
        count() AS events_per_minute,
        countIf(event_type = 'purchase') AS purchases
      FROM events
      WHERE event_time >= now() - INTERVAL 1 MINUTE
    `,
    format: 'JSONEachRow',
  });
  return await result.json();
}

// Push metrics to all connected dashboards every second
setInterval(async () => {
  const metrics = await getLiveMetrics();
  const payload = JSON.stringify(metrics);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}, 1000);
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Using PostgreSQL for real-time analytics** | OLTP DB crushes under analytical queries | ClickHouse or Druid for analytics workloads |
| **No time-based partitioning** | Full table scans on billions of rows | Partition by date; queries touch only relevant partitions |
| **Pre-aggregating everything** | Flexibility lost; can't answer new questions | Keep raw events; pre-aggregate common patterns |
| **Dashboard polling too fast** | 100 users × 1s poll = 100 QPS on OLAP | WebSocket push from server; server polls once |
| **No TTL on event data** | Disk grows forever | Set TTL — raw events deleted after 90 days; aggregates kept longer |
| **Lambda architecture by default** | Two codepaths to maintain | Start with Kappa; add batch only when accuracy gaps confirmed |
| **Ignoring out-of-order events** | Late arrivals corrupt real-time aggregations | Watermarks in Flink; allow-late config in windowing |

## 10 Rules

1. Define latency target first — it determines architecture, not vice versa.
2. ClickHouse MergeTree ORDER BY is the primary index — choose it based on query patterns, not write patterns.
3. Materialized views for frequent aggregations — queries that run every second should pre-compute.
4. Partition by date — time-series queries touch date-range partitions only.
5. Set TTL on raw events — raw data is expensive to store at scale; aggregate and discard.
6. Push from server to dashboard — don't poll from browser.
7. Kafka consumer group per downstream system — don't share consumer groups across different pipelines.
8. Handle late data explicitly — watermarks, allow-late windows, or separate reconciliation job.
9. Test at 10× expected load — real-time systems fail under load in ways batch systems don't.
10. Separate write path from read path — ingestion optimisation and query optimisation conflict; keep them independent.
