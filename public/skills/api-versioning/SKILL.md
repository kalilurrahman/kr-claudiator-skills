---
name: api-versioning
description: Design an API versioning strategy for a REST or GraphQL API. Covers version negotiation, deprecation lifecycle, migration guides, and backward compatibility rules.
argument-hint: [API type, client types, breaking change frequency, deprecation timeline]
allowed-tools: Read, Write
---

# API Versioning Strategy

API versioning is change management. The goal is to evolve your API without breaking existing clients while giving new clients access to improved interfaces. A versioning strategy defines how versions are expressed, how clients negotiate them, how long old versions are supported, and how migrations are communicated.

## Versioning Approaches

| Strategy | Format | Pros | Cons |
|----------|--------|------|------|
| URL path | `/v1/users` | Obvious, cacheable, easy to route | Pollutes URL hierarchy |
| Query parameter | `/users?version=1` | Non-invasive URL | Easy to forget, hard to route |
| Header | `Accept: application/vnd.api+json;version=1` | Clean URLs | Less discoverable |
| Content negotiation | `Accept: application/vnd.myapi.v1+json` | RESTful | Complex client implementation |

**Recommendation:** URL path versioning for public APIs (discoverability matters); header versioning for internal APIs (URL stability matters).

## Breaking vs. Non-Breaking Changes

```
NON-BREAKING (safe to deploy without version bump):
  + Add new optional field to response
  + Add new optional request parameter
  + Add new endpoint
  + Add new enum value (if clients ignore unknowns)
  + Increase rate limits
  + Relax validation rules

BREAKING (require new version):
  - Remove or rename a field
  - Change field type (string → integer)
  - Change endpoint path or HTTP method
  - Make optional field required
  - Remove enum value
  - Change error response format
  - Change authentication scheme
  - Reduce rate limits
  - Stricter validation
```

## Process

1. **Choose a versioning scheme** — URL path for public, header for internal.
2. **Define the version number format** — major only (v1, v2) for public; semver (1.2.3) for internal.
3. **Establish backward compatibility rules** — what changes require a new major version?
4. **Define the deprecation lifecycle** — how long do you support old versions after a new one ships?
5. **Design the version negotiation** — what happens when a client requests an unsupported version?
6. **Build the migration guide template** — every new version ships with a changelog and migration guide.
7. **Set up routing** — route `/v1/` and `/v2/` to separate handlers or use middleware to transform.
8. **Implement Sunset headers** — RFC 8594 headers tell clients when an endpoint will be removed.
9. **Monitor version usage** — track which clients are on which version before deprecating.
10. **Save** strategy to `docs/api-versioning.md`.

## Output Format

### URL Path Versioning

```
# Version in URL path — recommended for public APIs
GET  /v1/users/{id}
POST /v1/orders
GET  /v2/users/{id}     # v2 with new response schema

# Router config (Express)
app.use('/v1', v1Router);
app.use('/v2', v2Router);

# Router config (FastAPI)
from fastapi import APIRouter
v1 = APIRouter(prefix="/v1")
v2 = APIRouter(prefix="/v2")
app.include_router(v1)
app.include_router(v2)
```

### Header Versioning

```python
# FastAPI header versioning middleware
from fastapi import Request, HTTPException

async def version_middleware(request: Request, call_next):
    version = request.headers.get("API-Version", "2")
    supported = {"1", "2"}
    if version not in supported:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "unsupported_version",
                "message": f"API-Version {version!r} is not supported",
                "supported_versions": sorted(supported),
                "latest": "2"
            }
        )
    request.state.api_version = version
    response = await call_next(request)
    response.headers["API-Version"] = version
    response.headers["API-Latest-Version"] = "2"
    return response
```

### Deprecation Headers (RFC 8594)

