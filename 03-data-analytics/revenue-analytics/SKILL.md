---
name: revenue-analytics
description: Build revenue analytics systems tracking MRR, ARR, churn, expansion, and cohort revenue. Outputs revenue recognition logic, MRR waterfall analysis, LTV calculation, and forecasting models.
argument-hint: [business model, subscription vs usage, billing system, finance requirements]
allowed-tools: Read, Write, Bash
---

# Revenue Analytics

Revenue analytics tracks how revenue is generated, retained, and grown across customer cohorts. For SaaS businesses, the key metrics are MRR movements (new, expansion, contraction, churn), net revenue retention, and LTV. These metrics drive decisions on pricing, customer success investment, and growth strategy.

## MRR Components

```
TOTAL MRR = New MRR + Expansion MRR - Contraction MRR - Churned MRR

New MRR:        Revenue from customers acquired this period
Expansion MRR:  Revenue increase from existing customers (upgrades, usage growth)
Contraction MRR: Revenue decrease from existing customers (downgrades)
Churned MRR:    Revenue lost from customers who cancelled

Net New MRR = New + Expansion - Contraction - Churned
MRR Growth Rate = Net New MRR / Starting MRR
```

## MRR Waterfall SQL

```sql
WITH monthly_mrr AS (
    -- Calculate MRR per customer per month
    SELECT
        customer_id,
        DATE_TRUNC('month', period_start) AS month,
        SUM(mrr_amount) AS mrr
    FROM subscriptions
    WHERE status = 'active'
    GROUP BY customer_id, DATE_TRUNC('month', period_start)
),

mrr_movements AS (
    SELECT
        COALESCE(curr.month, prev.month + INTERVAL '1 month') AS month,
        COALESCE(curr.customer_id, prev.customer_id) AS customer_id,
        COALESCE(curr.mrr, 0) AS current_mrr,
        COALESCE(prev.mrr, 0) AS previous_mrr,

        -- Classify the MRR movement
        CASE
            WHEN prev.mrr IS NULL AND curr.mrr > 0
                THEN 'new'                              -- First payment
            WHEN curr.mrr IS NULL AND prev.mrr > 0
                THEN 'churned'                          -- Cancelled
            WHEN curr.mrr > prev.mrr
                THEN 'expansion'                        -- Upgraded
            WHEN curr.mrr < prev.mrr AND curr.mrr > 0
                THEN 'contraction'                      -- Downgraded
            ELSE 'retained'                             -- Same MRR
        END AS movement_type,

        COALESCE(curr.mrr, 0) - COALESCE(prev.mrr, 0) AS mrr_change

    FROM monthly_mrr curr
    FULL OUTER JOIN monthly_mrr prev
        ON curr.customer_id = prev.customer_id
        AND curr.month = prev.month + INTERVAL '1 month'
)

SELECT
    month,
    SUM(CASE WHEN movement_type = 'new'         THEN mrr_change ELSE 0 END) AS new_mrr,
    SUM(CASE WHEN movement_type = 'expansion'   THEN mrr_change ELSE 0 END) AS expansion_mrr,
    SUM(CASE WHEN movement_type = 'contraction' THEN mrr_change ELSE 0 END) AS contraction_mrr,
    SUM(CASE WHEN movement_type = 'churned'     THEN ABS(previous_mrr) ELSE 0 END) AS churned_mrr,
    SUM(current_mrr) FILTER (WHERE movement_type != 'churned') AS ending_mrr
FROM mrr_movements
GROUP BY month
ORDER BY month;
```

## Net Revenue Retention (NRR)

```sql
-- NRR: Revenue retained + expanded from existing customers
-- NRR > 100% = growing revenue from existing customers alone

WITH cohort_base AS (
    -- Starting MRR for each cohort (e.g., Jan 2024 cohort)
    SELECT
        customer_id,
        DATE_TRUNC('month', first_payment_date) AS cohort_month,
        starting_mrr
    FROM customers
    WHERE cohort_month = '2024-01-01'
),

cohort_current AS (
    -- Current MRR for same cohort N months later
    SELECT
        customer_id,
        COALESCE(current_mrr, 0) AS current_mrr
    FROM monthly_mrr
    WHERE month = '2024-07-01'  -- 6 months later
)

SELECT
    cohort_month,
    COUNT(DISTINCT cb.customer_id) AS original_customers,
    SUM(cb.starting_mrr) AS original_mrr,
    SUM(COALESCE(cc.current_mrr, 0)) AS current_mrr,
    ROUND(100.0 * SUM(COALESCE(cc.current_mrr, 0)) / SUM(cb.starting_mrr), 1) AS nrr_pct
FROM cohort_base cb
LEFT JOIN cohort_current cc USING (customer_id)
GROUP BY cohort_month;
-- NRR > 100: Expansion outpaces churn — excellent
-- NRR 90-100: Churn outpaces expansion — needs work
-- NRR < 80: Significant revenue leak — urgent
```

