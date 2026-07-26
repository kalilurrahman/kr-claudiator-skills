---
name: load-balancing
description: Design load balancing architecture — algorithms, health checking, session affinity, layer 4 vs layer 7, geographic distribution, and failover strategies for high-availability services.
argument-hint: [traffic volume, session requirements, geographic distribution, cloud provider]
allowed-tools: Read, Write, Bash
---

# Load Balancing

Load balancing distributes incoming traffic across multiple servers to ensure no single instance becomes a bottleneck, provides fault tolerance when instances fail, and enables horizontal scaling. The right load balancing strategy depends on traffic patterns, session requirements, and failure modes.

## Algorithm Selection

| Algorithm | Best For | Drawback |
|-----------|----------|----------|
| Round Robin | Stateless, homogenous instances | Ignores server load |
| Least Connections | Long-lived connections, heterogeneous load | Requires connection tracking |
| Weighted Round Robin | Mixed instance sizes | Static weights don't adapt |
| IP Hash | Session affinity (sticky sessions) | Poor distribution on NAT |
| Random with 2 Choices | High throughput, simple implementation | Slightly suboptimal |
| Least Response Time | Latency-sensitive services | Requires active health probing |

## Layer 4 vs Layer 7

| Feature | Layer 4 (TCP/UDP) | Layer 7 (HTTP) |
|---------|-------------------|----------------|
| Routing basis | IP + Port | URL, Headers, Cookies |
| TLS termination | Pass-through or terminate | Always terminates |
| Content-based routing | No | Yes |
| Performance | Higher | Lower (protocol parsing) |
| Use case | TCP services, gaming, streaming | Web APIs, microservices |

## Process

1. **Define traffic profile** — requests/sec, connection duration, payload size.
2. **Choose layer** — L4 for raw TCP performance; L7 for HTTP-aware routing.
3. **Select algorithm** — based on session requirements and instance homogeneity.
4. **Configure health checks** — active probing with appropriate thresholds.
5. **Set connection limits** — prevent any upstream from being overwhelmed.
6. **Configure timeouts** — connect, idle, and request timeouts at each tier.
7. **Plan failover** — warm standbys, DNS failover, or active-active.
8. **Test failure scenarios** — kill backends and verify traffic redistributes.

## Output Format

### HAProxy Configuration

```haproxy
# haproxy.cfg
global
    maxconn 50000
    log stdout format raw local0
    stats timeout 30s

defaults
    mode http
    log global
    option httplog
    option dontlognull
    option forwardfor
    option http-server-close
    timeout connect 5s
    timeout client 30s
    timeout server 30s
    timeout tunnel 1h       # For WebSocket connections
    retries 3

frontend api_frontend
    bind *:443 ssl crt /etc/ssl/certs/api.pem
    default_backend api_backend
    
    # Route based on path prefix
    acl is_admin path_beg /api/v1/admin
    use_backend admin_backend if is_admin
    
    # Rate limiting per IP
    stick-table type ip size 100k expire 60s store conn_cur,conn_rate(10s)
    tcp-request connection track-sc0 src
    tcp-request connection reject if { sc_conn_rate(0) gt 100 }

backend api_backend
    balance leastconn
    option httpchk GET /health
    http-check expect status 200
    default-server inter 5s fall 3 rise 2 weight 1
    
    server api-1 10.0.1.10:8080 check maxconn 500
    server api-2 10.0.1.11:8080 check maxconn 500
    server api-3 10.0.1.12:8080 check maxconn 500
    
    # Circuit breaker: remove server after 3 consecutive failures
    # Re-add after 2 consecutive successes

backend admin_backend
    balance roundrobin
    option httpchk GET /health
    
    server admin-1 10.0.2.10:8080 check
    server admin-2 10.0.2.11:8080 check backup  # Only used if admin-1 fails

listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 10s
    stats auth admin:${HAPROXY_STATS_PASS}
```

### AWS ALB (Terraform)

