---
name: llm-caching-strategy
description: Implement caching strategies for LLM applications to reduce costs and latency. Outputs exact cache, semantic cache, prompt cache, and KV cache configurations with measurement.
argument-hint: [request volume, query similarity, latency targets, cost constraints, provider]
allowed-tools: Read, Write
---

# LLM Caching Strategy

LLM API calls are expensive and slow. Caching reduces both by serving previous results without a new API call. The right caching strategy depends on how similar your requests are: exact duplicates (hash cache), semantically similar (vector cache), or long shared prefixes (prompt cache).

## Cache Hierarchy

```
Level 1: Exact Cache (fastest, cheapest)
  Hash(prompt + params) → stored response
  Hit rate: 5-20% for most apps
  Best for: Repeated identical queries

Level 2: Semantic Cache (medium speed)
  Embed query → nearest neighbour search → cached response
  Hit rate: 20-50% for similar query patterns
  Best for: FAQ-style, documentation Q&A

Level 3: Prompt Cache (provider-side)
  Anthropic/OpenAI caches tokens for repeated prefixes
  Savings: 90% cost on cached input tokens
  Best for: Long system prompts, static context
```

## Exact Cache Implementation

```python
import hashlib
import redis.asyncio as redis
import json
from anthropic import Anthropic

client = Anthropic()
r = redis.Redis(host="redis", port=6379, decode_responses=True)
CACHE_TTL = 3600  # 1 hour

def cache_key(model: str, messages: list, temperature: float, max_tokens: int) -> str | None:
    """Only cache deterministic requests (temperature=0)."""
    if temperature != 0:
        return None
    payload = json.dumps({"model": model, "messages": messages, "max_tokens": max_tokens}, sort_keys=True)
    return f"llm:exact:{hashlib.sha256(payload.encode()).hexdigest()}"

async def complete_with_cache(model: str, messages: list, 
                               temperature: float = 0, max_tokens: int = 1024) -> dict:
    key = cache_key(model, messages, temperature, max_tokens)
    
    if key:
        cached = await r.get(key)
        if cached:
            result = json.loads(cached)
            result["cache_hit"] = True
            return result
    
    response = client.messages.create(
        model=model, messages=messages,
        temperature=temperature, max_tokens=max_tokens
    )
    result = {
        "content": response.content[0].text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "cache_hit": False,
    }
    
    if key:
        await r.setex(key, CACHE_TTL, json.dumps(result))
    
    return result
```

## Semantic Cache

```python
import numpy as np
from anthropic import Anthropic

client = Anthropic()

class SemanticCache:
    """Cache LLM responses by semantic similarity of the query."""
    
    def __init__(self, similarity_threshold: float = 0.92, max_entries: int = 10000):
        self.threshold = similarity_threshold
        self.entries: list[dict] = []  # In production: use vector DB (Qdrant, Pinecone)
    
    def _embed(self, text: str) -> list[float]:
        response = client.embeddings.create(model="voyage-3", input=[text])
        return response.data[0].embedding
    
    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        a, b = np.array(a), np.array(b)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    
    def get(self, query: str) -> str | None:
        if not self.entries:
            return None
        
        query_embedding = self._embed(query)
        
        best_sim, best_response = 0, None
        for entry in self.entries:
            sim = self._cosine_similarity(query_embedding, entry["embedding"])
            if sim > best_sim:
                best_sim, best_response = sim, entry["response"]
        
        if best_sim >= self.threshold:
            return best_response
        return None
    
    def set(self, query: str, response: str):
        embedding = self._embed(query)
        self.entries.append({"query": query, "embedding": embedding, "response": response})
        if len(self.entries) > self.entries.__class__.__len__(self.entries):
            self.entries = self.entries[-self.entries.__class__.__len__(self.entries):]
```

## Anthropic Prompt Caching

```python
# Anthropic caches tokens for the first 1024+ tokens in a message
# when marked with cache_control. 90% cost reduction on cache hits.

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "You are an expert on our product documentation.",
            "cache_control": {"type": "ephemeral"}  # Cache this prefix
        },
        {
            "type": "text",
            "text": open("product_docs.txt").read(),  # Large static document
            "cache_control": {"type": "ephemeral"}  # Cache this too
        }
    ],
    messages=[
        {"role": "user", "content": "What is the pricing for enterprise tier?"}  # Changes per request
    ]
)

# Check cache status in response
print(response.usage.cache_creation_input_tokens)  # First request: creates cache
print(response.usage.cache_read_input_tokens)       # Subsequent: reads from cache
# Cache read costs 10% of normal input token price
```

## Cache Hit Rate Monitoring

```python
from dataclasses import dataclass
import time

@dataclass
class CacheMetrics:
    requests: int = 0
    exact_hits: int = 0
    semantic_hits: int = 0
    prompt_cache_hits: int = 0
    misses: int = 0
    
    @property
    def total_hit_rate(self) -> float:
        hits = self.exact_hits + self.semantic_hits + self.prompt_cache_hits
        return hits / self.requests if self.requests > 0 else 0
    
    @property
    def cost_savings_estimate(self) -> float:
        # Rough estimate: $0.015 per 1K input tokens on Claude Opus
        avg_tokens_per_request = 2000
        cost_per_token = 0.000015
        hits = self.exact_hits + self.semantic_hits
        return hits * avg_tokens_per_request * cost_per_token

metrics = CacheMetrics()
# Track in Prometheus/Datadog; alert if hit rate drops below 20%
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Caching non-deterministic requests** | Temperature>0 responses vary; stale cache misleads | Only cache temperature=0 requests |
| **No TTL on cached responses** | Stale responses served indefinitely | TTL based on content type: facts (24h), dynamic (1h) |
| **Semantic cache threshold too low** | Wrong responses returned | Start at 0.95; tune based on false positive analysis |
| **Not caching system prompts** | Paying full price for static prefix every request | Anthropic prompt caching for 1024+ token prefixes |
| **No hit rate monitoring** | Can't improve what you don't measure | Track hit rate per cache tier; alert on drops |

## 10 Rules

1. Only exact-cache deterministic requests (temperature=0) — non-deterministic responses shouldn't be cached.
2. Semantic cache threshold starts at 0.92 — tune based on false positive analysis.
3. Use Anthropic prompt caching for system prompts over 1024 tokens — 90% cost reduction.
4. Cache TTL reflects content freshness — factual content 24h, dynamic 1h, personalised skip.
5. Monitor hit rates by tier — exact, semantic, and prompt cache separately.
6. User-specific responses are never cached — only shared, context-independent responses.
7. Cache warm-up on startup for known common queries.
8. Log cache misses with query patterns — they reveal cache design gaps.
9. Semantic cache in vector DB for production — in-memory only for dev/small scale.
10. Cost savings from caching justify the complexity — measure ROI before building.
