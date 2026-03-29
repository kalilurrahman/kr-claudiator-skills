---
name: webhook-security
description: Secure webhook endpoints against spoofing, replay attacks, and denial of service. Outputs signature verification, replay prevention, IP allowlisting, and retry handling patterns.
argument-hint: [webhook provider, payload size, latency requirements, security requirements]
allowed-tools: Read, Write
---

# Webhook Security

Webhooks are HTTP callbacks from external services to your application. They are a common attack vector: spoofed payloads, replay attacks, and flood attacks. Securing webhooks requires signature verification, replay prevention, and fast acknowledgement with async processing.

## Process

1. **Verify the signature.** Every incoming webhook must be signed by the sender. Verify before processing.
2. **Prevent replay attacks.** Check timestamp freshness and deduplicate by webhook event ID.
3. **Acknowledge immediately.** Return 200 within 5 seconds; process asynchronously.
4. **Validate payload.** Schema validation after signature check.
5. **Handle retries idempotently.** Providers retry failed webhooks — process must be idempotent.
6. **Protect against flooding.** Rate limit per source IP.

## HMAC Signature Verification

```python
from fastapi import FastAPI, Request, HTTPException, Header
import hmac, hashlib, time, json

app = FastAPI()

WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]
MAX_TIMESTAMP_AGE_SECONDS = 300  # 5 minutes

def verify_stripe_signature(payload: bytes, sig_header: str, secret: str) -> bool:
    """Stripe-style HMAC-SHA256 signature verification."""
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        timestamp = int(parts["t"])
        signatures = [v for k, v in parts.items() if k == "v1"]
    except (KeyError, ValueError):
        return False
    
    # Check timestamp freshness (replay prevention)
    if abs(time.time() - timestamp) > MAX_TIMESTAMP_AGE_SECONDS:
        return False
    
    # Compute expected signature
    signed_payload = f"{timestamp}.{payload.decode()}"
    expected = hmac.new(
        secret.encode(), signed_payload.encode(), hashlib.sha256
    ).hexdigest()
    
    return any(hmac.compare_digest(expected, sig) for sig in signatures)

@app.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
):
    payload = await request.body()
    
    if not verify_stripe_signature(payload, stripe_signature, WEBHOOK_SECRET):
        raise HTTPException(400, "Invalid signature")
    
    event = json.loads(payload)
    
    # Deduplicate by event ID
    if await redis.exists(f"webhook:{event['id']}"):
        return {"status": "already_processed"}
    await redis.setex(f"webhook:{event['id']}", 86400, "1")
    
    # Acknowledge immediately — process async
    await queue.enqueue("process_stripe_event", event)
    return {"status": "accepted"}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No signature verification** | Any attacker can send fake webhooks | Verify HMAC on every request before processing |
| **Processing in request handler** | Timeout → provider retries → duplicate processing | Return 200 immediately; queue for async processing |
| **No replay prevention** | Provider retries create duplicate side effects | Deduplicate by webhook event ID in Redis/DB |
| **Trusting IP allowlist alone** | IPs can be spoofed; allowlists go stale | Signature verification is primary; IP is secondary |
| **Logging full payload** | PII in logs | Log event type and ID; not full payload |

## 10 Rules

1. Verify the HMAC signature before doing anything else — no signature, no processing.
2. Check timestamp freshness — reject payloads older than 5 minutes.
3. Deduplicate by event ID — providers retry failed webhooks; your handler must be idempotent.
4. Return 200 within 5 seconds — do all real work asynchronously.
5. Use `hmac.compare_digest` — constant-time comparison prevents timing attacks.
6. Store the webhook secret in a secrets manager — not in code or environment variables.
7. Rate limit per source IP — protect against webhook flood attacks.
8. Log the event type and ID, not the full payload — payloads may contain PII.
9. Validate payload schema after signature check — malformed payloads should return 400.
10. Test with the provider's official test tools — most providers have webhook testing consoles.
