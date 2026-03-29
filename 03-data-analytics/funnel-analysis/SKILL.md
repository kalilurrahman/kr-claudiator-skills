---
name: funnel-analysis
description: Build conversion funnel analyses to identify drop-off points and optimisation opportunities. Outputs funnel SQL queries, drop-off attribution, segment comparison, and experiment prioritisation.
argument-hint: [funnel steps, event tracking system, time window, segment dimensions]
allowed-tools: Read, Write, Bash
---

# Funnel Analysis

Funnel analysis tracks how users progress through a defined sequence of steps toward a goal. It reveals where users drop off, how long each stage takes, and which segments convert better. It is the primary tool for identifying the highest-ROI optimisation opportunities in a product.

## Process

1. **Define the funnel.** What is the goal event? What are the required prerequisite steps?
2. **Set the time window.** How long can a user take to complete the funnel? (e.g., signup must be within 7 days of first visit)
3. **Write the SQL.** Track each step as a distinct event; compute conversion at each stage.
4. **Segment the analysis.** By acquisition channel, device, plan tier, geography.
5. **Identify the biggest drop-off.** That is your primary optimisation target.
6. **Generate hypotheses.** Why do users drop? Session recordings, user interviews, support tickets.

## Funnel SQL

```sql
-- E-commerce checkout funnel
-- Steps: product_viewed → add_to_cart → checkout_started → payment_entered → order_placed

WITH funnel_events AS (
    SELECT
        user_id,
        event_type,
        event_time,
        device_type,
        acquisition_channel
    FROM events
    WHERE
        event_type IN (
            'product_viewed', 'add_to_cart',
            'checkout_started', 'payment_entered', 'order_placed'
        )
        AND event_time BETWEEN '2024-01-01' AND '2024-03-31'
),

step1 AS (
    SELECT
        user_id,
        MIN(event_time) AS step1_time,
        MAX(device_type) AS device_type,
        MAX(acquisition_channel) AS channel
    FROM funnel_events
    WHERE event_type = 'product_viewed'
    GROUP BY user_id
),

step2 AS (
    SELECT DISTINCT s1.user_id, MIN(e.event_time) AS step2_time
    FROM step1 s1
    JOIN funnel_events e ON s1.user_id = e.user_id
        AND e.event_type = 'add_to_cart'
        AND e.event_time > s1.step1_time
        AND e.event_time <= s1.step1_time + INTERVAL '30 minutes'
    GROUP BY s1.user_id
),

step3 AS (
    SELECT DISTINCT s2.user_id, MIN(e.event_time) AS step3_time
    FROM step2 s2
    JOIN funnel_events e ON s2.user_id = e.user_id
        AND e.event_type = 'checkout_started'
        AND e.event_time > s2.step2_time
    GROUP BY s2.user_id
),

step4 AS (
    SELECT DISTINCT s3.user_id, MIN(e.event_time) AS step4_time
    FROM step3 s3
    JOIN funnel_events e ON s3.user_id = e.user_id
        AND e.event_type = 'payment_entered'
        AND e.event_time > s3.step3_time
    GROUP BY s3.user_id
),

step5 AS (
    SELECT DISTINCT s4.user_id, MIN(e.event_time) AS step5_time
    FROM step4 s4
    JOIN funnel_events e ON s4.user_id = e.user_id
        AND e.event_type = 'order_placed'
        AND e.event_time > s4.step4_time
    GROUP BY s4.user_id
)

SELECT
    COUNT(DISTINCT s1.user_id)  AS step1_product_viewed,
    COUNT(DISTINCT s2.user_id)  AS step2_add_to_cart,
    COUNT(DISTINCT s3.user_id)  AS step3_checkout_started,
    COUNT(DISTINCT s4.user_id)  AS step4_payment_entered,
    COUNT(DISTINCT s5.user_id)  AS step5_order_placed,

    ROUND(100.0 * COUNT(DISTINCT s2.user_id) / NULLIF(COUNT(DISTINCT s1.user_id), 0), 1) AS s1_to_s2_pct,
    ROUND(100.0 * COUNT(DISTINCT s3.user_id) / NULLIF(COUNT(DISTINCT s2.user_id), 0), 1) AS s2_to_s3_pct,
    ROUND(100.0 * COUNT(DISTINCT s4.user_id) / NULLIF(COUNT(DISTINCT s3.user_id), 0), 1) AS s3_to_s4_pct,
    ROUND(100.0 * COUNT(DISTINCT s5.user_id) / NULLIF(COUNT(DISTINCT s4.user_id), 0), 1) AS s4_to_s5_pct,
    ROUND(100.0 * COUNT(DISTINCT s5.user_id) / NULLIF(COUNT(DISTINCT s1.user_id), 0), 1) AS overall_cvr

FROM step1 s1
LEFT JOIN step2 s2 ON s1.user_id = s2.user_id
LEFT JOIN step3 s3 ON s2.user_id = s3.user_id
LEFT JOIN step4 s4 ON s3.user_id = s4.user_id
LEFT JOIN step5 s5 ON s4.user_id = s5.user_id;
```