```python
# Add to responses for deprecated versions or endpoints
from datetime import datetime, timezone

def deprecated_response_headers(sunset_date: str) -> dict:
    return {
        "Deprecation": "true",
        "Sunset": sunset_date,               # RFC 7231 date: "Sat, 31 Dec 2025 23:59:59 GMT"
        "Link": '<https://docs.example.com/migration/v1-to-v2>; rel="deprecation"',
    }

# Django middleware
class DeprecationMiddleware:
    DEPRECATED_VERSIONS = {
        "v1": "Sat, 31 Dec 2025 23:59:59 GMT"
    }
    def __call__(self, request):
        response = self.get_response(request)
        version = self._extract_version(request.path)
        if version in self.DEPRECATED_VERSIONS:
            response["Deprecation"] = "true"
            response["Sunset"] = self.DEPRECATED_VERSIONS[version]
            response["Link"] = f'<https://docs.example.com/migrate/{version}>; rel="deprecation"'
        return response
```

### Version Lifecycle Policy

```markdown
# API Version Lifecycle

## Support Tiers
| Tier | Definition | SLA |
|------|-----------|-----|
| Current | Latest stable version | Full support, active development |
| Maintenance | Previous version | Security fixes only |
| Deprecated | Sunset announced | No new fixes; removal date set |
| Retired | Removed | 410 Gone response |

## Timeline
- New major version ships → previous version enters Maintenance
- Maintenance → Deprecated: announced at least 6 months in advance
- Deprecated → Retired: minimum 12 months notice for external APIs; 3 months for internal

## Minimum Support Windows
- Public API: 18 months from deprecation announcement to removal
- Partner API: 12 months
- Internal API: 3 months (with migration support)
```

### Migration Guide Template

```markdown
# Migration Guide: v1 → v2

**Breaking changes:** [N]
**Estimated migration effort:** [S/M/L]
**v1 sunset date:** [Date]

## Summary of Changes

| Change | v1 | v2 | Action required |
|--------|----|----|----------------|
| User response schema | `name: string` | `first_name, last_name: string` | Split name field in consumers |
| Pagination | `page, per_page` params | Cursor-based `cursor, limit` | Update pagination logic |
| Error format | `{error: string}` | `{code, message, details}` | Update error handling |

## Step-by-Step Migration

### 1. Update authentication
[Before / After code example]

### 2. Update User response handling
Before (v1):
```python
name = user["name"]  # "John Doe"
```
After (v2):
```python
name = f"{user['first_name']} {user['last_name']}"
```

### 3. Update pagination
[Before / After code example]

## Testing Your Migration
[Checklist of things to verify]

## Support
Questions? [Link to migration support channel or email]
```

### Version Usage Monitoring

```python
# Track version usage to know when it's safe to deprecate
import time
from prometheus_client import Counter

api_version_counter = Counter(
    "api_requests_by_version_total",
    "API requests broken down by version",
    ["version", "endpoint", "method"]
)

# Middleware
def track_version(request):
    version = extract_version(request)
    api_version_counter.labels(
        version=version,
        endpoint=request.path,
        method=request.method
    ).inc()

# Alert: clients still on deprecated version
# api_requests_by_version_total{version="v1"} > 0 AND time() > sunset_timestamp
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Never versioning | First breaking change breaks all clients | Version from day one, even if v1 is your first |
| Too many versions | N versions × M features = impossible to maintain | Aggressive deprecation; max 2 concurrent versions |
| No sunset dates | Clients never migrate; old versions live forever | Set and enforce sunset dates at deprecation announcement |
| Silent breaking changes | Clients break without warning | Backward compat audit on every PR; automated contract tests |
| Version in response body | Not standard; hard to route | Version in URL or header only |
| No migration guide | Clients don't know how to upgrade | Ship migration guide same day as new version |

## Rules

- **Version from v1, day one** — adding versioning later is much harder than starting with it.
- **Major versions only for breaking changes** — do not version every release; only when the contract changes.
- **Maximum two concurrent supported versions** — more than two is unmanageable.
- **Set sunset dates at deprecation time** — not later; vague deprecations are ignored.
- **Monitor which clients use which version** — never retire a version with active traffic.
- **Ship the migration guide with the new version** — not after; clients need it immediately.
- **Automate backward compat checks** — use contract testing (Pact) to catch breaking changes in CI.
- **Honor your sunset dates** — if you extend without reason, clients learn deadlines are not real.
- **Return useful errors for unsupported versions** — tell clients the supported versions and link to docs.
- **Add Deprecation and Sunset headers** — RFC 8594 is the standard; good clients will surface these to developers.
