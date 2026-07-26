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

The canonical workflow for **Funnel Analysis** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Build conversion funnel analyses to identify drop-off points and optimisation opportunities. Outputs funnel SQL queries, drop-off attribution, segment compariso
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
