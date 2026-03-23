---
name: multi-tenancy
description: Design multi-tenant SaaS architecture with tenant isolation, data partitioning, resource quotas, and tenant-aware observability. Outputs isolation patterns, row-level security, schema provisioning, and quota enforcement.
argument-hint: [isolation requirements, tenant count, compliance, pricing tiers]
allowed-tools: Read, Write, Bash
---

# Multi-Tenancy Architecture

Multi-tenancy allows a single application to serve multiple customers with appropriate isolation. The architecture choice — shared schema, schema-per-tenant, or database-per-tenant — drives cost, isolation strength, compliance posture, and operational complexity.

## Isolation Model Decision

| Model | Isolation | Cost | Compliance | Use When |
|-------|-----------|------|------------|----------|
| Shared schema + RLS | Low | Lowest | Harder | <1000 tenants, homogenous needs |
| Schema-per-tenant | Medium | Low | Easier | Hundreds of tenants, some isolation needed |
| Database-per-tenant | Highest | High | Easiest | Enterprise, regulated, <100 tenants |
| Hybrid (tiered) | Variable | Variable | Configurable | Mixed requirements |

## Process

1. **Define isolation requirements** — regulatory, contractual, and technical per tier.
2. **Choose partitioning strategy** — based on table above.
3. **Implement tenant context propagation** — every request carries tenant ID via middleware.
4. **Add Row-Level Security** — database-enforced isolation as defense-in-depth.
5. **Enforce resource quotas** — API rate limits, storage, user counts per plan.
6. **Build tenant-aware observability** — all metrics and logs labeled by tenant_id.
7. **Automate tenant provisioning** — schema creation, migrations, defaults on signup.
8. **Plan offboarding** — data export and deletion for GDPR/CCPA compliance.

## Output Format

### Tenant Context Middleware

```python
# middleware/tenant.py
from contextvars import ContextVar
from fastapi import Request, HTTPException
from dataclasses import dataclass
import jwt

tenant_ctx: ContextVar["TenantContext | None"] = ContextVar("tenant_ctx", default=None)

@dataclass
class TenantContext:
    tenant_id: str
    plan: str              # "starter" | "growth" | "enterprise"
    region: str            # "us-east-1" | "eu-west-1" (data residency)
    schema: str            # "tenant_abc123" or "public"
    rate_limit_rpm: int
    storage_gb: int
    max_seats: int

PLAN_LIMITS = {
    "starter":    {"rate_limit_rpm": 60,   "storage_gb": 5,   "max_seats": 5},
    "growth":     {"rate_limit_rpm": 600,  "storage_gb": 50,  "max_seats": 50},
    "enterprise": {"rate_limit_rpm": 6000, "storage_gb": 500, "max_seats": -1},
}

async def tenant_middleware(request: Request, call_next):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    if not token:
        return await call_next(request)
    
    try:
        payload = jwt.decode(token, key=get_public_key(), algorithms=["RS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(401, "No tenant_id in token")
    
    # Load from cache (Redis → DB fallback)
    tenant = await load_tenant(tenant_id)
    tenant_ctx.set(tenant)
    
    response = await call_next(request)
    response.headers["X-Tenant-ID"] = tenant_id  # For debugging
    return response

def current_tenant() -> TenantContext:
    ctx = tenant_ctx.get()
    if not ctx:
        raise RuntimeError("No tenant context set — missing middleware?")
    return ctx
```

### Row-Level Security (PostgreSQL)

```sql
-- Enable RLS on all tenant data tables
ALTER TABLE orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create isolation policies
CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON invoices
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- FORCE RLS even for table owners (prevents accidental bypass)
ALTER TABLE orders   FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

-- Function to set tenant context for a session
CREATE OR REPLACE FUNCTION set_tenant(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, true); -- true = LOCAL (transaction-scoped)
END;
$$;
```

