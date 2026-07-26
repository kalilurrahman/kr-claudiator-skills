---
name: event-driven-api
description: Design an event-driven API strategy choosing between webhooks, Server-Sent Events, WebSockets, and polling. Covers delivery guarantees, retry logic, security, fan-out patterns, and tool selection.
argument-hint: [use case, latency requirements, client type, scale, delivery guarantee needed]
allowed-tools: Read, Write, Bash
---

# Event-Driven API Design

REST is pull — the client asks, the server answers. Event-driven APIs are push — the server notifies clients when something happens. Choosing the right push mechanism depends on latency requirements, client capabilities, delivery guarantees, and operational complexity.

## Mechanism Comparison

| Mechanism | Latency | Direction | Delivery guarantee | Complexity | Best for |
|-----------|---------|-----------|-------------------|-----------|---------|
| Polling | High (interval-dependent) | Pull | At-least-once (client-driven) | Low | Simple; client-controlled; rarely-changing data |
| Webhooks | Medium (seconds) | Server → Client | At-least-once (with retry) | Medium | Server-to-server; async workflows; third-party integrations |
| SSE (Server-Sent Events) | Low (< 1 second) | Server → Browser | Best-effort | Low | Browser clients; real-time dashboards; log streaming |
| WebSockets | Very low (< 100ms) | Bidirectional | Best-effort | High | Chat; collaborative editing; live games; bidirectional |
| Message queue (Kafka/SQS) | Low–medium | Any | At-least-once / exactly-once | High | High-volume; fan-out; durable; replay |

## When to Use Each

```
Use webhooks when:
  - Client is a server (not a browser)
  - Events are infrequent (< 100/sec per recipient)
  - At-least-once delivery is acceptable
  - You need to integrate with third parties (Stripe, GitHub, Slack)

Use SSE when:
  - Client is a browser
  - Server → browser notifications only (no bidirectional)
  - Events are continuous (dashboard updates, log tailing, progress bars)
  - You want simplicity (SSE is just HTTP/1.1)

Use WebSockets when:
  - Low-latency bidirectional communication needed
  - Client is a browser or native app
  - Use cases: chat, collaborative editing, live auctions

Use polling when:
  - Simplicity outweighs efficiency
  - Events are rare and latency tolerance is high
  - Client cannot receive push (CLI tools, cron jobs)
  - Use exponential backoff to reduce load
```

## Webhooks — Design and Implementation

### Server: delivering webhooks reliably

```python
import hmac, hashlib, json, time
import httpx
from datetime import datetime

class WebhookDelivery:
    def __init__(self, db, secret_store, http_client: httpx.AsyncClient):
        self.db      = db
        self.secrets = secret_store
        self.http    = http_client

    async def deliver(self, endpoint: dict, event: dict) -> dict:
        payload    = json.dumps(event, separators=(",", ":")).encode()
        timestamp  = int(time.time())
        secret     = self.secrets.get(endpoint["id"])
        signature  = self._sign(payload, timestamp, secret)

        headers = {
            "Content-Type":          "application/json",
            "X-Webhook-ID":          event["id"],
            "X-Webhook-Timestamp":   str(timestamp),
            "X-Webhook-Signature":   f"v1={signature}",
            "X-Webhook-Event":       event["type"],
        }

        delivery_id = await self.db.create_delivery(endpoint["id"], event["id"])
        result = await self._deliver_with_retry(endpoint["url"], payload, headers, delivery_id)
        return result

    def _sign(self, payload: bytes, timestamp: int, secret: str) -> str:
        """HMAC-SHA256 signature — same scheme as Stripe webhooks."""
        signed_payload = f"{timestamp}.".encode() + payload
        return hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()

    async def _deliver_with_retry(self, url: str, payload: bytes, headers: dict, delivery_id: str) -> dict:
        delays = [0, 5, 30, 120, 600, 3600]   # retry at 0s, 5s, 30s, 2m, 10m, 1h

        for attempt, delay in enumerate(delays):
            if delay:
                await asyncio.sleep(delay)
            try:
                resp = await self.http.post(url, content=payload, headers=headers, timeout=10.0)
                success = 200 <= resp.status_code < 300

                await self.db.record_attempt(delivery_id, attempt, resp.status_code, success)

                if success:
                    return {"status": "delivered", "attempts": attempt + 1}

                if resp.status_code in (400, 401, 403, 410):
                    # Non-retryable errors — stop immediately
                    await self.db.mark_failed(delivery_id, f"Non-retryable: {resp.status_code}")
                    return {"status": "failed", "reason": f"HTTP {resp.status_code}"}

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                await self.db.record_attempt(delivery_id, attempt, None, False, str(e))

        await self.db.mark_failed(delivery_id, "Max retries exceeded")
        return {"status": "failed", "reason": "max_retries"}
```

### Client: verifying webhook signatures

```python
import hmac, hashlib, time
from fastapi import Request, HTTPException

WEBHOOK_SECRET = "whsec_..."
TIMESTAMP_TOLERANCE = 300   # reject webhooks older than 5 minutes

async def verify_webhook(request: Request) -> dict:
    body      = await request.body()
    timestamp = request.headers.get("X-Webhook-Timestamp", "")
    signature = request.headers.get("X-Webhook-Signature", "")

    # Reject stale webhooks (replay attack prevention)
    if abs(time.time() - int(timestamp)) > TIMESTAMP_TOLERANCE:
        raise HTTPException(400, "Webhook timestamp too old")

    # Verify HMAC signature
    signed_payload = f"{timestamp}.".encode() + body
    expected = hmac.new(WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256).hexdigest()
    received = signature.removeprefix("v1=")

    if not hmac.compare_digest(expected, received):   # constant-time comparison
        raise HTTPException(400, "Invalid webhook signature")

    return json.loads(body)

@app.post("/webhooks/stripe")
async def handle_stripe_webhook(request: Request):
    event = await verify_webhook(request)

    # Idempotency: events may be delivered more than once
    if await db.webhook_already_processed(event["id"]):
        return {"status": "already_processed"}

    await process_event(event)
    await db.mark_webhook_processed(event["id"])
    return {"status": "ok"}
```

