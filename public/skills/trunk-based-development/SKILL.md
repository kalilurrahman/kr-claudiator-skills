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


## Deep dive: applying this in practice

The sections above describe *what* to produce. This section describes *how* practitioners actually run this in the field, including the conversations, artefacts, and review loops that turn a one-page recommendation into a sustained outcome.

### The 30/60/90 cadence

A recommendation that is never revisited is a recommendation that quietly fails. Bake review checkpoints in from day one:

- **Day 0 — Decision committed.** Owner, scope, success metrics, and the first-checkpoint date are recorded in the decision log. The artefact is linked from the team's working space so it is discoverable without asking.
- **Day 30 — Early-signal review.** Look at the leading indicators, not the lagging ones. Has the team actually started? Are the assumed dependencies real? Have any of the named risks materialised? Adjust scope, not the goal.
- **Day 60 — Course-correction window.** This is the last cheap moment to change direction. If the leading indicators are flat or negative, escalate. Silence at day 60 is the most expensive form of optimism.
- **Day 90 — Outcome review.** Measure against the success criteria captured on day 0, not against the story the team is telling now. Write the post-mortem (or pre-mortem-confirmed) in the same artefact so the rationale, the outcome, and the lessons live together.

### Stakeholder choreography

Decisions stall not because the analysis is wrong but because the choreography is wrong. Use a lightweight RACI on every recommendation:

| Role | Meaning | Anti-pattern |
|---|---|---|
| **Responsible** | Does the work | More than two people listed |
| **Accountable** | Owns the outcome, signs off | Shared accountability (always becomes no accountability) |
| **Consulted** | Two-way input before the decision | Consulted *after* the decision is made — purely performative |
| **Informed** | One-way notification after the decision | Informed people are asked to approve — wastes their time and yours |

If you cannot name a single Accountable person in one minute, the recommendation is not ready to ship.

### Writing for senior readers

Senior readers scan first, read second, and only re-read the parts they disagree with. Optimise for that pattern:

1. **Lead with the recommendation**, not the analysis. The reader should know what you want them to do before they finish the first paragraph.
2. **One screen, one page, one decision.** If the artefact needs scrolling on a laptop, it is too long for the audience it is written for.
3. **Tables beat paragraphs** for comparing options. Prose hides the trade-off; a table forces it into the open.
4. **Numbers beat adjectives.** Replace "significant" with the actual number. Replace "soon" with a date. Replace "improved" with a baseline and a target.
5. **Name the disconfirming evidence.** A recommendation that lists what would change the author's mind is read as honest; one that does not is read as advocacy.

### Common failure modes

| Failure mode | Symptom | Counter-move |
|---|---|---|
| **Analysis paralysis** | Weeks of investigation, no decision | Time-box the analysis. State the decision quality you can defend in the time available. |
| **HiPPO override** | Highest-paid person's opinion wins regardless of evidence | Force the trade-off table into the room before opinions are voiced |
| **Sunk-cost gravity** | Team defends the current path because of prior investment | Re-frame: what would we choose today with no prior investment? |
| **Scope creep at the checkpoint** | Review becomes a re-planning session | Separate "did this work?" from "what next?" Run them as two meetings. |
| **Stealth de-scoping** | Success metrics quietly soften between day 0 and day 90 | Lock the day-0 metrics into the artefact; require an explicit amendment to change them. |
| **Owner drift** | Accountable person leaves, no one re-assigns | Owner reassignment is a mandatory step in onboarding/offboarding the role |

### A worked example

> A product line is debating whether to invest in a major rewrite of a legacy service that has been failing under peak load.

A weak response: "We should rewrite it because the code is old."

A response that uses this skill:

> **Recommendation.** Do not rewrite. Invest one quarter in targeted performance work on the existing service and a parallel strangler-fig migration of the top two failing endpoints. Confidence: medium. Would change my mind if peak-load incidents continue at the current rate for two consecutive months after the performance work ships.
>
> **Options considered.** (1) Full rewrite — 9–12 months, ~$1.4M, high risk of partial delivery. (2) Performance fix in place — 6 weeks, ~$120K, addresses 80% of incident volume per last-quarter analysis. (3) Strangler-fig migration — 6 months for the two hottest endpoints, ~$400K, preserves optionality.
>
> **Plan.** Owner: Platform tech lead. Day 30: performance fix in staging with load test results. Day 60: production rollout and a 30-day incident-rate comparison. Day 90: decision on whether to expand the strangler-fig scope.
>
> **Risks.** (1) Performance fix masks a deeper architectural issue — mitigated by capturing flame graphs before and after. (2) Strangler-fig endpoints are not in fact the hottest ones — mitigated by re-running the traffic analysis at day 0. (3) Team capacity collides with a separate compliance deadline — escalated to the portfolio review on the next planning cycle.

That is the shape of output this skill should produce: a defensible, time-bound, owner-attached recommendation that respects the reader's time and survives turnover.

## Quick reference card

- One paragraph of context, three options with trade-offs, one recommendation with confidence, one plan with an owner and a date.
- If you cannot name the owner, the metric, and the checkpoint date in one breath, the artefact is not done.
- A decision without a written rationale is a rumour. A rationale without a checkpoint is a wish. A checkpoint without a metric is theatre.
- Reversibility matters more than people admit: one-way doors deserve the slow lane, two-way doors deserve the fast lane.
- The best artefacts in this category are short, dated, signed, and easy to find six months later.
