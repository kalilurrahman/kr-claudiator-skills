---
name: progressive-delivery
description: Implement progressive delivery strategies including canary releases, feature flags, and traffic splitting. Outputs deployment pipeline, rollout configuration, automated rollback triggers, and observability requirements.
argument-hint: [deployment platform, traffic volume, rollback SLA, feature flag tooling]
allowed-tools: Read, Write
---

# Progressive Delivery

Progressive delivery releases changes to a subset of users first, measures impact, and expands or rolls back based on data. It separates deployment (code goes to production) from release (users get the feature). This reduces risk, enables data-driven decisions, and eliminates the big-bang release.

## Delivery Techniques

```
DARK LAUNCH
  Deploy code but route 0% traffic to new path
  Validate infrastructure and dependencies
  No user impact

CANARY RELEASE
  Route 1-5% traffic to new version
  Compare error rates, latency, business metrics
  Expand gradually if healthy; rollback if not

FEATURE FLAGS
  Decouple code deployment from feature exposure
  Target specific users, accounts, or % of population
  Instant rollback without redeployment

A/B TESTING
  Split traffic between control and variant
  Measure business impact (conversion, engagement)
  Statistical significance before deciding
```

## Argo Rollouts — Canary

```yaml
# argo-rollouts canary deployment
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-service
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5    # 5% to canary
        - pause: {}       # Manual gate (or automated with analysis)
        - setWeight: 20
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100  # Full rollout

      # Automated analysis before each step
      analysis:
        templates:
          - templateName: error-rate-check
        startingStep: 1

---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
spec:
  metrics:
    - name: error-rate
      interval: 1m
      successCondition: result[0] < 0.01  # <1% error rate
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{status=~"5.*",version="{{args.version}}"}[5m]))
            /
            sum(rate(http_requests_total{version="{{args.version}}"}[5m]))
    
    - name: p99-latency
      interval: 1m
      successCondition: result[0] < 0.5  # <500ms p99
      failureLimit: 3
      provider:
        prometheus:
          query: |
            histogram_quantile(0.99,
              rate(http_request_duration_seconds_bucket{version="{{args.version}}"}[5m])
            )
```

## Feature Flag Progressive Rollout

```python
from launchdarkly import LDClient

ld = LDClient(sdk_key=os.environ["LD_SDK_KEY"])

# Progressive rollout rule in LaunchDarkly:
# Stage 1: Internal users only (0% of customers)
# Stage 2: Beta users (opted-in customers)
# Stage 3: 1% of all users
# Stage 4: 10% → 25% → 50% → 100%

def new_checkout_enabled(user_id: str, account_id: str) -> bool:
    return ld.variation("checkout-v2", {
        "key": user_id,
        "custom": {
            "account_id": account_id,
            "is_beta": is_beta_user(user_id),
            "is_internal": is_internal_user(user_id),
        }
    }, default=False)

# Automated rollout with metrics check
async def advance_rollout_if_healthy(flag_key: str, current_pct: int) -> int:
    """Advance rollout only if metrics are healthy."""
    metrics = await get_rollout_metrics(flag_key)
    
    if metrics["error_rate"] > 0.01:
        await alert(f"Rollout {flag_key} paused: error rate {metrics['error_rate']:.1%}")
        return current_pct  # Don't advance
    
    if metrics["p99_latency_ms"] > 500:
        await alert(f"Rollout {flag_key} paused: p99 latency {metrics['p99_latency_ms']}ms")
        return current_pct
    
    # Advance to next tier
    next_pct = {1: 5, 5: 10, 10: 25, 25: 50, 50: 100}.get(current_pct, 100)
    await ld.update_rollout_percentage(flag_key, next_pct)
    return next_pct
```

## Rollback Triggers

```markdown
## Automatic Rollback Conditions

Trigger immediate rollback if ANY of:
- Error rate > 1% (sustained 5 minutes)
- p99 latency > 2× baseline (sustained 5 minutes)  
- Any critical business metric anomaly (payment failure rate, checkout completion)
- Any P1 incident attributed to this release

## Rollback SLA
- Detection: < 2 minutes (automated metric check)
- Decision: < 5 minutes (automated or on-call engineer)
- Rollback execution: < 5 minutes (automated revert)
- Total: < 12 minutes from incident to rollback complete
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No automated analysis** | Manual review misses subtle regressions | Automated metric checks before each canary step |
| **Big jump percentages** | 0% → 50% → 100% skips early signals | Small increments: 1% → 5% → 20% → 50% → 100% |
| **Only technical metrics** | Low error rate but conversion drops | Include business metrics in analysis |
| **Feature flags never cleaned up** | Flag proliferation; dead code | Every flag has a target full-rollout date when created |
| **Canary without baseline** | Nothing to compare against | Always compare canary vs stable version in same window |

## 10 Rules

1. Deploy to production at 0% traffic before any customer sees it — dark launch validates infrastructure.
2. Small canary increments: 1% → 5% → 20% → 50% → 100% with analysis at each step.
3. Automated analysis gates every canary step — no manual approval required for healthy releases.
4. Rollback is automatic when error rate or latency thresholds are breached.
5. Business metrics are in the analysis — not just infrastructure metrics.
6. Feature flags are the rollback for feature releases — no redeployment needed.
7. Every feature flag has a removal date — flag debt accumulates like technical debt.
8. Canary and stable versions are compared in the same time window — not historically.
9. Document rollback runbooks before launch — not during incidents.
10. Progressive delivery requires good observability — without metrics, it's just slow deployment.
