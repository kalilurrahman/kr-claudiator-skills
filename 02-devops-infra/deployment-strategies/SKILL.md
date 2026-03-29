---
name: deployment-strategies
description: Select and implement the right deployment strategy for your release. Covers rolling, blue-green, canary, feature flags, and shadow deployments with rollback procedures.
argument-hint: [service type, risk tolerance, traffic volume, rollback requirements, team size]
allowed-tools: Read, Write
---

# Deployment Strategies

The right deployment strategy balances risk (something goes wrong) with speed (getting changes to users). Higher risk requires more sophisticated strategies. All strategies need a rollback plan.

## Strategy Comparison

| Strategy | Risk | Speed | Rollback | Use When |
|----------|------|-------|----------|---------|
| **Big bang** | High | Fast | Hard | Very small apps, dev only |
| **Rolling** | Medium | Medium | Medium | Stateless services, K8s default |
| **Blue-green** | Low | Fast | Instant | APIs, zero-downtime required |
| **Canary** | Very low | Slow | Instant | High-traffic, data changes |
| **Feature flags** | Very low | Varies | Instant | Any size; gradual rollout |
| **Shadow** | None | N/A | N/A | Testing new service without user impact |

## Rolling Deployment (Kubernetes)

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2        # Allow 2 extra pods during rollout
      maxUnavailable: 0  # Never reduce below 10 healthy pods
  template:
    spec:
      containers:
        - name: api
          image: api:v2.1.0
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3
          # Readiness probe must pass before traffic routes to new pod
```

```bash
# Monitor rolling deployment
kubectl rollout status deployment/api -n production
kubectl get pods -n production -w

# Rollback if something's wrong
kubectl rollout undo deployment/api -n production
kubectl rollout undo deployment/api --to-revision=3 -n production
```

## Blue-Green Deployment

```yaml
# Two identical environments; switch traffic at load balancer

# blue-deployment.yaml (current production)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
  labels:
    slot: blue
spec:
  replicas: 5
  selector:
    matchLabels: { slot: blue }
  template:
    metadata:
      labels: { app: api, slot: blue, version: v2.0.0 }
    spec:
      containers:
        - name: api
          image: api:v2.0.0

---
# green-deployment.yaml (new version — staged)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
spec:
  replicas: 5
  selector:
    matchLabels: { slot: green }
  template:
    metadata:
      labels: { app: api, slot: green, version: v2.1.0 }

---
# service.yaml — switch by changing selector
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
    slot: blue  # ← change to 'green' to switch traffic
  ports:
    - port: 80
      targetPort: 8080
```

```bash
# Blue-green switch
kubectl patch service api -p '{"spec":{"selector":{"slot":"green"}}}'

# Instant rollback
kubectl patch service api -p '{"spec":{"selector":{"slot":"blue"}}}'
```

## Canary with Argo Rollouts

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api
spec:
  replicas: 20
  strategy:
    canary:
      steps:
        - setWeight: 5      # 5% of traffic to canary
        - pause: {duration: 10m}
        - analysis:
            templates:
              - templateName: error-rate-check
        - setWeight: 20     # 20% after passing analysis
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 5m}
        - setWeight: 100    # Full rollout if no issues

      canaryService: api-canary
      stableService: api-stable
      trafficRouting:
        nginx:
          stableIngress: api-stable-ingress

---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
spec:
  metrics:
    - name: error-rate
      successCondition: result < 0.01   # <1% error rate
      failureCondition: result > 0.05
      provider:
        prometheus:
          query: |
            sum(rate(http_requests_total{status=~"5..",version="canary"}[5m]))
            / sum(rate(http_requests_total{version="canary"}[5m]))
```

## Feature Flags

```python
# LaunchDarkly / Unleash / homegrown
from launchdarkly_client import Context

def get_price(product_id: str, user_id: str) -> dict:
    context = Context.builder(user_id).kind("user").build()
    
    # Gradually roll out new pricing algorithm
    use_new_pricing = ld_client.variation(
        "new-pricing-algorithm", context, default=False
    )
    
    if use_new_pricing:
        return new_pricing_engine.calculate(product_id)
    else:
        return legacy_pricing_engine.calculate(product_id)

# Percentage rollout: 0% → 5% → 25% → 50% → 100%
# Kill switch: set to 0% immediately if issues found
# No deployment needed to rollback — toggle the flag
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No readiness probe** | Traffic routes to pod before it's ready | Always define readiness probe |
| **No rollback plan** | Deploy then panic | Define rollback before every deploy |
| **Big bang in production** | All-or-nothing; hard to recover | Rolling or canary minimum for production |
| **Feature flags never cleaned up** | Flag debt accumulates; code complexity | Set cleanup date when creating every flag |
| **Blue-green with shared DB** | Both environments share state; schema migrations break | DB migration before/after deploy separately |

## 10 Rules

1. Every deployment strategy needs a defined rollback procedure — written before deploying.
2. Readiness probes gate traffic — pods receive requests only when truly ready.
3. Rolling is the default for stateless services; canary for high-risk or data-touching changes.
4. Blue-green gives instant rollback — essential for services with strict downtime SLAs.
5. Feature flags decouple deploy from release — ship code dark, enable gradually.
6. Canary analysis is automated — human monitors don't scale at 3am.
7. Database schema changes are separate from application deploys.
8. Monitor error rate and latency for 15 minutes after every deploy before declaring success.
9. Feature flags must have expiry dates — they're technical debt if left indefinitely.
10. Shadow deployments are risk-free validation for new services — run both old and new silently.
