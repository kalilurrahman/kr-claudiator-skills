---
name: distributed-cache
description: Design distributed caching with Redis or Memcached. Outputs cache topology, eviction strategy, invalidation patterns, consistency model, and failure handling.
argument-hint: [data types, read/write ratio, consistency requirements, cache size, hit rate target]
allowed-tools: Read, Write
---

# Distributed Cache Design

A distributed cache reduces database load and latency by serving frequently-read data from memory. The design challenges are consistency (when to invalidate), availability (what happens when cache fails), and cold start (warming after restart).

## Cache Topology Options

```
1. Cache-Aside (Lazy Loading)           2. Write-Through
   App checks cache → miss → DB →           App writes DB AND cache together
   populate cache → return                  Consistent; slower writes
   Most common; simple                      
                                        3. Write-Behind (Write-Back)
4. Read-Through                             Write to cache first; async to DB
   Cache fetches from DB on miss           Faster writes; risk of data loss
   App always talks to cache
   
5. Refresh-Ahead
   Background refresh before TTL expires
   Eliminates cold misses for hot keys
```

## Redis Implementation

```python
import redis
import json
import hashlib
from typing import Optional, Any
from datetime import timedelta
from functools import wraps

class CacheClient:
    def __init__(self, url: str, default_ttl: int = 300):
        # Redis cluster client
        self.r = redis.Redis.from_url(url, decode_responses=True,
                                       socket_timeout=0.5,       # Fast fail
                                       socket_connect_timeout=1.0)
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        try:
            value = self.r.get(key)
            return json.loads(value) if value else None
        except (redis.RedisError, json.JSONDecodeError):
            return None  # Cache failure → cache miss (never propagate)
    
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        try:
            return self.r.setex(
                key,
                ttl or self.default_ttl,
                json.dumps(value, default=str)
            )
        except redis.RedisError:
            return False
    
    def delete(self, *keys: str) -> int:
        try:
            return self.r.delete(*keys)
        except redis.RedisError:
            return 0
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern. Use sparingly — O(N) scan."""
        try:
            cursor = 0
            deleted = 0
            while True:
                cursor, keys = self.r.scan(cursor, match=pattern, count=100)
                if keys:
                    deleted += self.r.delete(*keys)
                if cursor == 0:
                    break
            return deleted
        except redis.RedisError:
            return 0

# Cache-aside pattern
cache = CacheClient("redis://redis-cluster:6379", default_ttl=300)

def get_product(product_id: str) -> dict:
    cache_key = f"product:{product_id}"
    
    # L1: check cache
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # L2: fetch from DB
    product = db.fetch_product(product_id)
    if product:
        cache.set(cache_key, product, ttl=600)
    return product

# Decorator for function-level caching
def cached(ttl: int = 300, key_prefix: str = None):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Build cache key from function name + args
            key_args = json.dumps(args) + json.dumps(kwargs, sort_keys=True)
            key = f"{key_prefix or fn.__name__}:{hashlib.sha256(key_args.encode()).hexdigest()[:16]}"
            
            result = cache.get(key)
            if result is not None:
                return result
            
            result = fn(*args, **kwargs)
            if result is not None:
                cache.set(key, result, ttl=ttl)
            return result
        return wrapper
    return decorator

@cached(ttl=60, key_prefix="user_orders")
def get_user_orders(user_id: str, status: str = None) -> list:
    return db.fetch_orders(user_id=user_id, status=status)
```

## Cache Invalidation Strategies

