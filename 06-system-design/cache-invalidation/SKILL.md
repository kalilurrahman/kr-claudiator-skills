---
name: cache-invalidation
description: Design cache invalidation strategies to keep cached data consistent with source of truth. Outputs invalidation patterns, TTL design, event-driven invalidation, and consistency tradeoff analysis.
argument-hint: [cache type, consistency requirements, update frequency, invalidation triggers]
allowed-tools: Read, Write
---

# Cache Invalidation

Cache invalidation is one of the hardest problems in computer science because cached data can become stale in unpredictable ways. There are only a few strategies — TTL, event-driven invalidation, write-through, and cache-aside — and each has specific consistency, complexity, and performance tradeoffs.

## Invalidation Strategies

```python
import redis.asyncio as redis
import json
from typing import Optional, Callable, Any
import asyncio
import time

r = redis.Redis(host="redis", port=6379, decode_responses=True)

# STRATEGY 1: TTL-based (simplest — tolerate staleness)
async def get_product_with_ttl(product_id: str) -> dict:
    cache_key = f"product:{product_id}"
    cached = await r.get(cache_key)
    if cached:
        return json.loads(cached)
    
    product = await db.fetch_product(product_id)
    await r.setex(cache_key, 300, json.dumps(product))  # 5-minute TTL
    return product

# STRATEGY 2: Write-through (consistent — invalidate on every write)
async def update_product(product_id: str, updates: dict):
    # Update DB and cache atomically
    async with r.pipeline(transaction=True) as pipe:
        await db.update_product(product_id, updates)
        await pipe.delete(f"product:{product_id}")
        await pipe.execute()

# STRATEGY 3: Event-driven invalidation (eventual consistency)
# Published when data changes anywhere; consumers invalidate their cache
async def handle_product_updated_event(event: dict):
    product_id = event["product_id"]
    affected_keys = [
        f"product:{product_id}",
        f"product:{product_id}:inventory",
        f"category:{event['category_id']}:products",  # Related cache
    ]
    await r.delete(*affected_keys)

# STRATEGY 4: Tag-based invalidation (group-level invalidation)
async def set_with_tags(key: str, value: Any, tags: list[str], ttl: int = 300):
    pipe = r.pipeline()
    pipe.setex(key, ttl, json.dumps(value))
    for tag in tags:
        pipe.sadd(f"tag:{tag}", key)
        pipe.expire(f"tag:{tag}", ttl + 60)
    await pipe.execute()

async def invalidate_tag(tag: str):
    """Invalidate all keys tagged with this tag."""
    tag_key = f"tag:{tag}"
    keys = await r.smembers(tag_key)
    if keys:
        await r.delete(*keys, tag_key)

# Usage: cache a product with tags
await set_with_tags(
    f"product:{product_id}",
    product_data,
    tags=[f"product:{product_id}", f"category:{product.category_id}"],
    ttl=600,
)
# When category changes, invalidate all products in that category
await invalidate_tag(f"category:{category_id}")
```

## Stale-While-Revalidate Pattern

```python
class StaleWhileRevalidateCache:
    """Serve stale data while refreshing in background."""
    
    def __init__(self, fresh_ttl: int, stale_ttl: int):
        self.fresh_ttl = fresh_ttl
        self.stale_ttl = stale_ttl  # Must be > fresh_ttl
    
    async def get(self, key: str, refresh_fn: Callable) -> Any:
        data = await r.get(key)
        meta = await r.get(f"{key}:meta")
        
        if not data:
            # Cache miss — fetch synchronously
            result = await refresh_fn()
            await self._store(key, result)
            return result
        
        result = json.loads(data)
        
        if meta:
            meta_data = json.loads(meta)
            age = time.time() - meta_data["cached_at"]
            
            if age > self.fresh_ttl:
                # Stale — serve immediately but refresh in background
                asyncio.create_task(self._refresh(key, refresh_fn))
        
        return result
    
    async def _refresh(self, key: str, refresh_fn: Callable):
        result = await refresh_fn()
        await self._store(key, result)
    
    async def _store(self, key: str, value: Any):
        pipe = r.pipeline()
        pipe.setex(key, self.stale_ttl, json.dumps(value))
        pipe.setex(f"{key}:meta", self.stale_ttl,
                   json.dumps({"cached_at": time.time()}))
        await pipe.execute()
```

## Consistency Tradeoff Guide

```markdown
## Choose by consistency requirement:

STRONG CONSISTENCY needed:
  → Write-through + synchronous invalidation
  → Higher latency on writes; always fresh on reads
  → Use: Financial data, inventory counts, user account data

EVENTUAL CONSISTENCY acceptable (seconds):
  → Event-driven invalidation
  → Propagation delay = event delivery latency
  → Use: Product catalogs, user profiles, content

EVENTUAL CONSISTENCY acceptable (minutes):
  → TTL-based with short TTL (60-300s)
  → Simple to implement; predictable staleness
  → Use: Search results, non-critical listings, aggregated data

STALE DATA ACCEPTABLE (hours):
  → Long TTL + stale-while-revalidate
  → Best for high-read, low-write data
  → Use: Public reference data, static content, configs
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Thundering herd on cache miss** | All requests hammer DB simultaneously | Cache locking/probabilistic early expiration |
| **Invalidating too broadly** | `del *` clears all cache; cold start | Targeted invalidation by key or tag |
| **Long TTL on frequently changing data** | Users see stale data for minutes | Event-driven invalidation for write-heavy data |
| **No consistency strategy** | Ad-hoc invalidation creates subtle bugs | Choose a strategy; document it |
| **Not testing staleness** | Stale data only discovered in production | Integration tests that verify invalidation |

## 10 Rules

1. Choose your consistency model first — then select the invalidation strategy.
2. TTL is a fallback safety net — not the primary invalidation mechanism for critical data.
3. Event-driven invalidation is more precise than TTL for write-heavy data.
4. Tag-based invalidation handles group invalidation (all products in a category) cleanly.
5. Thundering herd on cache miss requires a locking mechanism or probabilistic refresh.
6. Stale-while-revalidate is ideal for read-heavy, write-light data.
7. Write-through keeps cache and DB in sync — higher write latency, always-consistent reads.
8. Cache keys must be deterministic — same input always produces same key.
9. Document TTL reasoning — "why 300 seconds?" should have an answer.
10. Test invalidation explicitly — create tests that write to DB and verify cache is updated.
