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

The canonical workflow for **Cohort Analysis** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Build cohort analyses to understand user retention, behaviour over time, and revenue patterns. Outputs cohort SQL queries, retention visualisations, revenue coh
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
