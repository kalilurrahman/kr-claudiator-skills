---
name: metrics-framework
description: Design a company-wide metrics framework with north star, input metrics, guardrails, and reporting hierarchy. Outputs metric taxonomy, definition docs, instrumentation spec, and anomaly detection rules.
argument-hint: [business model, product stage, current reporting gaps, team size]
allowed-tools: Read, Write
---

# Metrics Framework

A metrics framework creates shared understanding of what success looks like, how it is measured, and who is responsible. Without it, teams optimise locally, metrics conflict across teams, and leadership debates definitions instead of decisions.

## Process

1. **Define the North Star.** One metric that best captures value delivered to customers and correlates with business success. Not revenue — the leading indicator of revenue.
2. **Decompose into Level 1 metrics.** 3–7 metrics that together explain the North Star. These map to product/business areas.
3. **Define Level 2 input metrics.** For each L1 metric, the levers teams can pull. These are team-owned and actionable.
4. **Define guardrail metrics.** Metrics that must not degrade while optimising the target. Prevents Goodhart's Law gaming.
5. **Write formal metric definitions.** Name, formula, data source, owner, refresh cadence, breakdowns.
6. **Build the instrumentation spec.** What events to fire, what properties to capture.
7. **Set anomaly detection thresholds.** Alert when metrics move unexpectedly — up or down.

## Metric Hierarchy Template

```markdown
## North Star: Weekly Active Customers (WAC)
Definition: Distinct customers who completed ≥1 order in trailing 7 days.
Why: Captures both acquisition and retention. Correlates with revenue but is harder to game.
Owner: CEO / Chief Product Officer
Refresh: Daily

## Level 1 — Business Health (5 metrics)

| Metric | Definition | Owner | Target |
|--------|-----------|-------|--------|
| New Customer Acquisition | Distinct customers placing first-ever order per week | Growth | +8% MoM |
| Repeat Purchase Rate | % of WAC with ≥2 orders in 30 days | Product | >45% |
| Average Order Value (AOV) | Revenue / Orders (7-day trailing) | Product | >$55 |
| Fulfilment Success Rate | Orders delivered on time / Orders shipped | Operations | >97% |
| Net Promoter Score (NPS) | Monthly survey, promoter % - detractor % | CX | >40 |

## Level 2 — Team Input Metrics (examples)

Growth team owns New Customer Acquisition:
  - Traffic volume (sessions per week)
  - New visitor conversion rate (orders / first-visit sessions)
  - CAC by channel (spend / new customers per channel)
  - Activation rate (% sign-ups placing first order within 7 days)

Product team owns Repeat Purchase Rate:
  - D7 retention (% users returning within 7 days of first order)
  - Category breadth (avg categories ordered from per customer)
  - Recommendation click-through rate
  - Wishlist-to-order conversion rate

## Guardrail Metrics
These must not degrade while optimising any target:
  - Return rate (orders returned / orders delivered) — cap: <12%
  - Customer support contacts per order — cap: <0.05
  - App crash rate — cap: <0.1%
  - Gross margin — floor: >35%
```

## Formal Metric Definition

```markdown
# Metric Definition: Weekly Active Customers (WAC)

**ID:** MTR-001  
**Version:** 2.0  
**Owner:** Data team / Product Analytics  
**Last reviewed:** 2024-01-15  
**Status:** Active

## Definition
**Plain English:** The number of distinct customers who placed at least one order that was successfully confirmed (not cancelled) in the trailing 7 calendar days, measured as of midnight UTC.

**Formula:**
```
WAC = COUNT(DISTINCT customer_id)
FROM orders
WHERE status NOT IN ('cancelled', 'refunded')
  AND confirmed_at >= CURRENT_DATE - INTERVAL '7 days'
  AND confirmed_at < CURRENT_DATE
```

## Data Source
- Table: `analytics.fact_orders`
- Refresh: Daily at 02:00 UTC (data for previous day complete)
- Latency SLA: Available by 06:00 UTC

## Breakdowns Available
| Breakdown | Values | Notes |
|-----------|--------|-------|
| Geography | Country, Region | Based on shipping address |
| Channel | Organic, Paid, Email, Direct | First-touch attribution |
| Customer cohort | New (first order ever) vs Returning | |
| Product category | Top-level category | SKU of first item in order |

## Exclusions
- Internal test orders (customer_id in test_customer_ids table)
- B2B accounts (account_type = 'business')
- Orders placed via API (source = 'api') unless flagged as customer

## Interpretation
- **Up is good** (higher = more active customers)
- Seasonality: +30–40% in November–December; -15% in January
- Expected week-over-week variance: ±5% (normal); >±15% = investigate

## Related Metrics
- WAC is the North Star. Decomposed into: New Customer Acquisition, Repeat Purchase Rate.
- Do not confuse with MAU (Monthly Active Users) — WAC counts orders, not sessions.
```

## Instrumentation Spec

