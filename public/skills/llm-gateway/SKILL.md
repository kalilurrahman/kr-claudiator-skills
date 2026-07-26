---
name: llm-gateway
description: Design and implement an LLM gateway for routing, rate limiting, cost control, caching, and observability across multiple AI providers. Outputs gateway architecture, routing rules, and operational runbook.
argument-hint: [providers needed, traffic volume, latency requirements, cost budget, compliance requirements]
allowed-tools: Read, Write
---

# LLM Gateway

An LLM gateway is a proxy layer between your application and AI provider APIs. It centralises routing, rate limiting, cost tracking, semantic caching, fallback logic, and observability — without requiring every team to re-implement these concerns.

## Process

1. **Define gateway requirements.** Which providers? What routing logic? Cost caps per team? Compliance requirements (data residency, PII scrubbing)?
2. **Choose or build.** LiteLLM (open source), Portkey, Kong AI Gateway, or custom FastAPI proxy.
3. **Implement routing rules.** By model capability, cost, latency, or feature flags.
4. **Add rate limiting.** Per-team, per-user, global. Token-based (not request-based).
5. **Implement semantic caching.** Similar prompts → cached responses. Significant cost reduction.
6. **Add fallback logic.** Primary provider down → automatic fallback to secondary.
7. **Instrument observability.** Latency, cost per token, cache hit rate, error rate — per team and model.
8. **Enforce policies.** PII detection, content filtering, max token limits.

## Gateway Architecture

```
Applications
    │
    ▼
┌─────────────────────────────────┐
│          LLM GATEWAY            │
│                                 │
│  Auth → Rate Limit → PII Check  │
│          │                      │
│      Router                     │
│    ┌─────┼──────┐               │
│    │     │      │               │
│  Cache  Log  Fallback           │
│    │     │      │               │
└────┼─────┼──────┼───────────────┘
     │     │      │
     ▼     ▼      ▼
  [Redis][Logs][Provider APIs]
           │
    ┌──────┴──────┐
    │             │
 Anthropic      OpenAI
   Claude        GPT-4
    │             │
 Anthropic     Google
  Haiku          Gemini
```

## LiteLLM Gateway Setup

```python
# litellm_config.yaml
model_list:
  # Primary: Claude for complex reasoning
  - model_name: smart
    litellm_params:
      model: anthropic/claude-opus-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
      max_tokens: 4096
    model_info:
      cost_per_input_token: 0.000015
      cost_per_output_token: 0.000075

  # Default: Claude Sonnet for most tasks
  - model_name: default
    litellm_params:
      model: anthropic/claude-sonnet-4-6
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      cost_per_input_token: 0.000003
      cost_per_output_token: 0.000015

  # Fast: Haiku for simple/high-volume
  - model_name: fast
    litellm_params:
      model: anthropic/claude-haiku-4-5-20251001
      api_key: os.environ/ANTHROPIC_API_KEY

  # Fallback: OpenAI if Anthropic down
  - model_name: fallback
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

router_settings:
  routing_strategy: "usage-based-routing"
  fallbacks:
    - {"smart": ["fallback"]}
    - {"default": ["fallback"]}

litellm_settings:
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
  cache: true
  cache_params:
    type: redis
    host: redis
    port: 6379
    ttl: 3600           # Cache for 1 hour

general_settings:
  master_key: os.environ/GATEWAY_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

## Custom Gateway (FastAPI)

```python
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import anthropic
import hashlib
import redis.asyncio as redis
import json
import time
from typing import Optional

app = FastAPI(title="LLM Gateway")
redis_client = redis.Redis(host="redis", port=6379, decode_responses=True)
anthropic_client = anthropic.Anthropic()

# Team configuration
TEAM_CONFIG = {
    "team-product": {
        "daily_token_budget": 1_000_000,
        "allowed_models": ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
        "max_tokens_per_request": 2048,
    },
    "team-research": {
        "daily_token_budget": 5_000_000,
        "allowed_models": ["claude-opus-4-5", "claude-sonnet-4-6"],
        "max_tokens_per_request": 8192,
    },
}

async def get_team(x_team_id: str = Header()):
    if x_team_id not in TEAM_CONFIG:
        raise HTTPException(403, f"Unknown team: {x_team_id}")
    return x_team_id

async def check_rate_limit(team_id: str, estimated_tokens: int):
    key = f"tokens:{team_id}:{time.strftime('%Y-%m-%d')}"
    used = int(await redis_client.get(key) or 0)
    budget = TEAM_CONFIG[team_id]["daily_token_budget"]
    if used + estimated_tokens > budget:
        raise HTTPException(429, f"Daily token budget exhausted ({used}/{budget})")
    await redis_client.incrby(key, estimated_tokens)
    await redis_client.expire(key, 86400)

def cache_key(model: str, messages: list, temperature: float) -> str:
    # Cache deterministic requests only (temperature=0)
    if temperature != 0:
        return None
    content = json.dumps({"model": model, "messages": messages}, sort_keys=True)
    return f"llm_cache:{hashlib.sha256(content.encode()).hexdigest()}"

