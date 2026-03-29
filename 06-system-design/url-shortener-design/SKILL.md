---
name: url-shortener-design
description: Design a URL shortener system at scale. Outputs encoding strategy, database schema, caching layer, analytics pipeline, and abuse prevention controls.
argument-hint: [scale requirements, analytics needs, custom domains, abuse vectors, read/write ratio]
allowed-tools: Read, Write
---

# URL Shortener Design

A URL shortener converts long URLs to short codes and redirects traffic. At scale (billions of URLs, millions of redirects/second) it becomes a distributed systems problem requiring caching, sharding, and abuse prevention.

## Scale Estimation

```
100M new URLs/day     = 1,157 writes/sec
10B redirects/day     = 115,740 reads/sec
Read:write ratio      = 100:1 — cache aggressively
5-year storage:       = 182.5B URLs * 500B = ~90TB
Short code space:     = 62^7 = 3.5 trillion unique codes
```

## Short Code Generation

```python
from string import ascii_letters, digits
import hashlib, secrets

ALPHABET = ascii_letters + digits  # 62 characters

def encode_id(n: int, length: int = 7) -> str:
    """Convert integer ID to base-62. Sequential — no collisions."""
    chars = []
    while n:
        chars.append(ALPHABET[n % 62])
        n //= 62
    while len(chars) < length:
        chars.append(ALPHABET[0])
    return "".join(reversed(chars))

def hash_url(url: str) -> str:
    """First 7 chars of MD5 in base62. Check collisions before storing."""
    n = int(hashlib.md5(url.encode()).hexdigest()[:10], 16)
    return encode_id(n, length=7)

def random_code(length: int = 7) -> str:
    """Cryptographically random — unpredictable."""
    return "".join(secrets.choice(ALPHABET) for _ in range(length))
```

## Database Schema

```sql
CREATE TABLE short_urls (
    id            BIGSERIAL PRIMARY KEY,
    short_code    VARCHAR(10) NOT NULL UNIQUE,
    long_url      TEXT NOT NULL,
    created_by    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at    TIMESTAMPTZ,
    is_active     BOOLEAN DEFAULT TRUE,
    custom_domain VARCHAR(255),    -- Branded short links
    domain_hash   VARCHAR(64)      -- Hash of destination domain for blocklist
);

CREATE INDEX ON short_urls (short_code);
CREATE INDEX ON short_urls (expires_at) WHERE expires_at IS NOT NULL;

-- Partitioned clicks table (high write volume)
CREATE TABLE clicks (
    short_code  VARCHAR(10) NOT NULL,
    clicked_at  TIMESTAMPTZ DEFAULT NOW(),
    ip_hash     VARCHAR(64),      -- SHA-256 of IP (GDPR-safe)
    country     VARCHAR(2),
    device_type VARCHAR(20)
) PARTITION BY RANGE (clicked_at);

-- Monthly partitions for efficient deletion
CREATE TABLE clicks_2024_03 PARTITION OF clicks
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

## Redirect Service (Hot Path)

```python
from fastapi import FastAPI, Response
from fastapi.responses import RedirectResponse
import redis.asyncio as redis

app = FastAPI()
cache = redis.Redis(host="redis", port=6379, decode_responses=True)

@app.get("/{short_code}")
async def redirect(short_code: str, response: Response):
    # L1: Redis (hot short codes — microseconds)
    cached_url = await cache.get(f"url:{short_code}")
    if cached_url:
        if cached_url == "DELETED":
            response.status_code = 404
            return {"error": "Link not found"}
        await record_click_async(short_code)  # Fire-and-forget
        return RedirectResponse(url=cached_url, status_code=301)

    # L2: Database (cold miss — milliseconds)
    record = await db.fetchone(
        "SELECT long_url, expires_at, is_active FROM short_urls WHERE short_code = $1",
        [short_code]
    )

    if not record or not record["is_active"]:
        await cache.setex(f"url:{short_code}", 3600, "DELETED")
        response.status_code = 404
        return {"error": "Link not found"}

    from datetime import datetime, timezone
    if record["expires_at"] and record["expires_at"] < datetime.now(timezone.utc):
        response.status_code = 410
        return {"error": "Link expired"}

    await cache.setex(f"url:{short_code}", 3600, record["long_url"])
    await record_click_async(short_code)
    return RedirectResponse(url=record["long_url"], status_code=301)
```

## Abuse Prevention

```python
BLOCKED_DOMAINS = {"malware-site.com", "phishing.net"}
MAX_URLS_PER_USER_PER_HOUR = 100

async def validate_url(url: str, user_id: str) -> tuple[bool, str]:
    from urllib.parse import urlparse
    domain = urlparse(url).netloc.lower().removeprefix("www.")

    if domain in BLOCKED_DOMAINS:
        return False, "Domain is blocked"

    # Google Safe Browsing API
    is_safe = await safe_browsing.check(url)
    if not is_safe:
        return False, "URL flagged as malicious"

    # Rate limit
    key = f"rate:url:{user_id}:{__import__('datetime').datetime.utcnow().strftime('%Y%m%d%H')}"
    count = await cache.incr(key)
    await cache.expire(key, 3600)
    if count > MAX_URLS_PER_USER_PER_HOUR:
        return False, "Rate limit exceeded"

    return True, ""
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No Redis cache** | DB hit on every redirect; can't scale | Redis cache for hot short codes |
| **Sequential IDs as short codes** | Predictable; users enumerate all links | Hash-based or random codes |
| **No expiry for links** | Database grows forever | Default expiry + explicit long-lived option |
| **Raw IPs in analytics** | GDPR violation | Hash IPs before storage |
| **No abuse prevention** | Becomes a phishing link distributor | Domain blocklist + Safe Browsing API |

## 10 Rules

1. Redis caches the hot redirect path — 99% of traffic hits cache, not DB.
2. Base-62 encoding of sequential IDs gives short, unique codes.
3. Collision handling is required for hash-based codes — always check before inserting.
4. Click analytics writes are fire-and-forget — never block the redirect path.
5. Link expiry is mandatory — expired links return 410 Gone.
6. 301 (permanent) for most links — browsers cache, reduces server load.
7. 302 (temporary) when link targets may change — more accurate analytics.
8. Analytics table partitioned by date — efficient deletion of old data.
9. Domain blocklist + Safe Browsing API prevents phishing abuse.
10. Rate limiting per user prevents bulk link creation for spam campaigns.