```typescript
// Events required to compute all framework metrics

// Event: order_confirmed — fires when payment captured and order confirmed
analytics.track('order_confirmed', {
  // Required for WAC, AOV, Repeat Purchase Rate
  order_id: string,           // UUID
  customer_id: string,        // UUID
  is_first_order: boolean,    // pre-computed in backend
  order_value_usd: number,    // in dollars with 2dp
  item_count: number,
  categories: string[],       // top-level category per item
  
  // Required for CAC attribution
  acquisition_channel: string, // 'paid_search' | 'email' | 'organic' | 'referral' | 'direct'
  campaign_id?: string,
  
  // Guardrail: fulfilment
  shipping_method: string,
  estimated_delivery_date: string,  // ISO date
});

// Event: order_delivered — fires when carrier marks delivered
analytics.track('order_delivered', {
  order_id: string,
  customer_id: string,
  confirmed_at: string,       // ISO timestamp
  delivered_at: string,       // ISO timestamp
  days_to_deliver: number,    // computed
  on_time: boolean,           // delivered_at <= promised_delivery_date
});

// Event: order_returned — fires when return initiated
analytics.track('order_returned', {
  order_id: string,
  customer_id: string,
  return_reason: string,      // 'defective' | 'wrong_item' | 'changed_mind' | 'other'
  refund_amount_usd: number,
});
```

## Anomaly Detection Rules

```python
import pandas as pd
from dataclasses import dataclass

@dataclass
class AnomalyRule:
    metric: str
    window: str          # '7d', '1d'
    method: str          # 'pct_change', 'zscore', 'absolute'
    threshold: float
    severity: str        # 'p1', 'p2', 'p3'
    direction: str       # 'both', 'down', 'up'

ANOMALY_RULES = [
    AnomalyRule('wac',         '7d',  'pct_change', 0.15, 'p1', 'down'),  # -15% WoW
    AnomalyRule('wac',         '1d',  'pct_change', 0.30, 'p1', 'both'),  # ±30% DoD
    AnomalyRule('aov',         '7d',  'pct_change', 0.10, 'p2', 'both'),
    AnomalyRule('return_rate', '7d',  'absolute',   0.12, 'p1', 'up'),    # >12%
    AnomalyRule('nps',         '30d', 'absolute',   30.0, 'p2', 'down'),  # NPS < 30
    AnomalyRule('fulfilment',  '1d',  'absolute',   0.95, 'p1', 'down'),  # <95%
]

def check_anomalies(metric_name: str, current_value: float,
                    historical: pd.Series) -> list[dict]:
    alerts = []
    for rule in ANOMALY_RULES:
        if rule.metric != metric_name: continue
        
        if rule.method == 'pct_change':
            prev = historical.iloc[-1]
            change = (current_value - prev) / prev
            triggered = (
                (rule.direction == 'both' and abs(change) > rule.threshold) or
                (rule.direction == 'down' and change < -rule.threshold) or
                (rule.direction == 'up' and change > rule.threshold)
            )
        elif rule.method == 'absolute':
            triggered = (
                (rule.direction == 'down' and current_value < rule.threshold) or
                (rule.direction == 'up' and current_value > rule.threshold)
            )
        
        if triggered:
            alerts.append({
                'metric': rule.metric,
                'severity': rule.severity,
                'current': current_value,
                'threshold': rule.threshold,
                'message': f"{rule.metric} anomaly: {current_value:.2f}"
            })
    return alerts
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Too many metrics** | Decision paralysis; no prioritisation | Max 7 L1 metrics; 5 per team at L2 |
| **Vanity metrics** | Page views, app downloads — impressive, not actionable | Use metrics that change with product decisions |
| **Conflicting definitions** | Finance WAC ≠ Product WAC | Single formal definition, one source of truth |
| **No guardrails** | Teams game North Star at expense of quality | Define guardrails before announcing targets |
| **Metrics without owners** | Nobody investigates anomalies | Every metric has a named owner and SLA |
| **Lagging-only metrics** | Revenue reported monthly — can't course correct | Balance leading indicators (input) with lagging (output) |
| **Goodhart's Law ignored** | When a measure becomes a target, it ceases to be a good measure | Rotate metrics; add guardrails; use multiple measures |

## 10 Rules

1. One North Star metric per company — not per team, not per quarter.
2. North Star is a leading indicator, not revenue. Revenue is a lagging outcome.
3. Every metric has exactly one owner — a person, not a team.
4. Guardrail metrics are defined before targets are set — not retrofitted after gaming is discovered.
5. Metric definitions are versioned; changes require deprecation notice to consumers.
6. L2 metrics must be directly actionable by the team that owns them.
7. Anomaly detection alerts on both up and down — unexpected improvement reveals measurement errors.
8. Seasonality adjustments are documented alongside definitions — not tribal knowledge.
9. Metric review cadence: North Star weekly, L1 weekly, L2 daily.
10. The framework is public internally — every employee can find the definition of every metric.