## Customer Lifetime Value (LTV)

```python
import numpy as np
from scipy.optimize import curve_fit

def calculate_ltv_cohort(
    mrr_per_month: list[float],   # Average MRR of customers in cohort each month
    retention_curve: list[float], # % of cohort still active each month
    discount_rate_annual: float = 0.10,
) -> float:
    """
    Calculate LTV as sum of discounted future cash flows.
    mrr_per_month and retention_curve must be same length.
    """
    monthly_discount = (1 + discount_rate_annual) ** (1/12) - 1
    ltv = 0

    for month, (mrr, retention) in enumerate(zip(mrr_per_month, retention_curve)):
        # Expected revenue in this month = MRR * retention rate
        expected_revenue = mrr * retention
        # Discount to present value
        discounted = expected_revenue / ((1 + monthly_discount) ** month)
        ltv += discounted

    return ltv

# Simple LTV approximation (when retention is roughly constant)
def simple_ltv(arpu_monthly: float, monthly_churn_rate: float,
               gross_margin: float = 0.75) -> float:
    """LTV = (ARPU * Gross Margin) / Monthly Churn Rate"""
    return (arpu_monthly * gross_margin) / monthly_churn_rate

# LTV:CAC ratio target
# <1: Losing money on every customer
# 1-3: Break-even to modest return
# 3+: Good unit economics
# 5+: Excellent; may be underinvesting in growth
def ltv_cac_ratio(ltv: float, cac: float) -> float:
    return ltv / cac
```

## Revenue Forecasting

```python
def forecast_mrr(
    historical_mrr: list[float],     # Last 12+ months of MRR
    months_ahead: int = 12,
    growth_assumption: float = None  # If None, use historical average
) -> list[dict]:
    """
    Simple MRR forecast using historical growth rate.
    For more sophisticated: use Prophet or ARIMA.
    """
    import statistics

    # Calculate historical monthly growth rates
    growth_rates = [
        (historical_mrr[i] - historical_mrr[i-1]) / historical_mrr[i-1]
        for i in range(1, len(historical_mrr))
    ]

    if growth_assumption is None:
        avg_growth = statistics.mean(growth_rates[-6:])  # Last 6 months
    else:
        avg_growth = growth_assumption

    forecast = []
    current_mrr = historical_mrr[-1]

    for month in range(1, months_ahead + 1):
        current_mrr = current_mrr * (1 + avg_growth)
        forecast.append({
            "month_offset": month,
            "forecasted_mrr": round(current_mrr, 0),
            "forecasted_arr": round(current_mrr * 12, 0),
            "confidence": "high" if month <= 3 else "medium" if month <= 6 else "low",
        })

    return forecast
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Booking vs revenue confusion** | Annual contract signed ≠ revenue recognised | Use MRR (recognised revenue); track bookings separately |
| **Not segmenting NRR** | Overall NRR hides segment differences | NRR by cohort, by plan tier, by segment |
| **Gross churn only** | Misses expansion that offsets churn | Always report gross AND net revenue retention |
| **No MRR waterfall** | Can't see what's driving MRR change | Track new/expansion/contraction/churned separately |
| **Ignoring contraction** | Appears as just "retained" customer | Track contraction as its own revenue leak category |

## 10 Rules

1. MRR is the single source of truth for recurring revenue — normalise all billing to monthly.
2. Track all four MRR movements: new, expansion, contraction, churned — the waterfall tells the full story.
3. NRR > 100% means revenue grows from existing customers alone — the most powerful growth engine.
4. LTV:CAC > 3 is the minimum threshold for sustainable unit economics.
5. Gross margin is part of LTV — not just revenue.
6. Cohort-based NRR reveals whether retention is improving over time.
7. Forecast based on the MRR waterfall — not just total MRR trend.
8. Contraction is as important to track as churn — it's early-warning churn.
9. Annual plans improve metrics artificially — compare cohorts with same billing frequency.
10. Revenue analytics drives Customer Success investment — where NRR is lowest, CS investment is highest ROI.
