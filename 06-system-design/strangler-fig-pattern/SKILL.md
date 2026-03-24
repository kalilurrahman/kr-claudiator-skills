---
name: strangler-fig-pattern
description: Migrate legacy monoliths to modern architecture using the Strangler Fig pattern. Outputs migration strategy, routing layer design, feature extraction sequence, and rollback procedures.
argument-hint: [legacy system type, target architecture, team size, migration timeline, risk tolerance]
allowed-tools: Read, Write
---

# Strangler Fig Pattern

The Strangler Fig pattern migrates a legacy system incrementally by routing new functionality to a new system while the legacy system handles the rest. Over time, the new system absorbs more traffic until the legacy system can be retired. No big-bang rewrite. No parallel operation of two full systems.

## Process

1. **Map the legacy system.** Document all entry points (APIs, UIs, background jobs, integrations).
2. **Identify seams.** Where can you introduce a routing layer? Typically at the API gateway, database, or message bus.
3. **Prioritise extraction sequence.** Start with low-risk, well-defined features. Avoid starting with core, complex, or cross-cutting concerns.
4. **Build the routing layer.** A facade that forwards requests to legacy or new service based on rules.
5. **Extract the first feature.** Build it in the new system. Route a small percentage of traffic. Verify parity.
6. **Migrate traffic incrementally.** 10% → 50% → 100% with monitoring at each step.
7. **Repeat per feature.** Each extracted feature reduces legacy surface area.
8. **Retire legacy when empty.** The fig has strangled the tree.

## Routing Layer Design

```python
# API Gateway routing layer — sits in front of both systems
from fastapi import FastAPI, Request
import httpx
import logging

app = FastAPI()
logger = logging.getLogger()

# Feature flags controlling which system handles each route
ROUTING_CONFIG = {
    "/api/v1/orders":        {"target": "legacy",  "canary_pct": 0},
    "/api/v1/products":      {"target": "new",     "canary_pct": 100},  # Fully migrated
    "/api/v1/users":         {"target": "canary",  "canary_pct": 10},   # 10% to new
    "/api/v1/payments":      {"target": "legacy",  "canary_pct": 0},
    "/api/v1/notifications": {"target": "new",     "canary_pct": 100},  # Migrated
}

LEGACY_BASE = "http://legacy-monolith:8080"
NEW_BASE    = "http://new-services:8080"

@app.api_route("/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def route_request(request: Request, path: str):
    route_key = f"/{path.split('/')[0]}" if '/' in path else f"/{path}"
    config = ROUTING_CONFIG.get(route_key, {"target": "legacy", "canary_pct": 0})
    
    target = _determine_target(config, request)
    base = NEW_BASE if target == "new" else LEGACY_BASE
    
    logger.info(f"Routing {request.method} {path} → {target}")
    
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method,
            url=f"{base}/{path}",
            headers=dict(request.headers),
            content=await request.body(),
            params=dict(request.query_params),
            timeout=30.0,
        )
    
    from fastapi.responses import Response
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers),
        media_type=resp.headers.get("content-type"),
    )

def _determine_target(config: dict, request: Request) -> str:
    if config["target"] == "new": return "new"
    if config["target"] == "legacy": return "legacy"
    
    # Canary: route by user_id hash for sticky routing
    import hashlib
    user_id = request.headers.get("x-user-id", "")
    hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
    return "new" if hash_val < config["canary_pct"] else "legacy"
```

## Feature Extraction Checklist

```markdown
## Feature Extraction: User Profiles

### Pre-extraction
- [ ] Document all legacy endpoints for this feature (GET/PUT /users/*)
- [ ] Identify all DB tables accessed by these endpoints
- [ ] Map all downstream consumers (who calls these endpoints?)
- [ ] Document current behaviour including edge cases and error responses
- [ ] Write characterisation tests against legacy (record expected outputs)

### Build new service
- [ ] New service passes all characterisation tests
- [ ] API contracts match legacy (same request/response shapes)
- [ ] Performance baseline: p99 latency comparable to legacy
- [ ] Feature flags implemented for traffic splitting

### Migration
- [ ] 1% canary — monitor error rate, latency, correctness
- [ ] 10% — run for 24h, compare metrics
- [ ] 50% — run for 48h, full monitoring
- [ ] 100% — monitor legacy for 24h before disabling it

### Post-migration
- [ ] Legacy code path disabled (not deleted yet)
- [ ] DB tables still populated for 30 days (rollback window)
- [ ] Legacy tables retired after 30 days
- [ ] Legacy code deleted
```

## Database Migration Strategy

```sql
-- Phase 1: Dual writes (new service writes to both DBs)
-- Legacy DB continues to be source of truth

-- Phase 2: New DB becomes source of truth, legacy read from new
-- (via replication or sync job)

-- Phase 3: Legacy DB retired

-- Sync job during migration
INSERT INTO new_db.users (id, email, name, created_at)
SELECT id, email, name, created_at
FROM legacy_db.users
WHERE updated_at > :last_sync_time
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = EXCLUDED.updated_at;
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Starting with the hardest feature** | Failure early kills confidence and timeline | Start with well-defined, low-risk features |
| **No routing layer** | Can't incrementally shift traffic | Build the proxy/facade first |
| **Big-bang data migration** | High risk, long downtime | Dual-write then cut over |
| **Skipping characterisation tests** | Don't know if new system matches legacy behaviour | Record legacy outputs; test new system against them |
| **Deleting legacy too early** | No rollback path if new system has bugs | Keep legacy running for 30 days post-migration |
| **Migrating shared database tables** | Creates tight coupling between old and new | Separate data ownership before migrating logic |

## 10 Rules

1. Never start with the core or most complex features — start with leaf nodes of the dependency graph.
2. The routing layer is built first and tested before any extraction begins.
3. Characterisation tests record legacy behaviour — the new system must match them exactly.
4. Traffic migration is gradual: 1% → 10% → 50% → 100% with monitoring gates.
5. Rollback is possible at every stage until legacy is retired.
6. Dual-write databases during transition — never migrate data in a single cutover.
7. Keep legacy running for 30 days after 100% traffic migration — then retire.
8. Each extracted service reduces legacy footprint — measure progress by % of legacy routes migrated.
9. Team owns the proxy layer — it is not a temporary hack, it is the migration control plane.
10. Define the retirement date for legacy before starting — migration without a deadline becomes permanent parallel operation.
