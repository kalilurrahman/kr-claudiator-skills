---
name: customer-segmentation
description: Build customer segmentation models for personalisation, targeting, and lifecycle management. Outputs RFM analysis, behavioural clustering, segment SQL, and activation playbooks.
argument-hint: [business model, data available, use case for segments, update frequency needed]
allowed-tools: Read, Write, Bash
---

# Customer Segmentation

Customer segmentation groups customers by shared characteristics to enable targeted treatment. Segments based on behaviour (RFM, lifecycle stage) are more actionable than demographic segments because they directly reflect the customer relationship.

## RFM Segmentation

```python
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def compute_rfm(transactions: pd.DataFrame, reference_date: datetime = None) -> pd.DataFrame:
    """
    Compute RFM scores for each customer.
    
    transactions: DataFrame with columns [customer_id, order_date, order_value]
    Returns: DataFrame with [customer_id, recency, frequency, monetary, rfm_score, segment]
    """
    if reference_date is None:
        reference_date = transactions["order_date"].max() + timedelta(days=1)
    
    rfm = transactions.groupby("customer_id").agg(
        recency=("order_date", lambda x: (reference_date - x.max()).days),
        frequency=("order_date", "count"),
        monetary=("order_value", "sum"),
    ).reset_index()
    
    # Score 1-5 (5 = best)
    rfm["r_score"] = pd.qcut(rfm["recency"], q=5, labels=[5,4,3,2,1])  # Lower recency = better
    rfm["f_score"] = pd.qcut(rfm["frequency"].rank(method="first"), q=5, labels=[1,2,3,4,5])
    rfm["m_score"] = pd.qcut(rfm["monetary"].rank(method="first"), q=5, labels=[1,2,3,4,5])
    
    rfm["rfm_score"] = rfm["r_score"].astype(int) * 100 + rfm["f_score"].astype(int) * 10 + rfm["m_score"].astype(int)
    
    # Assign segments
    def segment(row):
        r, f, m = int(row["r_score"]), int(row["f_score"]), int(row["m_score"])
        if r >= 4 and f >= 4: return "champions"
        if r >= 3 and f >= 3: return "loyal"
        if r >= 4 and f <= 2: return "new_customers"
        if r >= 3 and f >= 1 and m >= 3: return "potential_loyalists"
        if r <= 2 and f >= 3: return "at_risk"
        if r <= 2 and f <= 2: return "lost"
        return "others"
    
    rfm["segment"] = rfm.apply(segment, axis=1)
    return rfm

# Segment action map
SEGMENT_ACTIONS = {
    "champions":          "Early access to new features; referral programme",
    "loyal":              "Upsell to higher tier; loyalty rewards",
    "at_risk":            "Win-back campaign; investigate churn reasons",
    "new_customers":      "Onboarding assistance; guide to core features",
    "potential_loyalists":"Engagement campaign; personalised recommendations",
    "lost":               "Re-engagement offer; last-chance email",
}
```

## Lifecycle Segment SQL

```sql
-- Customer lifecycle segments based on activity
WITH latest_activity AS (
    SELECT
        customer_id,
        MAX(order_date)                         AS last_order_date,
        MIN(order_date)                         AS first_order_date,
        COUNT(DISTINCT order_id)                AS order_count,
        SUM(order_value_usd)                    AS total_revenue_usd,
        CURRENT_DATE - MAX(order_date)          AS days_since_last_order
    FROM orders
    WHERE status NOT IN ('cancelled', 'refunded')
    GROUP BY customer_id
),

segmented AS (
    SELECT
        customer_id,
        days_since_last_order,
        order_count,
        total_revenue_usd,
        CASE
            WHEN order_count = 1
             AND days_since_last_order <= 30  THEN 'new'
            WHEN order_count >= 2
             AND days_since_last_order <= 60  THEN 'active_repeat'
            WHEN order_count = 1
             AND days_since_last_order > 30
             AND days_since_last_order <= 90  THEN 'new_at_risk'
            WHEN days_since_last_order > 60
             AND days_since_last_order <= 120 THEN 'at_risk'
            WHEN days_since_last_order > 120
             AND days_since_last_order <= 365 THEN 'lapsed'
            WHEN days_since_last_order > 365  THEN 'lost'
        END AS lifecycle_segment
    FROM latest_activity
)

SELECT
    lifecycle_segment,
    COUNT(*) AS customer_count,
    AVG(total_revenue_usd) AS avg_ltv,
    AVG(order_count) AS avg_orders,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS pct_of_customers
FROM segmented
GROUP BY lifecycle_segment
ORDER BY customer_count DESC;
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Static segments** | Segments drift as behaviour changes | Re-compute segments daily/weekly |
| **Too many segments** | Operationally unmanageable | 5-8 actionable segments maximum |
| **Segments without actions** | Segmentation as analysis, not activation | Every segment has a defined treatment |
| **RFM without context** | High M but single purchase ≠ loyal | Layer lifecycle stage on top of RFM |
| **Ignoring B2B account vs user** | Individual user RFM misses account-level value | Segment at account level for B2B |

## 10 Rules

1. Segmentation exists to drive action — every segment has a defined playbook.
2. 5-8 segments maximum — more creates operational paralysis.
3. Recalculate segments regularly — customer behaviour changes; segments must follow.
4. RFM is a starting point — layer product behaviour on top for richer segments.
5. Segment at the right grain — individual users for B2C; accounts for B2B.
6. Measure segment migration — are customers moving toward "champions" or "at_risk"?
7. Champions are your best marketing asset — referral and advocacy programmes first.
8. At-risk is the highest-ROI intervention — it's cheaper to save than acquire.
9. Segment quality: every segment should be reachable (you have contact info) and actionable.
10. A/B test segment treatments — prove that the action improves outcomes for that segment.


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
