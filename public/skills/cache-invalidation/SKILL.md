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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Cache Invalidation** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Design cache invalidation strategies to keep cached data consistent with source of truth. Outputs invalidation patterns, TTL design, event-driven invalidation, 
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
