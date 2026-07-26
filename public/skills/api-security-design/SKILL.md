---
name: api-security-design
description: Design secure APIs with authentication, authorisation, input validation, rate limiting, and audit logging. Outputs security controls checklist, auth flow diagrams, and implementation patterns.
argument-hint: [API type, client types, sensitivity of data, regulatory requirements]
allowed-tools: Read, Write
---

# API Security Design

Secure APIs are not an add-on — they are designed in from the start. Every endpoint is a potential attack surface. Authentication, authorisation, input validation, and rate limiting are non-negotiable baseline controls for any production API.

## Process

1. **Classify data sensitivity.** What data does the API expose? PII, financial, health, public? Higher sensitivity = stricter controls.
2. **Choose auth mechanism.** OAuth 2.0 + OIDC for user-delegated access. API keys for machine-to-machine. mTLS for service mesh.
3. **Design authorisation model.** RBAC (role-based) or ABAC (attribute-based). Define resources and actions. Apply principle of least privilege.
4. **Enumerate attack surfaces.** For each endpoint: injection risks, IDOR, mass assignment, business logic flaws.
5. **Define input validation rules.** Schema validation, type checking, length limits, allowlists for enumerations.
6. **Set rate limits and quotas.** Per-client, per-endpoint, global. Define burst and sustained limits.
7. **Audit log all sensitive operations.** Who, what, when, from where. Immutable audit trail.
8. **Test the controls.** Automated security tests in CI/CD. Penetration test before launch.

## Authentication Patterns

```python
# JWT validation middleware (FastAPI)
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

JWKS_URL = "https://auth.example.com/.well-known/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)

security = HTTPBearer()

def require_auth(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="api.example.com",   # Must validate audience
            options={"require": ["exp", "iat", "sub", "aud"]},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")

# API Key auth for machine-to-machine
import hashlib, secrets

def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

def generate_api_key() -> tuple[str, str]:
    raw = f"sk_{secrets.token_urlsafe(32)}"
    return raw, hash_api_key(raw)  # Return (plaintext, hash)
    # Store only hash in DB; show plaintext to user once

async def require_api_key(x_api_key: str = Header()) -> ApiKeyRecord:
    key_hash = hash_api_key(x_api_key)
    record = await api_key_repo.find_by_hash(key_hash)
    if not record or record.revoked:
        raise HTTPException(401, "Invalid API key")
    if record.expires_at and record.expires_at < datetime.utcnow():
        raise HTTPException(401, "API key expired")
    await api_key_repo.update_last_used(record.id)
    return record
```

## Authorisation — RBAC

```python
from enum import Enum
from functools import wraps

class Permission(str, Enum):
    ORDERS_READ   = "orders:read"
    ORDERS_WRITE  = "orders:write"
    ORDERS_DELETE = "orders:delete"
    USERS_READ    = "users:read"
    USERS_ADMIN   = "users:admin"

ROLE_PERMISSIONS = {
    "viewer":  {Permission.ORDERS_READ, Permission.USERS_READ},
    "operator":{Permission.ORDERS_READ, Permission.ORDERS_WRITE},
    "admin":   set(Permission),  # All permissions
}

def require_permission(permission: Permission):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, claims=Depends(require_auth), **kwargs):
            roles = claims.get("roles", [])
            granted = set()
            for role in roles:
                granted |= ROLE_PERMISSIONS.get(role, set())
            
            if permission not in granted:
                raise HTTPException(403, "Insufficient permissions")
            return await func(*args, claims=claims, **kwargs)
        return wrapper
    return decorator

# Usage
@router.delete("/orders/{order_id}")
@require_permission(Permission.ORDERS_DELETE)
async def delete_order(order_id: str, claims: dict = Depends(require_auth)):
    ...

# IDOR Prevention — resource-level ownership check
@router.get("/orders/{order_id}")
async def get_order(order_id: str, claims: dict = Depends(require_auth)):
    order = await order_repo.get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Always verify ownership — never trust the ID alone
    user_id = claims["sub"]
    if order.customer_id != user_id and "admin" not in claims.get("roles", []):
        raise HTTPException(403, "Access denied")  # Not 404 — that leaks existence
    
    return order
```

## Input Validation

```python
from pydantic import BaseModel, validator, Field
import re

class CreateOrderRequest(BaseModel):
    # Explicit types, length limits, pattern validation
    customer_id: str = Field(min_length=1, max_length=50, pattern=r'^[a-zA-Z0-9-]+$')
    items: list = Field(min_items=1, max_items=100)
    shipping_address: str = Field(min_length=10, max_length=500)
    promo_code: str | None = Field(None, max_length=20, pattern=r'^[A-Z0-9-]+$')
    
    @validator('items', each_item=True)
    def validate_item(cls, item):
        if not isinstance(item.get('product_id'), str):
            raise ValueError("product_id must be string")
        if not (1 <= item.get('quantity', 0) <= 999):
            raise ValueError("quantity must be 1-999")
        return item
    
    class Config:
        # Reject extra fields — prevents mass assignment
        extra = "forbid"

# SQL Injection prevention — always parameterised queries
# BAD
query = f"SELECT * FROM orders WHERE customer_id = '{customer_id}'"

# GOOD
result = await db.execute(
    "SELECT * FROM orders WHERE customer_id = $1",
    [customer_id]
)

# Path traversal prevention
import os
def safe_file_path(user_input: str, base_dir: str) -> str:
    # Resolve and verify the path stays within base_dir
    requested = os.path.realpath(os.path.join(base_dir, user_input))
    if not requested.startswith(os.path.realpath(base_dir)):
        raise ValueError("Path traversal detected")
    return requested
```