async def check_pii(text: str) -> bool:
    """Basic PII detection — extend with Presidio or similar."""
    import re
    patterns = [
        r'\b\d{3}-\d{2}-\d{4}\b',         # SSN
        r'\b4[0-9]{12}(?:[0-9]{3})?\b',    # Visa card
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email (warn only)
    ]
    for pattern in patterns:
        if re.search(pattern, text):
            return True
    return False

@app.post("/v1/messages")
async def proxy_messages(request: dict, team_id: str = Depends(get_team)):
    model = request.get("model", "claude-sonnet-4-6")
    messages = request.get("messages", [])
    max_tokens = request.get("max_tokens", 1024)
    temperature = request.get("temperature", 1.0)
    
    # Validate model access
    config = TEAM_CONFIG[team_id]
    if model not in config["allowed_models"]:
        raise HTTPException(403, f"Model {model} not allowed for {team_id}")
    
    # Enforce token limit
    max_tokens = min(max_tokens, config["max_tokens_per_request"])
    
    # PII check on user messages
    user_text = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    if await check_pii(user_text):
        raise HTTPException(400, "PII detected in request — scrub before sending")
    
    # Check semantic cache (deterministic requests only)
    ck = cache_key(model, messages, temperature)
    if ck:
        cached = await redis_client.get(ck)
        if cached:
            resp = json.loads(cached)
            resp["cached"] = True
            return resp
    
    # Rate limit check (estimate ~4 chars/token)
    estimated_tokens = len(user_text) // 4 + max_tokens
    await check_rate_limit(team_id, estimated_tokens)
    
    # Call provider
    start = time.time()
    try:
        response = anthropic_client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
        )
        latency_ms = int((time.time() - start) * 1000)
        
        result = {
            "id": response.id,
            "model": response.model,
            "content": [{"type": b.type, "text": getattr(b, "text", "")} for b in response.content],
            "usage": response.usage.model_dump(),
            "latency_ms": latency_ms,
            "cached": False,
        }
        
        # Cache deterministic results
        if ck:
            await redis_client.setex(ck, 3600, json.dumps(result))
        
        # Track actual token usage
        actual_tokens = response.usage.input_tokens + response.usage.output_tokens
        await redis_client.incrby(
            f"tokens:{team_id}:{time.strftime('%Y-%m-%d')}", actual_tokens
        )
        
        return result
    
    except anthropic.APIStatusError as e:
        if e.status_code == 529:  # Overloaded — fallback
            return await fallback_openai(request)
        raise HTTPException(e.status_code, str(e))

@app.get("/v1/usage/{team_id}")
async def get_usage(team_id: str):
    today = time.strftime('%Y-%m-%d')
    used = int(await redis_client.get(f"tokens:{team_id}:{today}") or 0)
    budget = TEAM_CONFIG.get(team_id, {}).get("daily_token_budget", 0)
    return {
        "team_id": team_id,
        "date": today,
        "tokens_used": used,
        "budget": budget,
        "percent_used": round(used / budget * 100, 1) if budget else 0,
    }
```

## Observability Dashboard Metrics

```python
# Key metrics to track per request (send to Datadog / Grafana)
{
    "timestamp": "2024-03-15T14:30:00Z",
    "team_id": "team-product",
    "model": "claude-sonnet-4-6",
    "input_tokens": 512,
    "output_tokens": 256,
    "total_tokens": 768,
    "cost_usd": 0.00384,         # input_tokens * price + output_tokens * price
    "latency_ms": 1240,
    "cache_hit": False,
    "provider": "anthropic",
    "status": "success",
    "request_id": "req_abc123",
}

# Alert thresholds
# - p99 latency > 10s → investigate
# - error rate > 1% in 5min → page on-call
# - daily cost > 80% of budget → alert team lead
# - cache hit rate < 10% → review caching strategy
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **One API key for all teams** | No cost attribution; one team burns budget for all | Per-team keys or gateway-enforced budgets |
| **No semantic caching** | Identical prompts charged repeatedly | Cache deterministic requests (temperature=0) |
| **Request-based rate limiting** | Short requests count same as 100k-token requests | Rate limit by tokens, not requests |
| **No fallback provider** | One provider outage = total outage | At least one fallback model configured |
| **Logging full prompts always** | PII in logs; high storage cost | Configurable log levels; hash sensitive content |
| **Gateway as afterthought** | Retro-fitting onto existing direct integrations | Gateway from day one; single integration point |
| **No cost alerts** | Teams burn through budgets undetected | Daily cost alerts at 50%, 80%, 100% of budget |

## 10 Rules

1. Single integration point — all LLM calls go through the gateway, never direct from applications.
2. Rate limit by tokens, not requests — a single large request costs 100× more than a small one.
3. Cache deterministic requests (temperature=0) — semantic caching cuts costs by 20-40% in typical workloads.
4. Always configure a fallback provider — single-provider dependency is a reliability risk.
5. Track cost per team, per model, per day — cost visibility drives cost responsibility.
6. PII scrubbing happens at the gateway, not in every application — one place to enforce, one place to audit.
7. Log latency, tokens, cost, and cache hit rate — without metrics you can't optimise.
8. Set hard budget caps that stop requests — soft alerts are ignored; hard stops prevent runaway cost.
9. Standardise on OpenAI-compatible API format (LiteLLM handles translation) — applications shouldn't know which provider they're using.
10. Test provider failover in staging — fallback only works if it's been tested.