## Segment Comparison

```sql
-- Same funnel broken out by acquisition channel
SELECT
    s1.channel,
    COUNT(DISTINCT s1.user_id)  AS entered,
    COUNT(DISTINCT s5.user_id)  AS converted,
    ROUND(100.0 * COUNT(DISTINCT s5.user_id) / NULLIF(COUNT(DISTINCT s1.user_id), 0), 1) AS cvr,
    AVG(EXTRACT(EPOCH FROM (s5.step5_time - s1.step1_time))/60) AS avg_minutes_to_convert
FROM step1 s1
LEFT JOIN step5 s5 ON s1.user_id = s5.user_id
GROUP BY 1
ORDER BY cvr DESC;
```

## Python Funnel Analysis

```python
import pandas as pd
from datetime import timedelta

def compute_funnel(events_df: pd.DataFrame, steps: list[str],
                   time_window_minutes: int = 60) -> pd.DataFrame:
    """
    Compute ordered funnel conversion.
    events_df: columns [user_id, event_type, event_time]
    steps: ordered list of event types
    """
    results = []
    users_at_step = None

    for i, step in enumerate(steps):
        step_events = events_df[events_df["event_type"] == step]

        if i == 0:
            # First step: all users
            first_touch = step_events.groupby("user_id")["event_time"].min().reset_index()
            first_touch.columns = ["user_id", f"step_{i}_time"]
            users_at_step = first_touch
        else:
            # Subsequent steps: must occur AFTER previous step within window
            prev_col = f"step_{i-1}_time"
            merged = users_at_step.merge(step_events, on="user_id", how="left")
            merged = merged[
                (merged["event_time"] > merged[prev_col]) &
                (merged["event_time"] <= merged[prev_col] + timedelta(minutes=time_window_minutes))
            ]
            next_touch = merged.groupby("user_id")["event_time"].min().reset_index()
            next_touch.columns = ["user_id", f"step_{i}_time"]
            users_at_step = users_at_step.merge(next_touch, on="user_id", how="left")

        count = users_at_step[f"step_{i}_time"].notna().sum()
        results.append({"step": step, "step_index": i, "users": count})

    df = pd.DataFrame(results)
    df["conversion_from_prev"] = df["users"] / df["users"].shift(1)
    df["conversion_from_top"] = df["users"] / df["users"].iloc[0]
    return df
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No time window** | Users from months ago inflate completion rates | Set max window (e.g., 60 minutes) |
| **Counting events, not users** | Same user counted multiple times | DISTINCT user_id at each step |
| **Wrong step ordering** | Steps taken out of order included | Enforce chronological order in joins |
| **Single overall CVR** | Hides which step is the bottleneck | Show conversion at each step transition |
| **No segment analysis** | Missing that mobile drops off 3x more | Always segment by device, channel, plan |

## 10 Rules

1. Define funnel steps as specific events with a maximum time window.
2. Count distinct users at each step — not event occurrences.
3. Enforce step ordering — a user must complete step N before step N+1.
4. The biggest absolute drop-off (not just the worst rate) is the highest-ROI target.
5. Segment every funnel — the aggregate hides the story.
6. Time-to-convert is as important as conversion rate — slow funnels indicate friction.
7. Compare funnels over time — is conversion improving or degrading?
8. Session recordings at the drop-off step reveal the why.
9. Funnel analysis drives experiment hypotheses — it identifies where, not what to fix.
10. Re-entry analysis: can users re-enter the funnel after dropping? (abandoned cart recovery).