```python
# database/session.py
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

@asynccontextmanager
async def tenant_db_session(session: AsyncSession, tenant_id: str):
    """Set tenant context before queries — RLS uses this."""
    await session.execute(text(f"SELECT set_tenant('{tenant_id}')"))
    yield session
    # Context auto-resets at transaction end (LOCAL setting)

# Usage in service layer
async def list_orders(db: AsyncSession) -> list[Order]:
    tenant = current_tenant()
    async with tenant_db_session(db, tenant.tenant_id):
        result = await db.execute(select(Order))  # RLS filters automatically
        return result.scalars().all()
```

### Schema-per-Tenant Provisioning

```python
# provisioning/tenant_provisioner.py
import asyncpg
from alembic.config import Config
from alembic import command
import os

class TenantProvisioner:
    def __init__(self, admin_dsn: str):
        self.admin_dsn = admin_dsn
    
    async def provision(self, tenant_id: str, plan: str) -> dict:
        """Idempotent tenant schema setup."""
        schema = f"t_{tenant_id.replace('-', '_')}"
        
        conn = await asyncpg.connect(self.admin_dsn)
        try:
            await conn.execute(f"""
                CREATE SCHEMA IF NOT EXISTS {schema};
                GRANT USAGE ON SCHEMA {schema} TO app_user;
                GRANT ALL ON ALL TABLES IN SCHEMA {schema} TO app_user;
                ALTER DEFAULT PRIVILEGES IN SCHEMA {schema}
                    GRANT ALL ON TABLES TO app_user;
            """)
        finally:
            await conn.close()
        
        # Run Alembic in this schema
        cfg = Config("alembic.ini")
        os.environ["TENANT_SCHEMA"] = schema
        command.upgrade(cfg, "head")
        
        # Write tenant record to control plane DB
        await self._register_tenant(tenant_id, schema, plan)
        
        return {"tenant_id": tenant_id, "schema": schema, "status": "active"}
    
    async def deprovision(self, tenant_id: str, export_data: bool = True) -> None:
        """Full tenant offboarding — GDPR/CCPA right to erasure."""
        tenant = await load_tenant(tenant_id)
        
        if export_data:
            await self._export_tenant_data(tenant)
        
        conn = await asyncpg.connect(self.admin_dsn)
        await conn.execute(f"DROP SCHEMA IF EXISTS {tenant.schema} CASCADE")
        await conn.execute("DELETE FROM tenants WHERE tenant_id = $1", tenant_id)
        await conn.close()
```

### Quota Enforcement

```python
# quotas/enforcer.py
import redis.asyncio as redis
import time
from fastapi import HTTPException

class QuotaEnforcer:
    def __init__(self, redis_url: str):
        self.r = redis.from_url(redis_url)
    
    async def check_rate_limit(self, tenant: TenantContext):
        """Sliding window rate limit — O(1) with Redis."""
        key = f"rl:{tenant.tenant_id}:{int(time.time() // 60)}"
        current = await self.r.incr(key)
        await self.r.expire(key, 120)
        
        if current > tenant.rate_limit_rpm:
            raise HTTPException(
                429,
                detail=f"Rate limit: {tenant.rate_limit_rpm} req/min ({tenant.plan} plan)",
                headers={"Retry-After": "60", "X-Plan-Limit": str(tenant.rate_limit_rpm)}
            )
    
    async def check_storage(self, tenant: TenantContext, bytes_needed: int):
        key = f"storage:{tenant.tenant_id}"
        current = int(await self.r.get(key) or 0)
        limit = tenant.storage_gb * 1024 ** 3
        
        if current + bytes_needed > limit:
            raise HTTPException(
                402,
                detail=f"Storage quota: {tenant.storage_gb}GB ({tenant.plan}). Upgrade to add more."
            )
    
    async def check_seat_count(self, tenant: TenantContext, current_count: int):
        if tenant.max_seats == -1:
            return  # Unlimited
        if current_count >= tenant.max_seats:
            raise HTTPException(
                402,
                detail=f"Seat limit: {tenant.max_seats} users ({tenant.plan}). Upgrade to add more."
            )
```

### Tenant-Aware Monitoring

