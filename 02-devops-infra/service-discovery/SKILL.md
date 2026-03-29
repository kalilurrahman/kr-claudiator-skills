---
name: service-discovery
description: Implement service discovery for dynamic microservice environments. Outputs discovery patterns, DNS vs registry approaches, health check design, and client-side load balancing.
argument-hint: [orchestration platform, service count, dynamic scaling needs, client language]
allowed-tools: Read, Write
---

# Service Discovery

Service discovery solves the problem of services finding each other in dynamic environments where IP addresses change on every deployment. Services register themselves; clients discover them by name. The platform handles the mapping.

## Discovery Patterns

```
CLIENT-SIDE DISCOVERY
  Client queries registry → gets instance list → client load-balances
  Examples: Netflix Eureka + Ribbon, Consul + client SDK
  Pros: Client controls load balancing strategy
  Cons: Client complexity; registry per language

SERVER-SIDE DISCOVERY (recommended for Kubernetes)
  Client requests service name → platform routes → instance
  Examples: Kubernetes DNS + kube-proxy, AWS ALB
  Pros: Simple clients; platform handles routing
  Cons: Extra network hop; less control

SERVICE MESH (advanced)
  Sidecar proxy handles discovery + routing + mTLS
  Examples: Istio, Linkerd, Cilium
  Pros: Transparent; rich traffic management
  Cons: Operational complexity
```

## Kubernetes DNS (Server-Side)

```yaml
# Service definition — creates stable DNS name
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: production
spec:
  selector:
    app: order-service
  ports:
    - port: 8080
      targetPort: 8080
  type: ClusterIP  # Internal only

# DNS patterns:
# Within namespace:    order-service:8080
# Cross-namespace:     order-service.production:8080
# Full FQDN:           order-service.production.svc.cluster.local:8080
```

```python
# Client — just use the service name
import httpx

ORDER_SERVICE_URL = os.environ.get(
    "ORDER_SERVICE_URL",
    "http://order-service.production:8080"  # Kubernetes DNS
)

async def get_order(order_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{ORDER_SERVICE_URL}/api/v1/orders/{order_id}",
            timeout=5.0,
        )
        resp.raise_for_status()
        return resp.json()
```

## Consul Service Registry

```python
# Register service with Consul
import consul

c = consul.Consul(host="consul", port=8500)

def register_service():
    c.agent.service.register(
        name="order-service",
        service_id=f"order-service-{os.environ['POD_NAME']}",
        address=os.environ["POD_IP"],
        port=8080,
        tags=["api", "v2"],
        check=consul.Check.http(
            url=f"http://{os.environ['POD_IP']}:8080/health",
            interval="10s",
            timeout="5s",
            deregister="30s",
        ),
    )

def discover_service(name: str) -> list[dict]:
    """Get healthy instances of a service."""
    _, services = c.health.service(name, passing=True)
    return [
        {"address": s["Service"]["Address"], "port": s["Service"]["Port"]}
        for s in services
    ]

# Client-side load balancing
import random
def get_endpoint(name: str) -> str:
    instances = discover_service(name)
    if not instances:
        raise Exception(f"No healthy instances of {name}")
    instance = random.choice(instances)  # Simple random LB
    return f"http://{instance['address']}:{instance['port']}"
```

## Health Check Design

```python
from fastapi import FastAPI
from datetime import datetime

app = FastAPI()

@app.get("/health/live")   # Liveness: is the process running?
async def liveness():
    return {"status": "ok"}

@app.get("/health/ready")  # Readiness: can it handle traffic?
async def readiness():
    checks = {}
    
    try:
        await db.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
    
    try:
        await redis.ping()
        checks["cache"] = "ok"
    except Exception as e:
        checks["cache"] = f"error: {e}"
    
    is_ready = all(v == "ok" for v in checks.values())
    status_code = 200 if is_ready else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ready" if is_ready else "not_ready", "checks": checks}
    )
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Hardcoded IP addresses** | Services break on redeployment | Always use service names / DNS |
| **No health checks** | Traffic routed to unhealthy instances | Liveness + readiness probes on every service |
| **Liveness == readiness** | Restarting healthy pods on DB outage | Liveness checks process health; readiness checks dependencies |
| **No circuit breaker** | Discovery returns instances that are returning errors | Circuit breaker wraps service calls |
| **Slow health check** | Readiness probe timeout causes unnecessary pod restarts | Health check completes in <1 second |

## 10 Rules

1. Services always addressed by name — never by IP address.
2. Every service has both liveness and readiness probes.
3. Liveness checks the process only — never external dependencies.
4. Readiness checks critical dependencies — fail readiness when DB is unavailable, not liveness.
5. Health check endpoint responds in <1 second — slow checks cause false failures.
6. Service mesh for advanced routing — retries, circuit breaking, mTLS — without changing application code.
7. Grace period on shutdown — allow in-flight requests to complete before deregistering.
8. DNS TTL matters — respect TTL to avoid caching stale addresses.
9. Discovery is not the same as load balancing — discovery finds instances; load balancing picks one.
10. Test discovery in failure scenarios — what happens when a service has zero healthy instances?
