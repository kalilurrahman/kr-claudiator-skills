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

The canonical workflow for **Service Discovery** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement service discovery for dynamic microservice environments. Outputs discovery patterns, DNS vs registry approaches, health check design, and client-side 
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
