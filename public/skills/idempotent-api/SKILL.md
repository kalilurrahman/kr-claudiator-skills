---
name: idempotent-api
description: Design idempotent APIs that handle duplicate requests safely. Outputs idempotency key strategy, deduplication storage design, response caching patterns, and client retry guidance.
argument-hint: [API type, expected retry rate, storage backend, consistency requirements]
allowed-tools: Read, Write
---

# Idempotent API Design

An idempotent operation produces the same result whether executed once or many times. HTTP GET, PUT, and DELETE are naturally idempotent. POST is not — but can be made so with idempotency keys. This matters because networks fail, clients retry, and without idempotency, retries create duplicate charges, double sends, and data corruption.

## Process

1. **Identify non-idempotent endpoints.** POST (create), financial operations, email sends, state transitions.
2. **Design the idempotency key.** Client-generated UUID per logical operation. Scoped to the user/account.
3. **Choose deduplication storage.** Redis (fast, TTL-based) or database (durable, auditable).
4. **Define the response strategy.** Return the original response on duplicate — never re-execute.
5. **Set key TTL.** 24 hours is standard for most operations; longer for financial.
6. **Document for API consumers.** How to generate keys, when to use them, retry guidance.

## Implementation

```python
from fastapi import FastAPI, Header, HTTPException, Depends
from typing import Optional
import redis.asyncio as redis
import json
import hashlib
from datetime import datetime

app = FastAPI()
r = redis.Redis(host="redis", port=6379, decode_responses=True)

IDEMPOTENCY_TTL = 86400  # 24 hours

async def check_idempotency(
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user_id: str = Depends(get_current_user_id),
) -> Optional[str]:
    if not idempotency_key:
        return None
    # Scope key to user — prevents cross-user key collisions
    return f"idem:{user_id}:{idempotency_key}"

@app.post("/api/v1/orders", status_code=201)
async def create_order(
    request: CreateOrderRequest,
    scoped_key: Optional[str] = Depends(check_idempotency),
):
    # Check for existing response
    if scoped_key:
        cached = await r.get(scoped_key)
        if cached:
            stored = json.loads(cached)
            # Return original response with 200 (not 201) to signal replay
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=stored["status_code"],
                content=stored["body"],
                headers={"Idempotency-Replayed": "true"},
            )
    
    # Process the request
    order = await order_service.create(request)
    
    response_body = {"order_id": order.id, "status": order.status}
    
    # Store the result
    if scoped_key:
        await r.setex(
            scoped_key,
            IDEMPOTENCY_TTL,
            json.dumps({"status_code": 201, "body": response_body}),
        )
    
    return response_body

# Idempotency for state transitions
@app.post("/api/v1/orders/{order_id}/confirm")
async def confirm_order(
    order_id: str,
    scoped_key: Optional[str] = Depends(check_idempotency),
    user_id: str = Depends(get_current_user_id),
):
    if scoped_key:
        cached = await r.get(scoped_key)
        if cached:
            return json.loads(cached)["body"]
    
    order = await order_service.get(order_id)
    if not order or order.customer_id != user_id:
        raise HTTPException(404)
    
    # State machine handles duplicate confirms gracefully
    if order.status == "confirmed":
        result = {"order_id": order_id, "status": "confirmed", "message": "Already confirmed"}
    elif order.status == "draft":
        order = await order_service.confirm(order_id)
        result = {"order_id": order_id, "status": "confirmed"}
    else:
        raise HTTPException(409, f"Cannot confirm order in status: {order.status}")
    
    if scoped_key:
        await r.setex(scoped_key, IDEMPOTENCY_TTL, json.dumps({"body": result}))
    
    return result
```

## Database-Backed Deduplication (Durable)

```sql
-- For financial operations where Redis TTL is insufficient
CREATE TABLE idempotency_records (
    key          VARCHAR(255) PRIMARY KEY,  -- user_id:idempotency_key
    response     JSONB        NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ  NOT NULL
);

CREATE INDEX ON idempotency_records (expires_at);

-- Cleanup job: DELETE FROM idempotency_records WHERE expires_at < NOW();
```

```python
async def get_or_create_idempotent(key: str, fn, ttl_days: int = 7):
    """Database-backed idempotency for financial operations."""
    existing = await db.fetchone(
        "SELECT response FROM idempotency_records WHERE key = $1 AND expires_at > NOW()",
        [key]
    )
    if existing:
        return json.loads(existing["response"]), True  # (result, was_replayed)
    
    result = await fn()  # Execute the operation
    
    await db.execute(
        """INSERT INTO idempotency_records (key, response, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '$3 days')
           ON CONFLICT (key) DO NOTHING""",
        [key, json.dumps(result), ttl_days]
    )
    return result, False
```

## Client-Side Usage

```python
# Client SDK — how to use idempotency keys correctly
import uuid
import httpx
import time

class APIClient:
    def create_order(self, order_data: dict, max_retries: int = 3) -> dict:
        # Generate once per logical operation — NOT per retry
        idempotency_key = str(uuid.uuid4())
        
        for attempt in range(max_retries):
            try:
                response = httpx.post(
                    "/api/v1/orders",
                    json=order_data,
                    headers={"Idempotency-Key": idempotency_key},
                    timeout=10.0,
                )
                if response.status_code in [200, 201]:
                    return response.json()
                if response.status_code == 422:
                    raise ValidationError(response.json())
                # 5xx — retry with same key
                if response.status_code >= 500:
                    time.sleep(2 ** attempt)
                    continue
            except httpx.TimeoutException:
                # Network timeout — safe to retry with same key
                time.sleep(2 ** attempt)
                continue
        
        raise Exception("Max retries exceeded")
```

## API Documentation

```markdown
## Idempotency Keys

POST endpoints that create resources or trigger operations support idempotency
via the `Idempotency-Key` header.

**When to use:** Any operation you might need to retry — order creation, payments,
refunds, email sends.

**How to use:**
1. Generate a unique UUID for each distinct operation: `uuid4()`
2. Include it as `Idempotency-Key: <uuid>` in the request header
3. On retry (timeout, network error, 5xx), send the SAME key
4. The server returns the original response — the operation runs only once

**Key validity:** 24 hours from first use

**Response on replay:** Same response body + `Idempotency-Replayed: true` header

**What not to do:**
- Don't generate a new key on each retry — this defeats the purpose
- Don't reuse keys across different operations
- Don't use the same key for different users
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **New key per retry** | Each retry creates a new record | Generate key before first attempt; reuse on all retries |
| **Global key namespace** | User A can see User B's responses | Scope key to user: `{user_id}:{client_key}` |
| **Idempotency for GETs** | GETs are already idempotent | Only POST, PATCH for non-idempotent operations |
| **No TTL on keys** | Storage grows forever | 24-hour TTL for standard ops; 7 days for financial |
| **Re-executing on cache miss** | Race condition: two identical requests both execute | Atomic check-and-set on first request |

## 10 Rules

1. POST operations that have side effects must support idempotency keys.
2. Client generates the key once per logical operation — never regenerated on retry.
3. Keys are scoped to the requesting user — cross-user isolation is mandatory.
4. On replay, return the exact original response — do not re-execute.
5. TTL is 24 hours for standard operations; longer for financial transactions.
6. Network timeouts are safe to retry with the same key — the server handles deduplication.
7. The `Idempotency-Replayed: true` header tells clients the response is from cache.
8. Redis is sufficient for most cases; use database storage for financial audit requirements.
9. Idempotency key conflicts (different payload, same key) should return 422.
10. Document idempotency behaviour in the API spec — clients can't use it if they don't know it exists.
