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

The canonical workflow for **Product Health Metrics** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Define a comprehensive product health dashboard tracking acquisition, engagement, retention, and quality. Outputs metric definitions, threshold setting, anomaly
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
