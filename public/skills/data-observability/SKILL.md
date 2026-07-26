---
name: data-observability
description: Implement data observability to detect, alert on, and resolve data quality issues in pipelines and warehouses. Outputs freshness monitoring, anomaly detection, lineage tracking, and incident playbooks.
argument-hint: [data stack, pipeline complexity, SLA requirements, team size]
allowed-tools: Read, Write
---

# Data Observability

Data observability provides visibility into the health of your data pipelines and warehouse — detecting issues before downstream users and reports are affected.

## Five Pillars of Data Observability

1. **Freshness** — Is the data up to date? Was it updated when expected?
2. **Volume** — Is there the expected amount of data? Sudden drops or spikes indicate problems.
3. **Schema** — Did the structure change unexpectedly? New columns, removed columns, type changes.
4. **Distribution** — Are the values within expected ranges and distributions?
5. **Lineage** — If something is wrong, which pipelines and tables are affected?

## Freshness Monitoring (dbt)

```yaml
sources:
  - name: postgres
    tables:
      - name: orders
        loaded_at_field: updated_at
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 24, period: hour}
```

## Volume Anomaly Detection

```python
import pandas as pd
from scipy import stats

def detect_volume_anomaly(table: str, current_count: int,
                          historical_counts: list) -> dict:
    z_score = (current_count - pd.Series(historical_counts).mean()) / pd.Series(historical_counts).std()
    is_anomaly = abs(z_score) > 3
    return {
        "table": table,
        "current_count": current_count,
        "z_score": round(z_score, 2),
        "is_anomaly": is_anomaly,
        "direction": "spike" if z_score > 0 else "drop",
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Reactive monitoring only | Issues found by users, not systems | Proactive automated checks |
| Checking only final tables | Root cause in upstream pipeline | Monitor all pipeline stages |
| No lineage tracking | Cannot assess impact of failures | Automatic lineage from dbt metadata |

## 10 Rules

1. Monitor freshness, volume, schema, distribution, and lineage.
2. Alerts fire before business users notice issues.
3. Every alert has a runbook.
4. Data SLAs are defined and monitored.
5. Schema changes trigger validation before downstream tables are refreshed.
6. Lineage maps are auto-generated, not manually maintained.
7. Volume anomaly detection uses statistical baselines, not hard thresholds.
8. On-call rotation exists for data incidents, same as service incidents.
9. Data incidents have postmortems.
10. Data quality metrics are tracked over time — improving trend is the goal.


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
