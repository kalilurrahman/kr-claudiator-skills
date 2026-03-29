---
name: product-health-metrics
description: Define a comprehensive product health dashboard tracking acquisition, engagement, retention, and quality. Outputs metric definitions, threshold setting, anomaly detection, and weekly review process.
argument-hint: [product type, team size, current metric gaps, decision-making context]
allowed-tools: Read, Write
---

# Product Health Metrics

A product health dashboard gives the team a shared, real-time view of whether the product is performing well. Unlike a North Star Metric (which tracks strategic progress) or OKR metrics (which track quarterly goals), product health metrics are operational — they tell you if something is breaking or trending in the wrong direction before users report it.

## Health Metric Categories

```
ACQUISITION (Is the product finding new users?)
  New signups per week
  Trial start rate (% of visitors who start a trial)
  Signup-to-activation conversion (% who reach first value moment)

ENGAGEMENT (Are users actively using the product?)
  Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
  Core action frequency (times per week the key action is performed)
  Feature adoption rate (% of users using feature X)
  Session length and depth

RETENTION (Are users coming back?)
  Day-7, Day-30 retention (% of users still active N days after signup)
  Month-over-month retention (% of last month's users active this month)
  Cohort retention curve (does it flatten? Where?)
  Churn rate (monthly % of active users who stop)

REVENUE (Is value captured proportionally to value created?)
  MRR growth rate
  Net Revenue Retention (NRR)
  Trial-to-paid conversion rate
  Average Revenue Per Account (ARPA)

QUALITY (Is the product working correctly?)
  Error rate (API errors, JS errors)
  p99 latency for key flows
  App crash rate (mobile)
  Support ticket volume and category
```

## Dashboard Specification

```markdown
## Product Health Dashboard: Weekly Review

Updated: Every Monday by 9am
Owner: PM + Data

### Section 1: Acquisition
| Metric | This Week | Last Week | WoW | 4-Week Avg | Status |
|--------|-----------|-----------|-----|-----------|--------|
| New Signups | 487 | 451 | +8% | 462 | 🟢 |
| Trial Start Rate | 28% | 29% | -1pp | 28% | 🟢 |
| Signup → Activation (7d) | 31% | 28% | +3pp | 29% | 🟡 |

### Section 2: Engagement
| Metric | This Week | Last Week | WoW | Status |
|--------|-----------|-----------|-----|--------|
| WAU | 12,843 | 12,201 | +5% | 🟢 |
| Core Action Frequency (avg/user/week) | 4.2 | 4.1 | +2% | 🟢 |
| Feature X Adoption (% active users) | 34% | 31% | +3pp | 🟡 |

### Section 3: Retention
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Day-7 Retention | 48% | >45% | 🟢 |
| Month 1→2 Retention | 62% | >65% | 🟡 |
| Monthly Churn | 2.8% | <3% | 🟢 |

### Section 4: Revenue
| Metric | Value | MoM | Status |
|--------|-------|-----|--------|
| MRR | $2.84M | +6% | 🟢 |
| NRR | 108% | — | 🟢 |
| Trial → Paid | 22% | +1pp | 🟡 |

### Section 5: Quality
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| API Error Rate | 0.08% | <0.1% | 🟢 |
| p99 Latency (checkout) | 387ms | <500ms | 🟢 |
| App Crash Rate | 0.3% | <0.5% | 🟢 |
| Support Tickets/Week | 143 | <150 | 🟢 |

### This Week's Focus
🔴 RED: None this week
🟡 YELLOW: Signup → Activation below target — investigating onboarding drop-off
```

## Threshold Setting

```python
from dataclasses import dataclass

@dataclass
class MetricThreshold:
    metric: str
    green: str    # ">=X" or "<=X" or "between X and Y"
    yellow: str   # Warn but don't panic
    red: str      # Requires immediate investigation
    owner: str

THRESHOLDS = [
    MetricThreshold(
        metric="signup_to_activation_7d",
        green=">=35%",
        yellow="25-35%",
        red="<25%",
        owner="@growth-pm",
    ),
    MetricThreshold(
        metric="api_error_rate",
        green="<0.1%",
        yellow="0.1-0.5%",
        red=">0.5%",
        owner="@engineering-oncall",
    ),
    MetricThreshold(
        metric="monthly_churn",
        green="<2%",
        yellow="2-4%",
        red=">4%",
        owner="@cs-lead",
    ),
]
```

## Anomaly Detection

```python
import pandas as pd
import numpy as np

def detect_anomalies(metric_history: pd.Series,
                      current_value: float,
                      z_threshold: float = 2.5) -> dict:
    """Flag values more than z_threshold standard deviations from rolling mean."""
    rolling_mean = metric_history.rolling(4).mean().iloc[-1]
    rolling_std  = metric_history.rolling(4).std().iloc[-1]

    if rolling_std == 0:
        return {"anomaly": False}

    z_score = (current_value - rolling_mean) / rolling_std
    return {
        "anomaly": abs(z_score) > z_threshold,
        "z_score": round(z_score, 2),
        "rolling_mean": round(rolling_mean, 2),
        "direction": "above" if z_score > 0 else "below",
        "severity": "critical" if abs(z_score) > 4 else "warning",
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Too many metrics** | Dashboard paralysis; nobody acts | Max 20 health metrics; 5 per category |
| **No thresholds** | "Looks fine" culture; issues missed | Every metric has green/yellow/red definition |
| **Reviewing monthly** | Issues discovered too late | Weekly review; automated daily anomaly alerts |
| **No owner per metric** | Alerts fire; nobody investigates | Every metric has a named owner |
| **Health metrics = business metrics** | Operational issues mixed with strategic progress | Separate: health (is it working?) from strategy (are we winning?) |

## 10 Rules

1. Product health metrics are operational — they tell you if something is breaking, not if strategy is working.
2. Every metric has a green/yellow/red threshold — "looks fine" is not a threshold.
3. Every metric has a named owner — alerts without owners go uninvestigated.
4. Weekly review cadence — monthly is too slow for operational metrics.
5. Automated anomaly detection catches issues between reviews.
6. Quality metrics (errors, latency, crashes) belong on the same dashboard as engagement metrics.
7. Dashboard is shared with the full team — product health is everyone's responsibility.
8. Red metrics trigger an investigation — not just a note in the weekly review.
9. Trends matter as much as absolute values — a metric within threshold but declining for 4 weeks is a yellow.
10. Archive metrics that nobody uses — a metric not referenced in decisions is noise.
