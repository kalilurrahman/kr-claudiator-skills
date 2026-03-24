---
name: api-deprecation
description: Plan and execute API deprecation without breaking consumers. Outputs deprecation timeline, sunset headers, migration guides, consumer tracking, and communication templates.
argument-hint: [API version, consumer count, migration complexity, timeline, replacement API]
allowed-tools: Read, Write
---

# API Deprecation

Deprecating an API without breaking clients requires advance notice, clear migration paths, monitoring of usage, and multiple communication channels. Rushed or silent deprecations destroy developer trust and cause production incidents. A well-run deprecation is a product launch for the new API.

## Deprecation Process

1. **Measure usage.** Who is calling the deprecated endpoint? What volume? Can you identify consumers from API keys or User-Agent headers?
2. **Define the timeline.** Minimum notice period: 3 months for minor changes, 6 months for major. Published sunset date.
3. **Build the replacement first.** Deprecate only when the replacement is production-ready.
4. **Add sunset headers.** HTTP Deprecation and Sunset headers on every deprecated response.
5. **Communicate proactively.** Email registered developers, changelog, docs, status page.
6. **Track migration progress.** Monitor deprecated endpoint traffic declining toward zero.
7. **Sunset gradually.** Move to 429 responses before full removal.
8. **Remove after zero traffic.** Only retire the code when traffic is zero for 30+ days.

## Deprecation Headers

```python
from fastapi import FastAPI, Request, Response
from datetime import datetime
import pytz

# HTTP Deprecation headers (RFC 8594)
DEPRECATED_ENDPOINTS = {
    "/api/v1/orders": {
        "deprecated_at": "Wed, 01 Jan 2025 00:00:00 GMT",
        "sunset_at": "Sun, 01 Jun 2025 23:59:59 GMT",     # When it stops working
        "link": "https://docs.example.com/api/v2/orders",  # Migration guide
        "replacement": "/api/v2/orders",
    },
    "/api/v1/users/{user_id}/profile": {
        "deprecated_at": "Fri, 01 Mar 2024 00:00:00 GMT",
        "sunset_at": "Mon, 01 Sep 2024 23:59:59 GMT",
        "link": "https://docs.example.com/api/v2/users",
        "replacement": "/api/v2/users/{user_id}",
    },
}

@app.middleware("http")
async def add_deprecation_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Check if this path is deprecated
    for pattern, config in DEPRECATED_ENDPOINTS.items():
        if matches_path(request.url.path, pattern):
            response.headers["Deprecation"] = config["deprecated_at"]
            response.headers["Sunset"] = config["sunset_at"]
            response.headers["Link"] = (
                f'<{config["link"]}>; rel="successor-version"'
            )
            # Log for usage tracking
            await track_deprecated_usage(
                endpoint=request.url.path,
                method=request.method,
                api_key=request.headers.get("x-api-key"),
                user_agent=request.headers.get("user-agent"),
            )
            break
    
    return response
```

## Sunset Enforcement

```python
from datetime import datetime, timezone

@app.middleware("http")
async def enforce_sunset(request: Request, call_next):
    for pattern, config in DEPRECATED_ENDPOINTS.items():
        if matches_path(request.url.path, pattern):
            sunset = datetime.strptime(config["sunset_at"], 
                                        "%a, %d %b %Y %H:%M:%S GMT")
            sunset = sunset.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            
            # Within 30 days of sunset — add urgent warning
            days_until_sunset = (sunset - now).days
            if 0 < days_until_sunset <= 30:
                # Continue but add urgent warning header
                response = await call_next(request)
                response.headers["Warning"] = (
                    f'299 - "This API endpoint will stop working in {days_until_sunset} days. '
                    f'Migrate to {config["replacement"]} now."'
                )
                return response
            
            # Past sunset — return 410 Gone
            if now > sunset:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=410,
                    headers={
                        "Sunset": config["sunset_at"],
                        "Link": f'<{config["link"]}>; rel="successor-version"',
                    },
                    content={
                        "error": "gone",
                        "message": f"This API endpoint was retired on {config['sunset_at']}.",
                        "migration_guide": config["link"],
                        "replacement": config["replacement"],
                    }
                )
    
    return await call_next(request)
```

## Consumer Tracking

```python
import pandas as pd
from datetime import datetime, timedelta

class DeprecationTracker:
    def __init__(self, db):
        self.db = db
    
    async def get_migration_progress(self, endpoint: str, days: int = 30) -> dict:
        """Track which consumers are still using deprecated endpoint."""
        since = datetime.utcnow() - timedelta(days=days)
        
        # Get usage by API key
        usage = await self.db.execute("""
            SELECT
                api_key,
                consumer_name,
                COUNT(*) as call_count,
                MAX(called_at) as last_seen,
                MIN(called_at) as first_seen
            FROM deprecated_endpoint_usage
            WHERE endpoint = $1 AND called_at >= $2
            GROUP BY api_key, consumer_name
            ORDER BY call_count DESC
        """, [endpoint, since])
        
        # Compare to 30 days ago to see trend
        prev_period = await self.db.execute("""
            SELECT api_key, COUNT(*) as call_count
            FROM deprecated_endpoint_usage
            WHERE endpoint = $1 
              AND called_at BETWEEN $2 AND $3
            GROUP BY api_key
        """, [endpoint, since - timedelta(days=days), since])
        
        prev_counts = {row["api_key"]: row["call_count"] for row in prev_period}
        
        consumers = []
        for row in usage:
            prev = prev_counts.get(row["api_key"], 0)
            change_pct = ((row["call_count"] - prev) / prev * 100) if prev > 0 else 0
            consumers.append({
                "api_key": row["api_key"][:8] + "...",  # Mask key
                "consumer": row["consumer_name"],
                "calls_last_30d": row["call_count"],
                "last_seen": row["last_seen"].isoformat(),
                "trend": "↓ migrating" if change_pct < -20 else "→ stable" if abs(change_pct) < 10 else "↑ increasing",
            })
        
        return {
            "endpoint": endpoint,
            "active_consumers": len(consumers),
            "total_calls_30d": sum(c["calls_last_30d"] for c in consumers),
            "consumers": consumers,
            "migration_completion": len([c for c in consumers if c["trend"] == "↓ migrating"]) / max(len(consumers), 1),
        }
```

