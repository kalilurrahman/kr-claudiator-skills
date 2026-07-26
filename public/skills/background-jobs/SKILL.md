---
name: background-jobs
description: Design background job systems for async task processing. Outputs job queue design, worker configuration, retry strategies, failure handling, and monitoring patterns.
argument-hint: [job types, volume, latency requirements, failure tolerance, infrastructure]
allowed-tools: Read, Write
---

# Background Jobs

Background jobs handle work that shouldn't block the request-response cycle: sending emails, generating reports, processing uploads, syncing with third parties. Good job design addresses idempotency, retries, failure visibility, and concurrency without overcomplicating the system.

## Job Queue Options

```
Redis + Celery (Python)          → Mature, feature-rich, good for medium scale
Redis + BullMQ (Node.js)         → Modern, TypeScript-first, excellent UI
PostgreSQL + pg_boss              → Durable, no extra infra, transactional enqueue
RabbitMQ + workers               → Flexible routing, strong delivery guarantees
AWS SQS + Lambda/ECS             → Serverless workers, managed scaling
Temporal / Conductor             → Durable workflows, long-running orchestration
```

## Celery (Python) Setup

```python
# tasks/celery_app.py
from celery import Celery
from celery.utils.log import get_task_logger
import os

app = Celery(
    "myapp",
    broker=os.environ["REDIS_URL"],
    backend=os.environ["REDIS_URL"],
    include=["tasks.orders", "tasks.notifications", "tasks.reports"],
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Retry configuration
    task_acks_late=True,           # Ack after completion, not on pickup
    task_reject_on_worker_lost=True,
    # Routing
    task_routes={
        "tasks.reports.*": {"queue": "reports"},     # Slow queue
        "tasks.notifications.*": {"queue": "fast"},  # Fast queue
    },
    # Rate limiting
    task_annotations={
        "tasks.notifications.send_email": {"rate_limit": "100/m"},
    },
)

# tasks/orders.py
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,           # 1 minute
    autoretry_for=(Exception,),
    retry_backoff=True,               # Exponential backoff
    retry_backoff_max=600,            # Max 10 min between retries
    retry_jitter=True,                # Add randomness to avoid thundering herd
    acks_late=True,
)
def process_order(self, order_id: str) -> dict:
    """Process an order asynchronously."""
    logger.info(f"Processing order {order_id} (attempt {self.request.retries + 1})")
    
    try:
        order = order_repo.get(order_id)
        if not order:
            logger.warning(f"Order {order_id} not found — skipping")
            return {"status": "skipped", "reason": "not_found"}
        
        result = order_service.fulfil(order)
        logger.info(f"Order {order_id} processed successfully")
        return {"status": "success", "order_id": order_id}
    
    except TransientError as exc:
        logger.warning(f"Transient error for {order_id}: {exc}")
        raise self.retry(exc=exc)
    except PermanentError as exc:
        logger.error(f"Permanent failure for {order_id}: {exc}")
        # Don't retry — alert and move to DLQ
        alert_on_call(f"Permanent job failure: order {order_id}")
        return {"status": "failed", "error": str(exc)}
```

## BullMQ (Node.js / TypeScript)

```typescript
import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL!);

// Producer
export const orderQueue = new Queue("orders", { connection });

export async function enqueueOrderProcessing(orderId: string) {
  await orderQueue.add(
    "process-order",
    { orderId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    }
  );
}

// Worker
const worker = new Worker(
  "orders",
  async (job) => {
    const { orderId } = job.data;
    console.log(`Processing order ${orderId} (attempt ${job.attemptsMade + 1})`);

    const order = await orderRepo.get(orderId);
    if (!order) return { status: "skipped" };

    await orderService.fulfil(order);
    return { status: "success" };
  },
  {
    connection,
    concurrency: 10,
    limiter: { max: 100, duration: 60_000 }, // 100 jobs per minute
  }
);

worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts!) {
    // Final failure — send to DLQ or alert
    alertOncall(`Job ${job.id} permanently failed: ${err.message}`);
  }
});
```

## Idempotency Pattern

```python
@shared_task(bind=True, max_retries=3)
def send_confirmation_email(self, order_id: str, email: str) -> dict:
    # Idempotency key — prevent duplicate emails on retry
    idempotency_key = f"email:confirmation:{order_id}"
    
    if redis.exists(idempotency_key):
        logger.info(f"Email already sent for {order_id} — skipping")
        return {"status": "already_sent"}
    
    email_service.send_confirmation(order_id=order_id, to=email)
    
    # Mark as sent (expire after 48h)
    redis.setex(idempotency_key, 172800, "sent")
    return {"status": "sent"}
```

## Job Monitoring

```python
# Dead letter queue consumer
@shared_task
def process_dead_letters():
    """Review and optionally replay failed jobs."""
    failed_jobs = celery_app.control.inspect().reserved()
    # ... review, alert, replay logic

# Health check endpoint
@app.get("/health/workers")
def worker_health():
    inspect = celery_app.control.inspect()
    stats = inspect.stats()
    if not stats:
        return {"status": "unhealthy", "workers": 0}
    return {
        "status": "healthy",
        "workers": len(stats),
        "queues": {
            "orders": redis.llen("celery:orders"),
            "fast": redis.llen("celery:fast"),
            "reports": redis.llen("celery:reports"),
        }
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No idempotency** | Retry sends duplicate emails, charges | Idempotency key in Redis/DB before side effects |
| **Blocking in workers** | One slow job stalls others | Async workers; separate queues by job type |
| **No DLQ** | Failed jobs silently dropped | Dead letter queue + alerting on DLQ depth |
| **Unbounded queue depth** | Queue grows without bound | Alert at queue depth thresholds |
| **All jobs in one queue** | Slow reports block fast notifications | Queue per job type/priority |
| **No job timeout** | Zombie workers hold tasks forever | Always set soft and hard timeouts |

## 10 Rules

1. Every job that has side effects must be idempotent — retries are guaranteed.
2. `acks_late=True` — ack after completion, not on pickup, to prevent job loss on worker crash.
3. Separate queues by priority and speed — never let reports block email sends.
4. Dead letter queue with alerting — failed jobs must be visible, not silently dropped.
5. Exponential backoff with jitter — prevents thundering herd on dependency recovery.
6. Job timeouts are mandatory — zombie workers holding tasks cause queue stalls.
7. Transient failures retry; permanent failures alert and stop.
8. Monitor queue depth per queue — alert when depth grows unexpectedly.
9. Track job success rate, latency p99, and failure rate in dashboards.
10. Test retry behaviour explicitly — inject failures in tests to verify idempotency.
