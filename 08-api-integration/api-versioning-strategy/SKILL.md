---
name: api-versioning-strategy
description: Design an API versioning strategy that allows evolution without breaking existing clients. Outputs versioning scheme, compatibility rules, migration timeline, and consumer communication plan.
argument-hint: [API type, consumer count, change frequency, breaking change risk]
allowed-tools: Read, Write
---

# API Versioning Strategy

API versioning lets you evolve your API without breaking existing clients. The challenge is choosing a versioning approach that is simple to implement, easy for clients to understand, and compatible with your deployment and documentation tooling.

## Versioning Approaches

```
1. URL Path Versioning (most common)
   /api/v1/orders  →  /api/v2/orders
   Pros: Explicit, cacheable, easy to test
   Cons: Version in URL is "wrong" by REST purists

2. Header Versioning
   Accept: application/vnd.api+json; version=2
   Pros: Clean URLs
   Cons: Harder to test, not cacheable by default

3. Query Parameter
   /api/orders?version=2
   Pros: Easy to add for testing
   Cons: Not recommended for production; easily forgotten

4. Content Negotiation
   Accept: application/vnd.company.v2+json
   Pros: RESTful
   Cons: Complex; unfamiliar to many developers

RECOMMENDATION: URL path versioning for public APIs,
header versioning for internal APIs.
```

## Compatibility Rules

```python
# What requires a new version (breaking changes):
BREAKING_CHANGES = [
    "Removing a field from a response",
    "Renaming a field",
    "Changing a field type (string → integer)",
    "Changing HTTP status codes",
    "Removing an endpoint",
    "Making an optional field required",
    "Changing authentication scheme",
    "Modifying pagination format",
]

# What does NOT require a new version (non-breaking):
NON_BREAKING_CHANGES = [
    "Adding new optional fields to response",
    "Adding new optional request parameters",
    "Adding new endpoints",
    "Adding new enum values (with caution)",
    "Adding new HTTP methods to existing resources",
    "Bug fixes that don't change the contract",
]

# Robustness principle: clients should be written to ignore unknown fields
# so additive changes are safe
```

## URL Path Versioning Implementation

```python
from fastapi import FastAPI, APIRouter

app = FastAPI()

# v1 router — frozen, maintained for backwards compatibility
v1 = APIRouter(prefix="/api/v1")

@v1.get("/orders/{order_id}")
async def get_order_v1(order_id: str):
    order = await order_service.get(order_id)
    # v1 response format — never change this
    return {
        "order_ref": order.id,      # v1 used order_ref
        "status": order.status,
        "total_cost": order.total,   # v1 used total_cost
    }

# v2 router — current active version
v2 = APIRouter(prefix="/api/v2")

@v2.get("/orders/{order_id}")
async def get_order_v2(order_id: str):
    order = await order_service.get(order_id)
    # v2 response format — improved field names
    return {
        "order_id": order.id,        # renamed from order_ref
        "status": order.status,
        "total_amount": order.total, # renamed from total_cost
        "currency": order.currency,  # new field in v2
    }

app.include_router(v1)
app.include_router(v2)
```

## Version Lifecycle Policy

```markdown
## API Version Lifecycle

ACTIVE:    Current version — full support, new features added
MAINTAINED: Previous version — bug fixes only, no new features
DEPRECATED: Announced EOL — sunset headers, migration guide published
RETIRED:   Returns 410 Gone — remove code after 30 days of zero traffic

## Standard Timeline
- v1 → ACTIVE (launch)
- v2 launches → v1 becomes MAINTAINED
- v1 DEPRECATED: 6 months notice minimum
- v1 RETIRED after 6 months

## Version Support Commitment
- ACTIVE and MAINTAINED versions: SLA-backed support
- DEPRECATED: best-effort support, no new fixes
- We maintain at most 2 versions simultaneously (current + previous)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Breaking changes in existing version** | Clients break silently | Never break a published version; create v+1 |
| **Too many active versions** | Maintenance burden; confusing for clients | Maximum 2 supported versions at once |
| **No deprecation notice** | Clients broken without warning | Minimum 6 months notice with migration guide |
| **Versioning every minor change** | Version proliferation | Non-breaking changes in same version |
| **No default version** | Old clients break when new version is default | Maintain explicit version routing; no implicit default |

## 10 Rules

1. Never make breaking changes to a published version — create a new version.
2. URL path versioning (/v1/, /v2/) is the default choice for public APIs.
3. Non-breaking changes (adding optional fields, new endpoints) go in the current version.
4. Support at most 2 versions simultaneously — v(n) and v(n-1).
5. Deprecation notice minimum 6 months before retirement.
6. Retired versions return 410 Gone with a migration guide URL in the body.
7. Add `Deprecation` and `Sunset` HTTP headers to deprecated version responses.
8. Write a migration guide before announcing deprecation — not after.
9. Track usage per version — retire only when traffic reaches zero.
10. Document the version lifecycle policy publicly — clients need to plan migrations.