```hcl
# alb.tf
resource "aws_lb" "api" {
  name               = "api-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "api-alb"
    enabled = true
  }

  idle_timeout               = 60
  enable_deletion_protection = true
  enable_http2               = true
}

resource "aws_lb_target_group" "api" {
  name        = "api-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"  # ECS Fargate / pods

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
    path                = "/health"
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = false  # Stateless API — no sticky sessions
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_listener_rule" "admin_routing" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }

  condition {
    path_pattern {
      values = ["/api/*/admin/*"]
    }
  }
}
```

### Health Check Endpoint

```python
# health/check.py
from fastapi import FastAPI, Response
import asyncpg, redis.asyncio as redis, psutil, time

app = FastAPI()

@app.get("/health")
async def health(response: Response):
    """Health check for load balancer. Returns 200 if ready to receive traffic."""
    checks = {}
    healthy = True
    
    # Database connectivity
    try:
        async with asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=1) as pool:
            async with pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
        healthy = False
    
    # Cache connectivity
    try:
        r = redis.from_url(REDIS_URL)
        await r.ping()
        checks["cache"] = "ok"
    except Exception as e:
        checks["cache"] = f"error: {e}"
        # Don't mark unhealthy for cache — degraded but functional
    
    # Resource checks
    mem = psutil.virtual_memory()
    if mem.percent > 95:
        checks["memory"] = f"critical: {mem.percent}%"
        healthy = False
    else:
        checks["memory"] = f"ok: {mem.percent}%"
    
    response.status_code = 200 if healthy else 503
    return {"status": "healthy" if healthy else "unhealthy", "checks": checks}

@app.get("/health/live")
async def liveness():
    """Kubernetes liveness probe — is the process running?"""
    return {"status": "alive"}

@app.get("/health/ready")
async def readiness():
    """Kubernetes readiness probe — ready to receive traffic?"""
    # More thorough check — same as /health
    return await health(Response())
```

### Load Testing Verification

```python
# tests/load_balance_test.py
import asyncio
import httpx
from collections import Counter

async def verify_load_distribution(lb_url: str, n_requests: int = 1000):
    """Verify traffic is actually distributed across backends."""
    server_hits = Counter()
    
    async with httpx.AsyncClient() as client:
        tasks = [
            client.get(f"{lb_url}/api/v1/ping")
            for _ in range(n_requests)
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
    
    for resp in responses:
        if isinstance(resp, Exception):
            server_hits["error"] += 1
        else:
            # Backend should include its hostname in a header
            server = resp.headers.get("X-Server-ID", "unknown")
            server_hits[server] += 1
    
    total = sum(v for k, v in server_hits.items() if k != "error")
    print("Load distribution:")
    for server, hits in server_hits.most_common():
        pct = hits / total * 100
        print(f"  {server}: {hits} ({pct:.1f}%)")
    
    # Check rough evenness (no server should get > 2x average)
    n_servers = len([k for k in server_hits if k != "error"])
    avg = total / n_servers
    for server, hits in server_hits.items():
        if server != "error" and hits > avg * 2:
            print(f"WARNING: {server} getting {hits/avg:.1f}x average traffic!")
```

## Rules

- **Health checks must test actual readiness** — checking if the port is open is not sufficient; check DB connectivity.
- **Separate liveness from readiness** — liveness (is the process alive?) and readiness (can it serve traffic?) are different questions.
- **Drain connections before removing a backend** — abrupt removal drops in-flight requests; use connection draining.
- **Set aggressive connection timeouts** — zombie connections waste capacity; idle connections should time out in 60-120s.
- **Never route directly to instances in production** — all traffic must go through the load balancer for health checking to work.
- **Session affinity hides availability problems** — a sticky session to a failing backend silently fails users; prefer stateless design.
- **L7 load balancers add ~1ms latency** — for ultra-low-latency services (<10ms target), consider L4 or direct service routing.
- **ALB/ELB scale is not instant** — AWS ALBs need 5-10 minutes to scale; pre-warm before known traffic spikes.
- **Monitor both backend error rates and LB error rates separately** — a 502 from the LB means the backend is unreachable; a 500 from the backend means it's reachable but failing.
- **Test failover quarterly** — kill a backend and verify traffic redistributes without user impact.

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