```python
# monitoring/tenant_metrics.py
from prometheus_client import Counter, Histogram

requests = Counter("requests_total", "Requests by tenant", ["tenant_id", "plan", "endpoint", "status"])
latency  = Histogram("request_duration_seconds", "Latency by tenant", ["tenant_id", "plan"])
storage  = Counter("storage_bytes_written_total", "Storage writes", ["tenant_id", "plan"])

def record(tenant: TenantContext, endpoint: str, status: int, duration: float, bytes_written: int = 0):
    labels = {"tenant_id": tenant.tenant_id, "plan": tenant.plan}
    requests.labels(**labels, endpoint=endpoint, status=str(status)).inc()
    latency.labels(**labels).observe(duration)
    if bytes_written:
        storage.labels(**labels).inc(bytes_written)
```

### Cross-Tenant Leak Test

```python
# tests/test_tenant_isolation.py
import pytest
import httpx

@pytest.mark.asyncio
async def test_cannot_access_other_tenant_data(client_a, client_b):
    """Tenant A cannot read Tenant B's orders."""
    # Tenant B creates an order
    resp = await client_b.post("/orders", json={"item": "Widget", "qty": 1})
    order_id = resp.json()["id"]
    
    # Tenant A tries to read it — must get 404, not the order
    resp = await client_a.get(f"/orders/{order_id}")
    assert resp.status_code == 404, "Tenant isolation violated!"

@pytest.mark.asyncio
async def test_listing_returns_only_own_data(client_a, client_b):
    """Tenant A's order list contains no Tenant B rows."""
    await client_b.post("/orders", json={"item": "Secret", "qty": 10})
    
    resp = await client_a.get("/orders")
    orders = resp.json()["items"]
    
    for order in orders:
        assert order["tenant_id"] == client_a.tenant_id
```

## Rules

- **Never trust client-supplied tenant IDs** — derive from verified JWT or session; never from URL/body params.
- **Test cross-tenant isolation in CI** — automated leak tests must run on every PR; human review is not enough.
- **RLS is defense-in-depth, not the only layer** — filter in application code too; RLS catches bugs, not the first line.
- **Quota enforcement must be synchronous and fast** — Redis O(1) check, never a DB query per-request.
- **tenant_id appears on every log line** — without it, cross-tenant debugging is impossible.
- **Provisioning must be idempotent** — retrying a failed provisioning should not create duplicate schemas.
- **Schema migrations must handle all tenant schemas** — running `alembic upgrade head` must apply to every tenant's schema.
- **Noisy neighbor protection is non-negotiable** — one high-traffic tenant cannot degrade others; enforce quotas aggressively.
- **Right-to-erasure means full deletion** — "soft delete" does not satisfy GDPR; build hard-delete pipelines from day one.
- **Test plan downgrade paths** — users downgrading from enterprise to starter should have limits enforced immediately.


## Worked Example and Anti-Patterns

### Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No runbook | On-call engineer has no guidance during incident | Write runbook before going to production |
| Single point of failure | One component down takes everything with it | Design for redundancy at every layer |
| No monitoring | Problems discovered by users, not engineers | Instrument before launch |
| Manual toil | Repeated manual steps slow down and introduce errors | Automate anything done more than twice |
| Undocumented decisions | Next engineer repeats the same mistakes | Use Architecture Decision Records (ADRs) |

### Rules

- **Start with the simplest thing that works** -- complexity should be earned, not assumed.
- **Make it observable before making it complex** -- logs, metrics, and traces first.
- **Automate toil** -- anything done manually more than twice should be scripted.
- **Document decisions** -- use ADRs; future engineers will thank you.
- **Test failure modes** -- chaos engineering starts small; break one thing at a time.
- **Prefer reversible decisions** -- irreversible architecture decisions need the most careful thought.
- **Own your runbooks** -- every service needs a runbook before it goes to production.
- **Measure before optimizing** -- do not optimize what you have not profiled.
- **Design for the 99th percentile user** -- the average case is not the hard case.
- **Keep it boring** -- stable, predictable, well-understood technology over cutting-edge.

