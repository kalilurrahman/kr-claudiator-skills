---
name: cohort-analysis
description: Build cohort analyses to understand user retention, behaviour over time, and revenue patterns. Outputs cohort SQL queries, retention visualisations, revenue cohorts, and actionable insights.
argument-hint: [product type, cohort definition, time period, metrics to analyse]
allowed-tools: Read, Write, Bash
---

# Cohort Analysis

Cohort analysis groups users by a shared characteristic (when they signed up, their acquisition channel, their plan tier) and tracks their behaviour over time. It answers the fundamental question: are things getting better or worse for users who join today vs those who joined 6 months ago?

## Cohort Types

```
ACQUISITION COHORT (most common)
  Group by: first interaction / signup date
  Answers: Are newer users retained better than older ones?
  
BEHAVIOURAL COHORT
  Group by: action taken (e.g., users who used feature X)
  Answers: Does using feature X predict retention?
  
REVENUE COHORT
  Group by: signup month; track cumulative revenue
  Answers: How much has each signup cohort generated over time? (LTV)
  
SEGMENT COHORT
  Group by: acquisition channel, plan tier, geography
  Answers: Which segments have better retention? Which are worth more?
```

## Retention Cohort SQL

```sql
-- Classic retention cohort: % of users from signup month still active N months later

WITH user_signups AS (
    SELECT
        user_id,
        DATE_TRUNC('month', created_at) AS signup_month
    FROM users
    WHERE created_at >= '2023-01-01'
),

user_activity AS (
    SELECT DISTINCT
        user_id,
        DATE_TRUNC('month', event_time) AS active_month
    FROM user_events
    WHERE event_type = 'session_start'
),

cohort_sizes AS (
    SELECT
        signup_month,
        COUNT(DISTINCT user_id) AS cohort_size
    FROM user_signups
    GROUP BY 1
),

retention AS (
    SELECT
        s.signup_month,
        DATEDIFF('month', s.signup_month, a.active_month) AS months_since_signup,
        COUNT(DISTINCT s.user_id) AS retained_users
    FROM user_signups s
    JOIN user_activity a ON s.user_id = a.user_id
        AND a.active_month >= s.signup_month
    GROUP BY 1, 2
)

SELECT
    r.signup_month,
    c.cohort_size,
    r.months_since_signup,
    r.retained_users,
    ROUND(100.0 * r.retained_users / c.cohort_size, 1) AS retention_rate
FROM retention r
JOIN cohort_sizes c ON r.signup_month = c.signup_month
WHERE r.months_since_signup <= 12
ORDER BY r.signup_month, r.months_since_signup;

-- Output: Cohort table (rows = cohorts, columns = month 0, 1, 2, ... 12)
-- Month 0 should always be 100% (user was active in signup month)
```

## Revenue Cohort (LTV)

```sql
-- Cumulative revenue by signup cohort over time
WITH user_cohorts AS (
    SELECT user_id, DATE_TRUNC('month', created_at) AS signup_month
    FROM users
),

monthly_revenue AS (
    SELECT
        user_id,
        DATE_TRUNC('month', transaction_date) AS revenue_month,
        SUM(amount_usd) AS revenue
    FROM transactions
    GROUP BY 1, 2
),

cohort_revenue AS (
    SELECT
        c.signup_month,
        DATEDIFF('month', c.signup_month, r.revenue_month) AS months_since_signup,
        SUM(r.revenue) AS monthly_cohort_revenue,
        COUNT(DISTINCT c.user_id) AS cohort_size
    FROM user_cohorts c
    JOIN monthly_revenue r ON c.user_id = r.user_id
        AND r.revenue_month >= c.signup_month
    GROUP BY 1, 2
)

SELECT
    signup_month,
    cohort_size,
    months_since_signup,
    monthly_cohort_revenue,
    SUM(monthly_cohort_revenue) OVER (
        PARTITION BY signup_month
        ORDER BY months_since_signup
    ) AS cumulative_ltv,
    SUM(monthly_cohort_revenue) OVER (
        PARTITION BY signup_month
        ORDER BY months_since_signup
    ) / cohort_size AS ltv_per_user
FROM cohort_revenue
ORDER BY signup_month, months_since_signup;
```

## Retention Curve Analysis

```python
import pandas as pd
import numpy as np

def analyse_retention_cohorts(df: pd.DataFrame) -> dict:
    """
    df columns: signup_month, months_since_signup, retention_rate
    """
    insights = {}
    
    # Month-1 retention (strongest predictor of long-term retention)
    m1 = df[df["months_since_signup"] == 1].groupby("signup_month")["retention_rate"].mean()
    insights["m1_retention_trend"] = "improving" if m1.iloc[-1] > m1.iloc[0] else "declining"
    insights["m1_latest"] = float(m1.iloc[-1])
    insights["m1_change_6mo"] = float(m1.iloc[-1] - m1.iloc[-7]) if len(m1) >= 7 else None
    
    # Long-term retention (month 6+)
    m6 = df[df["months_since_signup"] == 6].groupby("signup_month")["retention_rate"].mean()
    insights["m6_latest"] = float(m6.iloc[-1]) if len(m6) > 0 else None
    
    # Find retention inflection point (where curve flattens)
    latest_cohort = df[df["signup_month"] == df["signup_month"].max()]
    rates = latest_cohort.sort_values("months_since_signup")["retention_rate"].values
    
    # Inflection = where month-over-month change is smallest (curve flattening)
    diffs = np.abs(np.diff(rates))
    inflection_month = int(np.argmin(diffs)) + 1 if len(diffs) > 0 else None
    insights["inflection_month"] = inflection_month
    
    return insights

# Typical healthy SaaS benchmarks
RETENTION_BENCHMARKS = {
    "b2b_saas": {"m1": 0.85, "m3": 0.70, "m12": 0.50},
    "b2c_consumer": {"m1": 0.40, "m3": 0.20, "m12": 0.10},
    "marketplace": {"m1": 0.60, "m3": 0.40, "m12": 0.25},
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Mixing cohorts** | Averages hide cohort-level trends | Always segment; never average across all users |
| **Not normalising to cohort size** | Large cohorts dominate small ones | Always show rate (%), not absolute count |
| **Only looking at month-1** | Early retention doesn't always predict long-term | Track through month 6 or 12 |
| **No action from cohort data** | Analysis for reporting, not decisions | Always follow with "what would improve this?" |
| **Ignoring resurrection** | Churned users can return | Include resurrection events in activity definition |

## 10 Rules

1. Cohort analysis uses rates (%), not absolute counts — cohort sizes differ.
2. Month-0 retention is always 100% — it's the baseline definition.
3. Month-1 retention is the strongest single predictor of long-term health — track it weekly.
4. Improving cohorts (later cohorts retain better) indicate product improvement.
5. Revenue cohorts reveal true LTV — blended averages hide high-value and low-value mix.
6. Behavioural cohorts reveal which features predict retention — use them to justify roadmap.
7. Segment cohorts by acquisition channel, plan, and geography — same product can perform very differently.
8. Resurrection (return after churn) is real — include in retention definition with transparency.
9. A flattening retention curve means users who will stay have stayed — the curve shape matters.
10. Cohort analysis without action is reporting. Action — product changes, experiments — is the goal.