## Rate Limiting

```python
# Redis sliding window rate limiter
import redis.asyncio as redis
import time

class RateLimiter:
    def __init__(self, redis_client, limit: int, window_seconds: int):
        self._redis = redis_client
        self._limit = limit
        self._window = window_seconds
    
    async def check(self, key: str) -> tuple[bool, dict]:
        now = time.time()
        window_start = now - self._window
        pipe_key = f"ratelimit:{key}"
        
        async with self._redis.pipeline() as pipe:
            pipe.zremrangebyscore(pipe_key, 0, window_start)
            pipe.zcard(pipe_key)
            pipe.zadd(pipe_key, {str(now): now})
            pipe.expire(pipe_key, self._window)
            _, count, _, _ = await pipe.execute()
        
        allowed = count < self._limit
        headers = {
            "X-RateLimit-Limit": str(self._limit),
            "X-RateLimit-Remaining": str(max(0, self._limit - count - 1)),
            "X-RateLimit-Reset": str(int(now + self._window)),
        }
        return allowed, headers

# FastAPI middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Key by API key or IP
    api_key = request.headers.get("x-api-key")
    rate_key = api_key or request.client.host
    
    limiter = RateLimiter(redis_client, limit=100, window_seconds=60)
    allowed, headers = await limiter.check(rate_key)
    
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded"},
            headers={**headers, "Retry-After": headers["X-RateLimit-Reset"]},
        )
    
    response = await call_next(request)
    response.headers.update(headers)
    return response
```

## Security Headers

```python
# FastAPI security headers middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Remove fingerprinting headers
    response.headers.pop("X-Powered-By", None)
    response.headers.pop("Server", None)
    return response
```

## Audit Logging

```python
import structlog

audit_log = structlog.get_logger("audit")

async def audit(
    action: str,
    resource_type: str,
    resource_id: str,
    actor_id: str,
    ip_address: str,
    result: str,
    metadata: dict = None
):
    audit_log.info(
        "api_action",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        actor_id=actor_id,
        ip_address=ip_address,
        result=result,  # "success" | "denied" | "error"
        metadata=metadata or {},
        timestamp=datetime.utcnow().isoformat(),
    )
    # Also persist to immutable audit store (CloudTrail, append-only DB table)

# Usage in endpoint
@router.delete("/users/{user_id}")
async def delete_user(user_id: str, claims=Depends(require_auth), request: Request = None):
    await audit("delete", "user", user_id, claims["sub"], request.client.host, "attempt")
    # ... do delete ...
    await audit("delete", "user", user_id, claims["sub"], request.client.host, "success")
```

## Security Controls Checklist

```
Authentication
  [ ] All endpoints require auth (explicit allowlist for public)
  [ ] JWT audience and issuer validated
  [ ] Token expiry enforced (≤15min access, ≤24h refresh)
  [ ] API keys hashed (SHA-256) in storage
  [ ] mTLS for service-to-service in sensitive flows

Authorisation
  [ ] RBAC or ABAC implemented
  [ ] IDOR checks on every resource endpoint
  [ ] Principle of least privilege applied to all roles
  [ ] Admin endpoints separated and extra-protected

Input Validation
  [ ] Schema validation on all request bodies
  [ ] Parameterised queries everywhere (no string interpolation)
  [ ] max_length on all string fields
  [ ] extra = "forbid" to block mass assignment
  [ ] File uploads: type check, size limit, virus scan

Transport
  [ ] TLS 1.2+ enforced, 1.0/1.1 disabled
  [ ] HSTS header set
  [ ] Certificate pinning for mobile clients

Rate Limiting
  [ ] Per-IP rate limit on public endpoints
  [ ] Per-API-key limits for authenticated clients
  [ ] Burst and sustained limits defined
  [ ] 429 response with Retry-After header

Audit
  [ ] All auth events logged (success + failure)
  [ ] All write operations logged
  [ ] All sensitive reads logged
  [ ] Logs shipped to immutable store
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Security by obscurity** | Hidden endpoints aren't protected | All endpoints need auth, even undocumented ones |
| **JWT without audience check** | Token for service A accepted by service B | Always validate `aud` claim |
| **Storing API keys plaintext** | DB breach exposes all keys | Hash with SHA-256; show once at creation |
| **404 for unauthorised resources** | Reveals existence to unauthorised callers | 403 for auth failure; 404 only when confirmed owner |
| **No rate limiting** | Brute force, credential stuffing, scraping | Rate limit every public endpoint |
| **Verbose error messages** | Stack traces expose internals | Generic error for clients, full detail in server logs |
| **Trust user-supplied IDs without auth check** | IDOR — any user can access any resource | Always verify ownership in addition to authentication |

## 10 Rules

1. Authenticate every request — build an explicit allowlist for public endpoints, not a blocklist.
2. Validate audience, issuer, expiry, and signature on every JWT.
3. Authorise at the resource level — auth token proves identity, not access rights to this specific record.
4. Never trust client-supplied data — validate type, length, format, and range server-side.
5. Use parameterised queries everywhere. No exceptions. Ever.
6. Hash API keys before storing — treat them like passwords.
7. Rate limit every public endpoint — unauthenticated endpoints especially.
8. Log every auth decision — success and failure — with actor, resource, and IP.
9. Return 403 (not 404) when a user can't access a resource they know exists. Return 404 only when they shouldn't even know it exists.
10. Automate security testing in CI — SAST, dependency scanning, and DAST on every deploy.
