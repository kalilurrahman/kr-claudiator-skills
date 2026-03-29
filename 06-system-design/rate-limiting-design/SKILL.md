---
name: rate-limiting-design
description: Design rate limiting systems for APIs, services, and infrastructure. Outputs algorithm selection, storage design, distributed coordination, and client communication patterns.
argument-hint: [traffic volume, rate limit tiers, distribution requirements, enforcement point]
allowed-tools: Read, Write
---

# Rate Limiting Design

Rate limiting protects services from overload, prevents abuse, and enforces fair usage. The design decisions are: what to limit (per IP, per user, per API key, per endpoint), how to count (fixed window, sliding window, token bucket), where to enforce (gateway, application, infrastructure), and how to communicate limits to clients.

## Algorithm Comparison

```
FIXED WINDOW
  Count requests in a fixed time window (1-min buckets)
  Pro: Simple, cheap in storage
  Con: Burst at window boundary (60 requests at 00:59, 60 at 01:00)
  Use: Coarse-grained limits where burst is acceptable

SLIDING WINDOW LOG
  Record exact timestamp of each request; count in trailing window
  Pro: Precise; no boundary burst
  Con: High memory (store all timestamps)
  Use: Strict limits on low-volume endpoints

SLIDING WINDOW COUNTER
  Weighted average of current + previous window
  Pro: Good approximation of sliding window; low memory
  Con: Slight imprecision at window boundary
  Use: Most API rate limiting (best balance)

TOKEN BUCKET
  Bucket refills at steady rate; requests consume tokens
  Pro: Allows bursts up to bucket size; smooth throttling
  Con: Slightly more complex
  Use: CDN traffic shaping, network bandwidth

LEAKY BUCKET
  Requests enter queue; processed at fixed rate
  Pro: Perfectly smooth output
  Con: Adds latency; queue can fill
  Use: Protecting slow downstream services
```

## Sliding Window Counter (Redis)

```python
import redis.asyncio as redis_asyncio
import time
from dataclasses import dataclass

@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_at: int        # Unix timestamp when window resets
    retry_after: int     # Seconds to wait if denied

class SlidingWindowRateLimiter:
    def __init__(self, redis_client, limit: int, window_seconds: int):
        self.r = redis_client
        self.limit = limit
        self.window = window_seconds
    
    async def check(self, key: str) -> RateLimitResult:
        """Sliding window counter using two fixed windows."""
        now = time.time()
        current_window = int(now // self.window)
        prev_window = current_window - 1
        
        current_key = f"rl:{key}:{current_window}"
        prev_key = f"rl:{key}:{prev_window}"
        
        async with self.r.pipeline(transaction=True) as pipe:
            pipe.incr(current_key)
            pipe.expire(current_window, self.window * 2)
            pipe.get(prev_key)
            current_count, _, prev_count = await pipe.execute()
        
        current_count = int(current_count)
        prev_count = int(prev_count or 0)
        
        # Weighted count: fraction of previous window still in the sliding window
        window_fraction = (now % self.window) / self.window
        estimated_count = prev_count * (1 - window_fraction) + current_count
        
        reset_at = (current_window + 1) * self.window
        allowed = estimated_count <= self.limit
        
        return RateLimitResult(
            allowed=allowed,
            limit=self.limit,
            remaining=max(0, self.limit - int(estimated_count)),
            reset_at=int(reset_at),
            retry_after=int(reset_at - now) if not allowed else 0,
        )

# Token bucket (Redis + Lua for atomicity)
TOKEN_BUCKET_SCRIPT = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])   -- tokens per second
local now = tonumber(ARGV[3])
local tokens_requested = tonumber(ARGV[4])

local last_refill = tonumber(redis.call('hget', key, 'last_refill') or now)
local tokens = tonumber(redis.call('hget', key, 'tokens') or capacity)

-- Refill tokens based on time elapsed
local elapsed = now - last_refill
tokens = math.min(capacity, tokens + elapsed * refill_rate)

if tokens >= tokens_requested then
    tokens = tokens - tokens_requested
    redis.call('hmset', key, 'tokens', tokens, 'last_refill', now)
    redis.call('expire', key, 3600)
    return {1, math.floor(tokens)}
else
    redis.call('hmset', key, 'tokens', tokens, 'last_refill', now)
    return {0, math.floor(tokens)}
end
"""
```

## Multi-Tier Rate Limits

```python
# Different limits for different tiers and endpoints
RATE_LIMIT_CONFIG = {
    "free": {
        "global":    RateLimitRule(limit=60,   window=60),    # 60/min
        "search":    RateLimitRule(limit=10,   window=60),    # 10/min
        "write":     RateLimitRule(limit=10,   window=60),
    },
    "standard": {
        "global":    RateLimitRule(limit=300,  window=60),
        "search":    RateLimitRule(limit=100,  window=60),
        "write":     RateLimitRule(limit=100,  window=60),
    },
    "premium": {
        "global":    RateLimitRule(limit=3000, window=60),
        "search":    RateLimitRule(limit=1000, window=60),
        "write":     RateLimitRule(limit=500,  window=60),
    },
}

async def apply_rate_limit(request: Request, tier: str, endpoint_type: str):
    config = RATE_LIMIT_CONFIG.get(tier, RATE_LIMIT_CONFIG["free"])
    rule = config.get(endpoint_type, config["global"])
    
    # Key by API key (preferred) or IP
    api_key = request.headers.get("x-api-key")
    rl_key = f"apikey:{api_key}" if api_key else f"ip:{request.client.host}"
    
    result = await limiter.check(f"{rl_key}:{endpoint_type}", rule.limit, rule.window)
    
    # Always return headers
    response_headers = {
        "X-RateLimit-Limit": str(result.limit),
        "X-RateLimit-Remaining": str(result.remaining),
        "X-RateLimit-Reset": str(result.reset_at),
        "X-RateLimit-Policy": f"{rule.limit};w={rule.window}",
    }
    
    if not result.allowed:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. {result.remaining} requests remaining.",
                "retry_after": result.retry_after,
            },
            headers={**response_headers, "Retry-After": str(result.retry_after)},
        )
    return response_headers
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Rate limiting only by IP** | Shared IPs (NAT, corporate) penalise innocent users | Prefer API key; fall back to IP for unauthenticated |
| **Fixed window only** | Burst at window boundary can 2× the effective limit | Sliding window or token bucket |
| **No Retry-After header** | Clients don't know when to retry | Always return Retry-After on 429 |
| **Counting in application memory** | Each instance has independent counters | Centralise in Redis |
| **Same limit for all endpoints** | Read and write endpoints have very different costs | Per-endpoint-type limits |
| **Silent rate limiting** | Clients see errors without understanding why | Clear 429 response with remaining/reset headers |

## 10 Rules

1. Rate limit by API key (authenticated) before falling back to IP (unauthenticated).
2. Always return X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers.
3. Return 429 with Retry-After — never 503, never 200 with an error body.
4. Sliding window counter is the default choice — it prevents boundary burst without high storage cost.
5. Centralise counters in Redis — in-memory counters per instance don't work in distributed systems.
6. Separate read and write endpoint limits — writes are typically more expensive.
7. Tiered limits by customer plan — premium customers get higher limits.
8. Alert when customers hit rate limits frequently — it may indicate a product or UX issue.
9. Token bucket for traffic shaping — it allows controlled bursts rather than hard cutoffs.
10. Test rate limiting under concurrent load — race conditions in naive implementations allow 2-3× the configured limit.