## Migration Guide Template

```markdown
# Migration Guide: /api/v1/orders → /api/v2/orders

**Deprecated:** January 1, 2025  
**Sunset date:** June 1, 2025  
**Migration time estimate:** 2-4 hours

## What's Changing

The v2 Orders API improves on v1 in several ways:
- Pagination uses `cursor` instead of `offset` (more efficient for large datasets)
- `status` field now accepts an array for multi-status filtering
- Response includes `meta.total` for count without a separate request

## Breaking Changes

| v1 | v2 | Notes |
|----|----|----|
| `?page=2&limit=20` | `?cursor=<token>&limit=20` | Cursor-based pagination |
| `?status=paid` | `?status[]=paid&status[]=shipped` | Array filter |
| Response: `total_count` | Response: `meta.total` | Renamed |
| Response: `order_ref` | Response: `order_id` | Renamed (same value) |

## Migration Steps

### Step 1: Update the endpoint URL
```diff
- GET /api/v1/orders
+ GET /api/v2/orders
```

### Step 2: Update pagination
```python
# v1
response = client.get("/api/v1/orders", params={"page": 2, "limit": 20})

# v2
cursor = None
while True:
    params = {"limit": 20}
    if cursor:
        params["cursor"] = cursor
    response = client.get("/api/v2/orders", params=params)
    data = response.json()
    process(data["items"])
    cursor = data["meta"].get("next_cursor")
    if not cursor:
        break
```

### Step 3: Update status filter
```python
# v1
client.get("/api/v1/orders", params={"status": "paid"})

# v2
client.get("/api/v2/orders", params={"status[]": ["paid", "shipped"]})
```

## Testing Your Migration

We provide a v2 sandbox environment:
- URL: https://sandbox-api.example.com/api/v2/
- Use your existing API key
- Data mirrors production (no real charges)

## Need Help?

- Migration guide: https://docs.example.com/api/v2/migration
- Support: api-support@example.com
- Office hours: Tuesdays 2-3pm UTC (for priority migration support)
```

## Communication Templates

```markdown
## Email: Initial Deprecation Notice

Subject: Action Required: /api/v1/orders will be retired on June 1, 2025

We're writing to let you know that our API v1 orders endpoint will be retired on June 1, 2025.

**Your account:** We see you're calling /api/v1/orders approximately 500 times/day.

**What you need to do:** Migrate to /api/v2/orders before June 1, 2025.

**Migration guide:** https://docs.example.com/api/v2/migration  
**Estimated migration time:** 2-4 hours  

Key changes in v2:
- Cursor-based pagination (more efficient)
- Array filtering for status
- Minor field renames (see migration guide)

Questions? Reply to this email or join our migration office hours (Tuesdays 2-3pm UTC).

---

## Email: 30-Day Warning

Subject: URGENT: /api/v1/orders retires in 30 days — action required

Your account is still making ~N calls/day to /api/v1/orders, which retires on June 1, 2025.

After June 1, these calls will return HTTP 410 Gone.

Please migrate immediately: https://docs.example.com/api/v2/migration

If you need help or more time, contact us now.
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Deprecating without a replacement** | Consumers can't migrate | Build and test replacement before announcing deprecation |
| **Too-short notice period** | Developers can't get approvals and ship changes in time | 3-6 months minimum based on complexity |
| **Silent deprecation** | Consumers don't know until it breaks | Email + docs + headers + changelog |
| **Removing before zero traffic** | Breaking live consumers | Monitor traffic; retire only after 30 days of zero traffic |
| **No consumer tracking** | Can't know if migration is complete | Track per-API-key usage of deprecated endpoints |
| **Returning 404 on sunset** | Confusing error; no migration info | Return 410 Gone with migration guide URL |
| **One communication only** | Single email missed or ignored | 3 touchpoints: deprecation day, 30-day warning, 7-day warning |

## 10 Rules

1. Build and production-test the replacement before announcing the deprecation.
2. Sunset date is a firm commitment — don't extend it repeatedly; it destroys credibility.
3. Add HTTP `Deprecation` and `Sunset` headers on the first day of deprecation.
4. Track every API key calling the deprecated endpoint — you need to know who hasn't migrated.
5. Proactive outreach: email consumers when you deprecate, at 30 days, and at 7 days.
6. Return 410 Gone (not 404) after sunset — with the migration guide URL in the response body.
7. Sandbox the v2 API from day 1 of deprecation — consumers need a safe place to test migration.
8. Document every breaking change in the migration guide — no surprises.
9. Never remove code until traffic has been zero for 30+ days.
10. Post-mortem any consumer broken by a deprecation — improve the process, not just the apology.
