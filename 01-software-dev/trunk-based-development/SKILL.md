---
name: trunk-based-development
description: Implement trunk-based development for fast, safe integration. Outputs branching rules, feature flag strategy, CI requirements, and team workflow guidelines.
argument-hint: [team size, deployment frequency, current branching model, CI/CD maturity]
allowed-tools: Read, Write
---

# Trunk-Based Development (TBD)

Trunk-based development is a source control practice where developers integrate small, frequent changes into the main branch (trunk). Long-lived feature branches are eliminated. The result is faster integration, fewer merge conflicts, and earlier defect detection. It's a prerequisite for continuous deployment.

## Core Rules

```
1. One main branch (trunk) — no long-lived feature branches
2. Integrate at least daily — every developer pushes to trunk every day
3. Branches are short-lived — max 1-2 days; often hours
4. Trunk is always deployable — every commit must pass CI before merge
5. Feature flags gate incomplete features — code ships, features don't
6. Never break the build — fix-forward immediately or revert
```

## Branching Model

```
TRUNK-BASED (recommended):
  main ─────●─────●─────●─────●─────●──── (always deployable)
              │           │
              └─feat(1d)──┘   └─fix(2h)──┘
              Feature branches: max 1-2 days

GITHUB FLOW (acceptable):
  Same as TBD but PRs before merge to main
  Branches: short-lived feature branches + PRs

GITFLOW (avoid for continuous delivery):
  develop → feature → release → main
  Long-lived branches = integration pain
```

## Feature Flags for Incomplete Work

```python
# Use feature flags to merge incomplete code safely
# Code ships to production; feature is hidden until ready

from launchdarkly import LDClient

ld_client = LDClient(sdk_key=os.environ["LD_SDK_KEY"])

def is_feature_enabled(flag_key: str, user_id: str) -> bool:
    return ld_client.variation(flag_key, {"key": user_id}, default=False)

# In product code — incomplete feature is merged but hidden
@router.get("/api/v1/orders")
async def get_orders(claims: dict = Depends(require_auth)):
    orders = await order_service.get_orders(claims["sub"])
    
    # New grouping feature in progress — only enabled for beta users
    if is_feature_enabled("order-grouping-v2", claims["sub"]):
        return await order_service.get_grouped_orders(claims["sub"])
    
    return orders
```

## CI Requirements for TBD

```yaml
# Every commit to main must pass ALL of these before merge
# Target: < 10 minutes total

# .github/workflows/trunk-ci.yml
name: Trunk CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality-gate:
    name: Quality Gate (must pass to merge)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements-dev.txt
      
      - name: Lint + type check
        run: ruff check . && mypy src/
        timeout-minutes: 2
      
      - name: Unit tests
        run: pytest tests/unit/ -n auto --timeout=30
        timeout-minutes: 4
      
      - name: Integration tests (critical paths)
        run: pytest tests/integration/ -m "not slow" -n auto
        timeout-minutes: 4
      
      - name: Security scan
        run: bandit -r src/ -ll
        timeout-minutes: 1

  # Slower tests run async — don't block merge but alert on failure
  extended-tests:
    name: Extended Tests (async)
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - run: pytest tests/ --timeout=120
        timeout-minutes: 20
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Long-lived feature branches** | Diverge from trunk; massive merge conflicts | Max 2-day branches; feature flags for long work |
| **Breaking trunk** | All developers blocked | Revert immediately; fix-forward never takes precedence |
| **Skipping CI** | Defects reach trunk | CI gates are mandatory; no bypassing |
| **Feature flags forever** | Flag proliferation; dead code accumulates | Every flag has a removal date in the PR that adds it |
| **Large commits** | Hard to review; hard to revert | Commit small; integrate often |

## 10 Rules

1. Trunk is always in a deployable state — every commit passes CI.
2. Integrate at minimum daily — prefer multiple times per day.
3. Feature branches live for hours, not days — max 2 days before merge.
4. Feature flags gate incomplete work — merge code; hide features.
5. A broken build is the team's top priority — fix or revert within 10 minutes.
6. CI runs in under 10 minutes — beyond that, developers bypass it.
7. Code review is async and fast — PRs reviewed within 2 hours.
8. Every feature flag has a removal date when created — prevent flag debt.
9. Monitor flag coverage — features behind flags that are 100% on are candidates for removal.
10. TBD requires strong CI and feature flag infrastructure — invest in both before mandating the practice.
