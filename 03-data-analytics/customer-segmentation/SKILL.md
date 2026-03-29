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
