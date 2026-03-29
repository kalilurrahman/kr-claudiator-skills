---
name: experiment-platform
description: Build an internal experimentation platform for running A/B tests at scale. Outputs experiment service architecture, assignment engine, metric pipeline, and statistical analysis framework.
argument-hint: [traffic volume, number of concurrent experiments, team size, existing analytics stack]
allowed-tools: Read, Write
---

# Experiment Platform

An experiment platform standardises how A/B tests are run across the organisation — experiment definition, user assignment, metric collection, and statistical analysis. Without a platform, every team implements its own experiment logic inconsistently. With one, experiments are faster, more reliable, and more trustworthy.

## Architecture

```
Experiment Service (define + assign)
  ├── Experiment Registry (what experiments exist, who is in them)
  ├── Assignment Engine (deterministic bucketing by user_id)
  └── Exposure Logging (record when user saw the experiment)

Metric Pipeline
  ├── Event collection (existing analytics pipeline)
  ├── Metric computation (joins exposure log with events)
  └── Results store (pre-computed stats per experiment)

Analysis Service
  ├── Statistical tests (t-test, z-test, sequential)
  ├── Segment breakdowns
  └── Results API (for dashboard)
```

## Assignment Engine

```python
import hashlib
from dataclasses import dataclass

@dataclass
class Experiment:
    id: str
    name: str
    variants: list[dict]  # [{"name": "control", "weight": 50}, {"name": "treatment", "weight": 50}]
    status: str           # "active" | "paused" | "concluded"
    targeting: dict       # Who qualifies: {"plans": ["pro", "enterprise"], "countries": ["US"]}

class AssignmentEngine:
    def assign(self, user_id: str, experiment: Experiment) -> str | None:
        """
        Deterministic, sticky assignment.
        Same user always gets same variant.
        Returns variant name or None if user not in experiment.
        """
        if experiment.status != "active":
            return None

        # Hash user_id + experiment_id for consistent bucketing
        hash_input = f"{user_id}:{experiment.id}"
        bucket = int(hashlib.md5(hash_input.encode()).hexdigest(), 16) % 100

        # Walk through variants by weight
        cumulative = 0
        for variant in experiment.variants:
            cumulative += variant["weight"]
            if bucket < cumulative:
                return variant["name"]

        return None  # User not bucketed (weights sum < 100)

    def is_eligible(self, user: dict, experiment: Experiment) -> bool:
        """Check targeting rules before assignment."""
        targeting = experiment.targeting
        if "plans" in targeting and user.get("plan") not in targeting["plans"]:
            return False
        if "countries" in targeting and user.get("country") not in targeting["countries"]:
            return False
        return True
```

## Results Computation (SQL)

```sql
-- Compute experiment results
WITH exposures AS (
    SELECT DISTINCT
        user_id,
        experiment_id,
        variant_name,
        MIN(exposed_at) AS first_exposed_at
    FROM experiment_exposures
    WHERE experiment_id = 'exp-checkout-v2'
      AND exposed_at >= '2024-03-01'
    GROUP BY user_id, experiment_id, variant_name
),

conversions AS (
    SELECT
        e.user_id,
        e.variant_name,
        COUNT(o.order_id) AS orders,
        SUM(o.total_amount) AS revenue
    FROM exposures e
    LEFT JOIN orders o ON e.user_id = o.customer_id
        AND o.created_at > e.first_exposed_at
        AND o.created_at <= e.first_exposed_at + INTERVAL '7 days'
    GROUP BY e.user_id, e.variant_name
)

SELECT
    variant_name,
    COUNT(*) AS users,
    AVG(orders > 0) AS conversion_rate,
    AVG(revenue) AS avg_revenue_per_user,
    STDDEV(revenue) AS revenue_stddev
FROM conversions
GROUP BY variant_name;
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Multiple experiment systems** | Inconsistent methodology; conflicting results | Single platform, shared assignment engine |
| **Non-deterministic assignment** | Users switch variants between sessions | Hash-based deterministic bucketing |
| **Novelty effect ignored** | First-week lift disappears | Require 2+ week run; check week-over-week consistency |
| **Too many concurrent experiments** | Interaction effects corrupt results | Mutual exclusion or layered experiment design |
| **Peeking and stopping early** | Inflated false positives | Pre-registered sample size; sequential testing |

## 10 Rules

1. Assignment is deterministic — same user always gets same variant.
2. Exposure is logged at the moment of assignment — not at conversion.
3. Analysis uses only users who were exposed — not all users.
4. Experiments run for minimum 2 weeks — novelty effects bias early results.
5. Sample size is calculated upfront — experiments are not stopped early.
6. Primary metric is pre-registered — changing metrics post-hoc is p-hacking.
7. Guardrail metrics are checked — a conversion win that harms NPS is not a win.
8. Segment results by major dimensions — aggregates hide important patterns.
9. Mutual exclusion prevents experiments from interacting unless explicitly layered.
10. The platform is owned — ungoverned experiment proliferation creates false results.