```python
# Strategy 1: Tag-based invalidation
class TaggedCache:
    """Invalidate all items tagged with a given tag."""
    
    def set_with_tags(self, key: str, value: Any, tags: list, ttl: int = 300):
        pipe = cache.r.pipeline()
        pipe.setex(key, ttl, json.dumps(value))
        for tag in tags:
            pipe.sadd(f"tag:{tag}", key)
            pipe.expire(f"tag:{tag}", ttl + 60)
        pipe.execute()
    
    def invalidate_tag(self, tag: str):
        tag_key = f"tag:{tag}"
        keys = cache.r.smembers(tag_key)
        if keys:
            cache.r.delete(*keys, tag_key)

tagged = TaggedCache()

def get_user_profile(user_id: str) -> dict:
    key = f"user:{user_id}:profile"
    result = cache.get(key)
    if not result:
        result = db.fetch_user(user_id)
        tagged.set_with_tags(key, result, tags=[f"user:{user_id}"], ttl=600)
    return result

def update_user(user_id: str, updates: dict):
    db.update_user(user_id, updates)
    tagged.invalidate_tag(f"user:{user_id}")  # Clears all user-tagged cache entries

# Strategy 2: Event-driven invalidation (pub/sub)
def on_order_updated(order_id: str):
    """Called by event listener when order changes."""
    cache.delete(
        f"order:{order_id}",
        f"order:{order_id}:items",
        f"user:{get_order(order_id)['customer_id']}:orders",
    )
```

## Redis Cluster Configuration

```yaml
# docker-compose for Redis cluster (development)
services:
  redis-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
             --cluster-node-timeout 5000 --appendonly yes
             --maxmemory 2gb --maxmemory-policy allkeys-lru
    
  redis-2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes ...

# Production: AWS ElastiCache Redis Cluster
# - cluster-mode enabled (6 nodes: 3 primary + 3 replica)
# - Multi-AZ with automatic failover
# - node.t3.medium to start; scale up as needed

# Key eviction policy choices:
# allkeys-lru    → evict least recently used key (general caching)
# volatile-lru   → evict LRU keys with TTL only (preserve permanent data)
# allkeys-lfu    → evict least frequently used (better for skewed access)
# noeviction     → return error when full (session stores, don't lose data)
```

## Cache Warming

```python
# Pre-warm cache after deployment/restart to avoid thundering herd
import asyncio
from typing import Iterator

class CacheWarmer:
    def __init__(self, batch_size: int = 100, concurrency: int = 10):
        self.batch_size = batch_size
        self.sem = asyncio.Semaphore(concurrency)
    
    async def warm_products(self):
        """Load top 1000 products into cache at startup."""
        product_ids = db.get_top_product_ids(limit=1000)
        
        async def warm_one(pid):
            async with self.sem:
                if not cache.get(f"product:{pid}"):
                    product = await db.fetch_product_async(pid)
                    cache.set(f"product:{pid}", product, ttl=3600)
        
        await asyncio.gather(*[warm_one(pid) for pid in product_ids])
        print(f"Cache warmed: {len(product_ids)} products")
    
    async def warm_from_access_log(self, hours_back: int = 24):
        """Warm keys accessed in last N hours."""
        hot_keys = analytics.get_hot_cache_keys(hours=hours_back)
        # Fetch and cache all hot keys...
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Caching mutable data without TTL** | Stale data served indefinitely | Always set TTL; use event-driven invalidation for critical data |
| **Large objects in cache** | Memory exhausted by few large keys | Cache IDs + fetch details; or compress large objects |
| **Cache-aside without stampede protection** | Thundering herd on miss | Probabilistic early expiration or mutex on miss |
| **Catching all Redis exceptions silently** | Hides real bugs | Log errors; distinguish transient from systematic failures |
| **Pattern delete (KEYS *)** | O(N) scan blocks Redis | Use SCAN; or tag-based invalidation |
| **No cache metrics** | Hit rate unknown; can't optimise | Track hit/miss/eviction rates |
| **Same TTL for everything** | Hot data evicted; cold data held | TTL based on data volatility and access frequency |

## 10 Rules

1. Cache failures must never propagate to the caller — return a cache miss, log the error.
2. Every cached item has a TTL — no permanent cache entries.
3. Invalidation on write is more important than TTL — stale data causes bugs, not just latency.
4. Cache-aside is the default pattern — write-through only when consistency is critical.
5. Monitor hit rate, eviction rate, and memory usage — below 80% hit rate means the cache is misconfigured.
6. Warm the cache before traffic hits after restarts — cold cache = database storm.
7. Size keys consistently: `{entity}:{id}:{variant}` — enables pattern invalidation and debugging.
8. Redis cluster for production — single node is a single point of failure.
9. Socket timeouts must be short (0.5s) — a slow Redis is worse than no cache.
10. Never store session data in volatile caches — sessions need durability guarantees (persistence or separate store).