## Server-Sent Events (SSE)

```python
# FastAPI SSE endpoint
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio, json

app = FastAPI()

@app.get("/events/{user_id}")
async def event_stream(user_id: str, request: Request):
    async def generate():
        yield "retry: 3000\n\n"   # tell client to retry after 3 seconds on disconnect

        last_event_id = request.headers.get("Last-Event-ID")  # resume from here on reconnect

        async for event in subscribe_to_events(user_id, since=last_event_id):
            if await request.is_disconnected():
                break

            # SSE format: id, event type, data, blank line
            yield f"id: {event['id']}\n"
            yield f"event: {event['type']}\n"
            yield f"data: {json.dumps(event['payload'])}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        }
    )
```

```javascript
// Browser SSE client
const evtSource = new EventSource(`/events/${userId}`);

evtSource.addEventListener("order.shipped", (e) => {
  const order = JSON.parse(e.data);
  showNotification(`Order ${order.id} has shipped!`);
});

evtSource.addEventListener("order.delivered", (e) => {
  const order = JSON.parse(e.data);
  markOrderDelivered(order.id);
});

evtSource.onerror = () => {
  // Browser automatically reconnects using the retry interval
  // and sends Last-Event-ID header so server can resume
  console.log("SSE disconnected; reconnecting...");
};
```

## Webhook Fan-Out (one event → many subscribers)

```python
# Event bus: publish once, deliver to all subscribers
class WebhookFanOut:
    def __init__(self, db, delivery_service):
        self.db       = db
        self.delivery = delivery_service

    async def publish(self, event: dict) -> None:
        """Store event; enqueue delivery for every subscriber."""
        event_id = await self.db.store_event(event)

        # Find all active endpoints subscribed to this event type
        subscribers = await self.db.get_subscribers(
            event_type=event["type"],
            active=True
        )

        # Enqueue delivery tasks (processed by background workers)
        await asyncio.gather(*[
            self.queue.enqueue("deliver_webhook", endpoint_id=sub["id"], event_id=event_id)
            for sub in subscribers
        ])

# Usage: one event → fan out to all subscribing tenants
await fan_out.publish({
    "id":   str(uuid.uuid4()),
    "type": "order.completed",
    "payload": {"order_id": 42, "total": 99.99},
})
```

## Webhook Management API

```yaml
# OpenAPI spec for webhook subscription management
paths:
  /webhooks:
    post:
      summary: Register a webhook endpoint
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [url, events]
              properties:
                url:
                  type: string
                  format: uri
                  example: "https://app.example.com/hooks/payments"
                events:
                  type: array
                  items:
                    type: string
                    enum: [order.created, order.shipped, order.delivered, payment.failed]
                  example: [order.shipped, order.delivered]
                secret:
                  type: string
                  description: "Optional: your own HMAC secret. If omitted, we generate one."
      responses:
        "201":
          description: Webhook endpoint registered
          content:
            application/json:
              example:
                id: "wh_01HX..."
                url: "https://app.example.com/hooks/payments"
                events: [order.shipped, order.delivered]
                secret: "whsec_abc123..."
                created_at: "2025-01-15T14:00:00Z"

  /webhooks/{id}/test:
    post:
      summary: Send a test event to verify the endpoint is working
      responses:
        "200":
          description: Test event delivered
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No retry logic on webhook delivery | Transient failures cause permanent event loss | Exponential backoff with at least 5 retry attempts |
| No signature verification | Unauthenticated callers can inject fake events | HMAC-SHA256; constant-time comparison; reject old timestamps |
| Synchronous processing of webhook payload | Slow processing blocks the delivery ACK; sender retries | Return 200 immediately; process in a background job |
| No idempotency on webhook receipt | Retried events processed twice | Store and check event ID before processing |
| WebSockets for one-directional push | Unnecessary complexity | Use SSE for server → browser; WebSockets for bidirectional |
| No delivery log / audit trail | Cannot debug missed events | Persist every delivery attempt: timestamp, status, response |

## Rules

- **Webhooks for server-to-server; SSE for browser** — match the mechanism to the client type.
- **Always sign webhook payloads** — HMAC-SHA256 with a per-endpoint secret; reject unsigned requests.
- **Reject timestamps older than 5 minutes** — replay attack prevention with no operational cost.
- **Return 200 immediately; process asynchronously** — a slow webhook handler causes unnecessary retries.
- **Idempotency keys on every event** — events will be delivered more than once; the receiver must handle duplicates.
- **Retry with exponential backoff** — at least 6 attempts over several hours; alert on persistent failure.
- **Log every delivery attempt** — timestamp, HTTP status, response body; essential for debugging.
- **Let clients filter by event type** — subscribers should receive only the events they care about.
- **Rate-limit and circuit-break slow subscribers** — a slow endpoint must not block delivery to other subscribers.
- **Provide a test-event endpoint** — let developers verify their endpoint is working before going live.
